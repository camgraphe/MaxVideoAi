import { profiles, media, labels, defaults, icon } from './data.js';
import { catalogue } from './catalog.generated.js';
import { createModelChoices, money, soundLabel } from './model-choice.js';

const { initialModelChoice, modelFor, differences, matchingQuote, adaptChoice } = createModelChoices(catalogue);

const $ = (s) => document.querySelector(s);
const esc = (s = '') => String(s).replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
const freshDraft = kind => ({ profile: defaults[kind], prompt: '', refs: [], output: null, format: '16:9', duration: '5 s', modelChoice: initialModelChoice() });
const state = {
  screen: 'create', kind: 'video', drafts: Object.fromEntries(Object.keys(labels).map(k => [k, freshDraft(k)])),
  selected: null, query: '', filter: 'all', panel: null, picks: [], returnContext: null,
  appearance: 'dark', reduced: false, accountTab: 'appearance', name: 'Créateur', undo: null,
};
state.drafts.video.output = 'v1';
state.drafts.video.prompt = 'Un mouvement de caméra lent. Préserver la lumière et la matière du plan.';
try { state.appearance = ['dark','light','system'].includes(localStorage.getItem('maxvideoai-concept-theme')) ? localStorage.getItem('maxvideoai-concept-theme') : 'dark'; } catch {}
let refCounter = 0, importCounter = 0, restoreFocus = null, noticeTimer;
const draft = () => state.drafts[state.kind];
const profile = () => profiles[draft().profile];
const asset = id => media.find(m => m.id === id);
const roleFor = id => profile().roles.find(r => r.id === id);
const byId = id => draft().refs.find(r => r.id === id);
const button = (label, action, ico, attrs = '', cls = '') => `<button class="btn ${cls}" data-action="${action}" ${attrs}>${ico ? icon(ico) : ''}${label}</button>`;
const wave = () => `<div class="wave" aria-hidden="true">${Array.from({length:55}, (_,i) => `<i style="height:${18 + (Math.sin(i * 2.3) + 1) * 25 + (i % 6) * 4}%"></i>`).join('')}</div>`;

