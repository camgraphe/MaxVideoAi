import { readFile, writeFile } from 'node:fs/promises';
import { assertPrivateReviewPath, buildNano21PrivateReview } from './lib/nano21-editorial-review';

async function main() {
  const [input, output, ...extra] = process.argv.slice(2);
  if (!input || !output || extra.length) throw new Error('Usage: preview-nano21-editorial.ts /absolute/private-draft.json /absolute/private-review.html');
  await assertPrivateReviewPath(input);
  await assertPrivateReviewPath(output);
  const html = await buildNano21PrivateReview(JSON.parse(await readFile(input, 'utf8')));
  await writeFile(output, html, { flag: 'wx', mode: 0o600 });
  process.stdout.write('Private local draft review created. No publication or generation.\n');
}
main().catch(error => { process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`); process.exitCode = 1; });
