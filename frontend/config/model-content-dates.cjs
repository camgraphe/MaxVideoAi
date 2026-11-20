const { execFileSync } = require('node:child_process');
const path = require('node:path');
const baseline = require('./model-content-date-baseline.json');

// Bundle one snapshot for both the static model sitemap and the serverless index.
// A shallow clone's boundary commit cannot date the files it introduces.
function readModelContentDates() {
  const dates = { ...baseline };
  const root = path.resolve(__dirname, '../..');
  const git = (...args) => execFileSync('git', args, {
    cwd: root,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
  }).trim();
  try {
    const shallow = git('rev-parse', '--is-shallow-repository') === 'true';
    const history = git('log', '--no-renames', '--format=DATE %cs %P', '--name-only', '--', 'content/models/');
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
