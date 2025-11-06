import fs from 'node:fs';
import path from 'node:path';

type Locale = 'fr' | 'es';
type Dictionary = Record<string, unknown>;
type FlatDictionary = Record<string, string>;

const BASE_PATH = process.cwd();
const SOURCE_PATH = path.resolve(BASE_PATH, 'messages/en.json');
const TARGETS: Record<Locale, string> = {
  fr: path.resolve(BASE_PATH, 'messages/fr.json'),
  es: path.resolve(BASE_PATH, 'messages/es.json'),
};
const PATH_SEPARATOR = '§';

function flatten(input: Dictionary, prefix: string[] = [], accumulator: FlatDictionary = {}): FlatDictionary {
  if (typeof input === 'string') {
    accumulator[prefix.join(PATH_SEPARATOR)] = input;
    return accumulator;
  }

  if (Array.isArray(input)) {
    input.forEach((value, index) => {
      flatten(value as Dictionary, [...prefix, String(index)], accumulator);
    });
    return accumulator;
  }

  if (input && typeof input === 'object') {
    Object.entries(input).forEach(([key, value]) => {
      flatten(value as Dictionary, [...prefix, key], accumulator);
    });
  }

  return accumulator;
}

function loadJson(filePath: string, label: string): Dictionary {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Missing ${label} dictionary at ${filePath}`);
  }
  return JSON.parse(fs.readFileSync(filePath, 'utf8')) as Dictionary;
}

function main() {
  const source = loadJson(SOURCE_PATH, 'source');
  const sourceFlat = flatten(source);
  let hasErrors = false;

  (Object.keys(TARGETS) as Locale[]).forEach((locale) => {
    const targetPath = TARGETS[locale];
    const target = loadJson(targetPath, locale);
    const targetFlat = flatten(target);

    const missing = Object.keys(sourceFlat).filter((key) => !(key in targetFlat));
    if (missing.length) {
      hasErrors = true;
      console.error(`\n[i18n] Missing keys for ${locale}:`);
      missing.slice(0, 20).forEach((key) => console.error(` - ${key}`));
      if (missing.length > 20) {
        console.error(` ...and ${missing.length - 20} more.`);
      }
    } else {
      console.log(`[i18n] ${locale}: parity OK (${Object.keys(targetFlat).length} keys).`);
    }
  });

  if (hasErrors) {
    process.exit(1);
  }
}

main();
