#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, '..', 'jobs.json');
const raw = fs.readFileSync(file, 'utf8');
const json = JSON.parse(raw);

if (!Array.isArray(json.jobs)) {
  console.error('jobs.json: missing jobs array');
  process.exit(1);
}

let replaced = 0;
for (const j of json.jobs) {
  if (j && typeof j === 'object') {
    if (typeof j.previewFrame === 'string' && j.previewFrame.trim()) {
      if (typeof j.thumbUrl === 'string' && j.thumbUrl.includes('images.unsplash.com')) {
        j.thumbUrl = j.previewFrame;
        replaced++;
      }
    }
  }
}

fs.writeFileSync(file, JSON.stringify(json, null, 2) + '\n');
console.log(`Sanitized jobs.json: replaced ${replaced} Unsplash URLs with local previewFrame.`);

