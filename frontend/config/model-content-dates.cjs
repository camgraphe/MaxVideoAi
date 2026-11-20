const { execFileSync } = require('node:child_process');
const path = require('node:path');
const baseline = require('./model-content-date-baseline.json');

// Bundle one snapshot for both the static model sitemap and the serverless index.
// A shallow clone's boundary commit cannot date the files it introduces.
function readModelContentDates(root = path.resolve(__dirname, '../..')) {
  const dates = { ...baseline };
  const git = (...args) => execFileSync('git', args, {
    cwd: root,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
  }).trim();
  try {
    const shallow = git('rev-parse', '--is-shallow-repository') === 'true';
    // The baseline is the public model sitemap at ac7221e45 on 2026-11-20.
    // Only incorporate subsequent edits; earlier Git history cannot date an
    // already published page whose template or media changed independently.
    const history = git('log', '--since=2026-11-20T00:00:00+01:00', '--no-renames',
      '--format=DATE %cs %P', '--name-only', '--', 'content/models/');
    let date = '';
    for (const line of history.split('\n')) {
      if (line.startsWith('DATE ')) {
        const [, day, parent] = line.split(' ');
        date = shallow && !parent ? '' : day;
        continue;
      }
      const match = /^content\/models\/(?:en|fr|es)\/([a-z0-9-]+)\.json$/.exec(line);
      if (match && date && (!dates[match[1]] || date > dates[match[1]])) dates[match[1]] = date;
    }
  } catch {
    // Archives deployed without .git use the last known editorial dates.
  }
  return dates;
}

module.exports = { readModelContentDates };
