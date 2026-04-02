import { html } from '../lib/preact-standalone.js';

export function Toolbar({
  activeTool,
  canUndo,
  canRedo,
  onSetTool,
  onUndo,
  onRedo,
  onCopyJson,
}) {
  return html`
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
    <button class="toolbar-btn copy-btn" onClick=${onCopyJson}>Copy JSON</button>
  `;
}
