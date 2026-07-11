import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

const runtimeModalsPath = 'frontend/app/(core)/(workspace)/app/image/_components/ImageWorkspaceRuntimeModals.tsx';
const galleryRailPath = 'frontend/app/(core)/(workspace)/app/image/_components/ImageWorkspaceGalleryRail.tsx';
const advancedSettingsPath = 'frontend/components/ImageAdvancedSettings.tsx';
const advancedContentPath = 'frontend/components/image-advanced-settings/ImageAdvancedSettingsContent.tsx';

test('image workspace defers closed conversion modals', () => {
  const source = readFileSync(runtimeModalsPath, 'utf8');

  assert.match(source, /dynamic(?:<[^>]+>)?\(\s*\(\) => import\('\.\/ImageAuthGateModal'\)/);
  assert.match(source, /dynamic(?:<[^>]+>)?\(\s*\(\) => import\('\.\/ImageLibraryModal'\)/);
  assert.doesNotMatch(source, /import \{ ImageAuthGateModal \} from/);
  assert.doesNotMatch(source, /import \{ ImageLibraryModal \} from/);
  assert.match(source, /authModalOpen \? \([\s\S]*<ImageAuthGateModal/);
  assert.match(source, /libraryModal\.open \? \([\s\S]*<ImageLibraryModal/);
});

test('image advanced fields load only after the stable toggle is expanded', () => {
  assert.equal(existsSync(advancedContentPath), true);
  const wrapperSource = readFileSync(advancedSettingsPath, 'utf8');
  const contentSource = readFileSync(advancedContentPath, 'utf8');

  assert.match(
    wrapperSource,
    /dynamic(?:<[^>]+>)?\(\s*\(\) =>\s*import\('\.\/image-advanced-settings\/ImageAdvancedSettingsContent'\)/
  );
  assert.match(wrapperSource, /isOpen \? \(\s*<ImageAdvancedSettingsContent/);
  assert.doesNotMatch(wrapperSource, /import \{ SelectMenu \}/);
  assert.match(contentSource, /export function ImageAdvancedSettingsContent/);
  assert.match(contentSource, /<SelectMenu/);
});

test('image workspace prioritizes the composer before the secondary gallery rail', () => {
  const source = readFileSync(galleryRailPath, 'utf8');

  assert.match(source, /dynamic(?:<[^>]+>)?\(\s*\(\) => import\('@\/components\/GalleryRail'\)/);
  assert.match(source, /loading: \(\) => <GalleryRailSkeleton \/>/);
  assert.doesNotMatch(source, /import \{ GalleryRail \} from/);
});
