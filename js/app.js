/**
 * Reactive rendering + safe persistence for the library.
 * All DOM is built with document.createElement and textContent.
 */

const STORAGE_KEY = "ketabkhaneh_state_v1";
const FONT_SIZES = ["small", "medium", "large"];
const THEMES = ["light", "dark"];
const VALID_BOOK_IDS = new Set(BOOKS.map((book) => book.id));

const numberFormatter = new Intl.NumberFormat("fa-IR");
const ratingFormatter = new Intl.NumberFormat("fa-IR", {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1
});

/* ==========================================================================
   State schema + sanitizers
   ========================================================================== */

function createDefaultState() {
  return {
    favorites: [],
    ownedBooks: [],
    user: null,
    readingSettings: {
      fontSize: "medium",
      theme: "light"
    }
  };
}

function sanitizeBookIds(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  const seen = new Set();
  const ids = [];

  for (const id of value) {
    if (typeof id === "string" && VALID_BOOK_IDS.has(id) && !seen.has(id)) {
      seen.add(id);
      ids.push(id);
    }
  }

  return ids;
}

function sanitizeUser(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const name = typeof value.name === "string" ? value.name.trim() : "";
  const phone = typeof value.phone === "string" ? value.phone.trim() : "";

  if (!name || !phone) {
    return null;
  }

  return {
    name: name.slice(0, 80),
    phone: phone.slice(0, 30)
  };
}

function sanitizeReadingSettings(value) {
  const settings = value && typeof value === "object" && !Array.isArray(value) ? value : {};

  return {
    fontSize: FONT_SIZES.includes(settings.fontSize) ? settings.fontSize : "medium",
    theme: THEMES.includes(settings.theme) ? settings.theme : "light"
  };
}

function sanitizeState(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return createDefaultState();
  }

  return {
    favorites: sanitizeBookIds(value.favorites),
    ownedBooks: sanitizeBookIds(value.ownedBooks),
    user: sanitizeUser(value.user),
    readingSettings: sanitizeReadingSettings(value.readingSettings)
  };
}

/* ==========================================================================
   Safe localStorage access
   ========================================================================== */

function clearStoredState() {
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch (error) {
    /* Storage unavailable: the in-memory state is still reset. */
  }
}

function loadState() {
  let raw = null;

  try {
    raw = window.localStorage.getItem(STORAGE_KEY);
  } catch (error) {
    return createDefaultState();
  }

  if (raw === null) {
    return createDefaultState();
  }

  let parsed = null;

  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    clearStoredState();
    return createDefaultState();
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    clearStoredState();
    return createDefaultState();
  }

  return sanitizeState(parsed);
}

function saveState() {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    return true;
  } catch (error) {
    return false;
  }
}

/* ==========================================================================
   Central store
   ========================================================================== */

let state = loadState();
const subscribers = new Set();

function subscribe(listener) {
  subscribers.add(listener);
}

function emitChange() {
  for (const listener of subscribers) {
    listener();
  }
}

function setState(nextState) {
  state = nextState;
  saveState();
  emitChange();
}

function toggleFavorite(bookId) {
  if (!VALID_BOOK_IDS.has(bookId)) {
    return;
  }

  const favorites = state.favorites.includes(bookId)
    ? state.favorites.filter((id) => id !== bookId)
    : [...state.favorites, bookId];

  setState({ ...state, favorites });
}

function setTheme(theme) {
  if (!THEMES.includes(theme)) {
    return;
  }

  setState({
    ...state,
    readingSettings: { ...state.readingSettings, theme }
  });
}

function resetState() {
  clearStoredState();
  state = createDefaultState();
  emitChange();
}

/* ==========================================================================
   Formatting helpers
   ========================================================================== */

function formatPrice(price) {
  if (price === 0) {
    return "رایگان";
  }
  return `${numberFormatter.format(price)} تومان`;
}

function createStatUpdater() {
  const nodes = {
    total: document.getElementById("stat-total"),
    categories: document.getElementById("stat-categories"),
    favorites: document.getElementById("stat-favorites"),
    free: document.getElementById("stat-free"),
    samples: document.getElementById("stat-samples")
  };

  return {
    total: (value) => { nodes.total.textContent = numberFormatter.format(value); },
    categories: (value) => { nodes.categories.textContent = numberFormatter.format(value); },
    favorites: (value) => { nodes.favorites.textContent = numberFormatter.format(value); },
    free: (value) => { nodes.free.textContent = numberFormatter.format(value); },
    samples: (value) => { nodes.samples.textContent = numberFormatter.format(value); }
  };
}

/* ==========================================================================
   Rendering
   ========================================================================== */

