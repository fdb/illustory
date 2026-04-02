import { html, render, useState, useEffect, useCallback } from './lib/preact-standalone.js';
import { createHistory, pushState, undo, redo, currentState, canUndo, canRedo } from './lib/history.js';
import { pickProjectDirectory, loadStory, saveStory, scanImages, getImageUrl, refreshImages } from './lib/filesystem.js';
import { Canvas } from './components/Canvas.js';
import { Sidebar } from './components/Sidebar.js';
import { Properties } from './components/Properties.js';
import { Toolbar } from './components/Toolbar.js';
import { WelcomeScreen } from './components/WelcomeScreen.js';
import { Player } from './components/Player.js';

function App() {
  // Project state
  const [dirHandle, setDirHandle] = useState(null);
  const [imageFiles, setImageFiles] = useState({ backgrounds: [], objects: [], highlights: [] });

  // Editor state
  const [history, setHistory] = useState(null);
  const [currentSceneId, setCurrentSceneId] = useState(null);
  const [selectedItemId, setSelectedItemId] = useState(null);
  const [activeTool, setActiveTool] = useState('select');
  const [lastSavedIndex, setLastSavedIndex] = useState(0);
  const [toast, setToast] = useState(null);
  const [playing, setPlaying] = useState(false);

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

  // Open a project folder
  const handleOpenProject = useCallback(async () => {
    try {
      const handle = await pickProjectDirectory();
      const storyData = await loadStory(handle);
      const images = await scanImages(handle);
      setDirHandle(handle);
      setImageFiles(images);
      setHistory(createHistory(storyData));
      setLastSavedIndex(0);
      setSelectedItemId(null);
      if (storyData.scenes.length > 0) {
        setCurrentSceneId(storyData.start_scene || storyData.scenes[0].id);
      } else {
        setCurrentSceneId(null);
      }
    } catch (e) {
      if (e.name !== 'AbortError') {
        console.error('Failed to open project:', e);
        setToast('Failed to open project folder');
      }
    }
  }, []);

  // Save story.json to the project folder
  const handleSave = useCallback(async () => {
    if (!story || !dirHandle) return;
    try {
      await saveStory(dirHandle, story);
      setLastSavedIndex(history.index);
      setToast('Saved story.json');
    } catch (e) {
      console.error('Save failed:', e);
      setToast('Save failed — check permissions');
    }
  }, [story, history, dirHandle]);

  // Copy JSON to clipboard (fallback / convenience)
  const handleCopyJson = useCallback(async () => {
    if (!story) return;
    const output = structuredClone(story);
    for (const scene of output.scenes) {
      delete scene.navigation;
    }
    await navigator.clipboard.writeText(JSON.stringify(output, null, 2));
    setToast('Copied to clipboard');
  }, [story]);

  // Rescan images (e.g. after user adds files externally)
  const handleRefreshImages = useCallback(async () => {
    if (!dirHandle) return;
    const images = await refreshImages(dirHandle);
    setImageFiles(images);
    setToast('Image list refreshed');
  }, [dirHandle]);

  // Resolve an image path to a blob URL
  const resolveImageUrl = useCallback(async (subfolder, filename) => {
    if (!dirHandle || !filename) return null;
    return await getImageUrl(dirHandle, `${subfolder}/${filename}`);
  }, [dirHandle]);

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
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault();
        handleSave();
      }
      const tag = document.activeElement?.tagName;
      if (tag !== 'INPUT' && tag !== 'TEXTAREA' && tag !== 'SELECT') {
        if (e.key === 'v' || e.key === 'V') setActiveTool('select');
        if (e.key === 'd' || e.key === 'D') setActiveTool('draw');
        if (e.key === 'o' || e.key === 'O') setActiveTool('object');
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [handleUndo, handleRedo, handleSave]);

  // Toast auto-dismiss
  useEffect(() => {
    if (toast) {
      const t = setTimeout(() => setToast(null), 2000);
      return () => clearTimeout(t);
    }
  }, [toast]);

  // Welcome screen — no project open yet
  if (!dirHandle || !story) {
    return html`<${WelcomeScreen} onOpenProject=${handleOpenProject} />`;
  }

  const currentScene = story.scenes.find(s => s.id === currentSceneId);

  return html`
    <div class="toolbar">
      <${Toolbar}
        activeTool=${activeTool}
        canUndo=${canUndo(history)}
        canRedo=${canRedo(history)}
        isDirty=${isDirty}
        onSetTool=${setActiveTool}
        onUndo=${handleUndo}
        onRedo=${handleRedo}
        onSave=${handleSave}
        onCopyJson=${handleCopyJson}
        onOpenProject=${handleOpenProject}
        onRefreshImages=${handleRefreshImages}
        onPlay=${() => setPlaying(true)}
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
        resolveImageUrl=${resolveImageUrl}
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
        imageFiles=${imageFiles}
        resolveImageUrl=${resolveImageUrl}
        onUpdateStory=${(newStory) => {
          const oldScene = story.scenes.find(s => s.id === currentSceneId);
          if (oldScene) {
            const sceneIndex = story.scenes.indexOf(oldScene);
            const newSceneAtIndex = newStory.scenes[sceneIndex];
            if (newSceneAtIndex && newSceneAtIndex.id !== currentSceneId) {
              setCurrentSceneId(newSceneAtIndex.id);
            }
          }
          commit(newStory);
          if (!newStory.scenes.find(s => s.id === currentSceneId)) {
            setCurrentSceneId(newStory.scenes[0]?.id || null);
            setSelectedItemId(null);
          }
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
    ${playing ? html`<${Player}
      story=${story}
      resolveImageUrl=${resolveImageUrl}
      onClose=${() => setPlaying(false)}
    />` : null}
  `;
}

render(html`<${App} />`, document.getElementById('app'));
