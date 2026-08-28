import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  readdirSync,
  rmSync,
  symlinkSync,
  watch,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative, resolve } from 'node:path';
import test from 'node:test';
import YAML from 'yaml';

const root = process.cwd();
const builder = resolve(root, 'scripts/build-maxvideoai-plugin-release.mjs');
const synchronizer = resolve(root, 'scripts/sync-maxvideoai-plugin-repository.mjs');
const workflowPath = resolve(root, '.github/workflows/publish-maxvideoai-plugin.yml');
const pluginSource = resolve(root, 'plugins/maxvideoai');
const safeTemporaryRoot = realpathSync(tmpdir());
const publicMarker = '.maxvideoai-public-repository';
const publicMarkerContents = `${JSON.stringify({
  repository: 'camgraphe/maxvideoai-plugin',
  schemaVersion: 1,
})}\n`;

type WorkflowStep = {
  env?: Record<string, string>;
  run?: string;
  uses?: string;
};

type WorkflowJob = {
  environment?: string;
  needs?: string;
  outputs?: Record<string, string>;
  steps: WorkflowStep[];
};

type PublicationWorkflow = {
  on: Record<string, unknown>;
  permissions: Record<string, string>;
  jobs: Record<string, WorkflowJob>;
};

function filesAt(path: string, current = path): string[] {
  return readdirSync(current, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = join(current, entry.name);
    if (entry.isDirectory()) return filesAt(path, entryPath);
    return [relative(path, entryPath).split('\\').join('/')];
  });
}

function buildBundle(temporary: string): string {
  const out = join(temporary, 'release');
  const result = spawnSync(process.execPath, [builder, '--source', pluginSource, '--out', out], {
    cwd: root,
    encoding: 'utf8',
  });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  return join(out, 'maxvideoai-plugin');
}

function createPublicRepository(path: string): void {
  mkdirSync(join(path, '.git'), { recursive: true });
  writeFileSync(join(path, '.git', 'HEAD'), 'ref: refs/heads/main\n');
  writeFileSync(join(path, publicMarker), publicMarkerContents);
}

function runSynchronizer(source: string, target: string, dryRun = false) {
  const args = [synchronizer, '--source', source, '--target', target];
  if (dryRun) args.push('--dry-run');
  return spawnSync(process.execPath, args, { cwd: root, encoding: 'utf8' });
}

function sha256(contents: Buffer | string): string {
  return createHash('sha256').update(contents).digest('hex');
}

function loadWorkflow(): { raw: string; workflow: PublicationWorkflow } {
  assert.ok(existsSync(workflowPath), 'publication workflow is missing');
  const raw = readFileSync(workflowPath, 'utf8');
  return { raw, workflow: YAML.parse(raw) as PublicationWorkflow };
}

function shellFor(job: WorkflowJob): string {
  return job.steps.map((step) => step.run ?? '').join('\n');
}

test('mirror replaces obsolete public content with the exact verified bundle', (t) => {
  const temporary = mkdtempSync(join(safeTemporaryRoot, 'maxvideoai-plugin-mirror-'));
  t.after(() => rmSync(temporary, { recursive: true, force: true }));
  const source = buildBundle(temporary);
  const target = join(temporary, 'public-repository');
  createPublicRepository(target);
  mkdirSync(join(target, 'obsolete', 'nested'), { recursive: true });
  writeFileSync(join(target, 'obsolete', 'nested', 'retired.md'), 'remove me\n');
  writeFileSync(join(target, 'README.md'), 'stale public README\n');

  const result = runSynchronizer(source, target);

  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.equal(readFileSync(join(target, '.git', 'HEAD'), 'utf8'), 'ref: refs/heads/main\n');
  assert.equal(readFileSync(join(target, publicMarker), 'utf8'), publicMarkerContents);
  assert.ok(!existsSync(join(target, 'obsolete')));

  const sourceFiles = filesAt(source).sort();
  const publicFiles = filesAt(target)
    .filter((name) => !name.startsWith('.git/'))
    .sort();
  assert.deepEqual(publicFiles, [publicMarker, ...sourceFiles].sort());
  for (const name of sourceFiles) {
    assert.deepEqual(readFileSync(join(target, name)), readFileSync(join(source, name)), name);
  }

  const checksums = JSON.parse(readFileSync(join(target, 'checksums.json'), 'utf8')) as {
    algorithm: string;
    files: Record<string, string>;
  };
  assert.equal(checksums.algorithm, 'sha256');
  assert.deepEqual(Object.keys(checksums.files), sourceFiles.filter((name) => name !== 'checksums.json'));
});

