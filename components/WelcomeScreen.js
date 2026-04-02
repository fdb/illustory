import { html } from '../lib/preact-standalone.js';

export function WelcomeScreen({ onOpenProject }) {
  return html`
    <div class="welcome-screen">
      <div class="welcome-content">
        <h1 class="welcome-title">illustory</h1>
        <p class="welcome-subtitle">Visual editor for story-driven adventure games</p>
        <button class="welcome-btn" onClick=${onOpenProject}>
          Open Project Folder
        </button>
        <p class="welcome-hint">
          Pick a folder containing a story.json and an images/ directory.
          If story.json doesn't exist yet, a new one will be created.
        </p>
      </div>
    </div>
  `;
}
