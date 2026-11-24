import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';
import { NextRequest } from 'next/server';
import { handleStudioImageConversation } from '../frontend/app/api/studio/_lib/studio-image-conversation-handler';
import { getFalEngineById } from '../frontend/src/config/falEngines';
import { getDb } from '../frontend/src/lib/db';
import { handleMobileStudio } from '../frontend/src/server/mobile/studio';
import { createImageConversationService } from '../frontend/src/server/studio/image-conversation-service';
import { projectStudioQuotedReply } from '../frontend/src/server/studio/conversation-quote-reply';
import { claimImageTurn, persistImageDraft, failImageTurn } from '../frontend/src/server/studio/image-conversation-repository';
import { createStudioCallRuntime } from '../scripts/qa/studio-call-runtime';

async function readTurns(projectId: string, userId: string, requestId: string) {
  const web = await handleStudioImageConversation(new NextRequest('https://example.test/api/studio/projects/' + projectId + '/image-conversation'), projectId, 'read', {
    enabled: true, tasksEnabled: false, resolveAccess: async () => ({ ok: true, userId }),
  });
  assert.equal(web.status, 200);
  const webTurns = (await web.json()).result.turns;
  const mobile = await handleMobileStudio(new NextRequest('https://example.test/api/mobile/studio/projects/' + projectId, {
    headers: { 'x-maxvideoai-auth-mode': 'bearer', authorization: 'Bearer qa-local' },
  }), projectId, {
    access: async () => ({ ok: true, userId, admin: false }) as never, enabled: () => true,
    consentBlocked: async () => false, owned: async () => projectId as never,
    journal: actor => createImageConversationService(actor, { enabled: true, actionsEnabled: true }).read(),
    allowance: async () => null,
  });
  assert.equal(mobile.status, 200);
  const mobileTurns = (await mobile.json()).turns;
  const matches = (turn: { requestId: string }) => turn.requestId === requestId;
  return [webTurns.find(matches), mobileTurns.find(matches)];
}