test('mirror rejects extra or tampered bundle files before changing the public checkout', async (t) => {
  const fixtureCases = [
    {
      name: 'extra source file',
      mutate(source: string) {
        writeFileSync(join(source, 'not-in-checksums.txt'), 'unexpected\n');
      },
      expected: /unexpected source entry/i,
    },
    {
      name: 'checksum mismatch',
      mutate(source: string) {
        writeFileSync(join(source, 'README.md'), 'tampered after build\n');
      },
      expected: /checksum mismatch/i,
    },
  ];

  for (const fixtureCase of fixtureCases) {
    await t.test(fixtureCase.name, (subtest) => {
      const temporary = mkdtempSync(join(safeTemporaryRoot, 'maxvideoai-plugin-mirror-source-'));
      subtest.after(() => rmSync(temporary, { recursive: true, force: true }));
      const source = buildBundle(temporary);
      const target = join(temporary, 'public-repository');
      createPublicRepository(target);
      const sentinel = join(target, 'keep-on-failure.txt');
      writeFileSync(sentinel, 'untouched\n');
      fixtureCase.mutate(source);

      const result = runSynchronizer(source, target);

      assert.notEqual(result.status, 0, `${fixtureCase.name} unexpectedly passed`);
      assert.match(`${result.stderr}\n${result.stdout}`, fixtureCase.expected);
      assert.equal(readFileSync(sentinel, 'utf8'), 'untouched\n');
    });
  }
});

test('mirror requires resolved, separated, marked repository paths', async (t) => {
  const temporary = mkdtempSync(join(safeTemporaryRoot, 'maxvideoai-plugin-mirror-paths-'));
  t.after(() => rmSync(temporary, { recursive: true, force: true }));
  const source = buildBundle(temporary);
  const validTarget = join(temporary, 'valid-public-repository');
  createPublicRepository(validTarget);

  const missingGit = join(temporary, 'missing-git');
  mkdirSync(missingGit);
  writeFileSync(join(missingGit, publicMarker), publicMarkerContents);

  const missingMarker = join(temporary, 'missing-marker');
  mkdirSync(join(missingMarker, '.git'), { recursive: true });

  const symlinkTarget = join(temporary, 'public-repository-link');
  symlinkSync(validTarget, symlinkTarget, 'dir');

  const fixtureCases = [
    {
      name: 'missing source',
      source: join(temporary, 'missing-source'),
      target: validTarget,
      expected: /source.*exist|resolved source/i,
    },
    {
      name: 'missing target',
      source,
      target: join(temporary, 'missing-target'),
      expected: /target.*exist|resolved target/i,
    },
    { name: 'missing git directory', source, target: missingGit, expected: /\.git.*directory/i },
    { name: 'missing marker', source, target: missingMarker, expected: /marker/i },
    { name: 'symlink target', source, target: symlinkTarget, expected: /symlink/i },
    { name: 'workspace root', source, target: root, expected: /protected|workspace|source repository/i },
    { name: 'bundle as target', source, target: source, expected: /overlap|source/i },
  ];

  for (const fixtureCase of fixtureCases) {
    await t.test(fixtureCase.name, () => {
      const result = runSynchronizer(fixtureCase.source, fixtureCase.target);
      assert.notEqual(result.status, 0, `${fixtureCase.name} unexpectedly passed`);
      assert.match(`${result.stderr}\n${result.stdout}`, fixtureCase.expected);
    });
  }
});

test('mirror dry run reports the exact change without touching the checkout', (t) => {
  const temporary = mkdtempSync(join(safeTemporaryRoot, 'maxvideoai-plugin-mirror-dry-run-'));
  t.after(() => rmSync(temporary, { recursive: true, force: true }));
  const source = buildBundle(temporary);
  const target = join(temporary, 'public-repository');
  createPublicRepository(target);
  const obsolete = join(target, 'obsolete.txt');
  writeFileSync(obsolete, 'still here after dry run\n');

  const result = runSynchronizer(source, target, true);

  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.equal(readFileSync(obsolete, 'utf8'), 'still here after dry run\n');
  const report = JSON.parse(result.stdout) as {
    dryRun: boolean;
    fileCount: number;
    remove: string[];
    version: string;
  };
  assert.equal(report.dryRun, true);
  assert.match(report.version, /^\d+\.\d+\.\d+$/);
  assert.ok(report.fileCount > 30);
  assert.deepEqual(report.remove, ['obsolete.txt']);
});

