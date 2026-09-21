import test from 'node:test';
import assert from 'node:assert/strict';
import { NextRequest } from 'next/server';

test('an unsigned editorial reader navigation resumes the exact version after login', async () => {
  const helper = await import('../frontend/lib/editorial/login');
  const target = '/admin/editorial/b1f7b87f-4850-4181-a499-97f9cadc78b3?version=4&locale=fr';
  const response = helper.editorialSignInRedirect(new NextRequest('https://maxvideoai.com'+target, {headers: {accept: 'text/html'}}));
  assert.ok(response);
  const location = new URL(response.headers.get('location')!);
  assert.equal(location.origin, 'https://maxvideoai.com');
  assert.equal(location.pathname, '/login');
  assert.equal(location.searchParams.get('next'), target);
  assert.match(response.headers.get('cache-control')??'', /private/);
});

test('other admin pages, APIs and mutations keep their unauthorized response', async () => {
  const {editorialSignInRedirect} = await import('../frontend/lib/editorial/login');
  for (const [path, method, accept] of [['/admin/users','GET','text/html'],['/api/admin/editorial/id/approve','POST','text/html'],['/admin/editorial','POST','text/html'],['/admin/editorial','GET','application/json']]) {
    assert.equal(editorialSignInRedirect(new NextRequest('https://maxvideoai.com'+path, {method, headers:{accept}})), null);
  }
});
