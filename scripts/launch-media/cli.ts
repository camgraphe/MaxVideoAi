import { loadPrivateRegistry, privatePath, readPrivateJson, writePrivateJson } from './local-registry';
import { check } from './manifest';
import { openStagingBatch, type Grant } from './private-staging';
import { createStoragePorts } from './storage-adapter';

async function main() {
  const [command, registryPath, inputPath, ...extra] = process.argv.slice(2);
  check(['validate', 'stage', 'sign', 'check-grants', 'record', 'cleanup'].includes(command) && registryPath && extra.length === 0, 'ARGUMENTS');
  const needsInput = ['sign', 'check-grants', 'record'].includes(command);
  check(needsInput === Boolean(inputPath), 'ARGUMENTS');
  const local = await loadPrivateRegistry(registryPath);
  try {
    const batch = await openStagingBatch({ ...local, ports: createStoragePorts() });
    if (command === 'stage') await batch.stage();
    if (command === 'cleanup') await batch.cleanup();
    if (command === 'sign') {
      const spec = await readPrivateJson<{ sceneId: string; expiresInSeconds: number; credentialsValidUntil: string; outputPath: string }>(inputPath);
      // Validate the destination BEFORE signing. Output is never stdout or a public receipt.
      await privatePath(spec.outputPath, false);
      const grants = await batch.issueGrants(spec.sceneId, spec);
      await writePrivateJson(spec.outputPath, { sceneId: spec.sceneId, grants });
    }
    if (command === 'check-grants') {
      const spec = await readPrivateJson<{ sceneId: string; grants: Grant[] }>(inputPath);
      batch.assertGrants(spec.sceneId, spec.grants);
    }
    if (command === 'record') {
      const spec = await readPrivateJson<{ sceneId: string; event: Parameters<typeof batch.recordJob>[1] }>(inputPath);
      await batch.recordJob(spec.sceneId, spec.event);
    }
    process.stdout.write(`${JSON.stringify(batch.summary())}\n`);
  } finally { await local.close(); }
}

main().catch(error => {
  const message = error instanceof Error && /^LAUNCH_[A-Z_]+$/.test(error.message) ? error.message : 'LAUNCH_FAILED';
  process.stderr.write(`${message}\n`); process.exitCode = 1;
});
