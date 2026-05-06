import { html, useState, useEffect, useCallback, useRef } from '../lib/preact-standalone.js';
import { parseCoords } from '../lib/coords.js';

/**
 * Fullscreen game player overlay.
 * Plays the current story from start_scene using filesystem images.
 */
export function Player({ story, resolveImageUrl, onClose }) {
  const [sceneId, setSceneId] = useState(story.start_scene || story.scenes[0]?.id);
  const [objectOverlay, setObjectOverlay] = useState(null); // { image, description }
  const [bgUrl, setBgUrl] = useState(null);
  const [highlightUrl, setHighlightUrl] = useState(null);
  const [objectImageUrl, setObjectImageUrl] = useState(null);

  const scene = story.scenes.find(s => s.id === sceneId);

  // Load background
  useEffect(() => {
    setBgUrl(null);
    if (scene?.background) {
      resolveImageUrl('backgrounds', scene.background).then(setBgUrl);
    }
  }, [sceneId, scene?.background, resolveImageUrl]);

  // Load object overlay image when shown
  useEffect(() => {
    setObjectImageUrl(null);
    if (objectOverlay?.image) {
      resolveImageUrl('objects', objectOverlay.image).then(setObjectImageUrl);
    }
  }, [objectOverlay?.image, resolveImageUrl]);

  // Escape to close
  useEffect(() => {
    const handler = (e) => {
      if (e.key === 'Escape') {
        if (objectOverlay) {
          setObjectOverlay(null);
        } else {
          onClose();
        }
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [objectOverlay, onClose]);

  const handleHotspotClick = useCallback((hotspot) => {
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
    }
  }, [story, scene]);

  const handleHotspotEnter = useCallback((hotspot) => {
    if (hotspot.highlight_image) {
      resolveImageUrl('highlights', hotspot.highlight_image).then(setHighlightUrl);
    }
  }, [resolveImageUrl]);

  const handleHotspotLeave = useCallback(() => {
    setHighlightUrl(null);
  }, []);

  const hotspots = scene?.hotspots || [];

  return html`
    <div class="player-overlay">
      <button class="player-close" onClick=${onClose} title="Back to editor (Esc)">✕</button>

      <div class="player-scene">
        ${bgUrl ? html`<img class="player-bg" src=${bgUrl} alt=${scene?.name} />` : null}

        ${highlightUrl ? html`
          <img class="player-highlight" src=${highlightUrl} />
        ` : null}

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
