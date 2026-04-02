# illustory

Visual editor for story-driven adventure games. No build step — pure Preact + HTM via CDN.

## Stack

- Preact 10.x + HTM 3.x via esm.sh (ES modules, no bundler)
- File System Access API for opening project folders, reading images, saving story.json
- Catppuccin Mocha-inspired dark theme

## Project structure

```
index.html              Entry point
app.js                  Root component, state management, undo/redo
style.css               All styles (CSS custom properties)
components/
  Canvas.js             SVG overlay for hotspot polygons + drawing
  Properties.js         Context-sensitive property editor (right panel)
  Sidebar.js            Scene list + layer outline (left panel)
  Toolbar.js            Tool buttons, save, undo/redo
  WelcomeScreen.js      Landing screen with "Open Project Folder"
lib/
  coords.js             Parse/serialize coordinate strings, SVG math
  filesystem.js         File System Access API wrapper
  history.js            Immutable undo/redo stack
  preact-standalone.js  CDN re-exports for Preact + hooks + htm
```

## Deploy

Static site — no server, no build step. Deploy to Cloudflare Pages:

```sh
npx wrangler pages deploy . --project-name illustory
```

First deploy creates the project. Subsequent deploys update it.

## Dev

```sh
python3 -m http.server 8001
```

Open http://localhost:8001. Requires a Chromium browser (Chrome, Edge, Arc) for the File System Access API.
