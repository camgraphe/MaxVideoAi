// Interaction prototype only. No network calls, uploads, account data or provider execution.
// Mention aliases belong to this preview. Production must resolve them to owned asset IDs
// and the selected provider's actual syntax; not all models accept literal @ aliases.
const $ = (id) => document.getElementById(id);
const examples = {
  video: {
    heading: 'Create a video', model: 'Kling 4.0', mark: 'K', label: 'Video prompt',
    prompt: 'A perfume bottle on pale stone in warm afternoon light. A slow camera push-in, natural textures and a quiet, elegant mood. No text on screen.',
    intro: 'Tell me what you have in mind. I’ll help shape it into a prompt for Kling 4.0.',
    reply: 'A slow push-in would keep the shot natural while giving the bottle more presence. I’ve prepared a prompt you can review below. Your settings stay as they are.',
    proposal: 'Live-action product shot of a perfume bottle on a pale limestone surface, slightly off-centre. Warm afternoon light comes from the side, revealing the glass contours. A slow, steady camera push-in moves from a close-up to a detail of the bottle. Keep the product still and in focus, with soft foliage in the background. A restrained ivory and olive palette, a light breeze, no added text or sudden movement.',
    generate: 'Generate video', motion: 'Find a camera move',
    starter: 'Help me choose a camera move for this scene.'
  },
  image: {
    heading: 'Create an image', model: 'Nano Banana 2', mark: 'N', label: 'Image prompt',
    prompt: 'A perfume bottle on pale stone in warm natural light. An elegant composition with room around the product.',
    intro: 'Describe your image. I can help with composition, lighting and how to use your references.',
    reply: 'I’d give the bottle a little more breathing room and use soft side lighting. Here is a composition to review, keeping your references and settings.',
    proposal: 'Editorial product photography. A perfume bottle rests on pale limestone, framed slightly off-centre with generous negative space. Soft afternoon side lighting reveals the mineral texture and the edges of the glass. Crisp product detail, a softly blurred green background, a restrained ivory and olive palette. Realistic materials, no added text.',
    generate: 'Generate image', motion: 'Shape the composition',
    starter: 'Help me refine the composition of this image.'
  },
  audio: {
    heading: 'Create a voice', model: 'Voice · audio preview', mark: '♪', label: 'Spoken script',
    prompt: 'Some moments stay with us. A certain light, a familiar scent, the memory of summer.',
    intro: 'Share your script or the feeling you’re after. Spoken words and voice direction stay separate.',
    reply: 'Here is a slightly more conversational script. A calm, close delivery could work well; those directions stay outside the spoken text.',
    proposal: 'Some moments never quite leave us. Soft afternoon light. A familiar scent. And suddenly, we’re back in summer.',
    generate: 'Generate voice', motion: 'Refine the script',
    starter: 'Make my script more natural without putting voice directions into the spoken text.'
  }
};

let surface = 'video';
let tab = 'manual';
let revision = 0;
let suggestionRevision = -1;
let undoSnapshot = null;
let appliedRevision = -1;
let refs = [];
let sequence = 0;
let counters = { image: 0, video: 0, audio: 0 };
let retiredTokens = new Set();
const selections = new Map();

function icon(name) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  const use = document.createElementNS(svg.namespaceURI, 'use');
  use.setAttribute('href', `#i-${name}`);
  svg.setAttribute('aria-hidden', 'true');
  svg.append(use);
  return svg;
}

function status(text) { $('status').textContent = text; }

function closeMenu(returnFocus = false) {
  $('reference-menu').hidden = true;
  $('add').setAttribute('aria-expanded', 'false');
  if (returnFocus) $('add').focus({ preventScroll: true });
}

function updateProposal() {
  const stale = suggestionRevision !== revision;
  $('apply').disabled = stale;
  $('stale').hidden = !stale;
  $('proposal-status').textContent = stale ? 'Draft changed' : 'Review';
}

function missingMentions(text) {
  const tokens = text.match(/@(StartImage|EndImage|SourceVideo|Image\d+|Video\d+|Audio\d+)\b/g) ?? [];
  return [...new Set(tokens.filter((token) => !refs.some((ref) => ref.token === token) || retiredTokens.has(token)))];
}

function updateSource() {
  const required = surface === 'video' && $('workflow').value === 'modify' && !refs.some((ref) => ref.role === 'source');
  const draftMissing = missingMentions($('prompt').value);
  const messageMissing = missingMentions($('message').value);
  const missing = tab === 'manual' ? draftMissing : messageMissing;
  $('source-required').hidden = !required;
  $('reference-warning').hidden = !missing.length;
  $('reference-warning').textContent = `Review the reference${missing.length === 1 ? '' : 's'} linked to ${missing.join(', ')}. Remove or reinsert the mention to update it.`;
  $('generate').disabled = required || Boolean(draftMissing.length);
  $('send').disabled = !$('message').value.trim() || Boolean(messageMissing.length);
  $('generate-label').textContent = required ? 'Add a source video' : examples[surface].generate;
}

