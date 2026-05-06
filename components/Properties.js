import { html, useState, useEffect } from '../lib/preact-standalone.js';

export function Properties({
  story,
  currentSceneId,
  selectedItemId,
  imageFiles,
  resolveImageUrl,
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
    return html`<${SceneProperties}
      story=${story} scene=${scene}
      imageFiles=${imageFiles} resolveImageUrl=${resolveImageUrl}
      onUpdateStory=${onUpdateStory} />`;
  }

  const hotspot = (scene.hotspots || []).find(h => h.id === selectedItemId);
  if (hotspot) {
    return html`<${HotspotProperties}
      story=${story} scene=${scene} hotspot=${hotspot}
      imageFiles=${imageFiles} resolveImageUrl=${resolveImageUrl}
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
    <div class="prop-group">
      <div class="prop-label">Canvas Width</div>
      <input class="prop-input" type="number" min="1" step="1" value=${story.width}
             onChange=${(e) => update('width', Math.max(1, parseInt(e.target.value, 10) || 1))} />
    </div>
    <div class="prop-group">
      <div class="prop-label">Canvas Height</div>
      <input class="prop-input" type="number" min="1" step="1" value=${story.height}
             onChange=${(e) => update('height', Math.max(1, parseInt(e.target.value, 10) || 1))} />
    </div>
  `;
}

function SceneProperties({ story, scene, imageFiles, resolveImageUrl, onUpdateStory }) {
  const [bgPreviewUrl, setBgPreviewUrl] = useState(null);

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

  // Preview the background image
  useEffect(() => {
    setBgPreviewUrl(null);
    if (scene.background && resolveImageUrl) {
      resolveImageUrl('backgrounds', scene.background).then(url => setBgPreviewUrl(url));
    }
  }, [scene.background, resolveImageUrl]);

  const bgAvailable = imageFiles.backgrounds.includes(scene.background);

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
      <select class="prop-select" value=${scene.background || ''}
              onChange=${(e) => update('background', e.target.value)}>
        <option value="">-- None --</option>
        ${imageFiles.backgrounds.map(f => html`<option value=${f}>${f}</option>`)}
        ${scene.background && !bgAvailable ? html`
          <option value=${scene.background}>${scene.background} (missing)</option>
        ` : null}
      </select>
      ${scene.background && !bgAvailable ? html`<div class="warning">File not found in images/backgrounds/</div>` : null}
      ${bgPreviewUrl ? html`<img src=${bgPreviewUrl} class="prop-preview" />` : null}
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

function HotspotProperties({ story, scene, hotspot, imageFiles, resolveImageUrl, onUpdateStory }) {
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

  // Highlight image preview
  const [hlPreviewUrl, setHlPreviewUrl] = useState(null);
  useEffect(() => {
    setHlPreviewUrl(null);
    if (hotspot.highlight_image && resolveImageUrl) {
      resolveImageUrl('highlights', hotspot.highlight_image).then(url => setHlPreviewUrl(url));
    }
  }, [hotspot.highlight_image, resolveImageUrl]);

  // Object image preview
  const [objPreviewUrl, setObjPreviewUrl] = useState(null);
  useEffect(() => {
    setObjPreviewUrl(null);
    if (object?.image && resolveImageUrl) {
      resolveImageUrl('objects', object.image).then(url => setObjPreviewUrl(url));
    }
  }, [object?.image, resolveImageUrl]);

  const hlAvailable = imageFiles.highlights.includes(hotspot.highlight_image);

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
      <select class="prop-select" value=${hotspot.highlight_image || ''}
              onChange=${(e) => updateHotspot('highlight_image', e.target.value)}>
        <option value="">-- None --</option>
        ${imageFiles.highlights.map(f => html`<option value=${f}>${f}</option>`)}
        ${hotspot.highlight_image && !hlAvailable ? html`
          <option value=${hotspot.highlight_image}>${hotspot.highlight_image} (missing)</option>
        ` : null}
      </select>
      ${hotspot.highlight_image && !hlAvailable ? html`<div class="warning">File not found in images/highlights/</div>` : null}
      ${hlPreviewUrl ? html`<img src=${hlPreviewUrl} class="prop-preview" />` : null}
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
        <select class="prop-select" value=${object.image || ''}
                onChange=${(e) => updateObject('image', e.target.value)}>
          <option value="">-- None --</option>
          ${imageFiles.objects.map(f => html`<option value=${f}>${f}</option>`)}
          ${object.image && !imageFiles.objects.includes(object.image) ? html`
            <option value=${object.image}>${object.image} (missing)</option>
          ` : null}
        </select>
        ${objPreviewUrl ? html`<img src=${objPreviewUrl} class="prop-preview" />` : null}
      </div>

      <div class="prop-group">
        <div class="prop-label">Description</div>
        <textarea class="prop-textarea" value=${object.description || ''}
                  onInput=${(e) => updateObject('description', e.target.value)} />
      </div>
    ` : null}
  `;
}
