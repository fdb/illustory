import { html, useState, useEffect, useCallback } from '../lib/preact-standalone.js';
import { parseCoords } from '../lib/coords.js';
import { pickVariant, resolveScene, initialGameState, applyAssignments } from '../lib/variants.js';

export function Player({ story, mode = 'test', resolveImageUrl, onClose }) {
  const isTest = mode === 'test';
  const startId = story.start_scene || story.scenes[0]?.id;
  const [sceneId, setSceneId] = useState(startId);
  const [gameState, setGameState] = useState(() => initialGameState(story));
  const [activeVariant, setActiveVariant] = useState(null);
  const [objectOverlay, setObjectOverlay] = useState(null);
  const [bgUrl, setBgUrl] = useState(null);
  const [movieUrl, setMovieUrl] = useState(null);
  const [highlightUrl, setHighlightUrl] = useState(null);
  const [objectImageUrl, setObjectImageUrl] = useState(null);

  // Save points (test mode only). A snapshot is just { sceneId, gameState } —
  // everything else re-derives from those via the effects below. Persisted to
  // localStorage so a hand-built mid-game state survives closing the player.
  const saveKey = `illustory:save:${story.title || 'untitled'}`;
  const [slots, setSlots] = useState(() => {
    try { return JSON.parse(localStorage.getItem(saveKey)) || [null, null, null]; }
    catch { return [null, null, null]; }
  });

  const rawScene = story.scenes.find(s => s.id === sceneId);
  const isMovie = rawScene?.type === 'movie';
  const scene = isMovie ? rawScene : resolveScene(rawScene, activeVariant);

  // On scene change: pick variant from CURRENT gameState (before on_visit),
  // then apply on_visit. This means a scene's first visit shows the base;
  // subsequent visits can see variants that depend on the just-set flag.
  useEffect(() => {
    if (!rawScene) return;
    setActiveVariant(isMovie ? null : pickVariant(rawScene, gameState));
    if (rawScene.on_visit?.length) {
      setGameState(prev => applyAssignments(prev, rawScene.on_visit));
    }
    // gameState intentionally omitted from deps — we read it as the "entry snapshot"
  }, [sceneId]);

  useEffect(() => {
    setBgUrl(null);
    if (!isMovie && scene?.background) {
      resolveImageUrl('backgrounds', scene.background).then(setBgUrl);
    }
  }, [scene?.background, isMovie, resolveImageUrl]);

  useEffect(() => {
    setMovieUrl(null);
    if (isMovie && scene?.video) {
      resolveImageUrl('movies', scene.video).then(setMovieUrl);
    }
  }, [scene?.video, isMovie, resolveImageUrl]);

  useEffect(() => {
    setObjectImageUrl(null);
    if (objectOverlay?.image) {
      resolveImageUrl('objects', objectOverlay.image).then(setObjectImageUrl);
    }
  }, [objectOverlay?.image, resolveImageUrl]);

  const advanceMovie = useCallback(() => {
    if (!isMovie) return;
    const next = scene?.next_scene;
    if (next && story.scenes.some(s => s.id === next)) {
      setSceneId(next);
    } else {
      onClose();
    }
  }, [isMovie, scene, story, onClose]);

  // Play mode is "production": escape the browser chrome via the Fullscreen API.
  useEffect(() => {
    if (isTest) return;
    document.documentElement.requestFullscreen?.().catch(() => {});
    return () => { if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {}); };
  }, [isTest]);

  useEffect(() => {
    const handler = (e) => {
      if (e.key === 'Escape') {
        if (isMovie) advanceMovie();
        else if (objectOverlay) setObjectOverlay(null);
        else onClose();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [objectOverlay, onClose, isMovie, advanceMovie]);

  const handleHotspotClick = useCallback((hotspot) => {
    const newState = applyAssignments(gameState, hotspot.sets);
    if (newState !== gameState) setGameState(newState);

    if (hotspot.action === 'navigate') {
      const target = story.scenes.find(s => s.id === hotspot.target);
      if (target) {
        setSceneId(hotspot.target);
        setHighlightUrl(null);
      }
    } else if (hotspot.action === 'object') {
      const obj = (scene.objects || []).find(o => o.id === hotspot.target);
      if (obj) {
        setObjectOverlay(obj);
        setHighlightUrl(null);
      }
      // Same scene — re-pick variant against the new state so the
      // background can swap immediately if a condition just flipped.
      if (newState !== gameState) {
        setActiveVariant(pickVariant(rawScene, newState));
      }
    }
  }, [gameState, story, scene, rawScene]);

  const handleHotspotEnter = useCallback((hotspot) => {
    if (hotspot.highlight_image) {
      resolveImageUrl('highlights', hotspot.highlight_image).then(setHighlightUrl);
    }
  }, [resolveImageUrl]);

  const handleHotspotLeave = useCallback(() => setHighlightUrl(null), []);

  const handleReset = useCallback(() => {
    setGameState(initialGameState(story));
    setSceneId(startId);
    setObjectOverlay(null);
    setActiveVariant(null);
  }, [story, startId]);

  const saveSlot = useCallback((i) => {
    setSlots(prev => {
      const next = prev.slice();
      next[i] = { sceneId, gameState, sceneName: rawScene?.name || sceneId };
      try { localStorage.setItem(saveKey, JSON.stringify(next)); } catch {}
      return next;
    });
  }, [sceneId, gameState, rawScene, saveKey]);

  const loadSlot = useCallback((i) => {
    const snap = slots[i];
    if (!snap) return;
    setGameState(snap.gameState);
    setSceneId(snap.sceneId); // triggers the [sceneId] effect, which re-picks
    setObjectOverlay(null);   // the variant against the restored state
    setActiveVariant(null);
  }, [slots]);

  const hotspots = scene?.hotspots || [];
  const hasVariables = (story.variables || []).length > 0;

  return html`
    <div class="player-overlay">
      ${isTest ? html`
        <button class="player-close" onClick=${onClose} title="Back to editor (Esc)">✕</button>
        ${hasVariables ? html`
          <button class="player-reset" onClick=${handleReset} title="Reset game state">↺</button>
          <div class="player-state">
            ${Object.entries(gameState).map(([k, v]) => html`
              <span class="player-state-pill ${v ? 'on' : 'off'}">${k}</span>
            `)}
          </div>
        ` : null}
        <div class="player-slots">
          <span class="player-slots-label">Save points</span>
          ${slots.map((snap, i) => html`
            <button
              key=${i}
              class="player-slot ${snap ? 'filled' : ''}"
              title=${snap
                ? `Slot ${i + 1} — ${snap.sceneName}\nClick: overwrite · Shift-click: restore`
                : `Slot ${i + 1} empty\nClick to save current scene + variables`}
              onClick=${(e) => (e.shiftKey ? loadSlot(i) : saveSlot(i))}
            >${i + 1}</button>
          `)}
        </div>
      ` : null}

      ${isMovie ? html`
        <${MoviePlayer} url=${movieUrl} onEnded=${advanceMovie} onSkip=${advanceMovie} />
      ` : html`
        <div class="player-scene">
          ${bgUrl ? html`<img class="player-bg" src=${bgUrl} alt=${scene?.name} />` : null}

          ${highlightUrl ? html`<img class="player-highlight" src=${highlightUrl} />` : null}

          <svg class="player-svg" viewBox="0 0 ${story?.width ?? 2000} ${story?.height ?? 1125}">
            ${hotspots.map(hotspot => {
              const points = parseCoords(hotspot.coords);
              const pointsStr = points.map(p => `${p.x},${p.y}`).join(' ');
              return html`
                <polygon
                  key=${hotspot.id}
                  points=${pointsStr}
                  fill="transparent"
                  style="cursor:pointer;pointer-events:auto"
                  onClick=${() => handleHotspotClick(hotspot)}
                  onMouseEnter=${() => handleHotspotEnter(hotspot)}
                  onMouseLeave=${handleHotspotLeave}
                />
              `;
            })}
          </svg>
        </div>

        ${objectOverlay ? html`
          <div class="player-object-overlay" onClick=${() => setObjectOverlay(null)}>
            ${objectImageUrl ? html`<img class="player-object-img" src=${objectImageUrl} />` : null}
            ${objectOverlay.description ? html`<div class="player-object-desc">${objectOverlay.description}</div>` : null}
          </div>
        ` : null}
      `}
    </div>
  `;
}

function MoviePlayer({ url, onEnded, onSkip }) {
  return html`
    ${url ? html`
      <video
        class="player-movie"
        src=${url}
        autoplay
        onEnded=${onEnded}
        onClick=${onSkip}
        onError=${onEnded}
      />
    ` : html`<div class="player-movie" onClick=${onSkip} />`}
    <button class="player-skip" onClick=${onSkip} title="Skip (Esc)">Skip →</button>
  `;
}
