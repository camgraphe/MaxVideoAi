const fs = require('node:fs');
const path = require('node:path');

const timestampPath = path.join(__dirname, '..', 'public', '.sitemap_build_timestamp');
const now = new Date().toISOString();

fs.writeFileSync(timestampPath, `${now}\n`, 'utf8');
console.log(`✅ Updated sitemap timestamp: ${now}`);
