// Variants: each scene may declare alternate presentations guarded by
// conditions over story-wide variables. At runtime the first matching
// variant wins; if none match, the base scene is rendered. Variants
// override the base field-by-field — `background`, `hotspots`, `objects`
// each fall back to the base if absent on the variant.

export function pickVariant(scene, gameState) {
  if (!scene?.variants?.length) return null;
  for (const v of scene.variants) {
    if (matchesConditions(v.conditions, gameState)) return v;
  }
  return null;
}

export function matchesConditions(conditions, gameState) {
  if (!conditions?.length) return true;
  for (const c of conditions) {
    if (!c?.variable) continue;
    if ((gameState?.[c.variable] ?? false) !== c.value) return false;
  }
  return true;
}

// Variants ADD to the base — hotspots and objects from base are always shown,
// the variant contributes extras that appear only when the variant is active.
// Only `background` is a true override (since a scene can have only one image).
export function resolveScene(scene, variant) {
  if (!variant) return scene;
  return {
    ...scene,
    background: variant.background ?? scene.background,
    hotspots: [...(scene.hotspots || []), ...(variant.hotspots || [])],
    objects: [...(scene.objects || []), ...(variant.objects || [])],
  };
}

// Find which container (scene base or one of its variants) owns a hotspot.
// Returns null if the hotspot isn't in this scene at all.
export function findHotspotOwner(scene, hotspotId) {
  if ((scene.hotspots || []).some(h => h.id === hotspotId)) return scene;
  for (const v of scene.variants || []) {
    if ((v.hotspots || []).some(h => h.id === hotspotId)) return v;
  }
  return null;
}

export function findObjectOwner(scene, objectId) {
  if ((scene.objects || []).some(o => o.id === objectId)) return scene;
  for (const v of scene.variants || []) {
    if ((v.objects || []).some(o => o.id === objectId)) return v;
  }
  return null;
}

export function findVariantById(scene, variantId) {
  if (!variantId || !scene?.variants) return null;
  return scene.variants.find(v => v.id === variantId) || null;
}

// Returns the container where NEW hotspots/objects should be created in the
// current context: the variant (so the new items are "extras" only visible
// when the variant matches) when activeVariantId is set, otherwise the
// scene's base list. Initializes empty arrays if needed.
//
// Existing items are NOT touched — see findHotspotOwner / findObjectOwner
// for "which array does this id live in?" lookups.
export function getAdditionTarget(scene, variantId) {
  const owner = variantId
    ? (scene.variants?.find(x => x.id === variantId) || scene)
    : scene;
  if (!owner.hotspots) owner.hotspots = [];
  if (!owner.objects) owner.objects = [];
  return owner;
}

export function initialGameState(story) {
  const state = {};
  for (const v of story?.variables || []) {
    state[v.name] = v.default ?? false;
  }
  return state;
}

export function applyAssignments(state, assignments) {
  if (!assignments?.length) return state;
  const next = { ...state };
  for (const a of assignments) {
    if (a?.variable) next[a.variable] = a.value;
  }
  return next;
}
