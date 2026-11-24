import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import test from 'node:test';
import { getFalEngineById } from '../frontend/src/config/falEngines';
import { query } from '../frontend/src/lib/db';
import { createStudioCallRuntime } from '../scripts/qa/studio-call-runtime';
import type { StudioResponseCreator } from '../frontend/src/server/studio/conversation-director';

test('a free revision and subsequent framing keep the source of the active visual brief', async (t) => {
  const prior = process.env.DATABASE_URL;
  delete process.env.DATABASE_URL;
  const engine = getFalEngineById('gpt-image-2-5-flare')!;
  const studio = await createStudioCallRuntime([
    {
      engine: engine.engine,
      surface: 'image',
      publicModes: ['i2i'],
      modeCaps: Object.fromEntries(engine.modes.map((mode) => [mode.mode, mode.ui])),
    },
  ]);
  t.after(async () => {
    await studio.close();
    if (prior !== undefined) process.env.DATABASE_URL = prior;
  });
  const direction =
    'Je préférerais une troisième piste : une affiche de science-fiction, moi en tenue de cosmonaute. Garde mon visage.';
  const framing = 'En neuf 16 en vertical en fait';
  const offer =
    'Voici deux directions pour ta photo : un portrait de cinéma ou une couverture de magazine. Laquelle veux-tu explorer ?';
  const missing = 'Pour garder ton visage, joins à nouveau ta photo. Je pourrai alors préparer cette direction.';
  function answer(reply: string): StudioResponseCreator {
    return async () => ({
      id: randomUUID(),
      model: 'gpt-6-luna',
      status: 'completed',
      service_tier: 'default',
      output_text: JSON.stringify({ reply }),
      output: [],
    });
  }
  async function start(id: string, keys = ['portrait'], reply = offer) {
    const first = await studio.submit(id, 'Quelles pistes proposes-tu pour ce portrait ?', keys, answer(reply));
    assert.equal(first.error, undefined);
    return first;
  }
  async function follow(id: string, message: string, reply: string) {
    const images: string[] = [];
    const checked: StudioResponseCreator = async (params, ...rest) => {
      const payload = studio.responseParams(params);
      // Inspect the actual visual input offered to the Responses API after normal ownership resolution.
      for (const item of Array.isArray(payload.input) ? payload.input : []) {
        if (!('content' in item) || !Array.isArray(item.content)) continue;
        for (const part of item.content) {
          if (part.type === 'input_image' && part.image_url?.startsWith('data:')) {
            const bytes = Buffer.from(part.image_url.split(',')[1], 'base64');
            images.push(createHash('sha256').update(bytes).digest('hex'));
          }
        }
      }
      return answer(reply)(params, ...rest);
    };
    const turn = await studio.submit(id, message, [], checked);
    assert.equal(turn.error, undefined);
    assert.deepEqual(turn.result?.references, []);
    assert.equal(turn.result?.quote, null);
    assert.deepEqual(turn.counts, { jobs: 0, charges: 0 });
    return { turn, images };
  }
  // Recreate a saved ready reply written by the old director without re-running it or importing media.
  async function historical(id: string, message: string, reply: string) {
    const requestId = randomUUID();
    await query(
      `INSERT INTO studio_image_turns(user_id,project_id,request_id,request_hash,input_json,draft_json,
        draft_reference_fingerprint,state,lease_id,lease_expires_at)
      SELECT user_id,project_id,$2,$3,$4,$5,$3,'ready',$6,clock_timestamp()
      FROM studio_image_turns WHERE project_id=$1 ORDER BY created_at LIMIT 1`,
      [
        id,
        requestId,
        'a'.repeat(64),
        { requestId, message, references: [], locale: 'fr' },
        { reply, image: null },
        randomUUID(),
      ],
    );
  }

  await t.test('the third direction and its dictated framing each receive the original pixels', async () => {
    const id = 'current-visual-brief',
      first = await start(id);
    const hash = first.fixtureReferences[0].sha256;
    assert.deepEqual(
      (await follow(id, direction, 'On garde ton visage pour cette affiche. Quel cadrage souhaites-tu ?')).images,
      [hash],
    );
    assert.deepEqual((await follow(id, framing, 'Je garde cette direction en 9:16.')).images, [hash]);
    const rows = await query<{ sent: number; recalled: string | null }>(
      `SELECT jsonb_array_length(input_json->'references') AS sent,
      draft_json#>>'{recalledReferences,0,assetId}' AS recalled FROM studio_image_turns WHERE project_id=$1 ORDER BY created_at`,
      [id],
    );
    assert.deepEqual(rows, [
      { sent: 1, recalled: null },
      { sent: 0, recalled: studio.referenceId(id, 'portrait') },
      { sent: 0, recalled: studio.referenceId(id, 'portrait') },
    ]);
  });
  for (const [i, retry] of [framing, 'Elle est juste au-dessus.'].entries())
    await t.test('reopen two old reattachment replies ' + i, async () => {
      const id = 'old-visual-brief-' + i,
        first = await start(id);
      await historical(id, direction, missing);
      await historical(id, framing, 'Le format vertical est noté. Peux-tu joindre ta photo pour la retouche ?');
      assert.deepEqual((await follow(id, retry, 'Je retrouve le portrait.')).images, [
        first.fixtureReferences[0].sha256,
      ]);
    });
  for (const [i, alternative] of [
    'A torn-paper collage, with the original face unchanged.',
    'Un grabado en tinta con mi rostro.',
  ].entries())
    await t.test('another creative direction ' + i, async () => {
      const id = 'other-direction-' + i,
        first = await start(
          id,
          ['portrait'],
          i
            ? 'Dos ideas para tu retrato: cine o revista. ¿Cuál prefieres?'
            : 'Two ideas for your portrait: a film still or a magazine cover. Which do you prefer?',
        );
      assert.deepEqual((await follow(id, alternative, 'OK.')).images, [first.fixtureReferences[0].sha256]);
    });
  await t.test('conversational requests distinguish edits from unrelated tasks after the same offer', async () => {
    const cases: Array<[string, boolean]> = [
      ['Peux-tu me mettre en combinaison argentée ?', true],
      ['Could you put me in a spacesuit?', true],
      ['¿Me puedes poner un traje espacial?', true],
      ['En noir et blanc, avec la lumière qui vient de côté.', true],
      ['Black and white, with the light coming from the side.', true],
      ['En blanco y negro, con luz lateral.', true],
      ['Je veux savoir combien de crédits il me reste.', false],
      ['I want to know how many credits I have left.', false],
      ['Quiero saber cuántos créditos me quedan.', false],
      ['Je voudrais un texte d’anniversaire.', false],
      ['A shopping list for tomorrow.', false],
      ['Comment changer la photo de mon compte ?', false],
      ['Je veux organiser mon anniversaire.', false],
    ];
    for (const [i, [message, expected]] of cases.entries()) {
      const id = 'spoken-edit-' + i;
      const first = await start(id);
      assert.deepEqual(
        (await follow(id, message, 'OK.')).images,
        expected ? [first.fixtureReferences[0].sha256] : [],
        message,
      );
    }
  });
  await t.test('pricing.compare sees only the active portrait on the free direction', async () => {
    const id = 'creative-comparison';
    await start(id);
    const assetId = studio.referenceId(id, 'portrait');
    const compare = (source: string) => ({
      surface: 'image',
      mode: 'i2i',
      prompt: 'Keep the face and light the portrait for a poster.',
      baselineModelId: engine.engine.id,
      candidateModelIds: [engine.engine.id],
      settings: [{ name: 'resolution', value: 'portrait_4_3' }],
      references: [{ ref: { type: 'asset', kind: 'image', assetId: source }, role: 'reference', slot: null }],
      outputCount: 1,
    });
    let calls = 0;
    const comparison = await studio.submit(id, direction, [], async () => {
      calls++;
      return {
        id: randomUUID(),
        model: 'gpt-6-luna',
        status: 'completed',
        service_tier: 'default',
        output_text: calls > 2 ? JSON.stringify({ reply: 'Une option a été chiffrée.' }) : '',
        output:
          calls > 2
            ? []
            : [
                {
                  type: 'function_call',
                  name: 'pricing_compare',
                  call_id: 'comparison-' + calls,
                  arguments: JSON.stringify(compare(calls === 1 ? studio.referenceId(id, 'watch') : assetId)),
                },
              ],
      };
    });
    assert.equal(comparison.error, undefined);
    const [outside, selected] = comparison.steps.map((step) => step.result);
    assert.ok(!outside.ok && outside.error.code === 'REFERENCE_INVALID');
    assert.ok(selected?.ok && selected.action === 'pricing.compare', JSON.stringify(selected));
    assert.ok(selected.data.options.some((option) => option.price.amountCents > 0));
    assert.equal(comparison.result?.quote, null);
    assert.deepEqual(comparison.quotes, []);
    assert.deepEqual(comparison.counts, { jobs: 0, charges: 0 });
  });
  await t.test('independent text, excluded files and a different project have no pixels', async () => {
    const id = 'separate-text';
    await start(id);
    assert.deepEqual((await follow(id, 'Écris un texte de présentation pour mon site.', 'Voici le texte.')).images, []);
    assert.deepEqual((await follow(id, framing, 'OK.')).images, []);
    assert.deepEqual((await follow('different-project', framing, 'OK.')).images, []);
    const excluded = 'excluded-source';
    await start(excluded);
    await historical(excluded, 'Ignore Image 1.', 'Compris.');
    assert.deepEqual((await follow(excluded, direction, 'OK.')).images, []);
  });
  await t.test('two candidate photos need a choice and deleted media cannot be recalled', async () => {
    const id = 'ambiguous-portrait';
    await start(id, ['portrait', 'watch']);
    const result = await follow(id, direction, 'The director should not need to choose.');
    assert.deepEqual(result.images, []);
    assert.match(result.turn.result?.reply ?? '', /Image 1.*Image 2/);
    const unavailable = 'deleted-portrait';
    await start(unavailable);
    await query('UPDATE media_assets SET deleted_at=clock_timestamp() WHERE public_id=$1', [
      studio.referenceId(unavailable, 'portrait'),
    ]);
    const missing = await follow(unavailable, direction, 'No model call');
    assert.deepEqual(missing.images, []);
    assert.match(missing.turn.result?.reply ?? '', /lire|read/);
  });
});
