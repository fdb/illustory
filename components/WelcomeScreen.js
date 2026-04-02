import { html } from '../lib/preact-standalone.js';

const hasFileSystemAccess = typeof window.showDirectoryPicker === 'function';

export function WelcomeScreen({ onOpenProject }) {
  return html`
    <div class="welcome-screen">
      <div class="welcome-content">
        <h1 class="welcome-title">illustory</h1>
        <p class="welcome-subtitle">Visual editor for story-driven adventure games</p>
        ${hasFileSystemAccess ? html`
          <button class="welcome-btn" onClick=${onOpenProject}>
            Open Project Folder
          </button>
          <p class="welcome-hint">
            Pick a folder containing a story.json and an images/ directory.
            If story.json doesn't exist yet, a new one will be created.
          </p>
        ` : html`
          <div class="welcome-unsupported">
            <p>Your browser does not support the File System Access API.</p>
            <p>Please use <strong>Chrome</strong>, <strong>Edge</strong>, or another Chromium-based browser.</p>
          </div>
        `}
      </div>
    </div>
  `;
}
