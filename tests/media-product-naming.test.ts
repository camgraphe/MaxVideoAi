import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { audioCreationCopy } from '../frontend/app/(core)/(workspace)/app/audio/_lib/audio-creation-copy';
import { DEFAULT_COPY as DEFAULT_IMAGE_COPY } from '../frontend/app/(core)/(workspace)/app/image/_lib/image-workspace-copy';
import { DEFAULT_LIBRARY_COPY } from '../frontend/app/(core)/(workspace)/app/library/_lib/library-page-helpers';
import { DEFAULT_STUDIO_COPY } from '../frontend/app/(core)/(workspace)/app/studio/_lib/studio-copy';
import { DEFAULT_JOBS_COPY } from '../frontend/app/(core)/jobs/_lib/jobs-copy';
import { workspaceReferenceCopy } from '../frontend/components/composer/workspace-reference-copy';
import { ASSET_DROPZONE_COPY } from '../frontend/lib/ltx-asset-dropzone-copy';
import { DEFAULT_ANGLE_COPY } from '../frontend/src/components/tools/angle/_lib/angle-workspace-copy';
import { DEFAULT_BACKGROUND_REMOVAL_COPY } from '../frontend/src/components/tools/background-removal/_lib/background-removal-workspace-copy';
import { DEFAULT_CHARACTER_COPY } from '../frontend/src/components/tools/character-builder/_lib/character-builder-copy';
import { toolboxCopy } from '../frontend/src/components/tools/toolbox-copy';
import { DEFAULT_UPSCALE_COPY } from '../frontend/src/components/tools/upscale/_lib/upscale-workspace-copy';
import { upscaleWorkspaceLabels } from '../frontend/src/components/tools/upscale/_lib/upscale-workspace-labels';

const localeExpectations = {
  en: { destination: 'Media', picker: 'Choose from Media', add: 'Add to Media', remove: 'Remove from Media', saved: 'Saved to Media.' },
  fr: { destination: 'Médias', picker: 'Choisir dans Médias', add: 'Ajouter à Médias', remove: 'Retirer de Médias', saved: 'Enregistré dans Médias.' },
  es: { destination: 'Medios', picker: 'Elegir en Medios', add: 'Agregar a Medios', remove: 'Quitar de Medios', saved: 'Guardado en Medios.' },
} as const;

test('workspace navigation dictionaries call the global destination Media', () => {
  for (const locale of ['en', 'fr', 'es'] as const) {
    const expected = localeExpectations[locale];
    const dictionary = JSON.parse(readFileSync(`frontend/messages/${locale}.json`, 'utf8'));
    assert.equal(dictionary.workspace.header.quickNav.library, expected.destination, `${locale} quick navigation`);
    assert.equal(dictionary.workspace.sidebar.links.library, expected.destination, `${locale} account navigation`);
    assert.equal(dictionary.workspace.sidebar.shortLabels.library, expected.destination, `${locale} compact navigation`);
    assert.equal(dictionary.workspace.studio.topbar.navigationLabels.library, expected.destination, `${locale} Studio account navigation`);
  }
});

test('authenticated app actions and destination pages consistently name Media', () => {
  for (const locale of ['en', 'fr', 'es'] as const) {
    const expected = localeExpectations[locale];
    const dictionary = JSON.parse(readFileSync(`frontend/messages/${locale}.json`, 'utf8'));
    assert.equal(dictionary.workspace.library.hero.title, expected.destination, `${locale} Media page title`);
    assert.equal(dictionary.workspace.library.assets.title, expected.destination, `${locale} Media asset heading`);
    assert.equal(dictionary.workspace.jobs.actions.addToLibrary, expected.add, `${locale} Activity add action`);
    assert.equal(dictionary.workspace.jobs.actions.removeFromLibrary, expected.remove, `${locale} Activity remove action`);
    assert.equal(dictionary.workspace.image.messages.savedToLibrary, expected.saved, `${locale} image saved state`);
    assert.equal(dictionary.workspace.backgroundRemoval.library, expected.destination, `${locale} Background Removal source`);
    assert.equal(dictionary.workspace.backgroundRemoval.saved, expected.saved, `${locale} Background Removal saved state`);
  }

  assert.equal(DEFAULT_LIBRARY_COPY.hero.title, 'Media');
  assert.equal(DEFAULT_LIBRARY_COPY.review.saveButton, 'Save to Media');
  assert.equal(DEFAULT_JOBS_COPY.actions.addToLibrary, 'Add to Media');
  assert.equal(DEFAULT_IMAGE_COPY.messages.savedToLibrary, 'Saved to Media.');
  assert.equal(DEFAULT_BACKGROUND_REMOVAL_COPY.saved, 'Saved to Media.');
  assert.equal(DEFAULT_ANGLE_COPY.addToLibrary, 'Add to Media');
  assert.equal(DEFAULT_CHARACTER_COPY.savedToLibrary, 'Saved to Media.');
  assert.equal(DEFAULT_UPSCALE_COPY.saved, 'Saved to Media.');
});

