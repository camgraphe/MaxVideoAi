import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {chromium,expect,type Browser} from '@playwright/test';
import {startStudioFailureCardFixture} from './helpers/studio-failure-card-fixture';

test('the real Studio route preserves safe failure explanations, locale and terminal state on reload and reopen', {timeout:90000}, async()=>{
  const fixture=await startStudioFailureCardFixture();
  let browser:Browser|undefined;
  const proof=process.env.STUDIO_FAILURE_PROOF_DIR;
  const observations=[];
  try{
    browser=await chromium.launch({headless:true});
    if(proof){
      await mkdir(join(proof,'preview'),{recursive:true});await mkdir(join(proof,'captures'),{recursive:true});
      for(const [name,value] of Object.entries({'index.html':fixture.artifacts.html,'fixture.js':fixture.artifacts.script,'fixture.css':fixture.artifacts.css}))await writeFile(join(proof,'preview',name),value);
    }
    for(const [locale,label,moderation,refund,unknown,next] of [
      ['en','Creation quote',/Google.*safety checks/,/refunded to your wallet/,/precise reason.*not available/,/new quote/],
      ['fr','Devis de création',/Google.*modération/,/remboursé sur votre wallet/,/motif précis.*pas disponible/,/nouveau devis/],
      ['es','Presupuesto de creación',/Google.*moderación/,/reembolsado.*monedero/,/motivo preciso.*no está disponible/,/nuevo presupuesto/],
    ] as const){
      const context=await browser.newContext({viewport:{width:1280,height:1100},reducedMotion:'reduce'});
      const errors:string[]=[];
      const check=async(page:Awaited<ReturnType<typeof context.newPage>>)=>{
        const cards=page.locator('[aria-label="'+label+'"]');
        await expect(cards).toHaveCount(3);
        const status=cards.locator('[role="status"]');
        await expect(status).toHaveCount(3);
        await expect(status.nth(0)).toContainText(moderation);
        await expect(status.nth(0)).toContainText(refund);
        await expect(status.nth(1)).toContainText(moderation);
        await expect(status.nth(1)).not.toContainText(refund);
        await expect(status.nth(2)).toContainText(unknown);
        await expect(status.nth(2)).not.toContainText(/Google|modération|moderación|safety/);
        await expect(cards.locator('[data-safety-guidance]')).toHaveCount(2);
        await expect(cards.nth(2).locator('[data-safety-guidance]')).toHaveCount(0);
        for(const text of await status.allTextContents()){
          assert.match(text,next);
          assert.doesNotMatch(text,/fixture-job|fixture-interaction|request_id|provider_job_id|https?:\/\/|Responsible AI/);
        }
        await expect(cards.getByRole('button')).toHaveCount(0);
        const requests=await page.evaluate(()=>((window as unknown as {fixtureRequests:Array<{method:string}>}).fixtureRequests));
        assert.ok(requests.length>=1,'the actual journal hook loads the persisted fixture');
        assert.ok(requests.every(request=>request.method==='GET'),'rendering a failure cannot dispatch a paid mutation');
        return cards;
      };
      let page=await context.newPage();page.on('pageerror',error=>errors.push(error.message));
      await page.goto(fixture.origin+'/?locale='+locale);
      const cards=await check(page);
      if(proof)for(let index=0;index<3;index++)await cards.nth(index).screenshot({path:join(proof,'captures',`${locale}-${['moderation-refunded','moderation-not-refunded','reason-unavailable'][index]}.png`)});
      const help=cards.nth(0).locator('[data-safety-guidance]');
      const helpSummary=help.locator('summary');
      await expect(help).not.toHaveAttribute('open','');
      await helpSummary.focus();await helpSummary.press('Enter');
      await expect(help).toHaveAttribute('open','');
      for(const paragraph of await help.locator('p').all())await expect(paragraph).toBeVisible();
      await expect(help.getByRole('link')).toHaveAttribute('href','https://policies.google.com/terms/generative-ai/use-policy?hl='+locale);
      if(proof)await cards.nth(0).screenshot({path:join(proof,'captures',`${locale}-safety-help-expanded.png`)});
      await helpSummary.press('Space');await expect(help).not.toHaveAttribute('open','');
      await page.setViewportSize({width:390,height:1000});
      await helpSummary.click();await expect(help).toHaveAttribute('open','');
      for(const paragraph of await help.locator('p').all())await expect(paragraph).toBeVisible();
      if(proof)await cards.nth(0).screenshot({path:join(proof,'captures',`${locale}-safety-help-mobile.png`)});
      await helpSummary.click();await expect(help).not.toHaveAttribute('open','');
      await page.reload();await check(page);
      await page.close();page=await context.newPage();page.on('pageerror',error=>errors.push(error.message));
      await page.goto(fixture.origin+'/?locale='+locale);await check(page);
      assert.deepEqual(errors,[]);
      observations.push({locale,card:true,reloaded:true,reopened:true,refundOnlyWhenPersisted:true,unknownReasonNotReconstructed:true,safetyHelpKeyboard:true,safetyHelpMobile:true,mutations:0});
      await context.close();
    }
    if(proof)await writeFile(join(proof,'browser-observations.json'),JSON.stringify({scope:'Real route, real journal hook and quote card with synthetic stored records; unrelated panels and remote boundaries isolated.',observations,authenticatedCustomerFlowVerified:false},null,2)+'\n');
  }finally{try{await browser?.close();}finally{await fixture.close();}}
});
