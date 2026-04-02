import { html, useState, useEffect } from '../lib/preact-standalone.js';

export function Properties({
  story,
  currentSceneId,
  selectedItemId,
  onUpdateStory,
}) {
  if (!selectedItemId) {
    return html`<span style="color:var(--text-muted);font-size:12px">Select an item to edit properties</span>`;
  }

  if (selectedItemId === '__project__') {
    return html`<${ProjectProperties} story=${story} onUpdateStory=${onUpdateStory} />`;
  }

  const scene = story.scenes.find(s => s.id === currentSceneId);
  if (!scene) return null;

  if (selectedItemId === '__background__') {
    return html`<${SceneProperties} story=${story} scene=${scene} onUpdateStory=${onUpdateStory} />`;
  }

  const hotspot = (scene.hotspots || []).find(h => h.id === selectedItemId);
  if (hotspot) {
    return html`<${HotspotProperties}
      story=${story}
      scene=${scene}
      hotspot=${hotspot}
      onUpdateStory=${onUpdateStory}
    />`;
  }

  return html`<span style="color:var(--text-muted);font-size:12px">Unknown selection</span>`;
}

function ProjectProperties({ story, onUpdateStory }) {
  const update = (field, value) => {
    const s = structuredClone(story);
    s[field] = value;
    onUpdateStory(s);
  };

  return html`
    <div class="prop-header">Project</div>
    <div class="prop-group">
      <div class="prop-label">Title</div>
      <input class="prop-input" value=${story.title}
             onInput=${(e) => update('title', e.target.value)} />
    </div>
    <div class="prop-group">
      <div class="prop-label">Start Scene</div>
      <select class="prop-select" value=${story.start_scene}
              onChange=${(e) => update('start_scene', e.target.value)}>
        <option value="">-- None --</option>
        ${story.scenes.map(s => html`<option value=${s.id}>${s.name || s.id}</option>`)}
      </select>
    </div>
  `;
}

function SceneProperties({ story, scene, onUpdateStory }) {
  const [bgWarning, setBgWarning] = useState('');

  const update = (field, value) => {
    const s = structuredClone(story);
    const sc = s.scenes.find(x => x.id === scene.id);
    sc[field] = value;
    onUpdateStory(s);
  };

  const updateId = (newId) => {
    if (newId === scene.id) return;
    const s = structuredClone(story);
    const oldId = scene.id;
    const sc = s.scenes.find(x => x.id === oldId);
    sc.id = newId;
    if (s.start_scene === oldId) s.start_scene = newId;
    for (const otherScene of s.scenes) {
      for (const h of otherScene.hotspots || []) {
        if (h.action === 'navigate' && h.target === oldId) {
          h.target = newId;
        }
      }
    }
    onUpdateStory(s);
  };

  useEffect(() => {
    if (!scene.background) { setBgWarning('No background set'); return; }
    fetch(`../images/backgrounds/${scene.background}`, { method: 'HEAD' })
      .then(r => { setBgWarning(r.ok ? '' : `File not found: ${scene.background}`); })
      .catch(() => setBgWarning(`Cannot check: ${scene.background}`));
  }, [scene.background]);

  return html`
    <div class="prop-header">Scene</div>
    <div class="prop-group">
      <div class="prop-label">Scene ID</div>
      <input class="prop-input" value=${scene.id}
             onChange=${(e) => updateId(e.target.value)} />
    </div>
    <div class="prop-group">
      <div class="prop-label">Name</div>
      <input class="prop-input" value=${scene.name || ''}
             onInput=${(e) => update('name', e.target.value)} />
    </div>
    <div class="prop-group">
      <div class="prop-label">Background</div>
      <input class="prop-input" value=${scene.background || ''}
             onInput=${(e) => update('background', e.target.value)} />
      ${bgWarning ? html`<div class="warning">${bgWarning}</div>` : null}
    </div>
    <button class="delete-btn" onClick=${() => {
      if (!confirm('Delete this scene? This cannot be undone.')) return;
      const s = structuredClone(story);
      s.scenes = s.scenes.filter(x => x.id !== scene.id);
      if (s.start_scene === scene.id) s.start_scene = s.scenes[0]?.id || '';
      onUpdateStory(s);
    }}>Delete Scene</button>
  `;
}

