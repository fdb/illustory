import { html, render, useState, useEffect, useCallback } from './lib/preact-standalone.js';
import { createHistory, pushState, undo, redo, currentState, canUndo, canRedo } from './lib/history.js';
import { Canvas } from './components/Canvas.js';
import { Sidebar } from './components/Sidebar.js';
import { Properties } from './components/Properties.js';
import { Toolbar } from './components/Toolbar.js';

function App() {
  const [history, setHistory] = useState(null);
  const [currentSceneId, setCurrentSceneId] = useState(null);
  const [selectedItemId, setSelectedItemId] = useState(null);
  const [activeTool, setActiveTool] = useState('select');
  const [lastSavedIndex, setLastSavedIndex] = useState(0);

  // Derived state
  const story = history ? currentState(history) : null;
  const isDirty = history ? history.index !== lastSavedIndex : false;

  const commit = useCallback((newStory) => {
    setHistory(h => pushState(h, newStory));
  }, []);

  const handleUndo = useCallback(() => {
    setHistory(h => undo(h));
  }, []);

  const handleRedo = useCallback(() => {
    setHistory(h => redo(h));
  }, []);

  // Load story
  useEffect(() => {
    fetch('../story.json')
      .then(r => r.ok ? r.json() : null)
      .catch(() => null)
      .then(data => {
        const s = data || { title: 'Untitled', start_scene: '', scenes: [] };
        setHistory(createHistory(s));
        if (s.scenes.length > 0) {
          setCurrentSceneId(s.start_scene || s.scenes[0].id);
        }
      });
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'z') {
        e.preventDefault();
        if (e.shiftKey) {
          handleRedo();
        } else {
          handleUndo();
        }
      }
      // Tool shortcuts — only when not typing in an input
      const tag = document.activeElement?.tagName;
      if (tag !== 'INPUT' && tag !== 'TEXTAREA' && tag !== 'SELECT') {
        if (e.key === 'v' || e.key === 'V') setActiveTool('select');
        if (e.key === 'd' || e.key === 'D') setActiveTool('draw');
        if (e.key === 'o' || e.key === 'O') setActiveTool('object');
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [handleUndo, handleRedo]);

  const handleCopyJson = useCallback(async () => {
    if (!story) return;
    const output = structuredClone(story);
    for (const scene of output.scenes) {
      delete scene.navigation;
    }
    await navigator.clipboard.writeText(JSON.stringify(output, null, 2));
    setLastSavedIndex(history.index);
    setToast('Copied to clipboard');
  }, [story, history]);

  const [toast, setToast] = useState(null);
  useEffect(() => {
    if (toast) {
      const t = setTimeout(() => setToast(null), 2000);
      return () => clearTimeout(t);
    }
  }, [toast]);

  if (!story) return html`<div class="toolbar" style="justify-content:center">Loading...</div>`;

  const currentScene = story.scenes.find(s => s.id === currentSceneId);

  return html`
    <div class="toolbar">
      <${Toolbar}
        activeTool=${activeTool}
        canUndo=${canUndo(history)}
        canRedo=${canRedo(history)}
        onSetTool=${setActiveTool}
        onUndo=${handleUndo}
        onRedo=${handleRedo}
        onCopyJson=${handleCopyJson}
      />
    </div>
    <div class="sidebar">
      <${Sidebar}
        story=${story}
        currentSceneId=${currentSceneId}
        selectedItemId=${selectedItemId}
        isDirty=${isDirty}
        onSelectScene=${(id) => { setCurrentSceneId(id); setSelectedItemId(null); }}
        onSelectItem=${(id) => setSelectedItemId(id)}
        onSelectProject=${() => setSelectedItemId('__project__')}
        onAddScene=${() => {
          const newStory = structuredClone(story);
          const id = 'scene_' + Date.now();
          newStory.scenes.push({ id, name: 'New Scene', background: '', hotspots: [], objects: [] });
          commit(newStory);
          setCurrentSceneId(id);
          setSelectedItemId(null);
        }}
      />
    </div>
    <div class="canvas-area">
      <${Canvas}
        scene=${currentScene}
        story=${story}
        selectedItemId=${selectedItemId}
        activeTool=${activeTool}
        onSelectHotspot=${(id) => { setSelectedItemId(id); setActiveTool('select'); }}
        onDeselectAll=${() => setSelectedItemId(null)}
        onHotspotCoordsChange=${(hotspotId, newCoords) => {
          const newStory = structuredClone(story);
          const scene = newStory.scenes.find(s => s.id === currentSceneId);
          const hotspot = scene.hotspots.find(h => h.id === hotspotId);
          hotspot.coords = newCoords;
          commit(newStory);
        }}
        onNewHotspot=${(coords) => {
          const newStory = structuredClone(story);
          const scene = newStory.scenes.find(s => s.id === currentSceneId);
          if (!scene.hotspots) scene.hotspots = [];
          const id = 'hotspot_' + Date.now();
          scene.hotspots.push({ id, coords, action: 'navigate', target: '', highlight_image: '' });
          commit(newStory);
          setSelectedItemId(id);
          setActiveTool('select');
        }}
        onNewObject=${(coords) => {
          const newStory = structuredClone(story);
          const scene = newStory.scenes.find(s => s.id === currentSceneId);
          if (!scene.hotspots) scene.hotspots = [];
          if (!scene.objects) scene.objects = [];
          const id = 'object_' + Date.now();
          scene.objects.push({ id, image: '', description: '' });
          scene.hotspots.push({ id: id + '_hotspot', coords, action: 'object', target: id, highlight_image: '' });
          commit(newStory);
          setSelectedItemId(id + '_hotspot');
          setActiveTool('select');
        }}
      />
    </div>
    <div class="properties">
      <${Properties}
        story=${story}
        currentSceneId=${currentSceneId}
        selectedItemId=${selectedItemId}
        onUpdateStory=${(newStory) => {
          // Detect scene ID rename
          const oldScene = story.scenes.find(s => s.id === currentSceneId);
          if (oldScene) {
            const sceneIndex = story.scenes.indexOf(oldScene);
            const newSceneAtIndex = newStory.scenes[sceneIndex];
            if (newSceneAtIndex && newSceneAtIndex.id !== currentSceneId) {
              setCurrentSceneId(newSceneAtIndex.id);
            }
          }
          commit(newStory);
          // If current scene was deleted, switch to first available
          if (!newStory.scenes.find(s => s.id === currentSceneId)) {
            setCurrentSceneId(newStory.scenes[0]?.id || null);
            setSelectedItemId(null);
          }
          // If selected hotspot was deleted, deselect
          if (selectedItemId && selectedItemId !== '__project__' && selectedItemId !== '__background__') {
            const sc = newStory.scenes.find(s => s.id === currentSceneId);
            if (sc && !(sc.hotspots || []).find(h => h.id === selectedItemId)) {
              setSelectedItemId(null);
            }
          }
        }}
      />
    </div>
    ${toast ? html`<div class="toast">${toast}</div>` : null}
  `;
}

render(html`<${App} />`, document.getElementById('app'));