function touch() {
  revision += 1;
  updateProposal();
  updateSource();
  if (undoSnapshot !== null && revision !== appliedRevision) $('undo').disabled = true;
}

function setTab(next, focus = false) {
  tab = next;
  const manual = next === 'manual';
  $('manual-panel').hidden = !manual;
  $('milo-panel').hidden = manual;
  $('message-area').hidden = manual;
  $('send-actions').hidden = manual;
  $('clear').hidden = !manual;
  $('credit').hidden = manual;
  $('manual-tab').setAttribute('aria-selected', String(manual));
  $('milo-tab').setAttribute('aria-selected', String(!manual));
  $('manual-tab').tabIndex = manual ? 0 : -1;
  $('milo-tab').tabIndex = manual ? -1 : 0;
  if (manual) {
    $('credit-note').hidden = true;
    $('credit').setAttribute('aria-expanded', 'false');
  }
  closeMenu();
  updateSource();
  if (focus) $(manual ? 'manual-tab' : 'milo-tab').focus();
}

function insertMention(ref) {
  // A spoken script must never receive a reference token that TTS could read aloud.
  if (surface === 'audio' && tab === 'manual') setTab('milo');
  const target = $(tab === 'manual' ? 'prompt' : 'message');
  const selection = selections.get(target.id) ?? { start: target.value.length, end: target.value.length };
  const before = target.value.slice(0, selection.start);
  const after = target.value.slice(selection.end);
  const inserted = `${before && !/[\s([{]$/.test(before) ? ' ' : ''}${ref.token}${after && /^[\s.,!?;:)\]}]/.test(after) ? '' : ' '}`;
  target.value = before + inserted + after;
  const caret = before.length + inserted.length;
  target.focus({ preventScroll: true });
  target.setSelectionRange(caret, caret);
  selections.set(target.id, { start: caret, end: caret });
  retiredTokens.delete(ref.token);
  if (target.id === 'prompt') touch();
  updateSource();
  status(`${ref.label} inserted into ${target.id === 'prompt' ? 'the prompt' : 'your message to Milo'}.`);
}

function renderRefs() {
  const container = $('attachments');
  container.replaceChildren();
  container.hidden = !refs.length;
  for (const ref of refs) {
    const item = document.createElement('div');
    item.className = 'attachment';
    const insert = document.createElement('button');
    insert.className = 'reference-insert';
    insert.setAttribute('aria-label', `Mention ${ref.label}`);
    const thumb = document.createElement('span');
    thumb.className = 'thumb';
    thumb.dataset.variant = String(ref.id % 3);
    thumb.setAttribute('aria-hidden', 'true');
    if (ref.kind === 'image') {
      const bottle = document.createElement('span');
      bottle.className = 'bottle';
      thumb.append(bottle);
    } else thumb.append(icon(ref.kind));
    const label = document.createElement('span');
    label.className = 'attachment-label';
    label.textContent = ref.label;
    insert.append(thumb, label);
    insert.onclick = () => insertMention(ref);
    const remove = document.createElement('button');
    remove.className = 'reference-remove';
    remove.setAttribute('aria-label', `Remove ${ref.label}`);
    remove.append(icon('close'));
    remove.onclick = () => {
      $('add').focus({ preventScroll: true });
      retiredTokens.add(ref.token);
      refs = refs.filter((item) => item.id !== ref.id);
      touch();
      renderRefs();
      status(`${ref.label} removed. Other reference numbers stay unchanged.`);
    };
    item.append(insert, remove);
    container.append(item);
  }
  $('reference-hint').textContent = refs.length ? 'Click a reference to mention it' : 'Add a reference';
  updateSource();
}

function addReference(role, kind = 'image', silent = false) {
  if (role !== 'reference' && refs.some((ref) => ref.role === role)) {
    closeMenu(true);
    status('That reference is already attached.');
    return;
  }
  if (refs.length >= 8) {
    closeMenu(true);
    status('This preview supports eight references. Product limits depend on the model.');
    return;
  }
  const fixed = { start: ['Start image', '@StartImage'], end: ['End image', '@EndImage'], source: ['Source video', '@SourceVideo'] }[role];
  const index = role === 'reference' ? ++counters[kind] : null;
  const type = kind[0].toUpperCase() + kind.slice(1);
  const [label, token] = fixed ?? [`${type} ${index}`, `@${type}${index}`];
  refs.push({ id: ++sequence, role, kind, label, token });
  touch();
  renderRefs();
  closeMenu(!silent);
  if (!silent) status(`${label} attached. Click its label to mention it.`);
}

