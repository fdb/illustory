/**
 * Parse "x1,y1,x2,y2,..." string into [{x, y}, ...] array.
 */
export function parseCoords(str) {
  if (!str) return [];
  const nums = str.split(',').map(Number);
  const points = [];
  for (let i = 0; i + 1 < nums.length; i += 2) {
    points.push({ x: nums[i], y: nums[i + 1] });
  }
  return points;
}

/**
 * Serialize [{x, y}, ...] array back to "x1,y1,x2,y2,..." string.
 */
export function serializeCoords(points) {
  return points.map(p => `${Math.round(p.x)},${Math.round(p.y)}`).join(',');
}

/**
 * Convert screen mouse coordinates to SVG viewBox coordinates.
 * svg is the SVG DOM element.
 */
export function screenToSvg(svg, screenX, screenY) {
  const pt = svg.createSVGPoint();
  pt.x = screenX;
  pt.y = screenY;
  const svgPt = pt.matrixTransform(svg.getScreenCTM().inverse());
  return { x: svgPt.x, y: svgPt.y };
}

/**
 * Distance between two points.
 */
export function distance(a, b) {
  return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
}