function HotspotProperties({ story, scene, hotspot, onUpdateStory }) {
  const object = hotspot.action === 'object'
    ? (scene.objects || []).find(o => o.id === hotspot.target)
    : null;

  const updateHotspot = (field, value) => {
    const s = structuredClone(story);
    const sc = s.scenes.find(x => x.id === scene.id);
    const h = sc.hotspots.find(x => x.id === hotspot.id);
    h[field] = value;
    onUpdateStory(s);
  };

  const updateObject = (field, value) => {
    const s = structuredClone(story);
    const sc = s.scenes.find(x => x.id === scene.id);
    const obj = sc.objects.find(o => o.id === hotspot.target);
    if (obj) {
      obj[field] = value;
      onUpdateStory(s);
    }
  };

  const deleteHotspot = () => {
    if (!confirm('Delete this hotspot?')) return;
    const s = structuredClone(story);
    const sc = s.scenes.find(x => x.id === scene.id);
    sc.hotspots = sc.hotspots.filter(h => h.id !== hotspot.id);
    if (hotspot.action === 'object' && hotspot.target) {
      sc.objects = (sc.objects || []).filter(o => o.id !== hotspot.target);
    }
    onUpdateStory(s);
  };

  return html`
    <div class="prop-header">
      ${hotspot.action === 'navigate' ? '↗' : '◇'} ${hotspot.id}
    </div>

    <div class="prop-group">
      <div class="prop-label">Hotspot ID</div>
      <input class="prop-input" value=${hotspot.id}
             onChange=${(e) => updateHotspot('id', e.target.value)} />
    </div>

    <div class="prop-group">
      <div class="prop-label">Action</div>
      <select class="prop-select" value=${hotspot.action}
              onChange=${(e) => updateHotspot('action', e.target.value)}>
        <option value="navigate">navigate</option>
        <option value="object">object</option>
      </select>
    </div>

    <div class="prop-group">
      <div class="prop-label">Target</div>
      ${hotspot.action === 'navigate' ? html`
        <select class="prop-select" value=${hotspot.target}
                onChange=${(e) => updateHotspot('target', e.target.value)}>
          <option value="">-- Select scene --</option>
          ${story.scenes.map(s => html`<option value=${s.id}>${s.name || s.id}</option>`)}
        </select>
      ` : html`
        <select class="prop-select" value=${hotspot.target}
                onChange=${(e) => updateHotspot('target', e.target.value)}>
          <option value="">-- Select object --</option>
          ${(scene.objects || []).map(o => html`<option value=${o.id}>${o.id}</option>`)}
        </select>
      `}
    </div>

    <div class="prop-group">
      <div class="prop-label">Highlight Image</div>
      <input class="prop-input" value=${hotspot.highlight_image || ''}
             onInput=${(e) => updateHotspot('highlight_image', e.target.value)} />
    </div>

    <div class="prop-group">
      <div class="prop-label">Coordinates</div>
      <div class="prop-readonly">${hotspot.coords}</div>
    </div>

    <button class="delete-btn" onClick=${deleteHotspot}>Delete Hotspot</button>

    ${object ? html`
      <div style="border-top:1px solid var(--bg-overlay);margin:16px 0" />
      <div class="prop-header">◇ Object: ${object.id}</div>

      <div class="prop-group">
        <div class="prop-label">Object ID</div>
        <input class="prop-input" value=${object.id}
               onChange=${(e) => {
                 const newId = e.target.value;
                 const s = structuredClone(story);
                 const sc = s.scenes.find(x => x.id === scene.id);
                 const obj = sc.objects.find(o => o.id === object.id);
                 const h = sc.hotspots.find(x => x.id === hotspot.id);
                 obj.id = newId;
                 h.target = newId;
                 onUpdateStory(s);
               }} />
      </div>

      <div class="prop-group">
        <div class="prop-label">Image</div>
        <input class="prop-input" value=${object.image || ''}
               onInput=${(e) => updateObject('image', e.target.value)} />
      </div>

      <div class="prop-group">
        <div class="prop-label">Description</div>
        <textarea class="prop-textarea" value=${object.description || ''}
                  onInput=${(e) => updateObject('description', e.target.value)} />
      </div>
    ` : null}
  `;
}
