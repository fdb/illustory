import { html } from '../lib/preact-standalone.js';

export function Toolbar({
  activeTool,
  canUndo,
  canRedo,
  isDirty,
  onSetTool,
  onUndo,
  onRedo,
  onSave,
  onCopyJson,
  onOpenProject,
  onRefreshImages,
}) {
  return html`
    <button class="toolbar-btn" onClick=${onOpenProject} title="Open project folder">Open</button>
    <button class="toolbar-btn" onClick=${onRefreshImages} title="Rescan images from disk">Refresh</button>
    <div class="toolbar-separator" />
    <button class="toolbar-btn ${activeTool === 'select' ? 'active' : ''}"
            onClick=${() => onSetTool('select')}>Select</button>
    <button class="toolbar-btn ${activeTool === 'draw' ? 'active' : ''}"
            onClick=${() => onSetTool('draw')}>Draw Hotspot</button>
    <button class="toolbar-btn ${activeTool === 'object' ? 'active' : ''}"
            onClick=${() => onSetTool('object')}>Place Object</button>
    <div class="toolbar-separator" />
    <button class="toolbar-btn" onClick=${onUndo} disabled=${!canUndo}>Undo</button>
    <button class="toolbar-btn" onClick=${onRedo} disabled=${!canRedo}>Redo</button>
    <div class="toolbar-separator" />
    <button class="toolbar-btn save-btn ${isDirty ? 'dirty' : ''}" onClick=${onSave}
            title="Save story.json (Ctrl+S)">Save</button>
    <button class="toolbar-btn" onClick=${onCopyJson} title="Copy JSON to clipboard">Copy</button>
  `;
}
