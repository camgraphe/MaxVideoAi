import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

type Release = readonly [major: number, minor: number, patch: number];
type Version = {
  release: Release;
  prerelease: string | null;
  raw: string;
};

const frontendPackage = JSON.parse(readFileSync('frontend/package.json', 'utf8')) as {
  dependencies?: Record<string, string>;
};
const lockfile = readFileSync('pnpm-lock.yaml', 'utf8');
const lockfilePackages = lockfile.split('\npackages:\n')[1]?.split('\nsnapshots:\n')[0] ?? '';

function parseVersion(value: string): Version {
  const match = value.match(/^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?(?:\+[0-9A-Za-z.-]+)?$/);
  assert.ok(match, `expected a semantic version in ${JSON.stringify(value)}`);
  return {
    release: [Number(match[1]), Number(match[2]), Number(match[3])],
    prerelease: match[4] ?? null,
    raw: value,
  };
}

function atLeast(actual: Version, minimum: Release): boolean {
  for (let index = 0; index < actual.release.length; index += 1) {
    if (actual.release[index] !== minimum[index]) {
      return actual.release[index] > minimum[index];
    }
  }
  return actual.prerelease === null;
}

function lockedVersions(packageName: string, packagesSection = lockfilePackages): Version[] {
  const escapedName = packageName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = new RegExp(`^  ${escapedName}@([^:\\s]+):`, 'gm');
  return Array.from(packagesSection.matchAll(pattern), (match) => parseVersion(match[1]));
}

function formatVersion(version: Version): string {
  return version.raw;
}

const patchedPolicies: Record<string, (version: Version) => boolean> = {
  'js-yaml': (version) =>
    version.release[0] > 4 ||
    (version.release[0] === 4 && atLeast(version, [4, 2, 0])) ||
    (version.release[0] === 3 && atLeast(version, [3, 15, 0])),
  ws: (version) =>
    version.release[0] > 8 ||
    (version.release[0] === 8 && atLeast(version, [8, 21, 0])) ||
    (version.release[0] === 7 && atLeast(version, [7, 5, 11])) ||
    (version.release[0] === 6 && atLeast(version, [6, 2, 4])) ||
    (version.release[0] === 5 && atLeast(version, [5, 2, 5])),
  tmp: (version) => atLeast(version, [0, 2, 7]),
  nodemailer: (version) => atLeast(version, [9, 0, 1]),
};

test('direct security-sensitive dependencies require patched release lines', () => {
  const nodemailer = frontendPackage.dependencies?.nodemailer;
  assert.ok(nodemailer, 'frontend should declare nodemailer');
  assert.ok(
    atLeast(parseVersion(nodemailer), [9, 0, 1]),
    `nodemailer ${nodemailer} must include the raw-message access-control fix from 9.0.1`
  );
});

test('lockfile keeps every audited dependency outside known vulnerable ranges', () => {
  for (const [packageName, isPatched] of Object.entries(patchedPolicies)) {
    const versions = lockedVersions(packageName);
    assert.ok(versions.length > 0, `${packageName} should be present in the lockfile`);
    for (const version of versions) {
      assert.ok(
        isPatched(version),
        `${packageName} ${formatVersion(version)} is inside an audited vulnerable range`
      );
    }
  }
});

test('ws policy accepts every patched release branch from the advisory', () => {
  const isPatched = patchedPolicies.ws;
  assert.equal(isPatched(parseVersion('5.2.5')), true);
  assert.equal(isPatched(parseVersion('6.2.4')), true);
  assert.equal(isPatched(parseVersion('7.5.11')), true);
  assert.equal(isPatched(parseVersion('8.21.0')), true);
});

test('release floors reject prereleases of the first patched version', () => {
  assert.equal(patchedPolicies.ws(parseVersion('8.21.0-beta.1')), false);
  assert.equal(patchedPolicies['js-yaml'](parseVersion('4.2.0-rc.1')), false);
  assert.equal(patchedPolicies.tmp(parseVersion('0.2.7-beta.1')), false);
  assert.equal(patchedPolicies.nodemailer(parseVersion('9.0.1-beta.1')), false);
});

test('lockfile scanner includes prereleases instead of silently skipping them', () => {
  const fixture = ['  ws@8.21.0:', '  ws@8.20.1-beta.1:'].join('\n');
  assert.deepEqual(lockedVersions('ws', fixture).map(formatVersion), ['8.21.0', '8.20.1-beta.1']);
});