test('mirror validates copied bytes against the manifest without rereading mutable source files', async (t) => {
  const temporary = mkdtempSync(join(safeTemporaryRoot, 'maxvideoai-plugin-mirror-target-digest-'));
  t.after(() => rmSync(temporary, { recursive: true, force: true }));
  const source = buildBundle(temporary);
  const target = join(temporary, 'public-repository');
  createPublicRepository(target);

  const original = 'validated before synchronization\n';
  const changed = 'source changed after its copy completed\n';
  writeFileSync(join(source, '000-first.txt'), original);
  mkdirSync(join(source, 'padding'));
  const checksumPath = join(source, 'checksums.json');
  const manifest = JSON.parse(readFileSync(checksumPath, 'utf8')) as {
    algorithm: string;
    files: Record<string, string>;
  };
  manifest.files['000-first.txt'] = sha256(original);
  for (let index = 0; index < 1_000; index += 1) {
    const name = `padding/${String(index).padStart(4, '0')}.txt`;
    const contents = `padding ${index}\n`;
    writeFileSync(join(source, name), contents);
    manifest.files[name] = sha256(contents);
  }
  manifest.files = Object.fromEntries(
    Object.keys(manifest.files)
      .sort()
      .map((name) => [name, manifest.files[name]]),
  );
  writeFileSync(checksumPath, `${JSON.stringify(manifest, null, 2)}\n`);

  let sourceWasChanged = false;
  const targetWatcher = watch(target, (_event, filename) => {
    if (filename !== '000-first.txt' || sourceWasChanged) return;
    sourceWasChanged = true;
    writeFileSync(join(source, '000-first.txt'), changed);
  });
  t.after(() => targetWatcher.close());

  const child = spawn(
    process.execPath,
    [synchronizer, '--source', source, '--target', target],
    { cwd: root, stdio: ['ignore', 'pipe', 'pipe'] },
  );
  let stdout = '';
  let stderr = '';
  child.stdout.setEncoding('utf8');
  child.stderr.setEncoding('utf8');
  child.stdout.on('data', (chunk) => {
    stdout += chunk;
  });
  child.stderr.on('data', (chunk) => {
    stderr += chunk;
  });
  const status = await new Promise<number | null>((resolveExit) => {
    child.on('close', resolveExit);
  });

  assert.ok(sourceWasChanged, 'fixture did not mutate the source after its target copy appeared');
  assert.equal(status, 0, stderr || stdout);
  assert.equal(readFileSync(join(target, '000-first.txt'), 'utf8'), original);
  assert.equal(readFileSync(join(source, '000-first.txt'), 'utf8'), changed);
});

test('publication preparation exposes the complete staged diff before environment approval', () => {
  const { workflow } = loadWorkflow();
  const prepare = workflow.jobs.prepare;
  const publish = workflow.jobs.publish;

  assert.ok(prepare, 'unprotected preparation job is missing');
  assert.ok(publish, 'protected publication job is missing');
  assert.equal(prepare.environment, undefined);
  assert.equal(publish.needs, 'prepare');
  assert.equal(publish.environment, 'maxvideoai-plugin-publication');
  assert.doesNotMatch(JSON.stringify(prepare), /MAXVIDEOAI_PLUGIN_REPO_TOKEN|secrets\./);

  const lines = shellFor(prepare).split('\n').map((line) => line.trim());
  const stage = lines.findIndex((line) => /git .* add -A$/.test(line));
  const check = lines.findIndex((line) => /git .* diff --cached --check$/.test(line));
  const stat = lines.findIndex((line) => /git .* diff --cached --stat$/.test(line));
  const completeDiff = lines.findIndex((line) => /git .* diff --cached$/.test(line));
  const writeTree = lines.findIndex((line) => /git .* write-tree/.test(line));
  assert.ok(stage >= 0, 'prepared public files are not staged');
  assert.ok(stage < check, 'staged whitespace check must run after staging');
  assert.ok(check < stat, 'staged stat must run after the whitespace check');
  assert.ok(stat < completeDiff, 'complete staged diff must be printed after the stat');
  assert.ok(completeDiff < writeTree, 'prepared tree must be recorded after the complete diff');
  assert.match(prepare.outputs?.base_sha ?? '', /steps\..*\.outputs\.base_sha/);
  assert.match(prepare.outputs?.tree ?? '', /steps\..*\.outputs\.tree/);
});