function createFavoriteButton(book) {
  const isFavorite = state.favorites.includes(book.id);
  const button = document.createElement("button");

  button.type = "button";
  button.className = "favorite-toggle";
  button.dataset.bookId = book.id;
  button.setAttribute("aria-pressed", String(isFavorite));
  button.setAttribute(
    "aria-label",
    isFavorite
      ? `حذف «${book.title}» از علاقه‌مندی‌ها`
      : `افزودن «${book.title}» به علاقه‌مندی‌ها`
  );
  button.textContent = isFavorite ? "♥" : "♡";

  if (isFavorite) {
    button.classList.add("is-active");
  }

  button.addEventListener("click", () => {
    toggleFavorite(book.id);
  });

  return button;
}

function createBookCard(book) {
  const card = document.createElement("article");
  card.className = "book-card";
  card.dataset.id = book.id;

  const coverWrap = document.createElement("div");
  coverWrap.className = "book-cover";

  const image = document.createElement("img");
  image.src = book.cover;
  image.alt = `جلد کتاب ${book.title} اثر ${book.author}`;
  image.width = 400;
  image.height = 600;
  image.loading = "lazy";
  image.decoding = "async";
  coverWrap.appendChild(image);

  if (book.price === 0) {
    const badge = document.createElement("span");
    badge.className = "badge-free";
    badge.textContent = "رایگان";
    coverWrap.appendChild(badge);
  }

  coverWrap.appendChild(createFavoriteButton(book));

  const body = document.createElement("div");
  body.className = "book-body";

  const category = document.createElement("span");
  category.className = "book-category";
  category.textContent = book.category;

  const title = document.createElement("h3");
  title.className = "book-title";
  title.textContent = book.title;

  const author = document.createElement("p");
  author.className = "book-author";
  author.textContent = book.author;

  const rating = document.createElement("p");
  rating.className = "book-rating";
  const star = document.createElement("span");
  star.className = "star";
  star.setAttribute("aria-hidden", "true");
  star.textContent = "★";
  const ratingText = document.createElement("span");
  ratingText.textContent = `${ratingFormatter.format(book.rating)} از ۵`;
  rating.appendChild(star);
  rating.appendChild(ratingText);
  rating.setAttribute("aria-label", `امتیاز ${ratingFormatter.format(book.rating)} از ۵`);

  const price = document.createElement("p");
  price.className = "book-price";
  if (book.price === 0) {
    price.classList.add("is-free");
  }
  price.textContent = formatPrice(book.price);

  body.appendChild(category);
  body.appendChild(title);
  body.appendChild(author);
  body.appendChild(rating);
  body.appendChild(price);

  card.appendChild(coverWrap);
  card.appendChild(body);
  return card;
}

function renderSummary() {
  const update = createStatUpdater();
  const freeCount = BOOKS.filter((book) => book.price === 0).length;
  const sampleCount = BOOKS.filter((book) => book.sampleParagraphs.length >= 3).length;

  update.total(BOOKS.length);
  update.categories(CATEGORIES.length);
  update.favorites(state.favorites.length);
  update.free(freeCount);
  update.samples(sampleCount);
}

function renderBooks() {
  const grid = document.getElementById("book-grid");
  const activeElement = document.activeElement;
  const focusedBookId =
    activeElement && activeElement.classList.contains("favorite-toggle")
      ? activeElement.dataset.bookId
      : null;
  const fragment = document.createDocumentFragment();

  for (const book of BOOKS) {
    fragment.appendChild(createBookCard(book));
  }

  grid.replaceChildren();
  grid.appendChild(fragment);

  if (focusedBookId) {
    const restoredButton = grid.querySelector(
      `.favorite-toggle[data-book-id="${focusedBookId}"]`
    );
    if (restoredButton) {
      restoredButton.focus();
    }
  }
}

function applyTheme() {
  document.documentElement.setAttribute("data-theme", state.readingSettings.theme);
}

function renderHeaderControls() {
  const toggle = document.getElementById("theme-toggle");
  const icon = document.getElementById("theme-toggle-icon");
  const label = document.getElementById("theme-toggle-label");

  if (!toggle || !icon || !label) {
    return;
  }

  const isDark = state.readingSettings.theme === "dark";

  toggle.setAttribute("aria-pressed", String(isDark));
  toggle.setAttribute("aria-label", isDark ? "تغییر به حالت روشن" : "تغییر به حالت تیره");
  icon.textContent = isDark ? "☀" : "☾";
  label.textContent = isDark ? "روشن" : "تیره";
}

function renderApp() {
  applyTheme();
  renderSummary();
  renderBooks();
  renderHeaderControls();
}

function initControls() {
  const themeToggle = document.getElementById("theme-toggle");
  const resetButton = document.getElementById("reset-state");

  if (themeToggle) {
    themeToggle.addEventListener("click", () => {
      setTheme(state.readingSettings.theme === "dark" ? "light" : "dark");
    });
  }

  if (resetButton) {
    resetButton.addEventListener("click", resetState);
  }
}

subscribe(renderApp);
initControls();
renderApp();
