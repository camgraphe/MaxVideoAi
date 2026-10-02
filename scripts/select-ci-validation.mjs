import { execFileSync } from 'node:child_process';
import { appendFileSync, readFileSync } from 'node:fs';
import { selectValidationLanes } from './_lib/ci-validation-policy.mjs';

let files;
const eventName = process.env.GITHUB_EVENT_NAME;
const exhaustive = !['push', 'pull_request'].includes(eventName);
if (!exhaustive) {
  try {
    const event = JSON.parse(readFileSync(process.env.GITHUB_EVENT_PATH, 'utf8'));
    const base = eventName === 'pull_request' ? event.pull_request.base.sha : event.before;
    const head = eventName === 'pull_request' ? event.pull_request.head.sha : event.after;
    // Validate object IDs before passing them to Git; a new branch's zero SHA
    // or unavailable history cannot prove that expensive tests are irrelevant.
    if (![base, head].every(sha => /^[a-f0-9]{40}$/.test(sha) && !/^0+$/.test(sha))) {
      throw new Error('Missing comparison revisions');
    }
    const range = eventName === 'pull_request' ? `${base}...${head}` : `${base}..${head}`;
    files = execFileSync('git', ['diff', '--name-only', '--no-renames', '-z', range, '--'], {
      encoding: 'utf8', maxBuffer: 10 * 1024 * 1024,
    }).split('\0').filter(Boolean);
  } catch {
    // Fail closed: an invalid event or Git comparison requests the full suite.
    files = undefined;
  }
}
const lanes = selectValidationLanes(files, exhaustive);
if (process.env.GITHUB_OUTPUT) {
  appendFileSync(process.env.GITHUB_OUTPUT, Object.entries(lanes).map(([name, enabled]) => `${name}=${enabled}\n`).join(''));
}
process.stdout.write(`${JSON.stringify(lanes)}\n`);
