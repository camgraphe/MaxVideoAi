import { createScene } from './scene.mjs';
import { clamp, sampleTimeline } from './timeline.mjs';

let active = false;
export async function startExperience() {
  if (active) return;
  const $ = selector => document.querySelector(selector);
  const mobile = matchMedia('(max-width: 600px)').matches;
  const stage = $('#stage'), story = $('#scroll-story'), canvas = $('#scene');
  const startTime = performance.now();
  const scene = createScene(canvas, { mobile });
  const resize = () => scene.resize(stage.clientWidth, stage.clientHeight, devicePixelRatio);
  resize();
  try { await scene.load(); } catch (error) { scene.dispose(); throw error; }
  active = true;
  const loadedMs = performance.now() - startTime;
  $('#intro').hidden = true; $('#scene-copy').hidden = false; $('#scene-controls').hidden = false;
  document.body.classList.remove('no-3d'); document.body.classList.add('is-ready');
  const motionPreference = matchMedia('(prefers-reduced-motion: reduce)');
  let reduced = motionPreference.matches, frame = 0, progress = 0, lastTime = 0, autoplay = null, lastAct = -1, parentPaused = false;
  const renderTimes = [], intervals = [];
  let renderCount = 0;
  const acts = [
    ['01 / LE PROJET', 'Votre projet<br>est déjà là.', 'Un site, une référence, un point de départ.'],
    ['02 / L’ÉMERGENCE', 'L’idée prend<br>du volume.', 'Le sujet quitte son cadre. La création commence.'],
    ['03 / L’ASSEMBLAGE', 'Un univers<br>se construit.', 'Matières, lumière et décor trouvent leur place.'],
    ['04 / L’ORBITE', 'Un autre<br>point de vue.', 'La scène se révèle, sous tous ses angles.'],
  ];
  const positions = [0, .37, .65, 1];
  const length = () => Math.max(1, story.offsetHeight - stage.offsetHeight);
  const current = () => clamp((scrollY - story.offsetTop) / length());
  const inView = () => { const rect = story.getBoundingClientRect(); return rect.bottom > 0 && rect.top < innerHeight; };
  const showMetrics = () => {
    const p95 = values => [...values].sort((a, b) => a - b)[Math.floor((values.length - 1) * .95)] || 0;
    const stats = scene.stats();
    $('#metrics').textContent = `Activation locale : ${Math.round(loadedMs)} ms\nCanvas : ${canvas.width} × ${canvas.height} · DPR ${stats.dpr}\nRendus : ${renderCount} · appels de dessin : ${stats.calls} · triangles : ${stats.triangles.toLocaleString('fr')}\nSoumission CPU p95 : ${p95(renderTimes).toFixed(1)} ms · intervalle entre frames actives p95 : ${p95(intervals).toFixed(1)} ms\nÉchantillons récents : ${renderTimes.length} · boucle arrêtée au repos · ${reduced ? 'poses fixes' : 'mouvement actif'}`;
  };
  const stopPlay = () => { autoplay = null; $('#play').textContent = 'Lire la séquence ▷'; $('#play').setAttribute('aria-label', 'Lire la séquence automatiquement'); };
  const schedule = () => { if (!frame && !document.hidden && !parentPaused && inView()) frame = requestAnimationFrame(tick); };
  const jump = value => { stopPlay(); scrollTo({ top: story.offsetTop + length() * value, behavior: 'instant' }); schedule(); };
  function tick(time) {
    frame = 0;
    if (document.hidden || parentPaused || !inView()) { lastTime = 0; return; }
    if (autoplay) {
      const value = clamp(autoplay.from + (time - autoplay.start) / 15500);
      scrollTo({ top: story.offsetTop + length() * value, behavior: 'instant' });
      if (value >= 1) stopPlay();
    }
    const target = current();
    const delta = lastTime ? Math.min(64, time - lastTime) : 16.7;
    if (lastTime) { intervals.push(time - lastTime); if (intervals.length > 240) intervals.shift(); }
    progress = reduced ? positions[sampleTimeline(target).act] : progress + (target - progress) * (1 - Math.exp(-delta / 90));
    if (Math.abs(progress - target) < .0002 && !reduced) progress = target;
    const state = sampleTimeline(progress, mobile);
    const before = performance.now(); scene.render(state); renderTimes.push(performance.now() - before); if (renderTimes.length > 240) renderTimes.shift(); renderCount++;
    document.body.classList.toggle('night', state.darkness > .63);
    // The subsequent editorial section retains its own ink colour.
    if (lastAct !== state.act) {
      const act = acts[state.act]; $('#act-label').textContent = act[0]; $('#act-title').innerHTML = act[1]; $('#act-description').textContent = act[2];
      document.querySelectorAll('[data-act]').forEach((button, index) => button.setAttribute('aria-pressed', String(index === state.act)));
      lastAct = state.act;
    }
    $('#progress-bar').style.width = `${progress * 100}%`; $('#progress').value = `${Math.round(progress * 100)} %`;
    lastTime = time;
    if (autoplay || (!reduced && Math.abs(target - progress) > .0001)) schedule();
    else { lastTime = 0; showMetrics(); }
  }
  const setReduced = value => {
    const previous = current(); reduced = value; stopPlay(); document.body.classList.toggle('reduced', reduced);
    $('#still').setAttribute('aria-pressed', String(reduced)); $('#play').disabled = reduced;
    $('#scroll-hint').textContent = reduced ? 'POSES FIXES · CHOISIR UN ACTE OU DÉFILER' : 'DÉFILER POUR AVANCER · REMONTER POUR REVENIR';
    scrollTo({ top: story.offsetTop + previous * length(), behavior: 'instant' }); schedule();
  };
  const observer = new ResizeObserver(() => { resize(); schedule(); }); observer.observe(stage);
  const abort = new AbortController(), options = { signal: abort.signal };
  addEventListener('scroll', schedule, { passive: true, ...options });
  for (const event of ['wheel', 'touchstart', 'keydown']) addEventListener(event, stopPlay, { passive: true, ...options });
  document.querySelectorAll('[data-act]').forEach(button => button.addEventListener('click', () => jump(Number(button.dataset.act)), options));
  $('#play').addEventListener('click', () => {
    if (autoplay) { stopPlay(); return; }
    if (current() > .98) jump(0);
    autoplay = { start: performance.now(), from: current() };
    $('#play').textContent = 'Pause Ⅱ'; $('#play').setAttribute('aria-label', 'Mettre la séquence en pause'); schedule();
  }, options);
  $('#still').addEventListener('click', () => setReduced(!reduced), options);
  motionPreference.addEventListener('change', event => setReduced(event.matches), options);
  document.addEventListener('visibilitychange', () => { stopPlay(); if (document.hidden) { cancelAnimationFrame(frame); frame = 0; lastTime = 0; } else schedule(); }, options);
  addEventListener('message', event => {
    if (event.origin !== location.origin || event.source !== parent) return;
    if (event.data === 'motion-pause') { parentPaused = true; stopPlay(); cancelAnimationFrame(frame); frame = 0; }
    if (event.data === 'motion-resume') { parentPaused = false; schedule(); }
    if (typeof event.data === 'string' && event.data.startsWith('motion-act:')) {
      const value = Number(event.data.slice(11)); if (positions.includes(value)) jump(value);
    }
  }, options);
  const dialog = $('#mobile-dialog'), iframe = $('#mobile-frame');
  $('#mobile-open').addEventListener('click', () => { stopPlay(); if (!iframe.getAttribute('src')) iframe.src = 'motion.html?phone=1&preview=1'; dialog.showModal(); iframe.contentWindow?.postMessage('motion-resume', location.origin); }, options);
  document.querySelectorAll('[data-preview-act]').forEach(button => button.addEventListener('click', () => iframe.contentWindow?.postMessage(`motion-act:${button.dataset.previewAct}`, location.origin), options));
  $('#mobile-close').addEventListener('click', () => dialog.close(), options);
  dialog.addEventListener('close', () => iframe.contentWindow?.postMessage('motion-pause', location.origin), options);
  canvas.addEventListener('webglcontextlost', event => {
    event.preventDefault(); stopPlay(); cancelAnimationFrame(frame); frame = 0; parentPaused = true;
    $('#scene-copy').hidden = true; $('#scene-controls').hidden = true; $('#intro').hidden = false;
    $('#loading-status').textContent = 'Le rendu 3D a été interrompu. Rechargez pour réessayer ou poursuivez avec le parcours illustré.';
    $('#start').hidden = true; document.body.classList.add('no-3d');
  }, options);
  addEventListener('pagehide', () => { stopPlay(); cancelAnimationFrame(frame); observer.disconnect(); abort.abort(); scene.dispose(); }, { once: true });
  $('#diagnostics').addEventListener('toggle', showMetrics, options);
  setReduced(reduced); schedule();
}
