# Ketabkhaneh (کتابخانه) — Offline Persian Bookstore & Sample Reader

## Project Overview

Ketabkhaneh is a Persian, right-to-left (RTL) web application inspired by Taaghche, an online bookstore. It lets users browse a curated catalog of books, filter and search it, view book details, save favorites, "acquire" books (free downloads or a simulated paid purchase), and read book samples in a dedicated reader.

The application is built entirely with **pure HTML5, CSS3, and Vanilla JavaScript**:

- Zero frameworks, zero build tools, and zero external libraries or CDN links.
- 100% offline: all data, styles, scripts, and cover images are local and referenced with relative paths.
- Persian-first UI with `lang="fa"` and `dir="rtl"`, Persian digits via `Intl.NumberFormat("fa-IR")`, and a Taaghche-inspired teal theme (`#007a78`) driven by CSS variables.
- Accessible by design: semantic elements, ARIA roles/labels, keyboard support, live regions, and safe DOM rendering.

This README documents the completed project across Steps 1–7.

---

## Project Structure

```
.
├── index.html            # Single HTML shell: header, search form, nav, <main id="app">, footer
├── css/
│   └── style.css         # All styling: CSS variables, teal/light/dark themes, responsive rules
├── js/
│   ├── books.js          # Local book catalog data (categories + 16 books with samples/prices)
│   └── app.js            # SPA router, state/persistence, all views, filters, dialog, reader
└── assets/
    ├── favicon.svg       # Local favicon
    └── covers/           # 16 local SVG book covers (book-1.svg … book-16.svg)
```

- **`index.html`** — the only HTML document. It defines the sticky RTL header with the brand, global search form, account link, theme toggle, reset button, and primary navigation, plus the empty `<main id="app">` mount point and a footer. The purchase dialog is created dynamically by JavaScript. Scripts are loaded in order: `js/books.js`, then `js/app.js`.
- **`css/style.css`** — the single stylesheet. It defines the teal design tokens in `:root`, a full `[data-theme="dark"]` variable override, component styles (hero, stats, cards, carousels, catalog toolbar, detail page, library, login, dialog, reader), and responsive media queries at `max-width: 760px`, `max-width: 560px`, and `min-width: 900px`.
- **`js/books.js`** — a plain data module exposing `CATEGORIES` (4 categories) and `BOOKS` (16 books). Each book has an `id`, `title`, `author`, `category`, local `cover` path, `description`, `price`, `rating`, flags (`featured`, `isNew`), and `sampleParagraphs`.
- **`js/app.js`** — the entire application: hash router, state store with `localStorage` persistence and sanitization, view builders, catalog search/filter/sort, favorites, auth gate, purchase confirmation dialog, and reader settings.
- **`assets/covers/`** — locally stored SVG cover images, one per book, so the app never needs a network connection.

---

## Key Features (Steps 1–7)

### 1. Hash-based SPA routing with fallback views

`app.js` parses `window.location.hash` with `parseRoute()` and renders views into `<main id="app">` on `hashchange`. Supported routes:

| Route | View |
| --- | --- |
| `#home` (or no hash) | Home page with hero, stats, categories, and shelves |
| `#categories` | All category cards |
| `#catalog` | Searchable/filterable/sortable catalog (query params supported) |
| `#book/<id>` | Book detail page |
| `#reader/<id>` | Sample reader |
| `#library` | Personal library (acquired books + favorites) |
| `#login` | Demo login / account page |

- Query parameters are supported on catalog routes, e.g. `#catalog?q=...&category=...&free=1&collection=...&sort=...`, and on `#login?returnTo=...` for post-login redirection.
- Invalid book IDs produce a "book not found" view; unknown paths produce a "page not found" view. Both offer links back to the catalog and home.
- Route changes update the document title, active navigation state (`aria-current="page"`), and move focus to `<main>` for keyboard/screen-reader users.

### 2. Home view

- A hero section with call-to-action links to the catalog and categories.
- **Live statistics** that update as state changes: total books, categories, favorites count, free books, and books with samples.
- **Category cards** showing each category's book count; each links to a pre-filtered catalog route.
- Three **RTL horizontal carousels** ("Featured", "New", "Free Books") using scroll-snap tracks with accessible "Previous"/"Next" controls, plus "see all" links into the catalog.

### 3. Catalog view

- Combined **search** across book titles and authors, normalized for Persian text: case-folding, Persian/Arabic `ي → ی` and `ك → ک`, ZWNJ removal, whitespace collapsing, and trimming.
- **Filters**: category select, collection select (featured / new), and a "free books only" checkbox. `#catalog?collection=free` maps to the free-only filter.
- **Sorting**: default, price ascending, price descending, highest rating.
- Active filters are shown as removable-looking chips, results update in place via `history.replaceState()` (no full re-render of the page shell), an `aria-live` result count announces updates, and a "Clear filters" button resets everything.
- Search works both from the catalog toolbar and the global header search, with their values kept in sync.

### 4. Book detail view

