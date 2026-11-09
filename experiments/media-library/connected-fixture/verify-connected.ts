import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
async function main() {
    const connection = JSON.parse(await readFile(resolve('.superpowers/sdd/2026-11-09-media-library-integration/task-8-connection.json'), 'utf8'));
    const control = async (path: string, body: unknown) => (await fetch(connection.controlOrigin + path, { method: 'POST', headers: { Authorization: `Bearer ${connection.controlToken}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body) })).json();
    const minted = await control('/session/mint', { account: 'a' });
    const bootstrap = await fetch(minted.entry, { redirect: 'manual' });
    assert.equal(bootstrap.status, 307);
    const cookies = bootstrap.headers.getSetCookie().map(value => value.split(';')[0]).join('; ');
    assert.ok(cookies.includes('sb-127-auth-token'));
    const get = async (path: string) => { const response = await fetch(connection.origin + path, { headers: { Cookie: cookies } }); const body = await response.json(); assert.equal(response.status, 200, JSON.stringify(body)); return body; };
    const browse = await get('/api/media-library/browse');
    const assets = await get('/api/media-library/assets?limit=30');
    const status = await Promise.all(['/api/wallet', '/api/admin/access', '/api/legal/reconsent', '/api/service-notice'].map(async (path) => ({ path, body: await get(path) })));
    const result = { bootstrap: bootstrap.status, browseKeys: Object.keys(browse), browseSummary: { ...browse, items: undefined, assets: undefined }, assetCount: assets.assets?.length ?? assets.items?.length, ancillary: status };
    await writeFile(join(connection.runDir, 'connected-http.json'), JSON.stringify(result, null, 2));
    console.log(JSON.stringify({ bootstrap: bootstrap.status, browseKeys: Object.keys(browse), assetsKeys: Object.keys(assets), ancillary: status.map(s => s.path) }));
}
main().catch(error => { console.error(error); process.exitCode = 1; });
