import { html, useState, useRef, useEffect } from '../lib/preact-standalone.js';

export function Sidebar({
  story,
  currentSceneId,
  selectedItemId,
  isDirty,
  onSelectScene,
  onSelectItem,
  onAddScene,
  onSelectProject,
  onRenameScene,
}) {
  const currentScene = story.scenes.find(s => s.id === currentSceneId);
  const hotspots = currentScene?.hotspots || [];
  const [editingSceneId, setEditingSceneId] = useState(null);

  return html`
    <div class="project-title ${selectedItemId === '__project__' ? 'selected' : ''}"
         onClick=${() => onSelectProject()}>
      ${story.title}
      ${isDirty ? html`<span class="dirty-dot" />` : null}
    </div>

    <div class="section-label">Scenes</div>
    ${story.scenes.map(scene => html`
      ${editingSceneId === scene.id ? html`
        <${InlineRename}
          value=${scene.name || scene.id}
          onCommit=${(newName) => { onRenameScene(scene.id, newName); setEditingSceneId(null); }}
          onCancel=${() => setEditingSceneId(null)}
        />
      ` : html`
        <div class="sidebar-item ${scene.id === currentSceneId ? 'selected' : ''}"
             onClick=${() => { onSelectScene(scene.id); onSelectItem('__background__'); }}
             onDblClick=${(e) => { e.preventDefault(); setEditingSceneId(scene.id); }}>
          ${scene.name || scene.id}
          ${scene.id === story.start_scene ? html`<span class="star">★</span>` : null}
        </div>
      `}
    `)}
    <div class="add-btn" onClick=${onAddScene}>+ Add Scene</div>

    ${currentScene ? html`
      <div class="section-label">Layers</div>
      <div class="sidebar-item ${selectedItemId === '__background__' ? 'selected' : ''}"
           onClick=${() => onSelectItem('__background__')}>
        <span class="icon"><svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="1" y="1" width="10" height="10"/><line x1="1" y1="1" x2="11" y2="11"/><line x1="11" y1="1" x2="1" y2="11"/></svg></span> Background
      </div>
      ${hotspots.map(hotspot => html`
        <div class="sidebar-item ${hotspot.id === selectedItemId ? 'selected' : ''}"
             onClick=${() => onSelectItem(hotspot.id)}>
          <span class="icon">${hotspot.action === 'navigate' ? '↗' : '◇'}</span>
          ${hotspot.id}${hotspot.action === 'navigate' && hotspot.target ? html` → ${hotspot.target}` : ''}
        </div>
      `)}
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