function applyTheme() {
  document.documentElement.dataset.theme = state.appearance === 'system' ? (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light') : state.appearance;
  document.documentElement.dataset.motion = state.reduced ? 'reduced' : 'system';
}
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', applyTheme);

function thumb(m, tag = true) {
  return `<div class="thumb ${m.kind === 'audio' ? 'audio-thumb' : ''}">${m.kind === 'image' ? `<img src="${esc(m.url)}" alt="" loading="lazy" decoding="async" style="object-position:${esc(m.focus||'50% 50%')}">` : m.poster ? `<img src="${esc(m.poster)}" alt="" loading="lazy" decoding="async">` : icon(m.kind)}${tag ? `<span class="kind-tag">${icon(m.kind)}${labels[m.kind]}</span>` : ''}</div>`;
}
function reader(m, cls = 'preview-media') {
  if (m.kind === 'image') return `<img class="${cls}" src="${esc(m.url)}" alt="${esc(m.name)}">`;
  if (m.kind === 'video') return `<video class="${cls}" src="${esc(m.url)}" ${m.poster ? `poster="${esc(m.poster)}"` : ''} controls playsinline preload="none" aria-label="${esc(m.name)}"></video>`;
  return `<div class="sound-stage">${wave()}<h2>${esc(m.name)}</h2><small>Audio · exemple local</small><audio src="${esc(m.url)}" controls preload="none" aria-label="Écouter ${esc(m.name)}"></audio></div>`;
}
function invalidRefs(p = profile(), refs = draft().refs) {
  const counts = {};
  return refs.filter((r, i) => {
    const role = p.roles.find(s => s.id === r.role);
    counts[r.role] = (counts[r.role] || 0) + 1;
    return !role || role.kind !== asset(r.assetId)?.kind || counts[r.role] > role.max || i >= p.max;
  });
}
function missingRequired() { return profile().roles.filter(r => r.required && !draft().refs.some(s => s.role === r.id)); }
function canInsert(role, amount = 1, replaceId = null) {
  if (!role) return false;
  const remaining = draft().refs.filter(r => r.id !== replaceId);
  return remaining.length + amount <= profile().max && remaining.filter(r => r.role === role.id).length + amount <= role.max;
}
function renderReferences() {
  const refs = draft().refs, invalid = invalidRefs(), p = profile();
  const visibleCount = innerWidth <= 350 ? (refs.length > 1 ? 0 : 1) : innerWidth <= 600 ? 2 : innerWidth <= 1100 && innerWidth > 800 ? 3 : 4;
  return `<div class="reference-line"><button class="refs-label" data-action="profile" aria-label="Scénarios de références de démonstration"><strong>Références</strong><small>${refs.length ? p.max ? `${refs.length} / ${p.max}` : `${refs.length} à vérifier` : p.roles.some(r=>r.required) ? 'Source requise' : 'Scénarios · démo'} ${icon('down')}</small></button>
    ${refs.length ? `<div class="ref-thumbs">${refs.slice(0, visibleCount).map((r, i) => {
      const m = asset(r.assetId);
      return `<button class="ref-thumb ${invalid.includes(r) ? 'invalid' : ''}" data-action="reference" data-id="${r.id}" aria-label="Gérer ${esc(m.name)}, ${esc(roleFor(r.role)?.name || r.role)}">${m.kind === 'image' ? `<img src="${esc(m.url)}" alt="" style="object-position:${esc(m.focus||'50% 50%')}">` : icon(m.kind)}<span class="ref-count">${i + 1}</span></button>`;
    }).join('')}${refs.length > visibleCount ? `<button class="refs-extra" data-action="manage" aria-label="Gérer les ${refs.length} références">+${refs.length-visibleCount}</button>` : ''}</div>` : `<span class="reference-empty">${p.roles.length ? 'Image, vidéo ou audio selon le profil' : 'Ce profil utilise uniquement du texte'}</span>`}
    ${p.roles.length ? `<button class="ref-add" data-action="add">${icon('plus')} Ajouter</button>` : ''}
    ${refs.length ? button('Gérer', 'manage', null) : ''}</div>
    ${invalid.length ? `<p class="error">${invalid.length} référence(s) incompatible(s) conservée(s). Changez de profil ou retirez-les du brouillon.</p>` : ''}
    ${missingRequired().length ? `<p class="error">À ajouter : ${missingRequired().map(r => r.name).join(', ')}.</p>` : ''}`;
}
function currentQuote(choice = draft().modelChoice) {
  return matchingQuote(choice, draft().refs.length, missingRequired().length > 0);
}
function quoteDisplay(choice = draft().modelChoice) {
  const quote = state.kind === 'video' ? currentQuote(choice) : null;
  return `<button class="price-readout" data-action="price-info" aria-label="Détails du prix avant génération"><span>${quote ? 'Estimation catalogue' : 'Prix avant génération'}</span><strong>${quote ? esc(money(quote)) : 'Devis à raccorder'}</strong></button>`;
}
function modelToolbar() {
  if (state.kind !== 'video') return `${button(`<span class="profile-name">${esc(profile().name)}</span>${icon('down')}`,'profile',state.kind,'','profile-button')}${button('Réglages','controls','settings','','subtle')}`;
  const model = modelFor(draft().modelChoice);
  return `<button class="model-trigger" data-action="models" aria-label="Choisir un modèle : ${esc(model.label)}"><span class="model-symbol">${icon('video')}</span><span class="model-title"><small>Modèle</small><strong>${esc(model.label)}</strong></span>${icon('down')}</button>${button('Comparer','models','replace','','compare-button')}`;
}
function quickControls() {
  const d = draft();
  if (state.kind !== 'video') return `${state.kind === 'audio' ? '' : button(esc(d.format),'controls',null,'','value')}${state.kind !== 'image' ? button(esc(d.duration),'controls',null,'','value') : ''}${button('Options','controls','settings','','value')}`;
  const c = d.modelChoice;
  return `${button(`${c.duration} s`,'controls',null,'aria-label="Régler la durée"','value')}${button(esc(c.resolution),'controls',null,'aria-label="Régler la résolution"','value')}${button(esc(c.format),'controls',null,'aria-label="Régler le format"','value')}${button(soundLabel(c),'controls','audio','aria-label="Régler le son"','value')}${button('Options','controls','settings','','value')}`;
}
function modelControls(choice) {
  const model = modelFor(choice);
  const select = (name, label, values) => `<label>${label}<select id="model-${name}" data-model-field="${name}" aria-label="${label}">${values.map(([value,text])=>`<option value="${esc(value)}" ${String(choice[name])===String(value)?'selected':''}>${esc(text)}</option>`).join('')}</select></label>`;
  return `<div class="model-fields">${select('duration','Durée',model.durations.map(v=>[v,`${v} s`]))}${select('resolution','Résolution',model.resolutions.map(r=>[r.value,r.label]))}${select('format','Format',model.formats.map(v=>[v,v==='auto'?'Automatique':v]))}${select('audio','Son du clip',model.audio==='optional'?[[true,'Avec son'],[false,'Sans son']]:[[model.audio==='included',model.audio==='included'?'Son inclus':'Sans son']])}</div>`;
}
function changeSummary(choice) {
  const previous = draft().modelChoice;
  const names = {duration:'Durée',resolution:'Résolution',format:'Format',audio:'Son'};
  const value = (key,c) => key==='audio'?soundLabel(c):key==='duration'?`${c[key]} s`:c[key];
  const changes = Object.keys(names).filter(key=>previous[key]!==choice[key]);
  return changes.length ? `<div class="model-changes"><small>Changements proposés</small>${changes.map(key=>`<div><span>${names[key]}</span><span>${esc(value(key,previous))} → <strong>${esc(value(key,choice))}</strong></span></div>`).join('')}</div>` : '<p class="panel-intro model-preserved">Vos réglages sont conservés.</p>';
}
function modelList() {
  const choice = draft().modelChoice;
  return `<p class="panel-intro">Même durée, résolution, format et son. Six modèles du catalogue pour éprouver ce choix.</p><div class="comparison-context"><span>${choice.duration} s</span><span>${esc(choice.resolution)}</span><span>${esc(choice.format)}</span><span>${soundLabel(choice)}</span>${button('Modifier','controls','settings')}</div>${draft().refs.length || missingRequired().length ? '<p class="error">Les devis avec références ne sont pas raccordés dans cette maquette.</p>' : ''}<div class="model-list">${catalogue.models.map(model=>{
    const proposed = {...choice,modelId:model.id}, diff = differences(model, choice), quote = currentQuote(proposed), selected = choice.modelId === model.id;
    return `<button class="model-option ${selected?'selected':''}" data-action="candidate" data-id="${model.id}" aria-label="Examiner ${esc(model.label)}${selected?', modèle actuel':''}"><span class="model-glyph">${selected?icon('check'):icon('video')}</span><span class="model-description"><strong>${esc(model.label)}</strong><small>${diff.length ? `${diff.join(' · ')} à adapter` : 'Réglages conservés'}${selected?' · Actuel':''}</small></span><span class="model-cost">${diff.length?'Adapter':quote?esc(money(quote)):'Devis à raccorder'}${icon('arrow')}</span></button>`;
  }).join('')}</div><div class="quote-scope"><span>Estimation catalogue · Member · USD</span>${button('Détails','price-info',null)}</div>`;
}
function returnBar() {
  const c = state.returnContext;
  return c ? `<div class="returnbar"><div><strong>Créer une référence ${labels[state.kind].toLowerCase()}</strong><small>Retour à votre brouillon ${labels[c.kind].toLowerCase()} · ${esc(c.role.name)}</small></div><div class="row">${button('Annuler le détour','cancel-return','back')}${draft().output ? button('Utiliser et revenir','complete-return','check','','primary') : ''}</div></div>` : '';
}
function creator() {
  const d = draft(), m = asset(d.output);
  return `${returnBar()}<div class="pagehead"><h1>Créer</h1><div class="modes" aria-label="Type de création">${Object.entries(labels).map(([k,l]) => `<button class="mode ${state.kind === k ? 'active' : ''}" data-action="kind" data-kind="${k}" aria-pressed="${state.kind===k}">${icon(k)}${l}</button>`).join('')}</div>${button('Nouveau','new','plus')}</div>
    <div class="work-layout"><section class="workbench" aria-label="Créateur ${labels[state.kind]}">
      <div class="toolbar">${modelToolbar()}</div>
      ${m ? `<div class="screen">${reader(m,'')}</div><div class="asset-caption"><div><strong>${esc(m.name)}</strong><small style="display:block;margin-top:4px">Exemple local · aucune génération</small></div>${button('Réutiliser','reuse', 'replace', `data-id="${m.id}"`)}</div>` : `<div class="screen screen-empty"><div class="empty-icon">${icon(state.kind)}</div><h2>${state.kind === 'audio' ? 'Donnez du son à votre idée.' : state.kind === 'image' ? 'Donnez forme à votre idée.' : 'Mettez votre idée en mouvement.'}</h2><p>Une instruction suffit pour commencer.</p></div>`}
      <div id="references">${renderReferences()}</div>
      <div class="compose"><label for="prompt">${state.kind === 'audio' && d.profile === 'voice' ? 'Votre script' : 'Votre direction'}</label><textarea id="prompt" rows="3" placeholder="Décrivez ce que vous voulez créer…">${esc(d.prompt)}</textarea></div>
      <div class="commandbar"><div class="quick-values">${quickControls()}</div><div class="creation-action">${quoteDisplay()}${button('Simuler','simulate','arrow',invalidRefs().length || missingRequired().length ? 'disabled' : '', 'primary generate')}</div></div>
    </section><aside class="shelf"><div class="shelf-head"><span class="tiny">Vos médias</span><button class="icon-btn" data-action="navigate" data-screen="library" aria-label="Ouvrir les médias">${icon('arrow')}</button></div><div class="shelf-items">${media.slice(0,4).map(m => `<button class="shelf-media" data-action="preview" data-id="${m.id}">${thumb(m)}<div class="shelf-caption">${esc(m.name)}</div></button>`).join('')}</div>${button('Tout voir','navigate',null,'data-screen="library"','','')}</aside></div>`;
}
const filteredMedia = () => media.filter(m => (state.filter === 'all' || m.kind === state.filter) && m.name.toLocaleLowerCase('fr').includes(state.query.toLocaleLowerCase('fr')));
function libraryGrid() {
  const rows = filteredMedia();
  return rows.length ? rows.map(m => `<article class="media-card ${state.selected===m.id?'selected':''}"><button data-action="select-media" data-id="${m.id}" aria-pressed="${state.selected===m.id}" aria-label="Sélectionner ${esc(m.name)}">${thumb(m)}<div class="caption"><strong>${esc(m.name)}</strong>${state.selected===m.id?icon('check'):''}</div><small>${esc(m.source)}</small></button></article>`).join('') : `<div class="empty-list">Aucun média trouvé. Essayez un autre terme.</div>`;
}
function selectionBar() {
  const m=asset(state.selected);return m?`<div class="selectionbar"><span class="grow">${icon(m.kind)} ${esc(m.name)}</span><div class="row wrap">${button('Aperçu','preview','play',`data-id="${m.id}"`)}${button('Réutiliser','reuse','replace',`data-id="${m.id}"`,'primary')}${button('Désélectionner','deselect',null)}</div></div>`:'';
}
function library() {
  return `<div class="pagehead"><div><p class="tiny" style="margin-bottom:8px">Votre matière première</p><h1>Médias</h1></div>${button('Importer','library-import','upload','','outline')}</div><div class="library-toolbar"><div class="filters" aria-label="Filtrer les médias">${[['all','Tous'],...Object.entries(labels)].map(([k,l])=>`<button class="filter ${state.filter===k?'active':''}" data-action="filter" data-kind="${k}" aria-pressed="${state.filter===k}">${l}</button>`).join('')}</div><label class="search">${icon('search')}<input type="search" id="library-search" value="${esc(state.query)}" placeholder="Rechercher un média" aria-label="Rechercher un média"></label></div><div id="media-grid" class="media-grid">${libraryGrid()}</div><div id="selection">${selectionBar()}</div>`;
}
function settings() {
  const tabs = [['appearance','settings','Préférences'],['profile','create','Profil'],['connections','connect','Connexions'],['activity','library','Activité & crédits']];
  let content='';
  if(state.accountTab==='appearance')content=`<h2>À votre façon.</h2><div class="preference"><div><h3>Apparence</h3><small>Votre espace, votre lumière.</small></div><div class="theme-options">${[['light','Clair'],['dark','Sombre'],['system','Système']].map(([k,l])=>`<button data-action="theme" data-value="${k}" class="${state.appearance===k?'active':''}" aria-pressed="${state.appearance===k}">${l}</button>`).join('')}</div></div><div class="preference"><div><h3>Réduire les mouvements</h3><small>Respecte aussi le réglage de votre appareil.</small></div><button class="toggle" data-action="motion" role="switch" aria-label="Réduire les mouvements" aria-checked="${state.reduced}"><span></span></button></div><div class="preference"><div><h3>Langue</h3><small>Prototype présenté en français.</small></div><span class="chip">Français</span></div>`;
  else if(state.accountTab==='profile')content=`<h2>Votre profil</h2><form id="profile-form" class="profile-form"><label>Nom affiché<input id="profile-name" name="name" value="${esc(state.name)}" maxlength="80" required autocomplete="off"></label><small>Modifications locales à cette maquette.</small><div class="row">${button('Enregistrer localement','save-name',null,'type="submit"','primary')}${button('Annuler','cancel-name',null,'type="button"')}</div></form>`;
  else if(state.accountTab==='connections')content=`<h2>Vos assistants</h2><p class="panel-intro" style="margin-top:12px">Un même espace de médias, accessible depuis vos outils.</p>${['ChatGPT','Claude','Codex'].map(name=>`<div class="connection">${icon('connect')}<div class="grow"><h3>${name}</h3><small>État réel à raccorder</small></div>${button('Voir le parcours','connection',null,`data-name="${name}"`,'outline')}</div>`).join('')}`;
  else content=`<h2>Activité & crédits</h2><p class="panel-intro" style="margin-top:14px">Ces accès restent présents dans la nouvelle navigation. Le prototype n’interroge aucun compte.</p>${[['Accueil','/dashboard'],['Historique des générations','/jobs'],['Crédits et factures','/billing']].map(([name,path])=>`<div class="preference"><h3>${name}</h3><span class="chip">${path}</span></div>`).join('')}`;
  return `<div class="pagehead"><h1>Votre espace</h1><span class="chip">Préférences locales</span></div><div class="settings-layout"><nav class="settings-nav" aria-label="Paramètres">${tabs.map(([k,i,l])=>`<button data-action="settings-tab" data-tab="${k}" class="${state.accountTab===k?'active':''}" aria-current="${state.accountTab===k?'page':'false'}">${icon(i)}${l}</button>`).join('')}</nav><section>${content}</section></div>`;
}
function futureScreen() {
  const studio=state.screen==='studio';
  return `<div class="placeholder-page"><div class="empty-icon">${icon(state.screen)}</div><span class="chip">Lot suivant · hors démonstration</span><h1>${studio?'Finaliser dans le Studio':'Les outils, au bon endroit.'}</h1><p>${studio?'Le Studio reprendra cette grammaire de sélection et de commandes. La première intégration de montage placera des plans dans l’ordre sur une timeline enregistrée.':'Angle, personnages, storyboard, upscale et détourage garderont leurs fonctions et recevront un média compatible depuis le créateur ou la bibliothèque.'}</p><ul>${studio?'<li>Sélection de plans → ordre → timeline.</li><li>Audio prévu dans les raccords ; piste séparée à spécifier.</li><li>Aucune timeline enregistrée par cette maquette.</li>':'<li>Choisir ou importer une source.</li><li>Appliquer l’outil et prévisualiser.</li><li>Réutiliser le résultat dans le même brouillon.</li>'}</ul>${button('Parcourir les médias','navigate','library','data-screen="library"','primary')}</div>`;
}
function render() {
  const active = document.activeElement;
  const focus = active?.closest('#app') && active.dataset.action ? {...active.dataset} : null;
  const focusLabel = active?.getAttribute('aria-label'), focusText = active?.textContent;
  applyTheme();
  const nav=[['create','create','Créer'],['library','library','Médias'],['tools','tools','Outils'],['studio','studio','Studio'],['settings','settings','Compte']];
  $('#app').innerHTML=`<div class="app-shell"><nav class="nav" aria-label="Navigation principale"><div class="brand" aria-label="MaxVideoAI">M/</div>${nav.map(([k,i,l])=>`<button class="nav-button ${state.screen===k?'active':''} ${k==='settings'?'nav-bottom':''}" data-action="navigate" data-screen="${k}" aria-current="${state.screen===k?'page':'false'}">${icon(i)}${l}</button>`).join('')}</nav><main class="main"><header class="topbar"><span class="wordmark">MaxVideoAI <span class="muted">/ Espace créatif</span></span><div class="top-right"><span class="demo-label"><i class="dot"></i>Prototype · local</span>${button('<span>Assistants</span>','assistants','connect','aria-label="Assistants"')}<div class="avatar" aria-hidden="true">${esc(state.name.slice(0,2).toUpperCase())}</div></div></header><div class="content">${state.screen==='create'?creator():state.screen==='library'?library():state.screen==='settings'?settings():futureScreen()}</div></main></div>`;
  if(focus){
    const matches=[...document.querySelectorAll('#app [data-action]')].filter(el=>Object.entries(focus).every(([key,value])=>el.dataset[key]===value));
    (matches.find(el=>focusLabel&&el.getAttribute('aria-label')===focusLabel)||matches.find(el=>el.textContent===focusText)||matches[0])?.focus({preventScroll:true});
  }
}
function toast(message, undo=null) {
  clearTimeout(noticeTimer);state.undo=undo;
  $('#notice').innerHTML=`<span>${esc(message)}</span>${undo?button('Annuler','undo',null):''}`;
  $('#notice').classList.add('shown');noticeTimer=setTimeout(()=>{$('#notice').classList.remove('shown');state.undo=null;},undo?12000:6500);
}
function openPanel(type, args={}) {
  if(!$('#panel').open){const el=document.activeElement;restoreFocus=el?.dataset?.action ? {action:el.dataset.action,id:el.dataset.id,kind:el.dataset.kind,label:el.getAttribute('aria-label'),text:el.textContent} : null;}
  state.panel={type,...args};state.picks=[];renderPanel();
  if(!$('#panel').open)$('#panel').showModal();
  $('#panel .icon-btn')?.focus();
}
function closePanel() {
  $('#panel').close();$('#panel').innerHTML='';state.panel=null;
  if(restoreFocus){
    const f=restoreFocus,matches=[...document.querySelectorAll('#app [data-action]')].filter(el=>el.dataset.action===f.action&&el.dataset.id===f.id&&el.dataset.kind===f.kind);
    (matches.find(el=>f.label&&el.getAttribute('aria-label')===f.label)||matches.find(el=>el.textContent===f.text)||matches[0])?.focus();
  }
}
function panelLayout(title,body) {
  $('#panel').innerHTML=`<div class="panel-header"><h2 id="panel-title">${title}</h2><button class="icon-btn" data-action="close" aria-label="Fermer">${icon('close')}</button></div><div class="panel-body">${body}</div>`;
}
function renderPanel() {
  const p=state.panel;if(!p)return;
  if(p.type==='models'){
    panelLayout('Choisir votre modèle',modelList());
  }else if(p.type==='candidate'){
    const choice=p.choice, model=modelFor(choice);
    panelLayout(esc(model.label),`${button('Tous les modèles','models','back','','back-models')}${modelControls(choice)}<div id="model-changes">${changeSummary(choice)}</div><div class="panel-footer"><div id="candidate-quote" class="candidate-quote" role="status"><strong>${esc(money(currentQuote(choice)))}</strong><small>Estimation catalogue · Member · USD</small></div>${button('Utiliser ce modèle','apply-model','check','','primary')}</div>`);
  }else if(p.type==='price-info'){
    panelLayout('Le prix avant de créer',`<div class="price-explanation"><p>Le montant affiché correspond à <strong>une vidéo créée depuis du texte</strong>, aux réglages sélectionnés.</p><p>Il provient du catalogue public et du moteur de prix MaxVideoAI, au tarif Member en USD. Cette maquette n’utilise ni votre compte ni les ajustements de prix en base de données.</p><p>Dans l’app, le devis sera confirmé par le serveur avec les références, les options, la quantité et votre tarif. Ici, les devis image, audio et avec références restent à raccorder.</p><small>Catalogue préparé le ${esc(new Intl.DateTimeFormat('fr-FR',{dateStyle:'short'}).format(new Date(catalogue.scope.generatedAt)))}. La simulation ne génère aucun média et ne débite rien.</small></div>`);
  }else if(p.type==='controls' && state.kind==='video'){
    panelLayout('Réglages de création',`${modelControls(draft().modelChoice)}<div class="panel-footer"><div id="settings-quote" class="candidate-quote" role="status"><strong>${esc(money(currentQuote()))}</strong><small>Estimation catalogue · Member · USD</small></div>${button('Terminé','close','check','','primary')}</div>`);
  }else if(p.type==='add'){
    panelLayout('Ajouter une référence',`<p class="panel-intro">Scénario de références indépendant du modèle : limites illustratives pour essayer les interactions.</p>${profile().roles.map(r=>`<div class="role-row">${icon(r.kind)}<div class="grow"><strong>${r.name}</strong><small>${draft().refs.filter(x=>x.role===r.id).length} / ${r.max}${r.required?' · Requise':''}</small><div class="role-options">${button('Choisir','pick',null,`data-role="${r.id}" aria-label="Choisir : ${r.name}" ${canInsert(r)?'':'disabled'}`)}${button('Importer','import',null,`data-role="${r.id}" aria-label="Importer : ${r.name}" ${canInsert(r)?'':'disabled'}`)}${button('Créer','create-reference',null,`data-role="${r.id}" aria-label="Créer : ${r.name}" ${!state.returnContext&&canInsert(r)?'':'disabled'}`)}</div></div></div>`).join('')}<small style="display:block;margin-top:18px">${draft().refs.length} / ${profile().max} au total · limites illustratives du prototype</small>`);
  }else if(p.type==='pick'){
    const role=roleFor(p.role),choices=media.filter(m=>m.kind===role.kind);
    panelLayout(p.replaceId?'Remplacer la référence':role.name,`<p class="panel-intro">${p.replaceId?'La référence actuelle reste en place jusqu’à votre choix.':'Sélectionnez un ou plusieurs médias compatibles.'}</p><div class="picker-grid">${choices.map(m=>`<button class="pick-card" data-action="pick-item" data-id="${m.id}" aria-pressed="${state.picks.includes(m.id)}" aria-label="Choisir ${esc(m.name)}">${thumb(m)}<span class="name">${esc(m.name)}</span>${state.picks.includes(m.id)?`<span class="pick-mark">${icon('check')}</span>`:''}</button>`).join('')}</div><div class="panel-footer"><small>${state.picks.length} sélectionné(s)</small>${button(p.replaceId?'Remplacer':'Ajouter la sélection','confirm-picks','check',!state.picks.length?'disabled':'','primary')}</div>`);
  }else if(p.type==='manage'||p.type==='reference'){
    const refs=p.type==='reference'?[byId(p.id)].filter(Boolean):draft().refs;
    panelLayout(p.type==='reference'?'Cette référence':`Références · ${draft().refs.length}`,`<p class="panel-intro">Retirer agit sur le brouillon. Vos médias restent dans la bibliothèque.</p>${refs.map(r=>{
      const m=asset(r.assetId),i=draft().refs.indexOf(r),role=roleFor(r.role);
      return `<div class="manage-row">${thumb(m,false)}<div><strong>${esc(m.name)}</strong><small>${esc(role?.name||'Incompatible avec ce profil')}</small>${profile().roles.filter(s=>s.kind===m.kind).length?`<label class="role-select">Rôle<select data-role-ref="${r.id}" aria-label="Rôle de ${esc(m.name)}"><option value="" ${role?'':'selected'} disabled>Attribuer un rôle</option>${profile().roles.filter(s=>s.kind===m.kind).map(s=>`<option value="${s.id}" ${r.role===s.id?'selected':''}>${s.name}</option>`).join('')}</select></label>`:''}</div><div class="manage-actions">${button('Aperçu','reference-preview','play',`data-id="${r.id}"`)}${button('Remplacer','replace','replace',`data-id="${r.id}" ${role?'':'disabled'}`)}${button('Retirer','remove','remove',`data-id="${r.id}"`,'danger')}<button class="icon-btn" data-action="move" data-id="${r.id}" data-step="-1" aria-label="Monter ${esc(m.name)}" ${i===0?'disabled':''}>${icon('up')}</button><button class="icon-btn" data-action="move" data-id="${r.id}" data-step="1" aria-label="Descendre ${esc(m.name)}" ${i===draft().refs.length-1?'disabled':''}>${icon('down')}</button></div></div>`;
    }).join('')||'<p class="panel-intro">Aucune référence dans ce brouillon.</p>'}${button('Ajouter une référence','add','plus','','outline')}`);
  }else if(p.type==='profile'){
    panelLayout('Scénarios de références',`<p class="panel-intro">Ces profils servent à tester les interactions. Leurs limites sont illustratives et ne décrivent pas les capacités du modèle sélectionné.</p>${Object.entries(profiles).filter(([,v])=>v.kind===state.kind).map(([key,v])=>`<button class="choice-row" data-action="set-profile" data-value="${key}">${icon(v.kind)}<div class="grow"><strong>${v.name}</strong><small>${v.detail}</small>${invalidRefs(v).length?`<small class="error">${invalidRefs(v).length} référence(s) deviendront incompatibles, sans être effacées.</small>`:""}</div>${draft().profile===key?icon('check'):icon('arrow')}</button>`).join('')}<p class="panel-intro" style="margin-top:18px">Vos références restent conservées si vous changez de profil. Les incompatibilités empêchent la simulation jusqu’à résolution.</p>`);
  }else if(p.type==='controls'){
    panelLayout('Réglages de création',`<p class="panel-intro">Valeurs locales pour éprouver les commandes. Aucun devis n’est calculé.</p><div class="stack">${state.kind!=='audio'?`<label>Format<select id="format"><option ${draft().format==='16:9'?'selected':''}>16:9</option><option ${draft().format==='9:16'?'selected':''}>9:16</option><option ${draft().format==='1:1'?'selected':''}>1:1</option></select></label>`:''}${state.kind!=='image'?`<label>Durée de démonstration<select id="duration"><option ${draft().duration==='5 s'?'selected':''}>5 s</option><option ${draft().duration==='10 s'?'selected':''}>10 s</option></select></label>`:''}</div><div class="panel-footer"><small>Conservés dans le brouillon</small>${button('Terminé','close','check','','primary')}</div>`);
  }else if(p.type==='preview'){
    const m=asset(p.id);panelLayout(esc(m.name),`${reader(m)}<div class="row wrap" style="margin-top:15px">${p.referenceId?button('Retour à la référence','reference','back',`data-id="${p.referenceId}"`):button('Réutiliser','reuse','replace',`data-id="${m.id}"`,'primary')}<a class="btn outline" href="${esc(m.url)}" download="${esc(m.name)}">Télécharger l’original</a></div>`);
  }else if(p.type==='reuse'){
    const m=asset(p.id);const targets=m.kind==='image'?[['image','Créer une image'],['video','Animer cette image']]:m.kind==='video'?[['video','Référence vidéo'],['audio','Sonoriser la vidéo']]:[['video','Référence audio'],['audio','Échantillon vocal']];
    panelLayout('Continuer avec ce média',`${thumb(m)}<div style="margin-top:12px">${targets.map(([kind,name])=>`<button class="choice-row" data-action="reuse-target" data-kind="${kind}" data-id="${m.id}">${icon(kind)}<span class="grow">${name}</span>${icon('arrow')}</button>`).join('')}</div><small style="display:block;margin-top:16px">La compatibilité du profil destinataire est vérifiée avant insertion.</small>`);
  }else if(p.type==='target-profile'){
    const m=asset(p.id), candidates=Object.entries(profiles).filter(([,v])=>v.kind===p.kind&&v.roles.some(r=>r.kind===m.kind));
    panelLayout('Choisir le profil destinataire',`<p class="panel-intro">Le brouillon ${labels[p.kind].toLowerCase()} utilisera le profil choisi. Ses références existantes seront conservées, avec les incompatibilités signalées.</p>${candidates.map(([key,v])=>`<button class="choice-row" data-action="apply-target" data-kind="${p.kind}" data-profile="${key}" data-id="${m.id}">${icon(p.kind)}<div class="grow"><strong>${v.name}</strong><small>${v.detail}</small></div>${icon('arrow')}</button>`).join('')}`);
  }else if(p.type==='connection'){
    panelLayout(`${esc(p.name)} · connexion`,`<p class="panel-intro">Parcours prévu : ouvrir la connexion, autoriser l’accès, vérifier l’état puis choisir les actions disponibles. La maquette n’effectue aucune connexion.</p><div class="choice-row">${icon('library')}<div><strong>Image · vidéo · audio</strong><small>Liste et import de références déjà présents côté MCP.</small></div></div><div class="choice-row">${icon('create')}<div><strong>Créer et suivre</strong><small>Génération image/vidéo existante ; génération audio autonome à compléter côté MCP.</small></div></div>`);
  }
}
function insertReferences(ids, roleId, replaceId) {
  const r=roleFor(roleId);if(!canInsert(r,ids.length,replaceId)||ids.some(id=>asset(id)?.kind!==r.kind)){toast('Cette sélection dépasse les limites du profil.');return false;}
  const next=ids.map(id=>({id:`ref-${++refCounter}`,assetId:id,role:roleId}));
  if(replaceId){const index=draft().refs.findIndex(r=>r.id===replaceId);if(index<0)return false;draft().refs.splice(index,1,...next);}
  else draft().refs.push(...next);
  return true;
}
function startReference(roleId) {
  const r=roleFor(roleId);if(!r||state.returnContext||!canInsert(r))return;
  state.returnContext={kind:state.kind,draft:structuredClone(draft()),role:r,childPrevious:structuredClone(state.drafts[r.kind])};
  state.kind=r.kind;state.drafts[r.kind]=freshDraft(r.kind);state.screen='create';closePanel();render();$('#prompt')?.focus();
}
function finishReference(useOutput) {
  const c=state.returnContext;if(!c)return;const output=draft().output;
  state.drafts[state.kind]=c.childPrevious;state.kind=c.kind;state.drafts[c.kind]=c.draft;state.returnContext=null;
  if(useOutput&&output)insertReferences([output],c.role.id);
  render();toast(useOutput?'Référence ajoutée au brouillon d’origine.':'Brouillon d’origine retrouvé.');
}
function upload(roleId=null) {
  const role=roleId?roleFor(roleId):null;
  const input=document.createElement('input');input.type='file';input.accept=role?`${role.kind}/*`:'image/*,video/*,audio/*';input.multiple=!role||role.max>1;
  input.addEventListener('change',()=>{
    const files=[...input.files];if(!files.length)return;
    const valid=files.filter(f=>['image','video','audio'].includes(f.type.split('/')[0])&&(!role||f.type.startsWith(`${role.kind}/`)));
    if(valid.length!==files.length){toast('Un fichier a un type incompatible. La sélection est conservée.');return;}
    if(role&&!canInsert(role,valid.length)){toast('Trop de fichiers pour ce rôle ou ce profil.');return;}
    const ids=valid.map(f=>{const id=`upload-${++importCounter}`;media.push({id,name:f.name,kind:f.type.split('/')[0],url:URL.createObjectURL(f),source:'Import local · non envoyé'});return id;});
    if(role)insertReferences(ids,roleId);closePanel();render();toast('Fichiers ajoutés localement. Aucun envoi au serveur.');
  });input.click();
}

document.addEventListener('click',event=>{
  const el=event.target.closest('[data-action]');if(!el||el.disabled)return;
  const a=el.dataset.action, id=el.dataset.id;
  if(a==='navigate'){
    if(state.returnContext){toast('Utilisez ou annulez la création de référence pour retrouver votre brouillon.');return;}
    state.screen=el.dataset.screen;closePanel();render();window.scrollTo({top:0});
  }else if(a==='kind'){
    if(state.returnContext){toast('Ce détour crée le type de référence demandé.');return;}
    state.kind=el.dataset.kind;render();
  }else if(a==='new'){
    const kind=state.kind,previous=structuredClone(draft());state.drafts[kind]=freshDraft(kind);render();toast('Nouveau brouillon.',()=>{state.drafts[kind]=previous;render();});
  }else if(['add','manage','profile','controls','models','price-info'].includes(a))openPanel(a);
  else if(a==='candidate'){
    const model=catalogue.models.find(m=>m.id===id);if(model)openPanel('candidate',{choice:adaptChoice(model,draft().modelChoice)});
  }else if(a==='apply-model'){
    if(state.panel?.type!=='candidate')return;
    draft().modelChoice=structuredClone(state.panel.choice);closePanel();render();toast('Modèle appliqué. Instruction et références conservées.');
  }
  else if(a==='reference')openPanel('reference',{id});
  else if(a==='pick')openPanel('pick',{role:el.dataset.role});
  else if(a==='replace'){const r=byId(id);if(r)openPanel('pick',{role:r.role,replaceId:id});}
  else if(a==='pick-item'){
    const p=state.panel;const role=roleFor(p.role);
    if(state.picks.includes(id))state.picks=state.picks.filter(v=>v!==id);
    else if(p.replaceId)state.picks=[id];
    else if(canInsert(role,state.picks.length+1))state.picks.push(id);
    else{toast('Limite atteinte pour ce profil.');return;}
    renderPanel();$('#panel [data-id="'+id+'"]')?.focus();
  }else if(a==='confirm-picks'){
    if(insertReferences(state.picks,state.panel.role,state.panel.replaceId)){closePanel();render();toast('Références mises à jour.');}
  }else if(a==='remove'){
    const kind=state.kind,index=draft().refs.findIndex(r=>r.id===id),removed=structuredClone(byId(id));draft().refs=draft().refs.filter(r=>r.id!==id);render();
    openPanel('manage');toast('Retirée du brouillon, conservée dans les médias.',()=>{if(!state.drafts[kind].refs.some(r=>r.id===removed.id))state.drafts[kind].refs.splice(Math.min(index,state.drafts[kind].refs.length),0,removed);render();if(state.panel)renderPanel();});
  }else if(a==='move'){
    const i=draft().refs.findIndex(r=>r.id===id),j=i+Number(el.dataset.step);if(j>=0&&j<draft().refs.length){[draft().refs[i],draft().refs[j]]=[draft().refs[j],draft().refs[i]];render();renderPanel();$('#panel [data-id="'+id+'"][data-step="'+el.dataset.step+'"]')?.focus();}
  }else if(a==='set-profile'){draft().profile=el.dataset.value;closePanel();render();if(invalidRefs().length)toast('Références conservées. Vérifiez les incompatibilités.');}
  else if(a==='create-reference')startReference(el.dataset.role);
  else if(a==='cancel-return')finishReference(false);
  else if(a==='complete-return')finishReference(true);
  else if(a==='simulate'){
    if(invalidRefs().length||missingRequired().length)return;
    draft().output=media.find(m=>m.kind===(profile().outputKind||state.kind))?.id;render();toast('Exemple local affiché. Aucune génération ni dépense.');
  }else if(a==='import')upload(el.dataset.role);
  else if(a==='library-import')upload();
  else if(a==='preview')openPanel('preview',{id});
  else if(a==='reference-preview'){const r=byId(id);openPanel('preview',{id:r.assetId,referenceId:r.id});}
  else if(a==='reuse'){
    if(state.returnContext){toast('Utilisez « Utiliser et revenir » pour ajouter cette référence.');return;}
    openPanel('reuse',{id});
  }else if(a==='reuse-target'){
    const m=asset(id),kind=el.dataset.kind;const oldKind=state.kind;state.kind=kind;
    let role=profile().roles.find(r=>r.kind===m.kind);
    if(!role){state.kind=oldKind;openPanel('target-profile',{id,kind});return;}
    if(!insertReferences([id],role.id)){state.kind=oldKind;return;}
    state.screen='create';closePanel();render();toast('Média ajouté au brouillon existant.');
  }else if(a==='apply-target'){
    const oldKind=state.kind, kind=el.dataset.kind, previousProfile=state.drafts[kind].profile;
    state.kind=kind;draft().profile=el.dataset.profile;
    const role=profile().roles.find(r=>r.kind===asset(id).kind);
    if(!insertReferences([id],role.id)){draft().profile=previousProfile;state.kind=oldKind;return;}
    state.screen='create';closePanel();render();toast('Profil choisi et média ajouté. Autres références conservées.');
  }else if(a==='select-media'){state.selected=id;$('#media-grid').innerHTML=libraryGrid();$('#selection').innerHTML=selectionBar();}
  else if(a==='deselect'){state.selected=null;$('#media-grid').innerHTML=libraryGrid();$('#selection').innerHTML='';}
  else if(a==='filter'){state.filter=el.dataset.kind;state.selected=null;render();}
  else if(a==='settings-tab'){state.accountTab=el.dataset.tab;render();}
  else if(a==='theme'){state.appearance=el.dataset.value;try{localStorage.setItem('maxvideoai-concept-theme',state.appearance);}catch{}render();}
  else if(a==='motion'){state.reduced=!state.reduced;render();}
  else if(a==='cancel-name'){event.preventDefault();$('#profile-name').value=state.name;toast('Modification annulée.');}
  else if(a==='assistants'){if(state.returnContext){toast('Terminez ou annulez le détour de référence.');return;}state.screen='settings';state.accountTab='connections';render();}
  else if(a==='connection')openPanel('connection',{name:el.dataset.name});
  else if(a==='close')closePanel();
  else if(a==='undo'){const fn=state.undo;state.undo=null;$('#notice').classList.remove('shown');fn?.();}
});
document.addEventListener('input',e=>{
  if(e.target.id==='prompt')draft().prompt=e.target.value;
  if(e.target.id==='profile-name')e.target.setCustomValidity('');
  if(e.target.id==='library-search'){state.query=e.target.value;state.selected=null;$('#media-grid').innerHTML=libraryGrid();$('#selection').innerHTML='';}
});
document.addEventListener('change',e=>{
  if(e.target.dataset.modelField){
    const field=e.target.dataset.modelField;
    const choice=state.panel?.type==='candidate'?state.panel.choice:draft().modelChoice;
    choice[field]=field==='duration'?Number(e.target.value):field==='audio'?e.target.value==='true':e.target.value;
    if(state.panel?.type==='candidate'){
      $('#model-changes').innerHTML=changeSummary(choice);
      $('#candidate-quote strong').textContent=money(currentQuote(choice));
    }else{
      render();$('#settings-quote strong').textContent=money(currentQuote());
    }
  }
  if(['format','duration'].includes(e.target.id)){draft()[e.target.id]=e.target.value;render();}
  if(e.target.dataset.roleRef){
    const id=e.target.dataset.roleRef, role=roleFor(e.target.value), reference=byId(id);
    if(!canInsert(role,1,id)){toast('Retirez une référence en trop avant d’attribuer ce rôle.');renderPanel();return;}
    if(reference){reference.role=role.id;render();renderPanel();$('#panel [data-role-ref="'+id+'"]')?.focus();}
  }
});
document.addEventListener('submit',e=>{if(e.target.id==='profile-form'){e.preventDefault();const name=$('#profile-name').value.trim();if(!name){$('#profile-name').setCustomValidity('Saisissez un nom.');$('#profile-name').reportValidity();return;}state.name=name;render();toast('Nom modifié dans cette maquette seulement.');}});
$('#panel').addEventListener('cancel',e=>{e.preventDefault();closePanel();});
$('#panel').addEventListener('keydown',e=>{
  if(e.key !== 'Tab')return;
  const controls=[...$('#panel').querySelectorAll('button:not(:disabled),a[href],input:not(:disabled),select:not(:disabled),textarea:not(:disabled),[tabindex="0"]')].filter(el=>el.getClientRects().length);
  const first=controls[0],last=controls.at(-1);
  if(e.shiftKey&&document.activeElement===first){e.preventDefault();last?.focus();}
  else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus();}
});
window.addEventListener('beforeunload',()=>media.filter(m=>m.url.startsWith('blob:')).forEach(m=>URL.revokeObjectURL(m.url)));
let width=innerWidth;
window.addEventListener('resize',()=>{if(Math.abs(width-innerWidth)>20){width=innerWidth;if(state.screen==='create'&&$('#references'))$('#references').innerHTML=renderReferences();}});
render();