function buildMenu() {
  const options = surface === 'video'
    ? ($('workflow').value === 'create'
      ? [['Start image', 'start', 'image'], ['End image', 'end', 'image'], ['Image reference', 'reference', 'image']]
      : [['Source video', 'source', 'video'], ['Image reference', 'reference', 'image']])
    : surface === 'image' ? [['Image reference', 'reference', 'image']] : [['Audio reference', 'reference', 'audio']];
  $('reference-options').replaceChildren();
  for (const [label, role, kind] of options) {
    const button = document.createElement('button');
    button.append(icon(kind), document.createTextNode(label));
    button.onclick = () => addReference(role, kind);
    $('reference-options').append(button);
  }
}

function setOptions(id, options, label) {
  $(id).replaceChildren(...options.map((text) => {
    const option = document.createElement('option');
    option.textContent = text;
    return option;
  }));
  $(id).setAttribute('aria-label', label);
}

function chooseSurface(next) {
  surface = next;
  revision += 1;
  suggestionRevision = -1;
  undoSnapshot = null;
  appliedRevision = -1;
  refs = [];
  counters = { image: 0, video: 0, audio: 0 };
  retiredTokens = new Set();
  selections.clear();
  const ex = examples[next];
  document.querySelectorAll('[data-surface]').forEach((button) => button.setAttribute('aria-pressed', String(button.dataset.surface === next)));
  $('heading').textContent = ex.heading;
  $('model').textContent = ex.model;
  $('model-mark').textContent = ex.mark;
  $('prompt-label').textContent = ex.label;
  $('prompt').value = ex.prompt;
  $('milo-context').textContent = `for ${ex.model}`;
  $('intro').textContent = ex.intro;
  $('workflow').value = 'create';
  $('workflow').hidden = next !== 'video';
  $('chat').replaceChildren();
  $('welcome').hidden = false;
  $('proposal').hidden = true;
  $('proposal').open = false;
  $('applied-note').hidden = true;
  $('message').value = '';
  $('send').disabled = true;
  $('motion-starter').replaceChildren(document.createTextNode(`${ex.motion} ↗`));
  $('motion-starter').dataset.starter = ex.starter;
  setOptions('format', next === 'audio' ? ['Selected voice'] : ['16:9', '9:16', '1:1'], next === 'audio' ? 'Voice' : 'Aspect ratio');
  setOptions('length', next === 'audio' ? ['English'] : next === 'image' ? ['1K', '2K'] : ['5 seconds', '10 seconds'], next === 'audio' ? 'Language' : next === 'image' ? 'Size' : 'Duration');
  setOptions('quality', next === 'audio' ? ['Natural delivery'] : next === 'image' ? ['Standard'] : ['1080p', '720p'], next === 'audio' ? 'Delivery' : next === 'image' ? 'Quality' : 'Resolution');
  renderRefs();
  buildMenu();
  setTab(tab);
  status('');
}

function sendMessage() {
  const value = $('message').value.trim();
  if (!value || missingMentions(value).length) return;
  const user = document.createElement('div');
  user.className = 'user-message';
  user.textContent = value;
  const reply = document.createElement('div');
  reply.className = 'reply';
  reply.textContent = examples[surface].reply;
  $('chat').append(user, reply);
  $('welcome').hidden = true;
  $('proposal').hidden = false;
  $('proposal').open = false;
  $('proposal-title').textContent = surface === 'audio' ? 'Suggested script' : 'Suggested prompt';
  const mentioned = refs.filter((ref) => value.includes(ref.token));
  const references = surface !== 'audio' && mentioned.length ? `Use ${mentioned.map((ref) => ref.token).join(' and ')} as the attached references. ` : '';
  $('proposal-text').value = references + examples[surface].proposal;
  $('patch-note').textContent = surface === 'audio' ? 'Only the spoken script changes. Voice and delivery stay unchanged.' : 'Your settings and references stay unchanged.';
  $('apply').textContent = surface === 'audio' ? 'Apply to script' : 'Apply to prompt';
  suggestionRevision = revision;
  updateProposal();
  $('message').value = '';
  selections.delete('message');
  $('send').disabled = true;
  $('message').placeholder = 'Tell Milo what you’d like to change…';
  $('conversation').scrollTop = $('conversation').scrollHeight;
  $('message').focus({ preventScroll: true });
  $('input-surface').scrollIntoView({ block: 'nearest' });
  status('Sample reply. No live AI call.');
}

