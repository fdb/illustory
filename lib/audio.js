// Looping background-sound player with equal-power cross-fades.
//
// One track is "current" at a time. Switching to a new sound fades the old
// one out while the new one fades in over `fadeMs`, so scene transitions are
// seamless. Switching to the SAME sound is a no-op — the audio keeps playing
// untouched, so adjacent scenes that share a sound never restart it.
//
// Each track carries a linear `gain` in [0, 1] that ramps toward its `target`.
// The audio element's volume is `sin(gain · π/2)`, which makes a simultaneous
// out (1→0) / in (0→1) pair satisfy out² + in² = 1 — constant perceived
// loudness with no dip in the middle of the fade.

export function createSoundPlayer(resolveUrl, { fadeMs = 2500 } = {}) {
  let tracks = [];          // { filename, audio, gain, target }
  let currentFilename = null;
  let raf = null;
  let lastT = null;

  function ensureLoop() {
    if (raf == null) {
      lastT = null;
      raf = requestAnimationFrame(tick);
    }
  }

  function tick(t) {
    if (lastT == null) lastT = t;
    const dt = Math.min(t - lastT, 100); // clamp gaps from inactive tabs
    lastT = t;
    const step = fadeMs > 0 ? dt / fadeMs : 1;

    let animating = false;
    for (const tr of tracks) {
      if (tr.gain < tr.target) {
        tr.gain = Math.min(tr.target, tr.gain + step);
        animating = true;
      } else if (tr.gain > tr.target) {
        tr.gain = Math.max(tr.target, tr.gain - step);
        animating = true;
      }
      tr.audio.volume = Math.sin(tr.gain * Math.PI / 2);
    }

    for (const tr of tracks) {
      if (tr.target === 0 && tr.gain <= 0.0001) tr.audio.pause();
    }
    tracks = tracks.filter(tr => !(tr.target === 0 && tr.gain <= 0.0001));

    if (animating) {
      raf = requestAnimationFrame(tick);
    } else {
      raf = null;
      lastT = null;
    }
  }

  // Cross-fade to `filename` (a name inside images/sounds/), or pass a falsy
  // value to fade everything out.
  async function crossfadeTo(filename) {
    if ((filename || null) === currentFilename) return;
    currentFilename = filename || null;

    for (const tr of tracks) {
      tr.target = tr.filename === filename ? 1 : 0;
    }

    if (!filename) { ensureLoop(); return; }

    // A track for this file already exists (possibly mid fade-out) — its
    // target was just set back to 1 above, so let it ramp back up.
    if (tracks.some(tr => tr.filename === filename)) { ensureLoop(); return; }

    const url = await resolveUrl(filename);
    if (currentFilename !== filename) return; // superseded while resolving
    if (!url) return;

    const audio = new Audio(url);
    audio.loop = true;
    audio.volume = 0;
    tracks.push({ filename, audio, gain: 0, target: 1 });
    try {
      await audio.play();
    } catch {
      // Autoplay blocked — needs a user gesture. The player overlay opens from
      // a click, so this is normally fine; ignore if it isn't.
    }
    ensureLoop();
  }

  function stop() {
    currentFilename = null;
    for (const tr of tracks) tr.target = 0;
    ensureLoop();
  }

  function dispose() {
    if (raf != null) cancelAnimationFrame(raf);
    raf = null;
    lastT = null;
    for (const tr of tracks) {
      tr.audio.pause();
      tr.audio.src = '';
    }
    tracks = [];
    currentFilename = null;
  }

  return { crossfadeTo, stop, dispose };
}
