import assert from 'node:assert/strict';
import test from 'node:test';
import { prioritizeCompareFaq, buildCompareFaqJsonLd } from '../frontend/app/(localized)/[locale]/(marketing)/ai-video-engines/[slug]/_lib/compare-page-faq';

test('generated FAQ leads with the editorial choice without losing any question', () => {
  const items = [{question:'About',answer:'Two models'}, {question:'Which?',answer:'Depends'}, {question:'Price?',answer:'Exact quote'}];
  const result=prioritizeCompareFaq(items,'Choose A for resolution and B for drafts.');
  assert.deepEqual(result.map(x=>x.question),['Which?','Price?','About']);
  assert.equal(result[0].answer,'Choose A for resolution and B for drafts.');
  assert.equal(items[1].answer,'Depends');
  assert.equal(buildCompareFaqJsonLd(result).mainEntity[0].acceptedAnswer.text,result[0].answer);
});

test('FAQ without editorial verdict preserves its answer and handles a single item', () => {
  const items=[{question:'About',answer:'About both'}, {question:'Choose',answer:'Original guidance'}];
  assert.equal(prioritizeCompareFaq(items)[0].answer,'Original guidance');
  assert.deepEqual(prioritizeCompareFaq(items.slice(0,1)),items.slice(0,1));
});
