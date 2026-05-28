import { html, useState, useRef, useEffect, useLayoutEffect } from '../lib/preact-standalone.js';
import { findVariantById, resolveScene } from '../lib/variants.js';

export function Sidebar({
  story,
  currentSceneId,
  selectedItemId,
  activeVariantId,
  isDirty,
  onSelectScene,
  onSelectItem,
  onAddScene,
  onAddMovieScene,
  onSelectProject,
  onRenameScene,
  onReorderScenes,
}) {
  const currentScene = story.scenes.find(s => s.id === currentSceneId);
  const isMovieScene = currentScene?.type === 'movie';
  const activeVariant = isMovieScene ? null : findVariantById(currentScene, activeVariantId);
  const resolvedScene = isMovieScene ? null : resolveScene(currentScene, activeVariant);
  const hotspots = resolvedScene?.hotspots || [];
  const [editingSceneId, setEditingSceneId] = useState(null);
  const [dragSceneId, setDragSceneId] = useState(null);
  const [dragOrder, setDragOrder] = useState(null);

  // Order to render: the live preview while dragging, otherwise the real order.
  const baseIds = story.scenes.map(s => s.id);
  const orderedScenes = dragOrder
    ? dragOrder.map(id => story.scenes.find(s => s.id === id)).filter(Boolean)
    : story.scenes;

  // Move the dragged scene before or after `targetId`, based on cursor midpoint.
  const previewMove = (targetId, after) => {
    setDragOrder(order => {
      const cur = order || baseIds;
      if (!dragSceneId || targetId === dragSceneId) return cur;
      const without = cur.filter(id => id !== dragSceneId);
      const ti = without.indexOf(targetId);
      if (ti === -1) return cur;
      const next = without.slice();
      next.splice(after ? ti + 1 : ti, 0, dragSceneId);
      return next.length === cur.length && next.every((id, i) => id === cur[i]) ? cur : next;
    });
  };

  const handleSceneDragOver = (e, targetId) => {
    if (!dragSceneId) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    const rect = e.currentTarget.getBoundingClientRect();
    previewMove(targetId, (e.clientY - rect.top) > rect.height / 2);
  };

  const endDrag = () => { setDragSceneId(null); setDragOrder(null); };

  const handleDrop = (e) => {
    if (!dragSceneId) return;
    e.preventDefault();
    if (dragOrder) onReorderScenes(dragOrder);
    endDrag();
  };

  // FLIP: animate scene/variant rows sliding to their new slots during a drag.
  const rowRefs = useRef(new Map());
  const prevRects = useRef(new Map());
  useLayoutEffect(() => {
    const newRects = new Map();
    rowRefs.current.forEach((el, key) => { if (el) newRects.set(key, el.getBoundingClientRect()); });
    if (dragSceneId) {
      newRects.forEach((rect, key) => {
        const prev = prevRects.current.get(key);
        const el = rowRefs.current.get(key);
        if (!prev || !el) return;
        const dy = prev.top - rect.top;
        if (!dy) return;
        el.style.transition = 'none';
        el.style.transform = `translateY(${dy}px)`;
        requestAnimationFrame(() => {
          el.style.transition = 'transform 160ms ease';
          el.style.transform = '';
        });
      });
    }
    prevRects.current = newRects;
  });

  const setRowRef = (key) => (el) => {
    if (el) rowRefs.current.set(key, el);
    else rowRefs.current.delete(key);
  };

  return html`
    <div class="project-title ${selectedItemId === '__project__' ? 'selected' : ''}"
         onClick=${() => onSelectProject()}>
      ${story.title}
      ${isDirty ? html`<span class="dirty-dot" />` : null}
    </div>

    <div class="sidebar-item ${selectedItemId === '__variables__' ? 'selected' : ''}"
         onClick=${() => onSelectItem('__variables__')}>
      <span class="icon">⚙</span> Variables${story.variables?.length ? html` <span class="muted-count">${story.variables.length}</span>` : null}
    </div>

    <div class="section-label">Scenes</div>
    ${orderedScenes.map(scene => html`
      ${editingSceneId === scene.id ? html`
        <${InlineRename}
          value=${scene.name || scene.id}
          onCommit=${(newName) => { onRenameScene(scene.id, newName); setEditingSceneId(null); }}
          onCancel=${() => setEditingSceneId(null)}
        />
      ` : html`
        <div class="sidebar-item ${scene.id === currentSceneId && selectedItemId === '__background__' ? 'selected' : ''} ${dragSceneId === scene.id ? 'dragging' : ''}"
             ref=${setRowRef(scene.id)}
             draggable=${true}
             onDragStart=${(e) => { setDragSceneId(scene.id); e.dataTransfer.effectAllowed = 'move'; }}
             onDragOver=${(e) => handleSceneDragOver(e, scene.id)}
             onDrop=${handleDrop}
             onDragEnd=${endDrag}
             onClick=${() => { onSelectScene(scene.id); onSelectItem('__background__'); }}
             onDblClick=${(e) => { e.preventDefault(); setEditingSceneId(scene.id); }}>
          ${scene.type === 'movie' ? html`<span class="icon">▶</span>` : null}
          ${scene.name || scene.id}
          ${scene.id === story.start_scene ? html`<span class="star">★</span>` : null}
        </div>
      `}
      ${(scene.variants || []).map(v => html`
        <div class="sidebar-item indent-1 ${selectedItemId === 'variant_' + v.id ? 'selected' : ''}"
             ref=${setRowRef('variant_' + v.id)}
             onClick=${() => { onSelectScene(scene.id); onSelectItem('variant_' + v.id); }}
             onDragOver=${(e) => handleSceneDragOver(e, scene.id)}
             onDrop=${handleDrop}>
          <span class="icon">◐</span> ${v.name || v.id}
        </div>
      `)}
    `)}
    <div class="add-btn" onClick=${onAddScene}>+ Add Scene</div>
    <div class="add-btn" onClick=${onAddMovieScene}>+ Add Movie</div>

    ${currentScene && !isMovieScene ? html`
      <div class="section-label">Layers${activeVariant ? html` <span class="layers-context">— ${activeVariant.name || activeVariant.id}</span>` : ''}</div>
      <div class="sidebar-item ${selectedItemId === '__background__' ? 'selected' : ''}"
           onClick=${() => onSelectItem('__background__')}>
        <span class="icon"><svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="1" y="1" width="10" height="10"/><line x1="1" y1="1" x2="11" y2="11"/><line x1="11" y1="1" x2="1" y2="11"/></svg></span> Background
      </div>
      ${hotspots.map(hotspot => {
        const fromVariant = activeVariant && (activeVariant.hotspots || []).some(h => h.id === hotspot.id);
        return html`
          <div class="sidebar-item ${hotspot.id === selectedItemId ? 'selected' : ''}"
               onClick=${() => onSelectItem(hotspot.id)}>
            <span class="icon">${hotspot.action === 'navigate' ? '↗' : '◇'}</span>
            ${hotspot.id}${hotspot.action === 'navigate' && hotspot.target ? html` → ${hotspot.target}` : ''}
            ${fromVariant ? html`<span class="variant-dot" title="extra in variant" />` : null}
          </div>
        `;
      })}
    ` : null}
  `;
}

function InlineRename({ value, onCommit, onCancel }) {
  const inputRef = useRef(null);

  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, []);

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      onCommit(e.target.value);
    } else if (e.key === 'Escape') {
      onCancel();
    }
  };

  return html`
    <input ref=${inputRef}
           class="sidebar-rename"
           value=${value}
           onKeyDown=${handleKeyDown}
           onBlur=${(e) => onCommit(e.target.value)} />
  `;
}
