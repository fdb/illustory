import { html, useState, useEffect, useCallback } from '../lib/preact-standalone.js';
import { parseCoords } from '../lib/coords.js';
import { pickVariant, resolveScene, initialGameState, applyAssignments } from '../lib/variants.js';

export function Player({ story, resolveImageUrl, onClose }) {
  const startId = story.start_scene || story.scenes[0]?.id;
  const [sceneId, setSceneId] = useState(startId);
  const [gameState, setGameState] = useState(() => initialGameState(story));
  const [activeVariant, setActiveVariant] = useState(null);
  const [objectOverlay, setObjectOverlay] = useState(null);
  const [bgUrl, setBgUrl] = useState(null);
  const [highlightUrl, setHighlightUrl] = useState(null);
  const [objectImageUrl, setObjectImageUrl] = useState(null);

  const rawScene = story.scenes.find(s => s.id === sceneId);
  const scene = resolveScene(rawScene, activeVariant);

  // On scene change: pick variant from CURRENT gameState (before on_visit),
  // then apply on_visit. This means a scene's first visit shows the base;
  // subsequent visits can see variants that depend on the just-set flag.
  useEffect(() => {
    if (!rawScene) return;
    setActiveVariant(pickVariant(rawScene, gameState));
    if (rawScene.on_visit?.length) {
      setGameState(prev => applyAssignments(prev, rawScene.on_visit));
    }
    // gameState intentionally omitted from deps — we read it as the "entry snapshot"
  }, [sceneId]);

  useEffect(() => {
    setBgUrl(null);
    if (scene?.background) {
      resolveImageUrl('backgrounds', scene.background).then(setBgUrl);
    }
  }, [scene?.background, resolveImageUrl]);

  useEffect(() => {
    setObjectImageUrl(null);
    if (objectOverlay?.image) {
      resolveImageUrl('objects', objectOverlay.image).then(setObjectImageUrl);
    }
  }, [objectOverlay?.image, resolveImageUrl]);

  useEffect(() => {
    const handler = (e) => {
      if (e.key === 'Escape') {
        if (objectOverlay) setObjectOverlay(null);
        else onClose();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [objectOverlay, onClose]);

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

  const hotspots = scene?.hotspots || [];
  const hasVariables = (story.variables || []).length > 0;

  return html`
    <div class="player-overlay">
      <button class="player-close" onClick=${onClose} title="Back to editor (Esc)">✕</button>
      ${hasVariables ? html`
        <button class="player-reset" onClick=${handleReset} title="Reset game state">↺</button>
        <div class="player-state">
          ${Object.entries(gameState).map(([k, v]) => html`
            <span class="player-state-pill ${v ? 'on' : 'off'}">${k}</span>
          `)}
        </div>
      ` : null}

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
        <div class="player-object-overlay" onClick=${(e) => {
          if (e.target.classList.contains('player-object-overlay')) setObjectOverlay(null);
        }}>
          <div class="player-object-content">
            ${objectImageUrl ? html`<img class="player-object-img" src=${objectImageUrl} />` : null}
            <div class="player-object-desc">${objectOverlay.description}</div>
          </div>
        </div>
      ` : null}
    </div>
  `;
}
