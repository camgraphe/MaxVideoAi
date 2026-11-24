import assert from 'node:assert/strict';
import test from 'node:test';
import { NextRequest } from 'next/server';
import { handleStudioImageConversation } from '../frontend/app/api/studio/_lib/studio-image-conversation-handler';
import { getFalEngineById } from '../frontend/src/config/falEngines';
import { getDb } from '../frontend/src/lib/db';
import { handleMobileStudio } from '../frontend/src/server/mobile/studio';
import { createImageConversationService } from '../frontend/src/server/studio/image-conversation-service';
import { projectStudioQuotedReply } from '../frontend/src/server/studio/conversation-quote-reply';
import { createStudioCallRuntime } from '../scripts/qa/studio-call-runtime';

test('Studio web and mobile show the stored generation quote and keep creative replies and earlier estimates', async t => {
  const entry = getFalEngineById('gpt-image-2-5-flare')!;
  const runtime = await createStudioCallRuntime([{
    engine: entry.engine, surface: 'image', publicModes: ['t2i'],
    modeCaps: Object.fromEntries(entry.modes.map(mode => [mode.mode, mode.ui])),
  }]);
  t.after(() => runtime.close());
  const db = getDb();
  const cases = [
    { id: 'en', message: 'Please prepare a quote for one square blue paper boat. Maximum $0.05.',
      creative: 'Use a matte red table and soft side lighting. Print ‘$5’ on the cup.',
      unverified: 'Its current estimate is $0.05 USD, under your $0.05 limit.',
      amount: /\$0\.07/ },
    { id: 'fr', message: 'Bonjour, je veux un devis pour une image carrée avec un bateau. Au plus 0,05 USD.',
      creative: 'Garde la table rouge mate et une lumière latérale douce. Imprime « 5 $ » sur la tasse.',
      unverified: 'Le prix estimé est de 0,05 USD, sous votre plafond.',
      amount: /0,07\s*\$US/ },
    { id: 'es', message: 'Necesito un presupuesto para una imagen cuadrada con un barco. Hasta USD 0,05.',
      creative: 'Mantén la mesa roja mate y una luz lateral suave. Escribe «5 $» en la taza.',
      unverified: 'La tarifa es de cinco centavos, dentro de tu presupuesto.',
      amount: /0,07\s*US\$/ },
  ] as const;
  for (const scenario of cases) {
    const projectId = 'quote-reply-' + scenario.id;
    const reply = scenario.creative + ' ' + scenario.unverified;
    const submitted = await runtime.submit(projectId, scenario.message, [], async () => ({
      id: 'qa-' + scenario.id, model: 'gpt-6-luna', status: 'completed', service_tier: 'default', output_text: '',
      output: [{ type: 'function_call', name: 'image_prepare', call_id: 'qa-square', arguments: JSON.stringify({
        reply, prompt: 'A blue folded paper boat on a matte red table with soft side lighting. ' + scenario.creative,
        aspectRatio: '1:1', modelId: 'gpt-image-2-5-flare', mode: 't2i', outputCount: 1, references: [],
        settings: [{ name: 'resolution', value: '1024x1024' }, { name: 'outputFormat', value: 'png' }],
      }) }],
    }));
    assert.equal(submitted.error, undefined);
    assert.equal(submitted.quotes[0].price_cents, 7);
    const saved = (await db.query('SELECT user_id,request_id,draft_json,quote_id FROM studio_image_turns WHERE project_id=$1', [projectId])).rows[0];
    // Replay a pre-fix persisted draft without changing the original exact quote.
    await db.query("UPDATE studio_image_turns SET draft_json=jsonb_set(draft_json, '{reply}', to_jsonb($2::text)) WHERE request_id=$1", [saved.request_id, reply]);
    const web = await handleStudioImageConversation(new NextRequest('https://example.test/api/studio/projects/' + projectId + '/image-conversation'), projectId, 'read', {
      enabled: true, tasksEnabled: false, resolveAccess: async () => ({ ok: true, userId: saved.user_id }),
    });
    assert.equal(web.status, 200);
    const webTurn = (await web.json()).result.turns[0];
    const mobile = await handleMobileStudio(new NextRequest('https://example.test/api/mobile/studio/projects/' + projectId, {
      headers: { 'x-maxvideoai-auth-mode': 'bearer', authorization: 'Bearer qa-local' },
    }), projectId, {
      access: async () => ({ ok: true, userId: saved.user_id, admin: false }) as never, enabled: () => true,
      consentBlocked: async () => false, owned: async () => projectId as never,
      journal: actor => createImageConversationService(actor, { enabled: true, actionsEnabled: true }).read(),
      allowance: async () => null,
    });
    assert.equal(mobile.status, 200);
    const mobileTurn = (await mobile.json()).turns[0];
    for (const projected of [submitted.result, webTurn, mobileTurn]) {
      assert.ok(projected.reply.includes(scenario.creative));
      assert.match(projected.reply, scenario.amount);
      assert.doesNotMatch(projected.reply, /before confirming|avant de confirmer|antes de confirmar/i);
      assert.ok(!projected.reply.includes(scenario.unverified));
    }
    assert.deepEqual(webTurn.quote, submitted.result?.quote);
    assert.equal(webTurn.quote.quoteId, saved.quote_id);
    assert.equal(mobileTurn.quote.amountCents, 7);
    assert.equal(mobileTurn.quote.currency, webTurn.quote.price.currency);
    assert.equal((await db.query('SELECT draft_json FROM studio_image_turns WHERE request_id=$1', [saved.request_id])).rows[0].draft_json.reply, reply);
    assert.deepEqual(submitted.counts, { jobs: 0, charges: 0 });
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
  assert.equal(projectStudioQuotedReply(direction, { message: 'Please create a cup graphic.' }, direction, quote), direction);
  assert.equal(projectStudioQuotedReply(direction + ' It will cost five cents.', { message: 'Please create a cup graphic.' }, direction, quote),
    direction + '\n\nGeneration quote · $0.07.');
});