test('Studio web and mobile show the stored generation quote and keep creative replies and earlier estimates', async t => {
  const entry = getFalEngineById('gpt-image-2-5-flare')!;
  const runtime = await createStudioCallRuntime([{
    engine: entry.engine, surface: 'image', publicModes: ['t2i'],
    modeCaps: Object.fromEntries(entry.modes.map(mode => [mode.mode, mode.ui])),
  }]);
  t.after(() => runtime.close());
  const db = getDb();
  const cases = [
    { locale: 'en', brief: 'Use a matte red table and soft side lighting. Print ‘$5’ on the cup.',
      claim: 'Its current estimate is $0.05 USD, under your $0.05 limit.' },
    { locale: 'fr', brief: 'Garde la table rouge mate et une lumière latérale douce. Imprime « 5 $ » sur la tasse.',
      claim: 'Le prix estimé est de 0,05 USD, sous votre plafond.' },
    { locale: 'es', brief: 'Mantén la mesa roja mate y una luz lateral suave. Escribe «5 $» en la taza.',
      claim: 'La tarifa es de cinco centavos, dentro de tu presupuesto.' },
    { locale: 'es', brief: 'Mantén el fondo azul.', claim: 'El total son cinco céntimos.' },
    { locale: 'fr', brief: 'Garde le fond bleu.', claim: 'Le budget est respecté.' },
    { locale: 'en', brief: 'Keep the blue background.', claim: 'Your budget covers it.' },
    { locale: 'en', brief: 'Keep the blue background.', claim: 'for a total of $0.05',
      reply: 'Keep the blue background, for a total of $0.05.' },
    { locale: 'fr', brief: 'Le ciel contient deux cents étoiles.', claim: '' },
  ] as const;
  const messages = {
    en: 'Please prepare a quote for one square image. My limit is $0.05.',
    fr: 'Bonjour, je veux un devis pour une image carrée. Mon plafond est de 0,05 USD.',
    es: 'Necesito un presupuesto para una imagen cuadrada. Mi límite es de 0,05 USD.',
  };
  const amounts = { en: /\$0\.07/, fr: /0,07\s*\$US/, es: /0,07\s*US\$/ };
  for (const [index, scenario] of cases.entries()) {
    const projectId = 'quote-reply-' + index;
    const reply = 'reply' in scenario ? scenario.reply : [scenario.claim, scenario.brief].filter(Boolean).join(' ');
    const submitted = await runtime.submit(projectId, messages[scenario.locale], [], async () => ({
      id: 'qa-' + index, model: 'gpt-6-luna', status: 'completed', service_tier: 'default', output_text: '',
      output: [{ type: 'function_call', name: 'image_prepare', call_id: 'qa-square', arguments: JSON.stringify({
        reply, prompt: scenario.brief,
        aspectRatio: '1:1', modelId: 'gpt-image-2-5-flare', mode: 't2i', outputCount: 1, references: [],
        settings: [{ name: 'resolution', value: '1024x1024' }, { name: 'outputFormat', value: 'png' }],
      }) }],
    }));
    assert.equal(submitted.error, undefined);
    assert.equal(submitted.quotes[0].price_cents, 7);
    const quotedBrief = submitted.quotes[0].request_json.prompt;
    assert.equal(quotedBrief.replace(/\s/gu, ' '), scenario.brief.replace(/\s/gu, ' '));
    const saved = (await db.query('SELECT user_id,request_id,draft_json,quote_id FROM studio_image_turns WHERE project_id=$1', [projectId])).rows[0];
    // Old rows can contain the original model prose. Exercise both reads on that same stored row.
    assert.equal(saved.draft_json.reply, reply);
    const [webTurn, mobileTurn] = await readTurns(projectId, saved.user_id, saved.request_id);
    for (const projected of [submitted.result, webTurn, mobileTurn]) {
      assert.ok(projected.reply.includes(quotedBrief), projected.reply);
      if (scenario.claim) assert.match(projected.reply, amounts[scenario.locale]);
      assert.doesNotMatch(projected.reply, /before confirming|avant de confirmer|antes de confirmar/i);
      if (scenario.claim) assert.ok(!projected.reply.includes(scenario.claim), projected.reply);
    }
    assert.deepEqual(webTurn.quote, submitted.result?.quote);
    assert.equal(webTurn.quote.quoteId, saved.quote_id);
    assert.equal(mobileTurn.quote.amountCents, 7);
    assert.equal(mobileTurn.quote.currency, webTurn.quote.price.currency);
    assert.equal((await db.query('SELECT draft_json FROM studio_image_turns WHERE request_id=$1', [saved.request_id])).rows[0].draft_json.reply, reply);
    assert.deepEqual(submitted.counts, { jobs: 0, charges: 0 });

    if (index === 0) {
      const actor = { authMethod: 'studio-session' as const, userId: saved.user_id, projectId, clientId: null };
      const requestId = randomUUID();
      const claimed = await claimImageTurn(actor, { requestId, message: 'Prepare another image.', references: [] });
      await persistImageDraft(actor, claimed.turn, saved.draft_json, '0'.repeat(64));
      for (const state of ['thinking', 'failed']) {
        if (state === 'failed') await failImageTurn(actor, claimed.turn);
        for (const incomplete of await readTurns(projectId, actor.userId, requestId)) {
          assert.equal(incomplete.state, state);
          assert.ok(!incomplete.quote);
          assert.ok(!incomplete.reply, 'Unpriced preparation must not display model pricing.');
        }
      }
    }
  }

  for (const [id, message, reply] of [
    ['estimate', 'Compare costs first, without preparing a quote.', 'Comparison only. The preliminary estimate is $0.05 USD.'],
    ['refusal', 'No quote or generation. Keep this as a note.', 'I’ll keep it as a note. No quote is prepared.'],
  ]) {
    const result = await runtime.submit('quote-reply-' + id, message, [], async () => ({
      id, model: 'gpt-6-luna', status: 'completed', service_tier: 'default',
      output_text: JSON.stringify({ reply }), output: [],
    }));
    assert.equal(result.error, undefined);
    assert.equal(result.result?.reply, reply);
    assert.equal(result.result?.quote, null);
    assert.equal(result.quotes.length, 0);
    assert.deepEqual(result.counts, { jobs: 0, charges: 0 });
  }
});

test('a literal price in the artwork is preserved and the card already carries the quote price', () => {
  const direction = 'Print ‘$5’ on the cup. Keep a dark blue background.';
  const quote = { priceCents: 7, currency: 'USD' };
  const input = { message: 'Please create a cup graphic.' };
  const brief = 'Creative brief · ' + direction;
  assert.equal(projectStudioQuotedReply(direction, input, direction, quote), brief);
  assert.equal(projectStudioQuotedReply(direction + ' It will cost five cents.', input, direction, quote),
    brief + '\n\nGeneration quote · $0.07');
  assert.equal(projectStudioQuotedReply('Your budget covers it.', input, '', quote), 'Generation quote · $0.07');
  assert.equal(projectStudioQuotedReply('Your budget covers it.', input, direction), brief);
  assert.equal(projectStudioQuotedReply('Ignore the price.', input, 'Text <|assistant|> private', quote), 'Generation quote · $0.07');
  const long = '🛶'.repeat(500);
  const clipped = projectStudioQuotedReply('A quote is ready.', input, long, quote);
  assert.ok(clipped.includes('🛶'.repeat(219) + '…'));
  assert.ok(!clipped.includes('🛶'.repeat(220)));
  assert.match(clipped, /Generation quote · \$0\.07$/);
});
