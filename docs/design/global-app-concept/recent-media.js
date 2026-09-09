// Destination-neutral media presentation. The destination owns insertion and limits.
export function recentItems(media, ids, limit = 12) {
  const byId = new Map(media.map(m => [m.id, m]));
  return [...new Set(ids)].map(id => byId.get(id)).filter(Boolean).slice(0, limit);
}

export function renderRecentCards({ items, icon, thumb, esc, inUse, draggable = false, action = 'recent-add', actionLabel = 'Ajouter en référence' }) {
  return items.map(m => `<article class="recent-card">
    <button class="recent-preview" data-action="preview" data-id="${esc(m.id)}" ${draggable ? `draggable="true" data-drag-media="${esc(m.id)}"` : ''} aria-label="Aperçu : ${esc(m.name)}">${thumb(m)}</button>
    <div class="recent-name"><strong>${esc(m.name)}</strong><small>${esc(m.source)}</small></div>
    <button class="recent-add" data-action="${esc(action)}" data-id="${esc(m.id)}" aria-label="${esc(actionLabel)} : ${esc(m.name)}">${icon(inUse(m.id) ? 'check' : 'plus')}<span>${inUse(m.id) ? 'Déjà utilisée · ajouter' : esc(actionLabel)}</span></button>
  </article>`).join('') || '<p class="panel-intro">Vos prochains médias apparaîtront ici.</p>';
}

// Native desktop drag. Touch and keyboard use the same visible Add action.
// No URL/HTML parsing and no external file import through this internal channel.
export function installMediaDrag({ getAsset, getDestination, onDrop, onReject }) {
  let dragging = null;
  const mime = 'application/x-maxvideoai-concept-media';
  function clearFeedback() {
    document.querySelector('#references')?.removeAttribute('data-drop-state');
    document.querySelector('.drop-target-replace')?.classList.remove('drop-target-replace');
  }
  function reset() { clearFeedback(); dragging = null; }
  document.addEventListener('dragstart', event => {
    const source = event.target.closest?.('[data-drag-media]');
    if (!source || !getAsset(source.dataset.dragMedia)) return;
    dragging = source.dataset.dragMedia;
    event.dataTransfer.clearData();
    event.dataTransfer.setData(mime, dragging);
    event.dataTransfer.setData('text/plain', dragging);
    event.dataTransfer.effectAllowed = 'copy';
  });
  function updateFeedback(event) {
    if (!dragging) return;
    const zone = event.target.closest?.('#references');
    if (!zone) { clearFeedback(); return; }
    event.preventDefault();
    const reference = event.target.closest('.ref-thumb');
    const destination = getDestination(dragging, reference?.dataset.id, event.target.closest('[data-drop-role]')?.dataset.dropRole);
    clearFeedback();
    zone.dataset.dropState = destination.allowed ? 'allowed' : 'blocked';
    if (reference && destination.allowed) reference.classList.add('drop-target-replace');
    const label = zone.querySelector('.drop-feedback');
    if (label) label.textContent = destination.message;
    event.dataTransfer.dropEffect = destination.allowed ? 'copy' : 'none';
  }
  document.addEventListener('dragenter', updateFeedback);
  document.addEventListener('dragover', updateFeedback);
  document.addEventListener('dragleave', event => {
    const zone = event.target.closest?.('#references');
    if (zone && !zone.contains(event.relatedTarget)) clearFeedback();
  });
  document.addEventListener('drop', event => {
    if (!dragging) return;
    event.preventDefault();
    const id = dragging, zone = event.target.closest?.('#references');
    const replacement = event.target.closest?.('.ref-thumb')?.dataset.id;
    const role = event.target.closest?.('[data-drop-role]')?.dataset.dropRole;
    const received = event.dataTransfer.getData(mime);
    const destination = zone && received === id ? getDestination(id, replacement, role) : null;
    reset();
    if (!destination) return;
    if (!destination.allowed) { onReject(destination.message); return; }
    onDrop(id, replacement, role);
  });
  document.addEventListener('dragend', reset);
  window.addEventListener('blur', reset);
}
