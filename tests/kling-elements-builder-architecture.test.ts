import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const builderPath = 'frontend/components/KlingElementsBuilder.tsx';

test('Kling subject video references expose the same library action as image references', () => {
  const source = readFileSync(builderPath, 'utf8');

  assert.match(
    source,
    /onOpenLibrary\?: \(elementId: string, slot: 'frontal' \| 'reference' \| 'video', index\?: number\) => void;/,
    'KlingElementsBuilder should allow opening the library for video reference slots'
  );
  assert.match(
    source,
    /onOpenLibrary=\{\s+onOpenLibrary\s+\? \(\) => onOpenLibrary\(element\.id, 'video'\)\s+: undefined\s+\}/,
    'the Video reference slot should wire the library handler'
  );
  assert.match(
    source,
    /<AssetFieldTooltip/,
    'Kling subject reference helper copy should use the shared asset tooltip treatment'
  );
  assert.doesNotMatch(
    source,
    /<p className="text-\[12px\] text-text-muted">\s+Use a frontal image plus at least one reference image/,
    'Kling subject reference helper copy should not consume vertical placeholder space'
  );
});

test('Kling subject reference slots use the shared media picker placeholder pattern', () => {
  const source = readFileSync(builderPath, 'utf8');

  assert.match(
    source,
    /import \{ AssetMediaPickerMenu \} from '@\/components\/asset-dropzone\/AssetMediaPickerMenu';/,
    'KlingElementsBuilder should reuse the shared media picker menu'
  );
  assert.match(
    source,
    /const inputRef = useRef<HTMLInputElement \| null>\(null\);/,
    'Kling subject asset slots should keep upload inputs hidden behind the media picker'
  );
  assert.match(
    source,
    /<AssetMediaPickerMenu[\s\S]+copy=\{assetCopy\}[\s\S]+canOpenLibrary=\{allowLibrary\}[\s\S]+onLibrary=\{triggerLibrary\}[\s\S]+onUpload=\{triggerUpload\}/,
    'Kling subject slots should route Upload and Library through the shared picker popup'
  );
  assert.match(
    source,
    /<Plus className="h-5 w-5" aria-hidden \/>/,
    'empty Kling subject slots should show a plus-only placeholder'
  );
  assert.doesNotMatch(
    source,
    />\s*Upload\s*<\/label>|>\s*Library\s*<\/Button>/,
    'empty Kling subject placeholders should not render inline Upload or Library buttons'
  );
});