- Cover, category link, title, author, rating, formatted price, and description.
- A **sample preview** (first sample paragraph) when available, otherwise a "no sample" note.
- **Related books** from the same category (up to four) in a book grid.
- **Auth-gated acquisition**:
  - No user → redirect to `#login?returnTo=#book/<id>` so the user returns after signing in.
  - Free book (`price === 0`) → added to the library immediately.
  - Paid book → opens an accessible purchase confirmation dialog before adding.
  - Already-owned books show a link to the library instead.
- Inline favorite toggle with live `aria-pressed` state.

### 5. Two-section user library

- `#library` shows two distinct sections: **Acquired Books** (کتاب‌های دریافت‌شده) and **Favorites** (علاقه‌مندیها).
- Each section has its own count, book grid, and empty state with a helpful call to action.
- State subscribers call `syncLibraryView()` so adding/removing a favorite or acquiring a book updates the library **in place instantly** without a full route re-render.
- Library cards keep action buttons outside the card link to avoid nested interactive elements; owned books with samples also get a direct "Read sample" link.

### 6. Demo login and accessible purchase dialog

- **Demo login** (no password): display name + mobile number.
  - Phone digits are normalized from Persian (`۰–۹`) and Arabic (`٠–٩`) to Latin before validation.
  - Validation requires an 11-digit number starting with `09` (`/^09\d{9}$/`); inline Persian error messages are announced via `aria-live`, and invalid fields get `aria-invalid="true"`.
  - A validated `returnTo` value (restricted to known internal routes) is honored after login; otherwise the user lands in the library. Logging out clears the user and returns home.
- **Purchase confirmation dialog** for paid books:
  - Created with `document.createElement`, marked `role="dialog"`, `aria-modal="true"`, and `aria-labelledby`.
  - Focus moves to the confirm button on open and returns to the triggering element on close.
  - A keyboard **focus trap** keeps Tab/Shift+Tab inside the dialog; **Escape** and backdrop clicks cancel.
  - Returns a Promise resolving to `true` (confirmed) or `false` (cancelled); body scrolling is locked while open.

### 7. Sample book reader

- `#reader/<id>` renders the book's `sampleParagraphs` in an RTL article, with a graceful "no sample" empty state for books without one.
- Sticky reader toolbar with:
  - **Font size** controls: `small`, `medium`, `large` (applied as `font-small` / `font-medium` / `font-large` classes).
  - **Theme** controls: `light` / `dark` (applied via `data-theme` on `<html>`, shared with the header theme toggle).
- Both settings are persisted in `localStorage` and reflected with `aria-pressed` on the active buttons.

---

## State & Persistence

All mutable user data lives in a single `localStorage` key: **`ketabkhaneh_state_v1`**.

```js
{
  "favorites": ["book-1", "book-7"],   // unique, valid book IDs
  "ownedBooks": ["book-3"],            // unique, valid book IDs
  "user": { "name": "...", "phone": "09123456789" } | null,
  "readingSettings": {
    "fontSize": "medium",              // "small" | "medium" | "large"
    "theme": "light"                   // "light" | "dark"
  }
}
```

- `setState()` saves the state and notifies subscribers; `resetState()` / the header's "Clear state" button removes the key and restores defaults.
- **Defensive sanitization:** on load, `sanitizeState()` validates the shape of the parsed JSON. Book-ID arrays are filtered against the known `BOOKS` set and de-duplicated; user name/phone must be non-empty strings and are length-capped; reading settings fall back to `medium` / `light` if invalid. Malformed JSON or non-object data clears the stored value and returns safe defaults.
- All `localStorage` access is wrapped in `try/catch`, so the app still works when storage is unavailable (e.g. certain private modes).
- Every state change re-syncs theme, reader controls, header, stats, favorite buttons, detail ownership, and the library view.

---

## How to Run & Verify

### Run

Because the app uses only relative paths and no network resources, the simplest way to run it is:

1. Download or clone the repository so the folder structure stays intact.
2. Open `index.html` directly in any modern browser (double-click it). It works **100% offline**.

Optionally, serve it locally (for example, from the project root):

```bash
python -m http.server 8000
# then visit http://localhost:8000/
```

### Verify

- **Responsive checks:** verify at **360px**, **768px**, and **1440px** viewport widths. There should be no horizontal scrolling. The stylesheet adapts at `760px` and `560px` (stacking the hero/detail layouts, full-width search and actions) and uses a wider book grid from `900px` upward.
- **Console:** zero JavaScript errors in the browser console.
- **HTML validation:** zero errors/warnings in the HTMLHint panel.
- **Strict compliance:**
  - All dynamic markup is created with `document.createElement()` / `document.createTextNode()` and written with `textContent` — **zero `innerHTML`** anywhere.
  - **Zero inline `style` attributes or `<style>` tags**; all styling lives in `css/style.css` using CSS variables.
  - No frameworks, no external libraries, and no CDN links; all assets are local.
- **Functional smoke test:** search and filter the catalog, toggle favorites, log in with `۰۹۱۲۳۴۵۶۷۸۹`-style digits, acquire a free book and confirm a paid purchase, check both library sections, then change reader font size and theme and reload to confirm persistence.
