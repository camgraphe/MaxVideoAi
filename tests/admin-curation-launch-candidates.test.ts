import assert from 'node:assert/strict';
import test from 'node:test';
import {listRuntimeModels} from '../frontend/config/model-runtime';
import {buildModelFamilyDefinitions} from '../frontend/config/model-families';
import {createExampleFamilyResolver} from '../frontend/lib/model-families';
import {getCurationCandidateAliases} from '../frontend/server/playlists/curation-candidate-aliases';

test('admin can prepare real Max family membership while the public family remains gated by assets',()=>{
  const models=listRuntimeModels();
  const publicFamilies=createExampleFamilyResolver({families:buildModelFamilyDefinitions(models,[])});
  assert.equal(publicFamilies.getModelSlugs('flux').includes('flux-3-max'),false);
  const aliases=getCurationCandidateAliases('family-flux')!;
  assert.ok(aliases.includes('flux-3-max'));
  assert.ok(aliases.includes('blackforestlabs/flux-3-max/keyframes-to-video'));
  assert.equal(aliases.includes('wan-3'),false);
  assert.equal(getCurationCandidateAliases('family-unknown'),null);
});

test('admin preparation still excludes retired, deep legacy and unpublished model identities',()=>{
  for(const variant of ['retired','deep_legacy','app-hidden','examples-hidden'] as const){
    const models=listRuntimeModels().map(model=>model.id!=='flux-3-max'?model:{...model,
      lifecycle:variant==='retired'||variant==='deep_legacy'?variant:model.lifecycle,
      publication:{...model.publication,app:{...model.publication.app,published:variant!=='app-hidden'},examples:{...model.publication.examples,published:variant!=='examples-hidden'}},
    });
    assert.equal(getCurationCandidateAliases('family-flux',models)?.includes('flux-3-max'),false,variant);
  }
});
