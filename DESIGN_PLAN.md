# Design Plan — tools.javagrant.ac.nz

## Overview

The tools site has two real tools (Clock and Event Viewer) plus an abandoned prototype (Exam Clock). The Clock is excellent. The Event Viewer is bare. Four HTML files each duplicate ~60 lines of CSS and dark-mode logic. The goal: consolidate shared assets, delete dead code, bring Event Viewer up to Clock quality, and unify the site's navigation.

---

## Architecture Decisions

| Decision | Choice |
|---|---|
| Shared CSS | Single `styles.css` with CSS custom properties |
| Shared dark mode | Single `theme.js` module — DOM-agnostic `initTheme()` |
| Build step | None — all vanilla HTML/CSS/JS |
| Deleted file | `tools/exam-clock.html` (never linked, abandoned) |

---

## Phase 1: Foundation — Extract shared assets, delete dead code

**Effort: Low | Impact: High**

### 1.1 Delete `tools/exam-clock.html`
Remove the file. No redirect needed — it was never linked from `index.html`.

### 1.2 Create `styles.css`
Extract the common ~60-line block shared across all pages:
- `:root` CSS custom properties (colors, shadows, radii)
- `.dark` overrides
- `body` background/text transition for smooth theme switching
- `.card` base class
- `.text-muted`, `.text-accent`, `.text-accent-light`
- `@keyframes fadeIn` + `.animate-fade-in`
- Tailwind config script block (accent colors, DM Sans font)

Page-specific styles stay in each page's own inline `<style>`.

### 1.3 Create `theme.js`
Extract the identical dark-mode toggle logic from `index.html`:
- Check `localStorage` → `prefers-color-scheme` fallback → toggle `.dark` class
- Expose `applyTheme(dark)` and `initTheme(toggleBtnEl, sunIconEl, moonIconEl)`
- DOM-agnostic — reuse on all pages

### 1.4 Update all 3 HTML files
Replace duplicated CSS/JS with:
```html
<link rel="stylesheet" href="styles.css">
<script src="theme.js"></script>
```
Each page keeps its own inline `<style>` for page-specific styles only.

---

## Phase 2: Consistency — Header, footer, meta, favicon

**Effort: Low-Medium | Impact: Medium**

### 2.1 Add dark mode toggle to Event Viewer
CSS already supports `.dark`. Add the toggle button using `theme.js`.

### 2.2 Consistent tool-page header
For `clock.html` and `tools/event-viewer.html`: thin top bar with `← Back` link (left) + dark mode toggle (right). Clock keeps its settings cog top-right alongside the toggle.

### 2.3 Add favicon to Event Viewer
Copy the inline SVG favicon pattern from `index.html`.

### 2.4 Footer
Footer stays on the landing page only (`index.html`): `Built by JavaGrant` with link, centered, `text-muted`, `text-xs`. Tool pages (`clock.html`, `tools/event-viewer.html`, `tools/comms-208-test-1-2026.html`) have no footer — full-screen displays stay clean.

### 2.5 Add Open Graph / Twitter meta tags
`og:title`, `og:description`, `og:image`, `twitter:card` on all 3 pages.

### 2.6 Settings modal close on backdrop click
In `clock.html`: click outside modal panel → close. One-liner in existing modal code.

---

## Phase 3: Event Viewer feature uplift

**Effort: Medium | Impact: High**

### 3.1 Fix empty-state cards
Hide the entire `#latest-events` grid when buffer is empty instead of showing faded `—` placeholders. Ensure cards don't flash stale data on clear.

### 3.2 Add pause/resume
Button in filter bar that stops/restarts event listeners. Paused state shows "Paused" badge, freezes buffer, disables Clear.

### 3.3 Add export JSON
Button next to Clear: serializes `eventBuffer` to JSON, triggers download via `Blob` + `URL.createObjectURL`. Filename: `events-{timestamp}.json`.

### 3.4 Add search by key
Text input filtering `eventBuffer` by `type` or `data` fields (case-insensitive substring match). Combines with category filters (AND logic). Debounced 150ms.

### 3.5 Alternating row colors
Zebra striping using `color-mix()` for automatic dark mode support.

---

## Phase 4: Polish (if time allows)

| # | Task |
|---|------|
| 4.1 | Add `maxBuffer` config to Event Viewer (cap at e.g. 5000 events, drop oldest) |
| 4.2 | Add `Ctrl+K` / `Cmd+K` keyboard shortcut to focus Event Viewer search |
| 4.3 | Add `prefers-reduced-motion` media query to landing page |
| 4.4 | Add `forced-colors` media query support to event-viewer |
