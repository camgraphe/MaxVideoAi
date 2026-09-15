import assert from 'node:assert/strict';
import test from 'node:test';
import { existsSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { buildToolBreadcrumbJsonLd, buildToolHowToJsonLd } from '../frontend/src/components/tools/landing/tool-marketing-json-ld';
import { TOOL_WORKSPACE_CAPTURES } from '../frontend/src/components/tools/landing/tool-workspace-assets';

test('tool breadcrumbs and workflow steps stay on the localized page', () => {
  for (const [locale,home,tools] of [['en','/','/tools'],['fr','/fr','/fr/outils'],['es','/es','/es/herramientas']] as const) {
    const canonicalUrl=`https://maxvideoai.com${tools}/character-builder`;
    const schema=buildToolBreadcrumbJsonLd({locale,canonicalUrl,breadcrumb:{home:'Home',tools:'Tools',current:'Character Builder'}});
    assert.deepEqual(schema.itemListElement.map(item=>item.item),[`https://maxvideoai.com${home}`,`https://maxvideoai.com${tools}`,canonicalUrl]);
    const workflow=buildToolHowToJsonLd({canonicalUrl,name:'Create',description:'Create a reference',steps:[{title:'Choose',body:'Pick a source'}]});
    assert.equal(workflow.step[0].url,`${canonicalUrl}#step-1`);
  }
});

test('current workspace captures are local, separate for each tool and bounded', () => {
  const captures=Object.values(TOOL_WORKSPACE_CAPTURES);
  assert.equal(new Set(captures).size,4);
  for (const src of captures) {
    const path=join(process.cwd(),'frontend/public',src);
    assert.ok(existsSync(path),src);
    assert.ok(statSync(path).size<150_000,`${src} should stay below 150 KB`);
  }
});
