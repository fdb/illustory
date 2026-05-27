import { html, useRef, useEffect, useState, useCallback } from '../lib/preact-standalone.js';
import { parseCoords, screenToSvg, distance, serializeCoords } from '../lib/coords.js';
import { findVariantById, resolveScene } from '../lib/variants.js';

const CLOSE_THRESHOLD = 30;

export function Canvas({
  scene: rawScene,
  story,
  selectedItemId,
  activeVariantId,
  activeTool,
  resolveImageUrl,
  onSelectHotspot,
  onDeselectAll,
  onHotspotCoordsChange,
  onNewHotspot,
  onNewObject,
}) {
  const variant = findVariantById(rawScene, activeVariantId);
  const scene = resolveScene(rawScene, variant);
  const svgRef = useRef(null);
  const [drawingPoints, setDrawingPoints] = useState([]);
  const [cursorPos, setCursorPos] = useState(null);
  const [dragging, setDragging] = useState(null);
  const [bgError, setBgError] = useState(false);

  useEffect(() => {
    setDrawingPoints([]);
    setCursorPos(null);
  }, [activeTool, scene?.id]);

  const hotspots = scene?.hotspots || [];

  // Close the in-progress polygon (shared by click-near-first, Enter, double-click, right-click)
  const finishDrawing = useCallback(() => {
    if (drawingPoints.length < 3) return;
    const coordsStr = serializeCoords(drawingPoints);
    if (activeTool === 'object') {
      onNewObject(coordsStr);
    } else {
      onNewHotspot(coordsStr);
    }
    setDrawingPoints([]);
    setCursorPos(null);
  }, [drawingPoints, activeTool, onNewHotspot, onNewObject]);

  const handleSvgClick = useCallback((e) => {
    if (!svgRef.current || dragging) return;
    const pt = screenToSvg(svgRef.current, e.clientX, e.clientY);

    if (activeTool === 'select') {
      const target = e.target;
      if (target.tagName === 'polygon' && target.dataset.hotspotId) {
        onSelectHotspot(target.dataset.hotspotId);
      } else if (target.tagName === 'circle' && target.dataset.hotspotId) {
        onSelectHotspot(target.dataset.hotspotId);
      } else {
        onDeselectAll();
      }
      return;
    }

    if (activeTool === 'draw' || activeTool === 'object') {
      // Click near first vertex → close
      if (drawingPoints.length > 2 && distance(pt, drawingPoints[0]) < CLOSE_THRESHOLD) {
        finishDrawing();
        return;
      }
      setDrawingPoints(prev => [...prev, pt]);
    }
  }, [activeTool, drawingPoints, dragging, finishDrawing, onSelectHotspot, onDeselectAll]);

  const handleSvgDblClick = useCallback((e) => {
    if ((activeTool === 'draw' || activeTool === 'object') && drawingPoints.length >= 3) {
      e.preventDefault();
      finishDrawing();
    }
  }, [activeTool, drawingPoints, finishDrawing]);

  const handleContextMenu = useCallback((e) => {
    if ((activeTool === 'draw' || activeTool === 'object') && drawingPoints.length >= 3) {
      e.preventDefault();
      finishDrawing();
    }
  }, [activeTool, drawingPoints, finishDrawing]);

  const handleSvgMouseMove = useCallback((e) => {
    if (!svgRef.current) return;
    const pt = screenToSvg(svgRef.current, e.clientX, e.clientY);

    if (dragging) {
      const polygon = svgRef.current.querySelector(`polygon[data-hotspot-id="${dragging.hotspotId}"]`);
      if (polygon) {
        const tempPoints = parseCoords(
          hotspots.find(h => h.id === dragging.hotspotId)?.coords || ''
        );
        tempPoints[dragging.vertexIndex] = pt;
        polygon.setAttribute('points', tempPoints.map(p => `${p.x},${p.y}`).join(' '));
      }
      const handle = svgRef.current.querySelector(
        `circle[data-hotspot-id="${dragging.hotspotId}"][data-vertex="${dragging.vertexIndex}"]`
      );
      if (handle) {
        handle.setAttribute('cx', pt.x);
        handle.setAttribute('cy', pt.y);
      }
      setDragging(prev => ({ ...prev, currentPt: pt }));
      return;
    }

    if (activeTool === 'draw' || activeTool === 'object') {
      setCursorPos(pt);
    }
  }, [activeTool, dragging, hotspots]);

  const handleSvgMouseUp = useCallback(() => {
    if (dragging && dragging.currentPt) {
      const hotspot = hotspots.find(h => h.id === dragging.hotspotId);
      if (hotspot) {
        const points = parseCoords(hotspot.coords);
        points[dragging.vertexIndex] = dragging.currentPt;
        onHotspotCoordsChange(dragging.hotspotId, serializeCoords(points));
      }
    }
    setDragging(null);
  }, [dragging, hotspots, onHotspotCoordsChange]);

  const handleVertexMouseDown = useCallback((e, hotspotId, vertexIndex) => {
    if (activeTool !== 'select') return;
    e.stopPropagation();
    onSelectHotspot(hotspotId);
    setDragging({ hotspotId, vertexIndex, currentPt: null });
  }, [activeTool, onSelectHotspot]);

  useEffect(() => {
    const handler = (e) => {
      if (e.key === 'Escape') {
        setDrawingPoints([]);
        setCursorPos(null);
      }
      if (e.key === 'Enter') {
        finishDrawing();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [finishDrawing]);

  // Resolve background image from filesystem
  const [bgUrl, setBgUrl] = useState(null);
  useEffect(() => {
    setBgUrl(null);
    setBgError(false);
    if (scene?.background && resolveImageUrl) {
      resolveImageUrl('backgrounds', scene.background).then(url => {
        if (url) {
          setBgUrl(url);
          setBgError(false);
        } else {
          setBgError(true);
        }
      });
    } else if (scene && !scene.background) {
      setBgError(true);
    }
  }, [scene?.id, scene?.background, resolveImageUrl]);

  if (!scene) {
    return html`<span style="color:var(--text-muted)">No scene selected</span>`;
  }

  // Canvas dimensions live on the story (project-wide); fall back to legacy 2000×1125
  // for safety in case an older story slipped past loadStory's normalization.
  const viewW = story?.width ?? 2000;
  const viewH = story?.height ?? 1125;

  return html`
    <div class="canvas-wrapper">
      ${bgUrl ? html`<img src=${bgUrl}
           alt=${scene.name}
           onError=${() => setBgError(true)}
           style=${bgError ? 'opacity: 0.3' : ''} />` :
        html`<div style="width:100%;aspect-ratio:${viewW}/${viewH};background:var(--bg-overlay);display:flex;align-items:center;justify-content:center">
          <span style="color:var(--text-muted)">No background</span>
        </div>`}
      ${bgError ? html`<div style="position:absolute;top:10px;left:10px;color:var(--accent-yellow);font-size:12px">
        Background not found: ${scene.background}
      </div>` : null}
      <svg ref=${svgRef}
           viewBox="0 0 ${viewW} ${viewH}"
           onClick=${handleSvgClick}
           onDblClick=${handleSvgDblClick}
           onContextMenu=${handleContextMenu}
           onMouseMove=${handleSvgMouseMove}
           onMouseUp=${handleSvgMouseUp}
           style="cursor: ${activeTool === 'select' ? 'default' : 'crosshair'}">

        ${hotspots.map(hotspot => {
          const points = parseCoords(hotspot.coords);
          const isSelected = hotspot.id === selectedItemId;
          const pointsStr = points.map(p => `${p.x},${p.y}`).join(' ');

          return html`
            <polygon
              key=${hotspot.id}
              data-hotspot-id=${hotspot.id}
              points=${pointsStr}
              fill=${isSelected ? 'rgba(137,180,250,0.2)' : 'rgba(166,227,161,0.1)'}
              stroke=${isSelected ? '#89b4fa' : '#a6e3a1'}
              stroke-width=${isSelected ? 2.5 : 1.5}
              opacity=${isSelected ? 1 : 0.6}
            />
            ${isSelected ? points.map((p, i) => html`
              <circle
                key=${`${hotspot.id}-v${i}`}
                data-hotspot-id=${hotspot.id}
                data-vertex=${i}
                cx=${p.x} cy=${p.y} r=${8}
                fill="#89b4fa"
                stroke="#1e1e2e"
                stroke-width=${2}
                style="cursor: grab"
                onMouseDown=${(e) => handleVertexMouseDown(e, hotspot.id, i)}
              />
            `) : null}
          `;
        })}

        ${drawingPoints.length > 0 ? html`
          <polygon
            points=${[...drawingPoints, ...(cursorPos ? [cursorPos] : [])].map(p => `${p.x},${p.y}`).join(' ')}
            fill="rgba(166,227,161,0.1)"
            stroke="#a6e3a1"
            stroke-width=${2}
            stroke-dasharray="8,4"
          />
          ${drawingPoints.map((p, i) => html`
            <circle key=${`draw-${i}`}
              cx=${p.x} cy=${p.y} r=${6}
              fill=${i === 0 ? '#f9e2af' : '#a6e3a1'}
              stroke="#1e1e2e" stroke-width=${2} />
          `)}
        ` : null}
      </svg>
    </div>
  `;
}
