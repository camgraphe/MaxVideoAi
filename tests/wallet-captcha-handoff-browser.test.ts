import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import test from 'node:test';
import { build } from 'esbuild';
import { chromium, expect } from '@playwright/test';

test('wallet and hosted checkout consume separate CAPTCHA tokens without discarding prepared sessions', { timeout: 45_000 }, async t => {
  const folder = await mkdtemp(join(tmpdir(), 'wallet-captcha-handoff-'));
  t.after(() => rm(folder, { recursive: true, force: true }));
  const bundle = join(folder, 'browser.js');
  const hook = resolve('frontend/hooks/useHostedWalletCheckout.ts');
  const express = resolve('frontend/app/(core)/billing/_components/WalletExpressCheckout.tsx');
  const challenge = resolve('frontend/components/ui/TurnstileChallenge.tsx');
  const copy = resolve('frontend/app/(core)/billing/_lib/billing-copy.ts');
  await build({
    stdin: { contents: `
      import React, {useState} from 'react'; import {createRoot} from 'react-dom/client';
      import {useHostedWalletCheckout} from ${JSON.stringify(hook)};
      import {WalletExpressCheckout} from ${JSON.stringify(express)};
      import {TurnstileChallenge} from ${JSON.stringify(challenge)};
      import {DEFAULT_BILLING_COPY} from ${JSON.stringify(copy)};
      const stripePromise = Promise.resolve({
        initCheckout() {
          const listeners = {}; let node;
          return {
            loadActions: async () => ({type:'success',actions:{confirm:async()=>{window.confirmations++;return {type:'success'};}}}),
            createExpressCheckoutElement(options) {
              window.walletOptions = options; return {
              on(name, fn) { listeners[name]=fn; },
              mount(target) {
                node=document.createElement('div');
                for (const method of ['Apple Pay','Google Pay','Link']) {
                  const button=document.createElement('button'); button.textContent=method;
                  button.onclick=()=>listeners.cancel(); node.appendChild(button);
                }
                target.appendChild(node); listeners.ready({availablePaymentMethods:{applePay:true,googlePay:true,link:true}});
              },
              destroy(){node?.remove();}
            }; }
          };
        }
      });
      function App() {
        const [enabled,setEnabled]=useState(!location.search.includes('hosted-first'));
        const checkout=useHostedWalletCheckout({accountId:'synthetic-account',accessToken:'synthetic-auth',amountCents:2000,currency:'EUR',
          locale:'en',source:'billing',stripePromise,onStarted(){},onFailed(){},onRateLimited(){}});
        return <div>
          <button onClick={()=>setEnabled(true)}>Enable wallets</button>
          <button disabled={checkout.isSubmitting} onClick={()=>checkout.startCheckout()}>Continue by card</button>
          {checkout.captchaRequired && <TurnstileChallenge siteKey="public-B" locale="en"
            onToken={checkout.handleCaptchaToken} onError={checkout.handleCaptchaError}
            resetGeneration={checkout.captchaResetGeneration}/>}
          <WalletExpressCheckout enabled={enabled&&!checkout.isSubmitting} amountCents={2000} chargeCurrency="EUR"
            locale="en" captchaToken={checkout.captchaToken} captchaSiteKey="public-B"
            takeCaptchaToken={checkout.takeCaptchaToken}
            session={{access_token:'synthetic-auth',user:{id:'synthetic-user'}}}
            stripePromise={stripePromise} labels={DEFAULT_BILLING_COPY.wallet}
            onCaptchaRequired={checkout.requireCaptcha} onPaymentStarted={()=>{}} onPaymentFailed={()=>{}}/>
        </div>;
      }
      window.confirmations=0; createRoot(document.getElementById('root')).render(<App/>);
    `, resolveDir: resolve('frontend'), loader: 'tsx' },
    outfile: bundle, bundle: true, platform: 'browser', format: 'iife', jsx: 'automatic',
    tsconfig: 'frontend/tsconfig.json',
    define: { 'process.env': JSON.stringify({NODE_ENV:'production',NEXT_PUBLIC_TURNSTILE_SITE_KEY:'public-B'}) },
  });
  type Request = { mode?: string; captchaToken?: string; captchaSiteKey?: string };
  const requests: Request[] = [];
  const consumed = new Set<string>();
  let replayed = 0;
  let successfulNative = 0;
  let failHosted = false;
  let holdNative = false;
  let releaseNative: (() => void) | undefined;
  const server = createServer(async (req, res) => {
    if (req.url === '/browser.js') { res.setHeader('content-type', 'text/javascript'); res.end(await readFile(bundle)); return; }
    if (req.url === '/api/turnstile/config') {
      res.setHeader('content-type', 'application/json');
      res.end(JSON.stringify({activeSiteKey:'public-B',acceptedSiteKeys:['public-B']})); return;
    }
    if (req.url === '/api/checkout-events') { res.writeHead(204); res.end(); return; }
    if (req.url === '/api/wallet') {
      const chunks: Buffer[] = []; for await (const chunk of req) chunks.push(Buffer.from(chunk));
      const body = JSON.parse(Buffer.concat(chunks).toString()) as Request; requests.push(body);
      res.setHeader('content-type', 'application/json');
      if (!body.captchaToken || consumed.has(body.captchaToken)) {
        if (body.captchaToken) replayed++;
        res.writeHead(403); res.end(JSON.stringify({captchaRequired:true})); return;
      }
      assert.equal(body.captchaSiteKey, 'public-B');
      consumed.add(body.captchaToken);
      if (body.mode === 'express_checkout') {
        if (holdNative) await new Promise<void>(resolveRelease => { releaseNative = resolveRelease; });
        successfulNative++;
        res.end(JSON.stringify({id:'synthetic-native-'+successfulNative,checkoutAttemptId:successfulNative,
          clientSecret:'synthetic-secret',expiresAt:Date.now()/1000+1800})); return;
      }
      if (failHosted) { res.writeHead(500); res.end('{}'); return; }
      res.end(JSON.stringify({id:'synthetic-hosted',url:'/hosted-success',checkoutAttemptId:500})); return;
    }
    res.setHeader('content-type', 'text/html');
    res.end(req.url === '/hosted-success' ? '<h1>Hosted checkout ready</h1>' : '<div id="root"></div><script src="/browser.js"></script>');
  });
  await new Promise<void>(resolveListen => server.listen(0, '127.0.0.1', resolveListen));
  t.after(() => { releaseNative?.(); server.closeAllConnections(); return new Promise<void>(resolveClose => server.close(() => resolveClose())); });
  const origin = 'http://localhost:' + (server.address() as {port:number}).port;
  const browser = await chromium.launch({headless:true});
  t.after(() => browser.close());
  const page = await browser.newPage();
  page.setDefaultTimeout(3000);
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  const unexpected: string[] = [];
  await page.route('**/*', async route => {
    const url = route.request().url();
    if (url.startsWith(origin + '/')) return route.continue();
    if (url.startsWith('https://challenges.cloudflare.com/turnstile/v0/api.js')) {
      return route.fulfill({contentType:'text/javascript',body:`
        const widgets=new Map(); window.turnstile={
          render(el,options){
            const id=crypto.randomUUID(),button=document.createElement('button');
            button.textContent='Verify human'; button.onclick=()=>{button.disabled=true;options.callback('synthetic-'+id);};
            el.appendChild(button);widgets.set(id,button);return id;
          },
          remove(id){widgets.get(id)?.remove();widgets.delete(id);}
        };
      `});
    }
    unexpected.push(url); return route.abort();
  });
  const verify = async () => {
    const button = page.getByRole('button',{name:'Verify human',exact:true});
    await expect(button, JSON.stringify({errors,requests})).toBeEnabled({timeout:3000}); await button.click();
  };

  for (const method of ['Apple Pay','Google Pay','Link']) {
    const from = requests.length, nativeBefore = successfulNative;
    await page.goto(origin);
    await verify();
    await page.getByRole('button',{name:method,exact:true}).click();
    assert.equal(await page.evaluate(()=>(window as unknown as {walletOptions:{paymentMethods:{googlePay:string}}}).walletOptions.paymentMethods.googlePay), 'always', 'Google Pay should be offered on supported browsers even without a saved card');
    // Session preparation has consumed the first proof. A fresh challenge must
    // now be available to authorize the other payment path, without a replay.
    await verify();
    assert.equal(await page.evaluate(()=>(window as unknown as {confirmations:number}).confirmations),0);
    await page.getByRole('button',{name:'Continue by card',exact:true}).click();
    await page.getByRole('heading',{name:'Hosted checkout ready'}).waitFor();
    const submitted = requests.slice(from).filter(r=>r.captchaToken);
    assert.equal(submitted.length,2);
    assert.notEqual(submitted[0].captchaToken,submitted[1].captchaToken);
    assert.equal(successfulNative,nativeBefore+1,'refreshing CAPTCHA must reuse the prepared native session');
  }

  holdNative=true;
  await page.goto(origin);
  await verify();
  await expect.poll(()=>Boolean(releaseNative)).toBe(true);
  await verify();
  await page.getByRole('button',{name:'Continue by card',exact:true}).click();
  await page.getByRole('heading',{name:'Hosted checkout ready'}).waitFor();
  releaseNative!(); holdNative=false;

  failHosted=true;
  await page.goto(origin+'/?hosted-first');
  await page.getByRole('button',{name:'Continue by card',exact:true}).click();
  await verify();
  await page.getByRole('button',{name:'Continue by card',exact:true}).click();
  await expect(page.getByRole('button',{name:'Continue by card',exact:true})).toBeEnabled();
  await page.getByRole('button',{name:'Enable wallets',exact:true}).click();
  await verify();
  await page.getByRole('button',{name:'Apple Pay',exact:true}).waitFor();
  assert.equal(await page.evaluate(()=>(window as unknown as {confirmations:number}).confirmations),0,'no CAPTCHA callback may submit a payment');
  assert.equal(replayed,0,'switching payment paths must never resubmit a consumed token');
  assert.deepEqual(errors,[]);
  assert.deepEqual(unexpected,[]);
});
