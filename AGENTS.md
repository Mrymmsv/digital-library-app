# AGENTS.md

## Permanent Rules

- **Project**: A Persian RTL web application inspired by Taaghche (online bookstore) for browsing, filtering, and reading book samples.
- **Tech Stack**: Pure HTML5, CSS3, and Vanilla JavaScript only. No frameworks, no external libraries, and no CDN links.
- **Offline & Relative Paths**: The app must work 100% offline. Use relative paths for all files (`css/style.css`, `js/books.js`, `js/app.js`, `assets/covers/`).
- **DOM Security**: Always use `textContent` and `document.createElement` to render data or user input. Never use `innerHTML`.
- **Styling**: Keep all styles in `css/style.css` using CSS variables (Taaghche teal theme `#007a78`). No inline styles or `<style>` tags.
- **Definition of Done**: Zero errors in the browser console and HTMLHint panel; responsive at 360px, 768px, and 1440px without horizontal scrolling.
