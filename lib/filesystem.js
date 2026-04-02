/**
 * File System Access API wrapper for loading/saving story projects.
 *
 * Expected project structure:
 *   story.json
 *   images/
 *     backgrounds/   — scene background images
 *     objects/       — object detail images
 *     highlights/    — hotspot highlight/glow images
 */

const IMAGE_EXTENSIONS = new Set(['png', 'jpg', 'jpeg', 'webp', 'gif', 'svg']);

/**
 * Prompt the user to pick a project directory.
 * Returns a FileSystemDirectoryHandle.
 */
export async function pickProjectDirectory() {
  return await window.showDirectoryPicker({ mode: 'readwrite' });
}

/**
 * Load story.json from a project directory.
 * Returns the parsed object, or a blank story if not found.
 */
export async function loadStory(dirHandle) {
  try {
    const fileHandle = await dirHandle.getFileHandle('story.json');
    const file = await fileHandle.getFile();
    const text = await file.text();
    return JSON.parse(text);
  } catch {
    return { title: 'Untitled', start_scene: '', scenes: [] };
  }
}

/**
 * Save story.json to the project directory.
 */
export async function saveStory(dirHandle, story) {
  const output = structuredClone(story);
  for (const scene of output.scenes) {
    delete scene.navigation;
  }
  const fileHandle = await dirHandle.getFileHandle('story.json', { create: true });
  const writable = await fileHandle.createWritable();
  await writable.write(JSON.stringify(output, null, 2) + '\n');
  await writable.close();
}

/**
 * Scan the images/ directory for available files, organized by subfolder.
 * Returns { backgrounds: ['crash_site.webp', ...], objects: [...], highlights: [...] }
 */
export async function scanImages(dirHandle) {
  const result = { backgrounds: [], objects: [], highlights: [] };
  let imagesDir;
  try {
    imagesDir = await dirHandle.getDirectoryHandle('images');
  } catch {
    return result;
  }

  for (const folder of ['backgrounds', 'objects', 'highlights']) {
    try {
      const subDir = await imagesDir.getDirectoryHandle(folder);
      for await (const entry of subDir.values()) {
        if (entry.kind === 'file') {
          const ext = entry.name.split('.').pop().toLowerCase();
          if (IMAGE_EXTENSIONS.has(ext)) {
            result[folder].push(entry.name);
          }
        }
      }
      result[folder].sort();
    } catch {
      // subfolder doesn't exist — that's fine
    }
  }
  return result;
}

/**
 * Get a blob URL for an image file in the project.
 * path is like "backgrounds/crash_site.webp"
 * Returns a blob: URL, or null if file not found.
 * Caches URLs so the same file isn't re-read repeatedly.
 */
const blobUrlCache = new Map();

export async function getImageUrl(dirHandle, path) {
  const cacheKey = `${dirHandle.name}/${path}`;
  if (blobUrlCache.has(cacheKey)) return blobUrlCache.get(cacheKey);

  try {
    const imagesDir = await dirHandle.getDirectoryHandle('images');
    const parts = path.split('/');
    let current = imagesDir;
    for (let i = 0; i < parts.length - 1; i++) {
      current = await current.getDirectoryHandle(parts[i]);
    }
    const fileHandle = await current.getFileHandle(parts[parts.length - 1]);
    const file = await fileHandle.getFile();
    const url = URL.createObjectURL(file);
    blobUrlCache.set(cacheKey, url);
    return url;
  } catch {
    return null;
  }
}

/**
 * Clear the blob URL cache (e.g. when switching projects).
 */
export function clearImageCache() {
  for (const url of blobUrlCache.values()) {
    URL.revokeObjectURL(url);
  }
  blobUrlCache.clear();
}

/**
 * Rescan images and return fresh file lists.
 * Call this after the user may have added files externally.
 */
export async function refreshImages(dirHandle) {
  clearImageCache();
  return await scanImages(dirHandle);
}
