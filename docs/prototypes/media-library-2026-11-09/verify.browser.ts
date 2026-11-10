/** Hosted CI only. Never launch these browsers on the user's computer. */
import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium, expect, type Page } from '@playwright/test';
import { startPrototype } from './server.mjs';
import { startBaseline } from './baseline';

const evidence = 'output/media-design-evidence';
const measures: unknown[] = [];
const appStateErrors: string[] = [];
function watch(page: Page) {
  page.on('pageerror',error=>appStateErrors.push(error.message));
  page.on('console',message=>{if(message.type()==='error')appStateErrors.push(message.text());});
}
async function display(page: Page, mode: 'mosaic'|'grid'|'list') {
  await page.getByRole('button',{name:'Affichage',exact:true}).click();
  await page.getByRole('button',{name:{mosaic:'Mosaïque',grid:'Grille',list:'Liste'}[mode],exact:true}).click();
  await page.keyboard.press('Escape');
  await expect(page.locator('.compact-media-canvas').last()).toHaveAttribute('data-layout',mode);
}
async function verifyMosaic(page: Page) {
  const geometry = await page.locator('.compact-media-canvas[data-layout="mosaic"]').last().evaluate(canvas=>{
    const cards=[...canvas.querySelectorAll('.compact-media-tile')].map(el=>el.getBoundingClientRect());
    const overlaps=cards.flatMap((a,i)=>cards.slice(i+1).filter(b=>Math.min(a.right,b.right)-Math.max(a.left,b.left)>1&&Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top)>1));
    const bounds=canvas.getBoundingClientRect();
    const coverage=[...canvas.querySelectorAll('.compact-media-cover img')].filter(el=>{
      const r=el.getBoundingClientRect();return r.bottom>bounds.top&&r.top<bounds.bottom;
    }).map(el=>{
      const img=el as HTMLImageElement, r=el.parentElement!.getBoundingClientRect();
      const scale=Math.min(r.width/img.naturalWidth,r.height/img.naturalHeight);
      return img.naturalWidth*img.naturalHeight*scale*scale/(r.width*r.height);
    });
    return {overlaps:overlaps.length,minCoverage:Math.min(...coverage)};
  });
  assert.equal(geometry.overlaps,0,'mosaic cards never overlap');
  assert.ok(geometry.minCoverage>.98,'native proportions use the poster frame without cropping or empty bars');
}
async function settleImages(page: Page) {
  await expect(page.locator('.toast.visible')).toHaveCount(0,{timeout:8000});
  await expect.poll(() => page.locator('img').evaluateAll(images => images.filter(image => {
    const r=image.getBoundingClientRect();
    return r.width>0 && r.height>0 && r.bottom>0 && r.top<innerHeight && r.right>0 && r.left<innerWidth;
  }).every(image => (image as HTMLImageElement).complete && (image as HTMLImageElement).naturalWidth>0)),{timeout:15_000,message:'visible posters must finish loading before accepting screenshots'}).toBe(true);
  // complete/naturalWidth precede async bitmap decoding. Let the decoded frame paint.
  await page.locator('img').evaluateAll(images => Promise.all(images.filter(image => {
    const r=image.getBoundingClientRect();
    return r.width>0 && r.height>0 && r.bottom>0 && r.top<innerHeight;
  }).map(image => (image as HTMLImageElement).decode())));
  await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
}
async function measure(page: Page, label: string) {
  await settleImages(page);
  const result = await page.evaluate(() => {
    const library = document.querySelector('.picker-sheet .library') ?? document.querySelector('.library');
    const grid = library?.querySelector('.compact-media-canvas');
    const cards = Array.from(library?.querySelectorAll('.compact-media-tile') ?? []);
    const bounds = grid?.getBoundingClientRect();
    const touch = Array.from(document.querySelectorAll('button,input:not([type="checkbox"]):not([type="radio"]),select,.compact-media-check')).filter(el => {
      const r = el.getBoundingClientRect();
      return r.width > 2 && r.height > 2 && r.bottom > 0 && r.top < innerHeight && r.left >= 0 && r.right <= innerWidth;
    }).map(el => {const r = el.getBoundingClientRect();return {name:el.getAttribute('aria-label')??el.textContent?.trim().slice(0,40),width:r.width,height:r.height};});
    return {width:innerWidth,height:innerHeight,scrollWidth:document.documentElement.scrollWidth,grid:bounds ? {x:bounds.x,y:bounds.y,width:bounds.width,height:bounds.height}:null,domCards:cards.length,visibleCards:cards.filter(el => {const r=el.getBoundingClientRect();return r.top>=(bounds?.top??0)&&r.bottom<=(bounds?.bottom??innerHeight);}).length,shortTargets:touch.filter(r=>r.height<(innerWidth<=700?43:35)||r.width<(innerWidth<=700?43:23)),videoElements:document.querySelectorAll('video').length};
  });
  measures.push({label,...result});
  assert.ok(result.scrollWidth <= result.width + 1, `${label}: horizontal page overflow`);
  await page.screenshot({path:`${evidence}/${label}.png`});
  return result;
}
test('synthetic media journeys and source baseline', {timeout:360_000}, async()=>{
  assert.ok(process.env.CI, 'Browser execution is restricted to hosted CI for this task');
  await mkdir(evidence,{recursive:true});
  const prototype = await startPrototype();
  const baseline = await startBaseline(prototype.url);
  const browser = await chromium.launch();
  try {
    for (const width of [1440,390,320]) {
      const context = await browser.newContext({viewport:{width,height:width>700?1000:844},hasTouch:width<=700});
      const page = await context.newPage();
      watch(page);
      const originalRequests: string[] = [];
      page.on('request',request=>{if(request.url().includes('/originals/'))originalRequests.push(request.url());});
      await page.goto(prototype.url);
      await expect(page.locator('.compact-media-tile').first()).toBeVisible();
      const geometry = await measure(page,`01-library-${width}`);
      assert.ok(geometry.domCards < 100,'grid stays bounded');
      await verifyMosaic(page);
      if(width<=700){
        await page.getByRole('button',{name:'Charger 60 médias de plus',exact:true}).click();
        await expect(page.locator('.mobile-load')).toHaveCount(0);
        await expect(page.locator('.library-count')).toContainText('93 médias');
      }
      // Selection is tied to identities even when cards are recycled into another layout.
      for(const id of ['demo-1','demo-2'])await page.locator(`[data-media-key="${id}"] .compact-media-check`).click();
      for(const mode of ['list','grid','mosaic'] as const){
        await display(page,mode);
        for(const id of ['demo-1','demo-2'])await expect(page.locator(`[data-media-key="${id}"]`)).toHaveAttribute('aria-selected','true');
        await expect(page.locator('.selection-summary')).toContainText('2 sélectionnés');
        await measure(page,`01-${mode}-${width}`);
      }
      await page.getByRole('button',{name:'Effacer la sélection',exact:true}).click();
      await page.getByRole('button',{name:'Tous les médias',exact:true}).click();
      await expect(page.getByRole('navigation',{name:'Collections',exact:true})).toBeVisible();
      await measure(page,`02-collections-${width}`);
      await page.getByRole('navigation',{name:'Collections',exact:true}).getByRole('button',{name:'Film · Lumière d’été',exact:true}).click();
      await expect(page.getByRole('button',{name:'Film · Lumière d’été',exact:true})).toBeVisible();
      await page.getByRole('button',{name:'Film · Lumière d’été',exact:true}).click();
      await page.getByRole('button',{name:'Gérer Film · Lumière d’été',exact:true}).click();
      await page.getByRole('textbox',{name:'Nom de la collection'}).fill('Film · Collection renommée');
      await page.getByRole('button',{name:'Enregistrer',exact:true}).click();
      await expect(page.getByRole('button',{name:'Film · Collection renommée',exact:true})).toBeVisible();
      await page.getByRole('button',{name:'Film · Collection renommée',exact:true}).click();
      await page.getByRole('button',{name:'Tous les médias',exact:true}).click();
      await page.getByRole('button',{name:'Filtres',exact:true}).click();
      await page.getByRole('combobox',{name:'Provenance',exact:true}).selectOption('character');
      await measure(page,`03-filters-${width}`);
      await page.keyboard.press('Escape');
      await expect(page.getByRole('button',{name:'Character Retirer le filtre provenance'})).toBeVisible();
      await page.getByRole('button',{name:'Character Retirer le filtre provenance'}).click();
      await page.getByRole('button',{name:'Filtres',exact:true}).click();
      await page.getByRole('combobox',{name:'Modèle',exact:true}).selectOption('Kling 4');
      await page.getByRole('combobox',{name:'Période',exact:true}).selectOption('7');
      await page.keyboard.press('Escape');
      assert.ok((await page.locator('.compact-media-name').allTextContents()).every(name=>name.startsWith('Kling 4')));
      await measure(page,`03-model-period-${width}`);
      await page.getByRole('button',{name:'Kling 4 Retirer le filtre modèle'}).click();
      await page.getByRole('button',{name:'7 jours Retirer le filtre période'}).click();
      await page.getByRole('searchbox',{name:'Rechercher des médias'}).fill('danseuse');
      await expect(page.locator('.compact-media-tile').first()).toContainText('Character');
      await page.getByRole('button',{name:'Effacer la recherche',exact:true}).click();
      for(const row of [page.locator('.compact-media-tile').nth(0),page.locator('.compact-media-tile').nth(1)])await row.locator('.compact-media-check').click();
      await expect(page.locator('.selection-summary')).toContainText('2 sélectionnés');
      await measure(page,`04-bulk-${width}`);
      await page.getByRole('button',{name:'Effacer la sélection',exact:true}).click();
      await page.locator('.compact-media-preview').first().click();
      await expect(page.getByRole('dialog',{name:'Aperçu du média'})).toBeVisible();
      await measure(page,`05-viewer-${width}`);
      await page.getByRole('button',{name:'Fermer Aperçu du média'}).click();
      // A personal label is optional, searchable, and never changes the technical name or ID.
      await page.locator('[data-media-key="demo-2"] .compact-media-preview').click();
      const viewer=page.getByRole('dialog',{name:'Aperçu du média'});
      await expect(viewer.locator('.viewer-prompt')).toContainText('danseuse');
      await viewer.getByRole('textbox',{name:'Repère personnel · facultatif'}).fill('Plan à garder');
      await viewer.getByRole('button',{name:'Enregistrer le repère'}).click();
      await expect(viewer.getByRole('heading',{name:'Plan à garder'})).toBeVisible();
      await viewer.getByText('Nom technique',{exact:true}).click();
      await expect(viewer.locator('.technical-name code')).toHaveText('character-output-00000002.png');
      await viewer.getByRole('button',{name:'Ajouter aux favoris',exact:true}).click();
      await expect(viewer.getByRole('button',{name:'Retirer des favoris',exact:true})).toHaveAttribute('aria-pressed','true');
      await page.getByRole('button',{name:'Fermer Aperçu du média'}).click();
      await page.getByRole('searchbox',{name:'Rechercher des médias'}).fill('Plan à garder');
      await expect(page.locator('.compact-media-tile')).toHaveCount(1);
      await expect(page.locator('.compact-media-tile')).toHaveAttribute('data-media-key','demo-2');
      await page.getByRole('button',{name:'Effacer la recherche',exact:true}).click();
      // On mobile the existing global navigation is intentionally outside this spike.
      await page.getByRole('button',{name:'Scénarios',exact:true}).click();
      await page.getByRole('button',{name:'Tester le sélecteur de références',exact:true}).click();
      const picker = page.getByRole('dialog',{name:'Choisir des références',exact:true});
      await expect(picker).toBeVisible();
      await expect(picker.locator('.compact-media-tile').first()).toBeVisible();
      await measure(page,`06-picker-${width}`);
      const rows = picker.locator('.compact-media-tile');
      const names = await rows.locator('.compact-media-name').allTextContents();
      await rows.nth(0).locator('.compact-media-check').click();
      await rows.nth(1).locator('.compact-media-check').click();
      await picker.getByRole('button',{name:'Vérifier l’ordre',exact:true}).click();
      await picker.getByRole('button',{name:`Monter ${names[1]}`,exact:true}).click();
      await expect(picker.locator('.basket li .basket-name').first()).toHaveText(names[1]);
      await measure(page,`07-picker-basket-${width}`);
      await picker.getByRole('button',{name:'Ajouter 2 références',exact:true}).click();
      await expect(page.locator('.draft-ref')).toHaveCount(2);
      await expect(page.locator('.draft-ref img').first()).toHaveAttribute('alt',names[1]);
      await page.getByRole('button',{name:'Remplacer la référence 1',exact:true}).click();
      const replace = page.getByRole('dialog',{name:'Remplacer la référence 1',exact:true});
      const third = replace.locator('.compact-media-tile').nth(2);
      await third.locator('.compact-media-inspect').click();
      await expect(page.getByRole('dialog',{name:'Aperçu du média'})).toBeVisible();
      await page.getByRole('button',{name:'Fermer Aperçu du média'}).click();
      await expect(page.locator('.draft-ref')).toHaveCount(2);
      const replacementName = await third.locator('.compact-media-name').textContent();
      await third.locator('.compact-media-preview').click();
      await expect(page.locator('.draft-ref')).toHaveCount(2);
      await expect(page.locator('.draft-ref img').first()).toHaveAttribute('alt',replacementName!);
      await measure(page,`08-create-references-${width}`);
      await page.getByRole('button',{name:'Retour aux médias'}).click();
      await page.getByRole('button',{name:'Filtres',exact:true}).click();
      await page.getByRole('combobox',{name:'Provenance',exact:true}).selectOption('character');
      await page.keyboard.press('Escape');
      await page.locator('[data-media-key="demo-2"] .compact-media-check').click();
      await page.getByRole('button',{name:'Scénarios',exact:true}).click();
      await page.getByRole('button',{name:'Tester le sélecteur de références',exact:true}).click();
      await picker.getByRole('button',{name:'Fermer Choisir des références'}).click();
      await page.getByRole('button',{name:'Retour aux médias'}).click();
      await expect(page.getByRole('button',{name:'Character Retirer le filtre provenance'})).toBeVisible();
      await expect(page.locator('[data-media-key="demo-2"]')).toHaveAttribute('aria-selected','true');
      await expect(page.locator('.selection-summary')).toContainText('1 sélectionné');
      await display(page,'list');
      await page.reload();
      await expect(page.locator('.compact-media-canvas')).toHaveAttribute('data-layout','list');
      assert.deepEqual(originalRequests,[],'grids and previews never fetch fake original URLs');
      await context.close();
    }
    for(const state of ['loading','empty','error','partial']) {
      const page=await browser.newPage({viewport:{width:390,height:844}});
      watch(page);
      await page.goto(`${prototype.url}/?state=${state}`);
      if(state==='partial'){
        await expect(page.locator('.compact-media-tile').first()).toBeVisible();
        await page.locator('.compact-media-check').nth(0).click();await page.locator('.compact-media-check').nth(1).click();
        await page.locator('.bulk-actions').getByRole('button',{name:'Favoris',exact:true}).click();
        await expect(page.getByRole('alert')).toContainText('1 confirmés · 1 échecs');
        await expect(page.locator('.selection-summary')).toContainText('1 sélectionné');
      }
      if(state==='error'){
        await expect(page.getByRole('alert')).toBeVisible();await measure(page,'09-error-390');
        await page.getByRole('button',{name:'Réessayer',exact:true}).click();
        await expect(page.locator('.compact-media-tile').first()).toBeVisible();
      }
      await measure(page,`10-${state}-390`);await page.close();
    }
    const volume=await browser.newPage({viewport:{width:1440,height:1000}});
    watch(volume);
    await volume.goto(`${prototype.url}/?count=10000&loaded=all&collections=1000`);
    await expect(volume.locator('.compact-media-tile').first()).toBeVisible();
    const stress = await measure(volume,'11-volume-10000');
    assert.ok(stress.domCards < 120,`10k assets render ${stress.domCards} tiles`);
    const initialHeight = await volume.locator('.compact-media-grid').evaluate(el=>el.scrollHeight);
    await volume.locator('.compact-media-grid').evaluate(el=>el.scrollTo(0,el.scrollHeight));
    // Recycled DOM order is not the collection order. Assert the exact last asset.
    await expect(volume.locator('[data-media-key="demo-9997"]')).toBeInViewport();
    await settleImages(volume);
    assert.equal(await volume.locator('.compact-media-grid').evaluate(el=>el.scrollHeight),initialHeight,'scroll height stays stable after mounting distant posters');
    await verifyMosaic(volume);
    await measure(volume,'11-volume-last-mosaic');
    for(const mode of ['grid','list','mosaic'] as const){
      await display(volume,mode);
      await volume.locator('[data-media-key="demo-1"]').press('End');
      await expect(volume.locator('[data-media-key="demo-9997"]')).toBeFocused();
      await expect(volume.locator('[data-media-key="demo-9997"]')).toBeInViewport();
      assert.ok(await volume.locator('.compact-media-tile').count()<120,'virtual DOM stays bounded at the end');
      await volume.locator('[data-media-key="demo-9997"]').press('Home');
      await expect(volume.locator('[data-media-key="demo-1"]')).toBeFocused();
    }
    await volume.getByRole('button',{name:'Tous les médias',exact:true}).click();
    await expect(volume.locator('.collection-row')).toHaveCount(30);
    await volume.getByRole('button',{name:'Afficher 30 de plus',exact:true}).click();
    await expect(volume.locator('.collection-row')).toHaveCount(60);
    await volume.getByRole('searchbox',{name:'Rechercher une collection'}).fill('1000');
    await expect(volume.getByRole('navigation',{name:'Collections',exact:true}).getByRole('button',{name:'Collection de démonstration 1000',exact:true})).toBeVisible();
    await measure(volume,'12-collection-search-1000');
    await volume.keyboard.press('Escape');
    await volume.locator('[data-media-key="demo-1"] .compact-media-check').click();
    await volume.locator('.bulk-actions').getByRole('button',{name:'Collections',exact:true}).click();
    await expect(volume.locator('.bulk-collection-list > button')).toHaveCount(30);
    await volume.getByRole('searchbox',{name:'Rechercher une collection de destination'}).fill('1000');
    await expect(volume.locator('.bulk-collection-list > button')).toHaveCount(1);
    await volume.getByRole('button',{name:'Collection de démonstration 1000',exact:true}).click();
    await expect(volume.locator('.selection-summary')).toHaveCount(0);
    await volume.getByRole('button',{name:'Tous les médias',exact:true}).click();
    await volume.getByRole('navigation',{name:'Collections',exact:true}).getByRole('button',{name:'Collection de démonstration 1000',exact:true}).click();
    await expect(volume.locator('.compact-media-tile')).toHaveCount(1);
    await expect(volume.locator('.compact-media-tile')).toHaveAttribute('data-media-key','demo-1');
    await volume.getByRole('button',{name:'Collection de démonstration 1000',exact:true}).click();
    await volume.getByRole('button',{name:'Tous les médias',exact:true}).click();
    await volume.getByRole('button',{name:'Changer le thème',exact:true}).click();
    await measure(volume,'13-dark-desktop');await volume.close();
    const mobileVolume=await browser.newPage({viewport:{width:390,height:844},hasTouch:true});
    watch(mobileVolume);
    await mobileVolume.goto(`${prototype.url}/?count=10000&loaded=all`);
    for(const mode of ['mosaic','grid','list'] as const){
      await display(mobileVolume,mode);
      const height=await mobileVolume.locator('.compact-media-grid').evaluate(el=>el.scrollHeight);
      await mobileVolume.locator('.compact-media-grid').evaluate(el=>el.scrollTo(0,el.scrollHeight));
      await expect(mobileVolume.locator('[data-media-key="demo-9997"]')).toBeInViewport();
      await settleImages(mobileVolume);
      assert.equal(await mobileVolume.locator('.compact-media-grid').evaluate(el=>el.scrollHeight),height);
      if(mode==='mosaic')await verifyMosaic(mobileVolume);
      const result=await measure(mobileVolume,`14-volume-mobile-${mode}`);
      assert.ok(result.domCards<100,'mobile volume stays virtualized');
    }
    await mobileVolume.close();
    for(const width of [1440,390]) {
      const page=await browser.newPage({viewport:{width,height:width>700?1000:844}});
      // Resolve thumbnails to the same local public assets used by the proposed layout.
      await page.route('**/assets/**',async route=>route.fulfill({response:await page.request.get(prototype.url+new URL(route.request().url()).pathname)}));
      await page.goto(baseline.url);await expect(page.locator('.compact-media-tile').first()).toBeVisible();
      await settleImages(page);
      const baselineMeasure=await page.evaluate(()=>{const grid=document.querySelector('.compact-media-canvas')!.getBoundingClientRect();return{width:innerWidth,grid:{x:grid.x,y:grid.y,width:grid.width,height:grid.height},domCards:document.querySelectorAll('.compact-media-tile').length,scrollWidth:document.documentElement.scrollWidth};});
      measures.push({label:`baseline-${width}`,...baselineMeasure});
      await page.screenshot({path:`${evidence}/00-baseline-${width}.png`});await page.close();
    }
    assert.deepEqual(appStateErrors,[],'no prototype JS errors across tested states');
  } finally {
    await writeFile(`${evidence}/measurements.json`,JSON.stringify({base:'86b598f88706cd23a685292d5675939e0cd09c8a',synthetic:true,measures,appStateErrors},null,2));
    await browser.close();await prototype.close();await baseline.close();
  }
});