test('protected publication rebuilds the bundle and refuses a different base or tree', () => {
  const { workflow } = loadWorkflow();
  const prepare = workflow.jobs.prepare;
  const publish = workflow.jobs.publish;
  assert.ok(prepare && publish);
  const preparationShell = shellFor(prepare);
  const publicationShell = shellFor(publish);

  assert.match(preparationShell, /sync-maxvideoai-plugin-repository\.mjs/);
  assert.match(publicationShell, /build-maxvideoai-plugin-release\.mjs/);
  assert.match(publicationShell, /sync-maxvideoai-plugin-repository\.mjs/);
  assert.match(publicationShell, /git .* add -A/);
  assert.match(publicationShell, /git .* write-tree/);
  assert.match(publicationShell, /PREPARED_BASE_SHA/);
  assert.match(publicationShell, /PREPARED_TREE/);

  const baseCheck = publicationShell.indexOf('PREPARED_BASE_SHA');
  const treeCheck = publicationShell.indexOf('PREPARED_TREE');
  const push = publicationShell.indexOf('push origin HEAD:main');
  assert.ok(baseCheck >= 0 && treeCheck >= 0 && push >= 0);
  assert.ok(baseCheck < push && treeCheck < push, 'base and tree checks must precede the push');
  assert.doesNotMatch(publicationShell, /--force(?:-with-lease)?\b/);

  const publishingSteps = publish.steps.filter((step) =>
    /git .*push|gh\s+release\s+create/.test(step.run ?? ''),
  );
  assert.ok(publishingSteps.length > 0);
  for (const step of publishingSteps) {
    assert.equal(
      step.env?.MAXVIDEOAI_PLUGIN_REPO_TOKEN,
      '${{ secrets.MAXVIDEOAI_PLUGIN_REPO_TOKEN }}',
    );
  }
  const releaseStep = publish.steps.find((step) => /gh\s+release\s+create/.test(step.run ?? ''));
  assert.equal(releaseStep?.env?.SOURCE_SHA, '${{ needs.prepare.outputs.source_sha }}');
  assert.equal(releaseStep?.env?.VERSION, '${{ needs.prepare.outputs.version }}');
});

test('publication workflow is manual only, pinned, and binds dispatch to its tag ref', () => {
  const { raw, workflow } = loadWorkflow();

  assert.deepEqual(Object.keys(workflow.on), ['workflow_dispatch']);
  assert.equal(workflow.permissions.contents, 'read');

  const actions = Object.values(workflow.jobs)
    .flatMap((job) => job.steps)
    .map((step) => step.uses)
    .filter((value): value is string => Boolean(value));
  assert.ok(actions.includes('actions/checkout@fbc6f3992d24b796d5a048ff273f7fcc4a7b6c09'));
  assert.ok(actions.includes('actions/setup-node@249970729cb0ef3589644e2896645e5dc5ba9c38'));
  assert.match(raw, /actions\/checkout@fbc6f3992d24b796d5a048ff273f7fcc4a7b6c09\s+# v5/);
  assert.match(raw, /actions\/setup-node@249970729cb0ef3589644e2896645e5dc5ba9c38\s+# v6/);

  const shell = Object.values(workflow.jobs).map(shellFor).join('\n');
  assert.match(shell, /GITHUB_EVENT_NAME.*workflow_dispatch/);
  assert.match(shell, /GITHUB_REF.*refs\/tags\/\$SOURCE_TAG/);
});

test('public release accepts an existing tag only when it resolves to the prepared public commit', () => {
  const { workflow } = loadWorkflow();
  const shell = shellFor(workflow.jobs.publish);
  const tagLookup = shell.indexOf('ls-remote --tags origin');
  const publicShaCheck = shell.indexOf('PUBLIC_SHA');
  const release = shell.indexOf('gh release create');

  assert.ok(tagLookup >= 0, 'destination tag is not inspected');
  assert.match(shell, /refs\/tags\/\$RELEASE_TAG/);
  assert.match(shell, /\^\{\}/);
  assert.ok(publicShaCheck > tagLookup, 'destination tag is not compared with PUBLIC_SHA');
  assert.ok(release > publicShaCheck, 'release is created before the public tag check');
});

test('publication workflow uses reviewable non-force publication', () => {
  const { workflow } = loadWorkflow();

  const steps = Object.values(workflow.jobs).flatMap((job) => job.steps);
  const shell = steps.map((step) => step.run ?? '').join('\n');
  assert.match(shell, /MAXVIDEOAI_PLUGIN_REPO_TOKEN/);
  assert.match(shell, /git(?:\s+-C\s+"[^"]+")?\s+diff\s+(?:--cached\s+)?--check/);
  assert.match(shell, /git(?:\s+-C\s+"[^"]+")?\s+fetch\s+origin\s+main/);
  assert.match(shell, /git(?:\s+-C\s+"[^"]+")?\s+push\s+origin\s+HEAD:main/);
  assert.match(shell, /gh\s+release\s+create/);
  assert.doesNotMatch(shell, /--force(?:-with-lease)?\b/);
});
