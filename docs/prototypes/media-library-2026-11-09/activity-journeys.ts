import assert from 'node:assert/strict';
import { expect, type Page } from '@playwright/test';

/** Called only by the hosted browser suite. All records and transfers are synthetic. */
export async function verifyActivityJourneys(page:Page,width:number,measure:(page:Page,label:string)=>Promise<unknown>) {
  const navigate=async(name:string)=>{
    if(width<=700){await page.getByRole('button',{name:'Navigation',exact:true}).click();await page.getByRole('navigation',{name:'Navigation mobile'}).getByRole('button',{name,exact:true}).click();}
    else await page.locator('.app-rail').getByRole('button',{name,exact:true}).click();
  };
  const open=async(id:string)=>page.locator(`.compact-media-tile[data-media-key="${id}"] .compact-media-preview`).click();
  const row=(id:string)=>page.locator(`[data-activity-id="${id}"]`);
  await navigate('Activité');
  await expect(page.locator('.activity-row')).toHaveCount(24);
  await expect(page.locator('.activity-list img, .activity-list video')).toHaveCount(0);
  const height=await row('activity-demo-1').evaluate(el=>el.getBoundingClientRect().height);
  assert.ok(height<=(width<=700?96:58),'activity remains a compact text list');
  await measure(page,`15-activity-${width}`);

  // One operation, two results: no duplicate file identities or second gallery in Activity.
  await row('activity-demo-4').locator('.activity-description').click();
  assert.deepEqual(await page.locator('.activity-output-preview [data-media-key]').evaluateAll(items=>items.map(el=>el.getAttribute('data-media-key'))),['demo-4','demo-17']);
  await page.getByRole('button',{name:'Voir 2 médias dans la bibliothèque'}).click();
  await expect(page.locator('.compact-media-tile')).toHaveCount(2);
  assert.deepEqual((await page.locator('.compact-media-tile').evaluateAll(items=>items.map(el=>el.getAttribute('data-media-key')))).sort(),['demo-17','demo-4']);
  await measure(page,`16-activity-results-${width}`);
  await open('demo-4');
  await page.getByRole('button',{name:'Retrouver la génération',exact:true}).click();
  await expect(page.getByRole('dialog',{name:'Détails de la génération'})).toBeVisible();
  await expect(page.locator('.activity-output-preview [data-media-key]')).toHaveCount(2);
  await page.getByRole('button',{name:'Reprendre dans Storyboard'}).click();
  await expect(page.getByRole('dialog',{name:'Storyboard',exact:true})).toBeVisible();
  await expect(page.getByRole('textbox',{name:'Instructions'})).toHaveValue('Deux personnages échangent au bord d’une voie ferrée, plan en hauteur.');
  await page.getByRole('button',{name:'Fermer Storyboard'}).click();

  // Pending/failed work has no fictional result. Existing Studio context is a separate action.
  await page.getByRole('combobox',{name:'État des générations'}).selectOption('pending');
  await expect(page.locator('.activity-row')).toHaveCount(1);
  await row('activity-pending').getByRole('button',{name:'Détails',exact:true}).click();
  await expect(page.locator('.activity-output-preview')).toHaveCount(0);
  await expect(page.getByRole('button',{name:'Reprendre dans Créer'})).toHaveCount(0);
  await page.getByRole('button',{name:'Ouvrir le projet Studio'}).click();
  await expect(page.getByRole('dialog',{name:'Projet Studio'})).toContainText('Film de démonstration');
  await expect(page.locator('.handoff-assets')).toHaveCount(0);
  await measure(page,`17-activity-studio-${width}`);
  await page.getByRole('button',{name:'Fermer Projet Studio'}).click();
  await page.getByRole('combobox',{name:'État des générations'}).selectOption('failed');
  await expect(page.locator('.activity-row')).toHaveCount(1);
  await row('activity-failed').getByRole('button',{name:'Détails',exact:true}).click();
  await expect(page.getByRole('dialog',{name:'Détails de la génération'})).toContainText('n’a pas produit de résultat');
  await expect(page.locator('.activity-output-preview')).toHaveCount(0);
  await page.getByRole('button',{name:'Fermer Détails de la génération'}).click();

  // MCP is a proven origin in the mock, not a new file bucket or an invented external chat link.
  await page.getByRole('combobox',{name:'État des générations'}).selectOption('all');
  await page.getByRole('combobox',{name:'Origine des générations'}).selectOption('mcp');
  assert.ok((await page.locator('.activity-origin').allTextContents()).every(text=>text.includes('MCP')));
  await row('activity-demo-1').locator('.activity-description').click();
  await page.getByRole('button',{name:'Reprendre dans Créer'}).click();
  await expect(page.locator('[data-draft-model]')).toHaveText('Kling 4');
  await expect(page.getByRole('textbox',{name:'Votre scène'})).toHaveValue('Un raton laveur dans une ruelle de nuit, lumières colorées et vapeur.');
  await expect(page.locator('.draft-ref')).toHaveCount(0);
  await measure(page,`18-activity-resume-${width}`);
  // Returning retains the Activity filter; the media picker has its own independent state.
  await navigate('Activité');
  await expect(page.getByRole('combobox',{name:'Origine des générations'})).toHaveValue('mcp');
  await navigate('Médias');
  await expect(page.locator('.activity-context')).toHaveCount(0);
  await open('demo-3');
  await expect(page.getByRole('button',{name:'Retrouver la génération'})).toHaveCount(0);
  await expect(page.getByRole('dialog',{name:'Aperçu du média'})).toContainText('Média importé · aucune génération associée.');
  await page.getByRole('button',{name:'Créer une vidéo',exact:true}).click();
  await expect(page.locator('.draft-ref')).toHaveCount(1);
  await expect(page.locator('.draft-ref')).toHaveAttribute('data-media-key','demo-3');

  // Both tools and Studio receive exactly the selected record, without output-as-input confusion.
  await navigate('Médias');
  await open('demo-4');
  await page.getByRole('button',{name:'Angle',exact:true}).click();
  await expect(page.locator('.handoff-asset')).toHaveCount(1);
  await expect(page.locator('.handoff-asset')).toHaveAttribute('data-media-key','demo-4');
  await page.getByRole('button',{name:'Fermer Angle'}).click();
  await open('demo-4');
  await page.getByRole('dialog',{name:'Aperçu du média'}).getByRole('button',{name:'Studio',exact:true}).click();
  await expect(page.locator('.handoff-asset')).toHaveAttribute('data-media-key','demo-4');
  await page.getByRole('combobox',{name:'Placement',exact:true}).selectOption('replace');
  await expect(page.getByRole('combobox',{name:'Clip à remplacer'})).toBeVisible();
  await page.getByRole('button',{name:'Appliquer au film · démo'}).click();
  await expect(page.getByRole('button',{name:'Modification simulée'})).toBeVisible();
  await measure(page,`19-media-studio-${width}`);
  await page.getByRole('button',{name:'Fermer Studio'}).click();
}
