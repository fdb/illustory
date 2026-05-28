import { html, useState, useEffect } from '../lib/preact-standalone.js';
import { findVariantById, resolveScene, findHotspotOwner, findObjectOwner } from '../lib/variants.js';

export function Properties({
  story,
  currentSceneId,
  selectedItemId,
  activeVariantId,
  imageFiles,
  resolveImageUrl,
  onAddVariant,
  onUpdateStory,
}) {
  if (!selectedItemId) {
    return html`<span style="color:var(--text-muted);font-size:12px">Select an item to edit properties</span>`;
  }

  if (selectedItemId === '__project__') {
    return html`<${ProjectProperties} story=${story} onUpdateStory=${onUpdateStory} />`;
  }

  if (selectedItemId === '__variables__') {
    return html`<${VariablesProperties} story=${story} onUpdateStory=${onUpdateStory} />`;
  }

  const scene = story.scenes.find(s => s.id === currentSceneId);
  if (!scene) return null;

  if (selectedItemId === '__background__') {
    if (scene.type === 'movie') {
      return html`<${MovieSceneProperties}
        story=${story} scene=${scene}
        imageFiles=${imageFiles} resolveImageUrl=${resolveImageUrl}
        onUpdateStory=${onUpdateStory} />`;
    }
    return html`<${SceneProperties}
      story=${story} scene=${scene}
      imageFiles=${imageFiles} resolveImageUrl=${resolveImageUrl}
      onAddVariant=${onAddVariant}
      onUpdateStory=${onUpdateStory} />`;
  }

  if (selectedItemId.startsWith('variant_')) {
    const vid = selectedItemId.slice('variant_'.length);
    const variant = (scene.variants || []).find(v => v.id === vid);
    if (variant) {
      return html`<${VariantProperties}
        story=${story} scene=${scene} variant=${variant}
        imageFiles=${imageFiles} resolveImageUrl=${resolveImageUrl}
        onUpdateStory=${onUpdateStory} />`;
    }
  }

  const resolvedScene = resolveScene(scene, findVariantById(scene, activeVariantId));
  const hotspot = (resolvedScene.hotspots || []).find(h => h.id === selectedItemId);
  if (hotspot) {
    return html`<${HotspotProperties}
      story=${story} scene=${scene} hotspot=${hotspot}
      activeVariantId=${activeVariantId}
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

function VariablesProperties({ story, onUpdateStory }) {
  const variables = story.variables || [];

  const updateVar = (index, field, value) => {
    const s = structuredClone(story);
    if (!s.variables) s.variables = [];
    s.variables[index][field] = value;
    onUpdateStory(s);
  };

  const renameVar = (index, newName) => {
    const oldName = variables[index].name;
    if (newName === oldName) return;
    const s = structuredClone(story);
    s.variables[index].name = newName;
    for (const scene of s.scenes) {
      for (const a of scene.on_visit || []) {
        if (a.variable === oldName) a.variable = newName;
      }
      for (const v of scene.variants || []) {
        for (const c of v.conditions || []) {
          if (c.variable === oldName) c.variable = newName;
        }
      }
      for (const h of scene.hotspots || []) {
        for (const a of h.sets || []) {
          if (a.variable === oldName) a.variable = newName;
        }
      }
    }
    onUpdateStory(s);
  };

  const addVar = () => {
    const s = structuredClone(story);
    if (!s.variables) s.variables = [];
    const base = 'var_' + (s.variables.length + 1);
    let name = base;
    let n = 1;
    while (s.variables.some(v => v.name === name)) { name = base + '_' + (++n); }
    s.variables.push({ name, type: 'bool', default: false });
    onUpdateStory(s);
  };

  const deleteVar = (index) => {
    const name = variables[index].name;
    if (!confirm(`Delete variable "${name}"? References in scenes/hotspots will be removed.`)) return;
    const s = structuredClone(story);
    s.variables.splice(index, 1);
    for (const scene of s.scenes) {
      scene.on_visit = (scene.on_visit || []).filter(a => a.variable !== name);
      for (const v of scene.variants || []) {
        v.conditions = (v.conditions || []).filter(c => c.variable !== name);
      }
      for (const h of scene.hotspots || []) {
        h.sets = (h.sets || []).filter(a => a.variable !== name);
      }
    }
    onUpdateStory(s);
  };

  return html`
    <div class="prop-header">⚙ Variables</div>
    <div style="color:var(--text-muted);font-size:11px;margin-bottom:12px;line-height:1.5">
      Boolean flags set as the player visits scenes or clicks hotspots. Variants on scenes use these to conditionally swap the background.
    </div>
    ${variables.length === 0 ? html`
      <div style="color:var(--text-muted);font-size:12px;margin-bottom:12px">No variables yet.</div>
    ` : variables.map((v, i) => html`
      <div class="prop-group" key=${i}>
        <div class="prop-row">
          <input class="prop-input" style="flex:1" value=${v.name}
                 onChange=${(e) => renameVar(i, e.target.value)} />
          <label class="prop-row-inline" title="Default value">
            <input type="checkbox" checked=${!!v.default}
                   onChange=${(e) => updateVar(i, 'default', e.target.checked)} />
            <span>default</span>
          </label>
          <button class="row-delete" title="Delete variable"
                  onClick=${() => deleteVar(i)}>✕</button>
        </div>
      </div>
    `)}
    <button class="add-row-btn" onClick=${addVar}>+ Add Variable</button>
  `;
}

function AssignmentRowList({ rows, variables, label, onChange }) {
  const update = (i, field, value) => {
    const next = rows.map((r, idx) => idx === i ? { ...r, [field]: value } : r);
    onChange(next);
  };
  const add = () => {
    const firstVar = variables[0]?.name || '';
    onChange([...rows, { variable: firstVar, value: true }]);
  };
  const remove = (i) => {
    onChange(rows.filter((_, idx) => idx !== i));
  };

  return html`
    <div class="prop-group">
      <div class="prop-label">${label}</div>
      ${variables.length === 0 ? html`
        <div style="color:var(--text-muted);font-size:11px">Declare a variable first.</div>
      ` : null}
      ${rows.map((r, i) => html`
        <div class="prop-row" key=${i}>
          <select class="prop-select" style="flex:1" value=${r.variable}
                  onChange=${(e) => update(i, 'variable', e.target.value)}>
            <option value="">-- variable --</option>
            ${variables.map(v => html`<option value=${v.name}>${v.name}</option>`)}
            ${r.variable && !variables.find(v => v.name === r.variable)
              ? html`<option value=${r.variable}>${r.variable} (missing)</option>` : null}
          </select>
          <span style="color:var(--text-muted);font-size:11px">=</span>
          <select class="prop-select" style="width:70px" value=${String(r.value)}
                  onChange=${(e) => update(i, 'value', e.target.value === 'true')}>
            <option value="true">true</option>
            <option value="false">false</option>
          </select>
          <button class="row-delete" title="Remove" onClick=${() => remove(i)}>✕</button>
        </div>
      `)}
      ${variables.length > 0 ? html`
        <button class="add-row-btn" onClick=${add}>+ Add</button>
      ` : null}
    </div>
  `;
}

function SceneProperties({ story, scene, imageFiles, resolveImageUrl, onAddVariant, onUpdateStory }) {
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
    rewriteSceneRefs(s, oldId, newId);
    onUpdateStory(s);
  };

  useEffect(() => {
    setBgPreviewUrl(null);
    if (scene.background && resolveImageUrl) {
      resolveImageUrl('backgrounds', scene.background).then(url => setBgPreviewUrl(url));
    }
  }, [scene.background, resolveImageUrl]);

  const bgAvailable = imageFiles.backgrounds.includes(scene.background);

  return html`
    <div class="prop-header">
      <span>Scene</span>
      <button class="header-action" onClick=${() => onAddVariant(scene.id)}>+ Variant</button>
    </div>
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

    <div class="prop-divider" />
    <${AssignmentRowList}
      rows=${scene.on_visit || []}
      variables=${story.variables || []}
      label="On Visit — set variables"
      onChange=${(rows) => update('on_visit', rows)}
    />

    <button class="delete-btn" onClick=${() => {
      if (!confirm('Delete this scene? This cannot be undone.')) return;
      const s = structuredClone(story);
      s.scenes = s.scenes.filter(x => x.id !== scene.id);
      if (s.start_scene === scene.id) s.start_scene = s.scenes[0]?.id || '';
      clearSceneRefs(s, scene.id);
      onUpdateStory(s);
    }}>Delete Scene</button>
  `;
}

/**
 * Rewrite all references to oldId → newId across the story:
 * - start_scene
 * - hotspot navigate targets
 * - movie next_scene
 */
function rewriteSceneRefs(s, oldId, newId) {
  if (s.start_scene === oldId) s.start_scene = newId;
  for (const otherScene of s.scenes) {
    if (otherScene.type === 'movie' && otherScene.next_scene === oldId) {
      otherScene.next_scene = newId;
    }
    for (const h of otherScene.hotspots || []) {
      if (h.action === 'navigate' && h.target === oldId) {
        h.target = newId;
      }
    }
  }
}

/**
 * Clear references to a deleted sceneId in movie next_scene and
 * hotspot navigate targets. Sets to empty string rather than removing,
 * so the editor's "(missing)" UI surfaces the broken link.
 */
function clearSceneRefs(s, sceneId) {
  for (const otherScene of s.scenes) {
    if (otherScene.type === 'movie' && otherScene.next_scene === sceneId) {
      otherScene.next_scene = '';
    }
    for (const h of otherScene.hotspots || []) {
      if (h.action === 'navigate' && h.target === sceneId) {
        h.target = '';
      }
    }
  }
}

function MovieSceneProperties({ story, scene, imageFiles, resolveImageUrl, onUpdateStory }) {
  const [previewUrl, setPreviewUrl] = useState(null);

  const update = (field, value) => {
    const s = structuredClone(story);
    const sc = s.scenes.find(x => x.id === scene.id);
    sc[field] = value;
    onUpdateStory(s);
  };

  const updateId = (newId) => {
    if (newId === scene.id || !newId) return;
    const s = structuredClone(story);
    const oldId = scene.id;
    const sc = s.scenes.find(x => x.id === oldId);
    sc.id = newId;
    rewriteSceneRefs(s, oldId, newId);
    onUpdateStory(s);
  };

  useEffect(() => {
    setPreviewUrl(null);
    if (scene.video && resolveImageUrl) {
      resolveImageUrl('movies', scene.video).then(url => setPreviewUrl(url));
    }
  }, [scene.video, resolveImageUrl]);

  const movies = imageFiles.movies || [];
  const videoAvailable = !scene.video || movies.includes(scene.video);
  const nextSceneOptions = story.scenes.filter(s => s.id !== scene.id);
  const nextSceneAvailable = !scene.next_scene || story.scenes.some(s => s.id === scene.next_scene);

  return html`
    <div class="prop-header">▶ Movie Scene</div>
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
      <div class="prop-label">Video file</div>
      <select class="prop-select" value=${scene.video || ''}
              onChange=${(e) => update('video', e.target.value)}>
        <option value="">-- None --</option>
        ${movies.map(f => html`<option value=${f}>${f}</option>`)}
        ${scene.video && !videoAvailable ? html`
          <option value=${scene.video}>${scene.video} (missing)</option>
        ` : null}
      </select>
      ${scene.video && !videoAvailable ? html`<div class="warning">File not found in images/movies/</div>` : null}
      ${previewUrl ? html`<video src=${previewUrl} class="prop-preview" controls muted />` : null}
    </div>
    <div class="prop-group">
      <div class="prop-label">Next scene (when movie ends or is skipped)</div>
      <select class="prop-select" value=${scene.next_scene || ''}
              onChange=${(e) => update('next_scene', e.target.value)}>
        <option value="">-- Exit play mode --</option>
        ${nextSceneOptions.map(s => html`<option value=${s.id}>${s.name || s.id}</option>`)}
        ${scene.next_scene && !nextSceneAvailable ? html`
          <option value=${scene.next_scene}>${scene.next_scene} (missing)</option>
        ` : null}
      </select>
      ${scene.next_scene && !nextSceneAvailable ? html`<div class="warning">Scene not found</div>` : null}
    </div>

    <div class="prop-divider" />
    <${AssignmentRowList}
      rows=${scene.on_visit || []}
      variables=${story.variables || []}
      label="On Visit — set variables"
      onChange=${(rows) => update('on_visit', rows)}
    />

    <button class="delete-btn" onClick=${() => {
      if (!confirm('Delete this movie scene? This cannot be undone.')) return;
      const s = structuredClone(story);
      s.scenes = s.scenes.filter(x => x.id !== scene.id);
      if (s.start_scene === scene.id) s.start_scene = s.scenes[0]?.id || '';
      clearSceneRefs(s, scene.id);
      onUpdateStory(s);
    }}>Delete Movie Scene</button>
  `;
}

function VariantProperties({ story, scene, variant, imageFiles, resolveImageUrl, onUpdateStory }) {
  const [bgPreviewUrl, setBgPreviewUrl] = useState(null);

  const updateVariant = (field, value) => {
    const s = structuredClone(story);
    const sc = s.scenes.find(x => x.id === scene.id);
    const v = sc.variants.find(x => x.id === variant.id);
    v[field] = value;
    onUpdateStory(s);
  };

  const updateVariantId = (newId) => {
    if (newId === variant.id || !newId) return;
    const s = structuredClone(story);
    const sc = s.scenes.find(x => x.id === scene.id);
    const v = sc.variants.find(x => x.id === variant.id);
    v.id = newId;
    onUpdateStory(s);
  };

  useEffect(() => {
    setBgPreviewUrl(null);
    const bg = variant.background ?? scene.background;
    if (bg && resolveImageUrl) {
      resolveImageUrl('backgrounds', bg).then(url => setBgPreviewUrl(url));
    }
  }, [variant.background, scene.background, resolveImageUrl]);

  const bgOverride = variant.background ?? '';
  const bgAvailable = bgOverride ? imageFiles.backgrounds.includes(bgOverride) : true;

  return html`
    <div class="prop-header">◐ Variant</div>
    <div class="prop-group">
      <div class="prop-label">Variant ID</div>
      <input class="prop-input" value=${variant.id}
             onChange=${(e) => updateVariantId(e.target.value)} />
    </div>
    <div class="prop-group">
      <div class="prop-label">Name</div>
      <input class="prop-input" value=${variant.name || ''}
             onInput=${(e) => updateVariant('name', e.target.value)} />
    </div>

    <${AssignmentRowList}
      rows=${variant.conditions || []}
      variables=${story.variables || []}
      label="Show this variant when…"
      onChange=${(rows) => updateVariant('conditions', rows)}
    />

    <div class="prop-divider" />

    <div class="prop-group">
      <div class="prop-label">Background override</div>
      <select class="prop-select" value=${bgOverride}
              onChange=${(e) => updateVariant('background', e.target.value || undefined)}>
        <option value="">-- Use base (${scene.background || 'none'}) --</option>
        ${imageFiles.backgrounds.map(f => html`<option value=${f}>${f}</option>`)}
        ${bgOverride && !bgAvailable ? html`
          <option value=${bgOverride}>${bgOverride} (missing)</option>
        ` : null}
      </select>
      ${bgOverride && !bgAvailable ? html`<div class="warning">File not found in images/backgrounds/</div>` : null}
      ${bgPreviewUrl ? html`<img src=${bgPreviewUrl} class="prop-preview" />` : null}
    </div>

    <button class="delete-btn" onClick=${() => {
      if (!confirm('Delete this variant?')) return;
      const s = structuredClone(story);
      const sc = s.scenes.find(x => x.id === scene.id);
      sc.variants = sc.variants.filter(v => v.id !== variant.id);
      onUpdateStory(s);
    }}>Delete Variant</button>
  `;
}

function HotspotProperties({ story, scene, hotspot, activeVariantId, imageFiles, resolveImageUrl, onUpdateStory }) {
  // Find the actual container (base scene or one of its variants) holding this hotspot.
  const hotspotOwner = findHotspotOwner(scene, hotspot.id);
  const isVariantOwned = hotspotOwner && hotspotOwner !== scene;

  const objectOwner = hotspot.action === 'object' && hotspot.target
    ? findObjectOwner(scene, hotspot.target)
    : null;
  const object = objectOwner?.objects.find(o => o.id === hotspot.target) || null;

  const updateHotspot = (field, value) => {
    const s = structuredClone(story);
    const sc = s.scenes.find(x => x.id === scene.id);
    const owner = findHotspotOwner(sc, hotspot.id);
    const h = owner?.hotspots.find(x => x.id === hotspot.id);
    if (h) { h[field] = value; onUpdateStory(s); }
  };

  const updateObject = (field, value) => {
    const s = structuredClone(story);
    const sc = s.scenes.find(x => x.id === scene.id);
    const owner = findObjectOwner(sc, hotspot.target);
    const obj = owner?.objects.find(o => o.id === hotspot.target);
    if (obj) { obj[field] = value; onUpdateStory(s); }
  };

  const deleteHotspot = () => {
    if (!confirm('Delete this hotspot?')) return;
    const s = structuredClone(story);
    const sc = s.scenes.find(x => x.id === scene.id);
    const owner = findHotspotOwner(sc, hotspot.id);
    if (owner) {
      owner.hotspots = owner.hotspots.filter(h => h.id !== hotspot.id);
    }
    if (hotspot.action === 'object' && hotspot.target) {
      const objOwner = findObjectOwner(sc, hotspot.target);
      if (objOwner) {
        objOwner.objects = objOwner.objects.filter(o => o.id !== hotspot.target);
      }
    }
    onUpdateStory(s);
  };

  const [hlPreviewUrl, setHlPreviewUrl] = useState(null);
  useEffect(() => {
    setHlPreviewUrl(null);
    if (hotspot.highlight_image && resolveImageUrl) {
      resolveImageUrl('highlights', hotspot.highlight_image).then(url => setHlPreviewUrl(url));
    }
  }, [hotspot.highlight_image, resolveImageUrl]);

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
      ${isVariantOwned ? html`<span class="variant-tag">extra in ${hotspotOwner.name || hotspotOwner.id}</span>` : null}
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

    <div class="prop-divider" />
    <${AssignmentRowList}
      rows=${hotspot.sets || []}
      variables=${story.variables || []}
      label="On click — set variables"
      onChange=${(rows) => updateHotspot('sets', rows)}
    />

    <button class="delete-btn" onClick=${deleteHotspot}>Delete Hotspot</button>

    ${object ? html`
      <div class="prop-divider" />
      <div class="prop-header">◇ Object: ${object.id}</div>

      <div class="prop-group">
        <div class="prop-label">Object ID</div>
        <input class="prop-input" value=${object.id}
               onChange=${(e) => {
                 const newId = e.target.value;
                 const s = structuredClone(story);
                 const sc = s.scenes.find(x => x.id === scene.id);
                 const objOwner = findObjectOwner(sc, object.id);
                 const hOwner = findHotspotOwner(sc, hotspot.id);
                 const obj = objOwner?.objects.find(o => o.id === object.id);
                 const h = hOwner?.hotspots.find(x => x.id === hotspot.id);
                 if (obj && h) { obj.id = newId; h.target = newId; onUpdateStory(s); }
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
