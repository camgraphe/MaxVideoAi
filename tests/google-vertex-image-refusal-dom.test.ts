import assert from 'node:assert/strict';
import test from 'node:test';
import { mountToolFixture } from './helpers/tool-selection-fixture';

test('the French image workspace shows the Google refusal and only the confirmed wallet recredit', async () => {
  const fixture = await mountToolFixture(`
    import {I18nProvider} from './lib/i18n/I18nProvider';
    import {writeLastKnownUserId} from './src/lib/last-known';
    import {getFalEngineById} from './src/config/falEngines';
    import {useImageComposerValues} from './app/(core)/(workspace)/app/image/_hooks/useImageComposerValues';
    import {useImageGenerationRunner} from './app/(core)/(workspace)/app/image/_hooks/useImageGenerationRunner';
    import {DEFAULT_COPY} from './app/(core)/(workspace)/app/image/_lib/image-workspace-copy';

    writeLastKnownUserId('fixture-owner');
    const entry = getFalEngineById('nano-banana-pro');
    function Surface() {
      const values = useImageComposerValues(entry.id);
      const [error, setError] = useState(null);
      const [, setPendingGroups] = useState([]);
      const submit = useImageGenerationRunner({
        ...values, prompt: 'A product photo',
        selectedEngine: { id: entry.id, name: entry.marketingName, engineCaps: entry.engine },
        combinedReferenceUrls: [], readyReferenceUrls: [], readyReferenceSizes: [], referenceMinRequired: 0,
        selectedCharacterReferences: [], resolvedCopy: DEFAULT_COPY, mutateJobs: async () => {},
        setAuthModalOpen: noop, setError, setLocalHistory: noop, setPendingGroups,
        setSelectedPreviewEntryId: noop, setSelectedPreviewImageIndex: noop, setStatusMessage: noop,
      });
      return <form onSubmit={submit}><button>Generate</button><output role="alert">{error}</output></form>;
    }
    function App() {
      return <I18nProvider locale="fr" dictionary={{}} fallback={{}}><Surface /></I18nProvider>;
    }
  `, {
    '@/lib/supabaseClient': "export const supabase={auth:{getSession:async()=>({data:{session:{access_token:'offline-session'}}})}};",
    '@/lib/authFetch': 'export const authFetch = (url, init) => window.fixtureFetch(url, init);',
  });
  try {
    const submit = fixture.w.document.querySelector('button');
    const alert = fixture.w.document.querySelector('[role="alert"]');
    for (const [message, expected] of [
      ['Google blocked the generated image during its moderation checks. The amount was returned to your wallet.',
        'Google a bloqué l’image générée lors de ses contrôles de modération. Le montant a été recrédité sur votre portefeuille.'],
      ['Google stopped image generation during its moderation checks.',
        'Google a interrompu la génération lors de ses contrôles de modération.'],
    ]) {
      await fixture.act(async () => submit.click());
      const request = fixture.w.requests.at(-1);
      assert.equal(request.url, '/api/images/generate');
      await fixture.respond(request, { ok: false, error: { code: 'google_vertex_image_safety_block', message } }, 422);
      assert.equal(alert.textContent, expected);
    }
  } finally {
    await fixture.close();
  }
});