test('contextual library entry points use an action that names Media', () => {
  for (const locale of ['en', 'fr', 'es'] as const) {
    const expected = localeExpectations[locale];
    const dictionary = JSON.parse(readFileSync(`frontend/messages/${locale}.json`, 'utf8'));
    assert.equal(workspaceReferenceCopy(locale).library, expected.picker, `${locale} video reference picker`);
    assert.equal(ASSET_DROPZONE_COPY[locale].library, expected.picker, `${locale} asset dropzone picker`);
    assert.equal(audioCreationCopy(locale).library, expected.picker, `${locale} audio reference picker`);
    assert.equal(toolboxCopy(locale).library, expected.picker, `${locale} tool source picker`);
    assert.equal(dictionary.workspace.image.library.modal.title, expected.picker, `${locale} image picker title`);
    assert.equal(dictionary.workspace.toolsAngle.library, expected.picker, `${locale} Angle picker action`);
    assert.equal(dictionary.workspace.characterBuilder.library.open, expected.picker, `${locale} Character Builder picker action`);
    assert.equal(dictionary.workspace.studio.assetLibrary.library, expected.picker, `${locale} Studio global picker title`);
  }

  assert.equal(DEFAULT_IMAGE_COPY.library.modal.title, localeExpectations.en.picker);
  assert.equal(DEFAULT_ANGLE_COPY.libraryChoose, localeExpectations.en.picker);
  assert.equal(DEFAULT_CHARACTER_COPY.library.open, localeExpectations.en.picker);
  assert.equal(DEFAULT_UPSCALE_COPY.libraryTitle, localeExpectations.en.picker);
  assert.equal(upscaleWorkspaceLabels('fr').libraryTitle, localeExpectations.fr.picker);
  assert.equal(upscaleWorkspaceLabels('es').libraryTitle, localeExpectations.es.picker);
});

test('Studio keeps Project media distinct from the global Media destination', () => {
  const english = JSON.parse(readFileSync('frontend/messages/en.json', 'utf8'));
  assert.equal(DEFAULT_STUDIO_COPY.viewer.projectMedia.title, 'Project media');
  assert.equal(DEFAULT_STUDIO_COPY.viewer.projectMedia.sidebarLabel, 'Project media');
  assert.equal(DEFAULT_STUDIO_COPY.assetLibrary.importProjectMediaSubtitle, 'Import media into Project media');
  assert.equal(english.workspace.studio.viewer.projectMedia.title, 'Project media');
  assert.equal(english.workspace.studio.viewer.projectMedia.sidebarLabel, 'Project media');
  assert.equal(english.workspace.studio.assetLibrary.importProjectMediaSubtitle, 'Import media into Project media');
});

test('app fallbacks do not reintroduce Library as a second destination', () => {
  const fallbackFiles = [
    'frontend/app/(core)/(workspace)/app/_hooks/useWorkspaceAssetLibrary.ts',
    'frontend/app/(core)/(workspace)/app/_lib/workspace-assets.ts',
    'frontend/app/(core)/(workspace)/app/image/_components/ImageLibraryModal.tsx',
    'frontend/app/(core)/(workspace)/app/image/_hooks/useImageLibraryData.ts',
    'frontend/src/components/tools/background-removal/_hooks/useBackgroundRemovalRecentActions.ts',
    'frontend/src/components/tools/upscale/_hooks/useUpscaleLibraryAssets.ts',
  ];
  const source = fallbackFiles.map(file => readFileSync(file, 'utf8')).join('\n');
  assert.doesNotMatch(source, /Saved to library|access your (?:image|video) library|Pick an? (?:image|video) from the (?:image |video )?library|Failed to load library/);
});