document.addEventListener('pointerdown', () => { document.body.dataset.input = 'pointer'; }, true);
document.addEventListener('keydown', (event) => {
  if (['Tab', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) document.body.dataset.input = 'keyboard';
  if (event.key === 'Escape' && !$('reference-menu').hidden) {
    event.preventDefault();
    closeMenu(true);
  }
});
document.addEventListener('click', (event) => {
  if (!$('reference-menu').contains(event.target) && !$('add').contains(event.target)) closeMenu();
});
document.addEventListener('focusin', (event) => {
  if (!$('reference-menu').hidden && !$('reference-menu').contains(event.target) && event.target !== $('add')) closeMenu();
});
$('manual-tab').onclick = () => setTab('manual');
$('milo-tab').onclick = () => setTab('milo');
document.querySelector('.mode-tabs').onkeydown = (event) => {
  if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
  event.preventDefault();
  setTab(event.key === 'Home' ? 'manual' : event.key === 'End' ? 'milo' : tab === 'manual' ? 'milo' : 'manual', true);
};
document.querySelectorAll('[data-surface]').forEach((button) => {
  button.onclick = () => { chooseSurface(button.dataset.surface); status('A separate sample is loaded for this media type.'); };
});
$('theme').onclick = () => {
  document.body.classList.toggle('dark');
  $('theme').setAttribute('aria-label', document.body.classList.contains('dark') ? 'Switch to light theme' : 'Switch to dark theme');
};
$('add').onclick = () => {
  const open = $('reference-menu').hidden;
  buildMenu();
  $('reference-menu').hidden = !open;
  $('add').setAttribute('aria-expanded', String(open));
  if (open && document.body.dataset.input === 'keyboard') $('reference-options').querySelector('button')?.focus();
};
$('library').onclick = () => addReference('reference', surface === 'audio' ? 'audio' : 'image');
$('source-add').onclick = () => addReference('source', 'video');
$('workflow').onchange = () => { touch(); buildMenu(); status('Workflow changed. Previous suggestions need to be reviewed.'); };
['prompt', 'message'].forEach((id) => {
  for (const event of ['select', 'keyup', 'click', 'input', 'blur']) {
    $(id).addEventListener(event, () => selections.set(id, { start: $(id).selectionStart, end: $(id).selectionEnd }));
  }
});
$('prompt').oninput = touch;
['format', 'length', 'quality', 'count'].forEach((id) => {
  $(id).onchange = () => { touch(); status('Settings changed. The product will refresh the quote before generation.'); };
});
$('clear').onclick = () => {
  if (!$('prompt').value) return;
  $('prompt').value = '';
  selections.delete('prompt');
  touch();
  $('prompt').focus();
};
$('message').oninput = updateSource;
$('message').onkeydown = (event) => {
  if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) { event.preventDefault(); sendMessage(); }
};
$('send').onclick = sendMessage;
document.querySelectorAll('[data-starter]').forEach((button) => {
  button.onclick = () => {
    $('message').value = button.dataset.starter;
    selections.delete('message');
    $('send').disabled = false;
    $('message').focus({ preventScroll: true });
    $('message').scrollIntoView({ block: 'nearest' });
  };
});
$('apply').onclick = () => {
  if (suggestionRevision !== revision) return;
  undoSnapshot = $('prompt').value;
  $('prompt').value = $('proposal-text').value;
  selections.delete('prompt');
  revision += 1;
  appliedRevision = revision;
  $('applied-note').hidden = false;
  $('undo').disabled = false;
  setTab('manual');
  updateProposal();
  updateSource();
  status('Applied to the draft. No generation started.');
};
$('undo').onclick = () => {
  if (undoSnapshot === null || revision !== appliedRevision) return;
  $('prompt').value = undoSnapshot;
  selections.delete('prompt');
  undoSnapshot = null;
  revision += 1;
  $('applied-note').hidden = true;
  updateProposal();
  updateSource();
  status('Previous prompt restored.');
};
$('copy').onclick = async () => {
  try { await navigator.clipboard.writeText($('proposal-text').value); status('Suggestion copied.'); }
  catch { $('proposal-text').focus(); $('proposal-text').select(); status('Text selected. Use Copy on your device.'); }
};
$('credit').onclick = () => {
  const show = $('credit-note').hidden;
  $('credit-note').hidden = !show;
  $('credit').setAttribute('aria-expanded', String(show));
};
$('generate').onclick = () => status('Preview only. No media generated and no credits spent.');
$('reset').onclick = () => { tab = 'manual'; chooseSurface('video'); status('Preview reset.'); };

chooseSurface('video');
const params = new URLSearchParams(location.search);
if (params.get('theme') === 'dark') $('theme').click();
if (params.get('references') === '1') { addReference('start', 'image', true); addReference('reference', 'image', true); }
if (params.get('mode') === 'milo') {
  setTab('milo');
  if (params.get('example') === '1') {
    $('message').value = refs.length ? 'Use @StartImage for the opening frame and @Image1 for the style. Keep it natural.' : 'Make it more cinematic, while keeping it natural.';
    sendMessage();
    $('message').blur();
    status('');
  }
}
