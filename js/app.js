/**
 * Hash-routed bookstore shell + safe persistence.
 * All DOM is built with document.createElement and textContent.
 */

const STORAGE_KEY = "ketabkhaneh_state_v1";
const FONT_SIZES = ["small", "medium", "large"];
const THEMES = ["light", "dark"];
const BOOK_BY_ID = new Map(BOOKS.map((book) => [book.id, book]));
const VALID_BOOK_IDS = new Set(BOOK_BY_ID.keys());

const COLLECTION_LABELS = {
  featured: "پیشنهادها",
  new: "تازه‌ها",
  free: "کتاب‌های رایگان"
};

const CATALOG_SORTS = ["default", "price-asc", "price-desc", "rating-desc"];
const CATALOG_SORT_LABELS = {
  default: "پیش‌فرض",
  "price-asc": "ارزان‌ترین",
  "price-desc": "گران‌ترین",
  "rating-desc": "بیشترین امتیاز"
};
const EMPTY_CATALOG_STATE = {
  q: "",
  category: "",
  freeOnly: false,
  collection: "",
  sort: "default"
};

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

function formatCount(value) {
  return numberFormatter.format(value);
}

function setStatValue(id, value) {
  const node = document.getElementById(id);
  if (node) {
    node.textContent = formatCount(value);
  }
}

function syncStats() {
  setStatValue("stat-total", BOOKS.length);
  setStatValue("stat-categories", CATEGORIES.length);
  setStatValue("stat-favorites", state.favorites.length);
  setStatValue("stat-free", BOOKS.filter((book) => book.price === 0).length);
  setStatValue(
    "stat-samples",
    BOOKS.filter((book) => book.sampleParagraphs.length >= 3).length
  );
}

/* ==========================================================================
   Routing
   ========================================================================== */

function parseRoute() {
  const raw = window.location.hash.replace(/^#/, "");
  const queryIndex = raw.indexOf("?");
  const pathPart = queryIndex === -1 ? raw : raw.slice(0, queryIndex);
  const queryPart = queryIndex === -1 ? "" : raw.slice(queryIndex + 1);
  const path = pathPart.replace(/^\/+|\/+$/g, "");
  const params = new URLSearchParams(queryPart);

  if (!path || path === "home") {
    return { name: "home", params };
  }

  if (path === "categories") {
    return { name: "categories", params };
  }

  if (path === "catalog") {
    return { name: "catalog", params };
  }

  if (path === "library") {
    return { name: "library", params };
  }

  if (path === "login") {
    return { name: "login", params };
  }

  if (path.startsWith("book/")) {
    let bookId = path.slice("book/".length);

    try {
      bookId = decodeURIComponent(bookId);
    } catch (error) {
      bookId = "";
    }

    return { name: "book", bookId, params };
  }

  if (path.startsWith("reader/")) {
    let bookId = path.slice("reader/".length);

    try {
      bookId = decodeURIComponent(bookId);
    } catch (error) {
      bookId = "";
    }

    return { name: "reader", bookId, params };
  }

  return { name: "notfound", params };
}

function navigate(target) {
  const hash = target.startsWith("#") ? target : `#${target}`;

  if (window.location.hash === hash) {
    renderRoute({ focus: shouldFocusMain() });
    return;
  }

  window.location.hash = hash;
}

function shouldFocusMain() {
  const active = document.activeElement;
  return !active || active.id !== "search-input";
}

function routeTitle(route) {
  switch (route.name) {
    case "home":
      return "کتابخانه | لذت خواندن و شنیدن کتاب‌ها";
    case "categories":
      return "دسته‌بندی‌ها | کتابخانه";
    case "catalog":
      return "فهرست کتاب‌ها | کتابخانه";
    case "book": {
      const book = BOOK_BY_ID.get(route.bookId);
      return book ? `${book.title} | کتابخانه` : "کتاب پیدا نشد | کتابخانه";
    }
    case "reader":
      return "خواندن نمونه | کتابخانه";
    case "library":
      return "کتابخانه من | کتابخانه";
    case "login":
      return "ورود / حساب کاربری | کتابخانه";
    default:
      return "صفحه پیدا نشد | کتابخانه";
  }
}

function updateActiveNav(route) {
  const routeMap = {
    home: "home",
    categories: "categories",
    catalog: "catalog",
    book: "catalog",
    reader: "catalog",
    library: "library"
  };
  const activeRoute = routeMap[route.name] || "";

  for (const link of document.querySelectorAll(".nav-link")) {
    const isActive = link.dataset.route === activeRoute;
    link.classList.toggle("is-active", isActive);

    if (isActive) {
      link.setAttribute("aria-current", "page");
    } else {
      link.removeAttribute("aria-current");
    }
  }
}

function syncSearchField(route) {
  const input = document.getElementById("search-input");
  if (!input) {
    return;
  }

  const nextValue = route.name === "catalog" ? route.params.get("q") || "" : "";

  if (input.value === nextValue) {
    return;
  }

  if (route.name === "catalog" && document.activeElement === input) {
    return;
  }

  input.value = nextValue;
}

function renderRoute(options) {
  const route = parseRoute();
  const main = document.getElementById("app");

  if (!main) {
    return;
  }

  const container = document.createElement("div");
  container.className = "container";
  container.appendChild(buildView(route));
  main.replaceChildren(container);

  document.title = routeTitle(route);
  updateActiveNav(route);
  syncSearchField(route);
  syncStats();
  applyTheme();
  syncThemeControl();
  syncHeader();
  syncFavoriteButtons();

  if (options && options.focus) {
    main.focus({ preventScroll: true });
  }

  window.scrollTo(0, 0);
}

/* ==========================================================================
   Shared header / theme sync
   ========================================================================== */

function applyTheme() {
  document.documentElement.setAttribute(
    "data-theme",
    state.readingSettings.theme
  );
}

function syncThemeControl() {
  const toggle = document.getElementById("theme-toggle");
  const icon = document.getElementById("theme-toggle-icon");
  const label = document.getElementById("theme-toggle-label");

  if (!toggle || !icon || !label) {
    return;
  }

  const isDark = state.readingSettings.theme === "dark";

  toggle.setAttribute("aria-pressed", String(isDark));
  toggle.setAttribute(
    "aria-label",
    isDark ? "تغییر به حالت روشن" : "تغییر به حالت تیره"
  );
  icon.textContent = isDark ? "☀" : "☾";
  label.textContent = isDark ? "روشن" : "تیره";
}

function syncHeader() {
  const count = document.getElementById("library-count");

  if (count) {
    count.textContent = formatCount(state.ownedBooks.length);
  }

  const accountLink = document.getElementById("account-link");
  const accountLabel = document.querySelector("#account-link .account-label");

  if (accountLabel) {
    accountLabel.textContent = state.user
      ? state.user.name
      : "ورود / حساب کاربری";
  }

  if (accountLink) {
    accountLink.setAttribute(
      "aria-label",
      state.user ? `حساب کاربری ${state.user.name}` : "ورود یا حساب کاربری"
    );
  }
}

function syncFavoriteButtons() {
  const buttons = document.querySelectorAll(".favorite-toggle");

  for (const button of buttons) {
    const book = BOOK_BY_ID.get(button.dataset.bookId);

    if (!book) {
      continue;
    }

    const isFavorite = state.favorites.includes(book.id);
    const glyph = isFavorite ? "♥" : "♡";

    button.classList.toggle("is-active", isFavorite);
    button.setAttribute("aria-pressed", String(isFavorite));
    button.setAttribute(
      "aria-label",
      isFavorite
        ? `حذف «${book.title}» از علاقه‌مندی‌ها`
        : `افزودن «${book.title}» به علاقه‌مندی‌ها`
    );

    if (button.dataset.variant === "inline") {
      button.textContent = `${glyph} ${
        isFavorite ? "در علاقه‌مندی‌ها" : "افزودن به علاقه‌مندی‌ها"
      }`;
    } else {
      button.textContent = glyph;
    }
  }
}

/* ==========================================================================
   Shared UI pieces
   ========================================================================== */

function categoryHref(category) {
  return `#catalog?category=${encodeURIComponent(category)}`;
}

function createCategoryBadge(category) {
  const badge = document.createElement("span");
  badge.className = "category-badge";
  badge.setAttribute("aria-hidden", "true");
  badge.textContent = category.charAt(0);
  return badge;
}

function createCategoryCard(category) {
  const count = BOOKS.filter((book) => book.category === category).length;
  const card = document.createElement("a");
  card.className = "category-card";
  card.href = categoryHref(category);

  const top = document.createElement("span");
  top.className = "category-card-top";
  top.appendChild(createCategoryBadge(category));

  const name = document.createElement("span");
  name.className = "category-name";
  name.textContent = category;

  const meta = document.createElement("span");
  meta.className = "category-count";
  meta.textContent = `${formatCount(count)} کتاب`;

  card.appendChild(top);
  card.appendChild(name);
  card.appendChild(meta);
  return card;
}

function createCategoryGrid() {
  const grid = document.createElement("div");
  grid.className = "category-grid";

  for (const category of CATEGORIES) {
    grid.appendChild(createCategoryCard(category));
  }

  return grid;
}

function createFavoriteButton(book, extraClass) {
  const button = document.createElement("button");
  const isFavorite = state.favorites.includes(book.id);
  const isInline = Boolean(extraClass && extraClass.includes("favorite-inline"));

  button.type = "button";
  button.className = "favorite-toggle";
  button.dataset.bookId = book.id;
  button.setAttribute("aria-pressed", String(isFavorite));

  if (isInline) {
    button.dataset.variant = "inline";
    button.textContent = `${isFavorite ? "♥" : "♡"} ${
      isFavorite ? "در علاقه‌مندی‌ها" : "افزودن به علاقه‌مندی‌ها"
    }`;
  } else {
    button.textContent = isFavorite ? "♥" : "♡";
  }

  if (extraClass) {
    button.classList.add(extraClass);
  }

  if (isFavorite) {
    button.classList.add("is-active");
  }

  button.setAttribute(
    "aria-label",
    isFavorite
      ? `حذف «${book.title}» از علاقه‌مندی‌ها`
      : `افزودن «${book.title}» به علاقه‌مندی‌ها`
  );

  button.addEventListener("click", () => {
    toggleFavorite(book.id);
  });

  return button;
}

function createRating(book) {
  const rating = document.createElement("p");
  rating.className = "book-rating";
  rating.setAttribute(
    "aria-label",
    `امتیاز ${ratingFormatter.format(book.rating)} از ۵`
  );

  const star = document.createElement("span");
  star.className = "star";
  star.setAttribute("aria-hidden", "true");
  star.textContent = "★";

  const value = document.createElement("span");
  value.textContent = `${ratingFormatter.format(book.rating)} از ۵`;

  rating.appendChild(star);
  rating.appendChild(value);
  return rating;
}

function createBookCard(book) {
  const card = document.createElement("article");
  card.className = "book-card";
  card.dataset.id = book.id;

  const link = document.createElement("a");
  link.className = "book-card-link";
  link.href = `#book/${encodeURIComponent(book.id)}`;

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

  const price = document.createElement("p");
  price.className = "book-price";
  if (book.price === 0) {
    price.classList.add("is-free");
  }
  price.textContent = formatPrice(book.price);

  body.appendChild(category);
  body.appendChild(title);
  body.appendChild(author);
  body.appendChild(createRating(book));
  body.appendChild(price);

  link.appendChild(coverWrap);
  link.appendChild(body);

  link.addEventListener("keydown", (event) => {
    if (event.key === " " || event.key === "Spacebar") {
      event.preventDefault();
      link.click();
    }
  });

  card.appendChild(link);
  card.appendChild(createFavoriteButton(book));
  return card;
}

function createBookGrid(books) {
  const grid = document.createElement("div");
  grid.className = "book-grid";

  for (const book of books) {
    grid.appendChild(createBookCard(book));
  }

  return grid;
}

function createSectionHead(title, options) {
  const head = document.createElement("div");
  head.className = "section-head";

  const titleWrap = document.createElement("div");
  titleWrap.className = "section-title-wrap";

  const heading = document.createElement("h2");
  heading.textContent = title;
  titleWrap.appendChild(heading);

  if (options && options.note) {
    const note = document.createElement("p");
    note.className = "section-note";
    note.textContent = options.note;
    titleWrap.appendChild(note);
  }

  head.appendChild(titleWrap);

  if (options && options.linkHref) {
    const link = document.createElement("a");
    link.className = "link-more";
    link.href = options.linkHref;
    link.textContent = options.linkLabel || "مشاهده همه";
    head.appendChild(link);
  }

  return head;
}

function createEmptyState(title, text, linkHref, linkLabel) {
  const box = document.createElement("div");
  box.className = "empty-state";

  const heading = document.createElement("h2");
  heading.textContent = title;

  const paragraph = document.createElement("p");
  paragraph.textContent = text;

  box.appendChild(heading);
  box.appendChild(paragraph);

  if (linkHref) {
    const link = document.createElement("a");
    link.className = "btn btn-primary";
    link.href = linkHref;
    link.textContent = linkLabel || "مشاهدهٔ کتاب‌ها";
    box.appendChild(link);
  }

  return box;
}

/* ==========================================================================
   Home view
   ========================================================================== */

function createHero() {
  const hero = document.createElement("section");
  hero.className = "hero";
  hero.setAttribute("aria-labelledby", "hero-title");

  const content = document.createElement("div");
  content.className = "hero-content";

  const eyebrow = document.createElement("p");
  eyebrow.className = "hero-eyebrow";
  eyebrow.textContent = "کتابخانهٔ آنلاین و آفلاین";

  const heading = document.createElement("h1");
  heading.id = "hero-title";
  heading.textContent = "لذت خواندن و شنیدن کتاب‌ها";

  const text = document.createElement("p");
  text.className = "hero-text";
  text.textContent =
    "کتاب بعدی‌ات را پیدا کن؛ از میان داستان‌ها، کتاب‌های روان‌شناسی، ادبیات و تاریخ جست‌وجو کن، نمونه بخوان و کتاب‌های محبوبت را در کتابخانهٔ خودت نگه دار.";

  const actions = document.createElement("div");
  actions.className = "hero-actions";

  const primary = document.createElement("a");
  primary.className = "btn btn-light";
  primary.href = "#catalog";
  primary.textContent = "مرور فهرست کتاب‌ها";

  const secondary = document.createElement("a");
  secondary.className = "btn btn-outline-light";
  secondary.href = "#categories";
  secondary.textContent = "دسته‌بندی‌ها";

  actions.appendChild(primary);
  actions.appendChild(secondary);

  content.appendChild(eyebrow);
  content.appendChild(heading);
  content.appendChild(text);
  content.appendChild(actions);

  const art = document.createElement("div");
  art.className = "hero-art";
  art.setAttribute("aria-hidden", "true");

  const artBooks = ["book-1", "book-5", "book-7"]
    .map((id) => BOOK_BY_ID.get(id))
    .filter(Boolean);

  for (const book of artBooks) {
    const frame = document.createElement("div");
    frame.className = "hero-cover";

    const image = document.createElement("img");
    image.src = book.cover;
    image.alt = "";
    image.width = 400;
    image.height = 600;

    frame.appendChild(image);
    art.appendChild(frame);
  }

  hero.appendChild(content);
  hero.appendChild(art);
  return hero;
}

function createStatsSection() {
  const stats = document.createElement("section");
  stats.className = "stats";
  stats.setAttribute("aria-label", "آمار کتابخانه");

  const items = [
    { id: "stat-total", label: "کتاب", value: BOOKS.length },
    { id: "stat-categories", label: "دسته‌بندی", value: CATEGORIES.length },
    {
      id: "stat-favorites",
      label: "علاقه‌مندی‌ها",
      value: state.favorites.length
    },
    {
      id: "stat-free",
      label: "کتاب رایگان",
      value: BOOKS.filter((book) => book.price === 0).length
    },
    {
      id: "stat-samples",
      label: "کتاب با نمونه",
      value: BOOKS.filter((book) => book.sampleParagraphs.length >= 3).length
    }
  ];

  for (const item of items) {
    const card = document.createElement("div");
    card.className = "stat";

    const value = document.createElement("span");
    value.className = "stat-value";
    value.id = item.id;
    value.textContent = formatCount(item.value);

    const label = document.createElement("span");
    label.className = "stat-label";
    label.textContent = item.label;

    card.appendChild(value);
    card.appendChild(label);
    stats.appendChild(card);
  }

  return stats;
}

function createCategoriesSection() {
  const section = document.createElement("section");
  section.className = "home-section";
  section.setAttribute("aria-labelledby", "home-categories-title");

  const head = createSectionHead("دسته‌بندی‌ها", {
    note: "با انتخاب هر دسته، فهرست کتاب‌های همان موضوع را ببینید.",
    linkHref: "#categories",
    linkLabel: "همهٔ دسته‌بندی‌ها"
  });
  head.querySelector("h2").id = "home-categories-title";

  section.appendChild(head);
  section.appendChild(createCategoryGrid());
  return section;
}

function scrollShelf(track, direction) {
  const firstCard = track.querySelector(".book-card");

  if (!firstCard) {
    return;
  }

  const styles = window.getComputedStyle(track);
  const gap = parseFloat(styles.columnGap || styles.gap) || 0;
  const step = firstCard.getBoundingClientRect().width + gap;

  if (!step) {
    return;
  }

  const maxScroll = Math.max(0, track.scrollWidth - track.clientWidth);

  if (maxScroll <= 0) {
    return;
  }

  const current = Math.abs(track.scrollLeft);
  let target;

  if (direction === "next") {
    target = current >= maxScroll - 2 ? 0 : track.scrollLeft - step;
  } else {
    target = current <= 2 ? -maxScroll : track.scrollLeft + step;
  }

  target = Math.max(-maxScroll, Math.min(0, target));
  track.scrollTo({ left: target, behavior: "smooth" });
}

function createShelf(options) {
  const section = document.createElement("section");
  section.className = "shelf";
  section.id = `shelf-${options.id}`;
  section.setAttribute("aria-labelledby", `shelf-${options.id}-title`);

  const head = document.createElement("div");
  head.className = "shelf-head";

  const titleWrap = document.createElement("div");
  titleWrap.className = "shelf-title-wrap";

  const heading = document.createElement("h2");
  heading.id = `shelf-${options.id}-title`;
  heading.textContent = options.title;

  const note = document.createElement("p");
  note.className = "shelf-note";
  note.textContent = options.note;

  titleWrap.appendChild(heading);
  titleWrap.appendChild(note);

  const actions = document.createElement("div");
  actions.className = "shelf-actions";

  const seeAll = document.createElement("a");
  seeAll.className = "link-more";
  seeAll.href = options.seeAllHref;
  seeAll.textContent = "مشاهده همه";

  const controls = document.createElement("div");
  controls.className = "shelf-controls";

  const trackId = `shelf-${options.id}-track`;

  const prev = document.createElement("button");
  prev.type = "button";
  prev.className = "shelf-btn";
  prev.textContent = "قبلی";
  prev.setAttribute("aria-controls", trackId);
  prev.setAttribute("aria-label", `کتاب‌های قبلی در ${options.title}`);

  const next = document.createElement("button");
  next.type = "button";
  next.className = "shelf-btn";
  next.textContent = "بعدی";
  next.setAttribute("aria-controls", trackId);
  next.setAttribute("aria-label", `کتاب‌های بعدی در ${options.title}`);

  controls.appendChild(prev);
  controls.appendChild(next);

  actions.appendChild(seeAll);
  actions.appendChild(controls);

  head.appendChild(titleWrap);
  head.appendChild(actions);

  const track = document.createElement("div");
  track.className = "shelf-track";
  track.id = trackId;
  track.setAttribute("aria-label", options.title);

  for (const book of options.books) {
    track.appendChild(createBookCard(book));
  }

  prev.addEventListener("click", () => {
    scrollShelf(track, "prev");
  });

  next.addEventListener("click", () => {
    scrollShelf(track, "next");
  });

  section.appendChild(head);
  section.appendChild(track);
  return section;
}

function buildHomeView() {
  const fragment = document.createDocumentFragment();

  fragment.appendChild(createHero());
  fragment.appendChild(createStatsSection());
  fragment.appendChild(createCategoriesSection());

  fragment.appendChild(
    createShelf({
      id: "featured",
      title: "پیشنهادها",
      note: "کتاب‌هایی که بیشتر پیشنهاد می‌شوند.",
      books: BOOKS.filter((book) => book.featured).sort(
        (a, b) => b.rating - a.rating
      ),
      seeAllHref: "#catalog?collection=featured"
    })
  );

  fragment.appendChild(
    createShelf({
      id: "new",
      title: "تازه‌ها",
      note: "جدیدترین کتاب‌های اضافه‌شده به مجموعه.",
      books: BOOKS.filter((book) => book.isNew),
      seeAllHref: "#catalog?collection=new"
    })
  );

  fragment.appendChild(
    createShelf({
      id: "free",
      title: "کتاب‌های رایگان",
      note: "خواندن بدون هزینه؛ همین حالا شروع کنید.",
      books: BOOKS.filter((book) => book.price === 0),
      seeAllHref: "#catalog?collection=free"
    })
  );

  return fragment;
}

/* ==========================================================================
   Categories view
   ========================================================================== */

function buildCategoriesView() {
  const page = document.createElement("section");
  page.className = "page";

  const head = document.createElement("div");
  head.className = "page-head";

  const heading = document.createElement("h1");
  heading.textContent = "دسته‌بندی‌ها";

  const lead = document.createElement("p");
  lead.className = "page-lead";
  lead.textContent = `${formatCount(CATEGORIES.length)} دسته‌بندی برای پیدا کردن کتاب مناسب.`;

  head.appendChild(heading);
  head.appendChild(lead);

  page.appendChild(head);
  page.appendChild(createCategoryGrid());
  return page;
}

/* ==========================================================================
   Catalog view
   ========================================================================== */

function normalizeSearchText(value) {
  if (typeof value !== "string") {
    return "";
  }

  return value
    .toLowerCase()
    .replace(/ي/g, "ی")
    .replace(/ك/g, "ک")
    .replace(/\u200c/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function readCatalogState(params) {
  const collectionParam = params.get("collection") || "";
  const categoryParam = params.get("category") || "";
  const sortParam = params.get("sort") || "default";

  let collection = "";
  let freeOnly = params.get("free") === "1";

  if (collectionParam === "featured" || collectionParam === "new") {
    collection = collectionParam;
  } else if (collectionParam === "free") {
    freeOnly = true;
  }

  return {
    q: (params.get("q") || "").trim(),
    category: CATEGORIES.includes(categoryParam) ? categoryParam : "",
    freeOnly,
    collection,
    sort: CATALOG_SORTS.includes(sortParam) ? sortParam : "default"
  };
}

function currentCatalogState() {
  return readCatalogState(parseRoute().params);
}

function buildCatalogHash(catalogState) {
  const params = new URLSearchParams();
  const query = (catalogState.q || "").trim();

  if (query) {
    params.set("q", query);
  }

  if (catalogState.category) {
    params.set("category", catalogState.category);
  }

  if (catalogState.freeOnly) {
    params.set("free", "1");
  }

  if (catalogState.collection) {
    params.set("collection", catalogState.collection);
  }

  if (catalogState.sort && catalogState.sort !== "default") {
    params.set("sort", catalogState.sort);
  }

  const queryString = params.toString();
  return queryString ? `#catalog?${queryString}` : "#catalog";
}

function hasActiveCatalogFilters(catalogState) {
  return Boolean(
    catalogState.q ||
      catalogState.category ||
      catalogState.freeOnly ||
      catalogState.collection ||
      catalogState.sort !== "default"
  );
}

function catalogHeading(catalogState) {
  if (catalogState.q) {
    return `نتایج جست‌وجو برای «${catalogState.q}»`;
  }

  if (catalogState.category) {
    return `کتاب‌های ${catalogState.category}`;
  }

  if (catalogState.collection && COLLECTION_LABELS[catalogState.collection]) {
    return COLLECTION_LABELS[catalogState.collection];
  }

  if (catalogState.freeOnly) {
    return COLLECTION_LABELS.free;
  }

  return "فهرست کتاب‌ها";
}

function filterCatalogBooks(catalogState) {
  let books = BOOKS.slice();

  if (catalogState.category) {
    books = books.filter((book) => book.category === catalogState.category);
  }

  if (catalogState.freeOnly) {
    books = books.filter((book) => book.price === 0);
  }

  if (catalogState.collection === "featured") {
    books = books.filter((book) => book.featured);
  } else if (catalogState.collection === "new") {
    books = books.filter((book) => book.isNew);
  }

  if (catalogState.q) {
    const needle = normalizeSearchText(catalogState.q);

    if (needle) {
      books = books.filter((book) => {
        return (
          normalizeSearchText(book.title).includes(needle) ||
          normalizeSearchText(book.author).includes(needle)
        );
      });
    }
  }

  return books;
}

function sortCatalogBooks(books, sort) {
  const sorted = books.slice();

  if (sort === "price-asc") {
    sorted.sort((a, b) => a.price - b.price);
  } else if (sort === "price-desc") {
    sorted.sort((a, b) => b.price - a.price);
  } else if (sort === "rating-desc") {
    sorted.sort((a, b) => b.rating - a.rating);
  }

  return sorted;
}

function createCatalogSelectField(labelText, id, options, selectedValue, onChange) {
  const field = document.createElement("div");
  field.className = "catalog-field";

  const label = document.createElement("label");
  label.htmlFor = id;
  label.textContent = labelText;

  const select = document.createElement("select");
  select.className = "catalog-select";
  select.id = id;

  for (const option of options) {
    const node = document.createElement("option");
    node.value = option.value;
    node.textContent = option.label;

    if (option.value === selectedValue) {
      node.selected = true;
    }

    select.appendChild(node);
  }

  select.addEventListener("change", () => {
    onChange(select.value);
  });

  field.appendChild(label);
  field.appendChild(select);
  return field;
}

function createCatalogToolbar(catalogState) {
  const toolbar = document.createElement("div");
  toolbar.className = "catalog-toolbar";
  toolbar.setAttribute("role", "search");
  toolbar.setAttribute("aria-label", "جست‌وجو و فیلتر کتاب‌ها");

  const searchField = document.createElement("div");
  searchField.className = "catalog-field catalog-search-field";

  const searchLabel = document.createElement("label");
  searchLabel.htmlFor = "catalog-search-input";
  searchLabel.textContent = "جست‌وجو در فهرست";

  const searchInput = document.createElement("input");
  searchInput.className = "catalog-input";
  searchInput.id = "catalog-search-input";
  searchInput.type = "search";
  searchInput.placeholder = "نام کتاب یا نویسنده…";
  searchInput.autocomplete = "off";
  searchInput.value = catalogState.q;
  searchInput.addEventListener("input", () => {
    applyCatalogState(
      { ...currentCatalogState(), q: searchInput.value.trim() },
      { source: "catalog-search" }
    );
  });

  searchField.appendChild(searchLabel);
  searchField.appendChild(searchInput);

  const categoryField = createCatalogSelectField(
    "دسته‌بندی",
    "catalog-category-select",
    [{ value: "", label: "همهٔ دسته‌ها" }].concat(
      CATEGORIES.map((category) => ({ value: category, label: category }))
    ),
    catalogState.category,
    (value) => {
      applyCatalogState(
        { ...currentCatalogState(), category: value },
        { source: "category" }
      );
    }
  );

  const collectionField = createCatalogSelectField(
    "مجموعه",
    "catalog-collection-select",
    [
      { value: "", label: "همهٔ کتاب‌ها" },
      { value: "featured", label: COLLECTION_LABELS.featured },
      { value: "new", label: COLLECTION_LABELS.new }
    ],
    catalogState.collection,
    (value) => {
      applyCatalogState(
        { ...currentCatalogState(), collection: value },
        { source: "collection" }
      );
    }
  );

  const freeLabel = document.createElement("label");
  freeLabel.className = "catalog-check";

  const freeCheckbox = document.createElement("input");
  freeCheckbox.type = "checkbox";
  freeCheckbox.id = "catalog-free-checkbox";
  freeCheckbox.checked = catalogState.freeOnly;
  freeCheckbox.addEventListener("change", () => {
    applyCatalogState(
      { ...currentCatalogState(), freeOnly: freeCheckbox.checked },
      { source: "free" }
    );
  });

  const freeText = document.createElement("span");
  freeText.textContent = "فقط کتاب‌های رایگان";

  freeLabel.appendChild(freeCheckbox);
  freeLabel.appendChild(freeText);

  const sortField = createCatalogSelectField(
    "مرتب‌سازی",
    "catalog-sort-select",
    CATALOG_SORTS.map((sort) => ({
      value: sort,
      label: CATALOG_SORT_LABELS[sort]
    })),
    catalogState.sort,
    (value) => {
      applyCatalogState(
        { ...currentCatalogState(), sort: value },
        { source: "sort" }
      );
    }
  );

  const clearButton = document.createElement("button");
  clearButton.type = "button";
  clearButton.id = "catalog-clear";
  clearButton.className = "btn btn-primary catalog-clear";
  clearButton.textContent = "پاک کردن فیلترها";
  clearButton.hidden = !hasActiveCatalogFilters(catalogState);
  clearButton.addEventListener("click", clearCatalogFilters);

  toolbar.appendChild(searchField);
  toolbar.appendChild(categoryField);
  toolbar.appendChild(collectionField);
  toolbar.appendChild(freeLabel);
  toolbar.appendChild(sortField);
  toolbar.appendChild(clearButton);
  return toolbar;
}

function createCatalogChips() {
  const chips = document.createElement("div");
  chips.className = "catalog-chips";
  chips.id = "catalog-chips";
  return chips;
}

function renderCatalogChips(catalogState, container) {
  if (!container) {
    return;
  }

  container.replaceChildren();
  const labels = [];

  if (catalogState.q) {
    labels.push(`جست‌وجو: «${catalogState.q}»`);
  }

  if (catalogState.category) {
    labels.push(`دسته: ${catalogState.category}`);
  }

  if (catalogState.freeOnly) {
    labels.push(COLLECTION_LABELS.free);
  }

  if (catalogState.collection) {
    labels.push(`مجموعه: ${COLLECTION_LABELS[catalogState.collection]}`);
  }

  if (catalogState.sort !== "default") {
    labels.push(`مرتب‌سازی: ${CATALOG_SORT_LABELS[catalogState.sort]}`);
  }

  for (const label of labels) {
    const chip = document.createElement("span");
    chip.className = "filter-chip";
    chip.textContent = label;
    container.appendChild(chip);
  }
}

function createCatalogEmptyState() {
  const box = document.createElement("div");
  box.className = "empty-state";

  const heading = document.createElement("h2");
  heading.textContent = "کتابی با این مشخصات پیدا نشد";

  const text = document.createElement("p");
  text.textContent =
    "عبارت جست‌وجو یا فیلترها را تغییر دهید، یا همهٔ فیلترها را پاک کنید و همهٔ کتاب‌ها را ببینید.";

  const button = document.createElement("button");
  button.type = "button";
  button.className = "btn btn-primary";
  button.textContent = "پاک کردن فیلترها";
  button.addEventListener("click", clearCatalogFilters);

  box.appendChild(heading);
  box.appendChild(text);
  box.appendChild(button);
  return box;
}

function getCatalogElements() {
  return {
    heading: document.getElementById("catalog-heading"),
    count: document.getElementById("catalog-count"),
    results: document.getElementById("catalog-results"),
    chips: document.getElementById("catalog-chips"),
    clear: document.getElementById("catalog-clear"),
    search: document.getElementById("catalog-search-input"),
    category: document.getElementById("catalog-category-select"),
    collection: document.getElementById("catalog-collection-select"),
    sort: document.getElementById("catalog-sort-select"),
    free: document.getElementById("catalog-free-checkbox")
  };
}

function syncCatalogControls(catalogState, source, elements) {
  if (
    elements.search &&
    source !== "catalog-search" &&
    elements.search.value !== catalogState.q
  ) {
    elements.search.value = catalogState.q;
  }

  if (elements.category && elements.category.value !== catalogState.category) {
    elements.category.value = catalogState.category;
  }

  if (
    elements.collection &&
    elements.collection.value !== catalogState.collection
  ) {
    elements.collection.value = catalogState.collection;
  }

  if (elements.sort && elements.sort.value !== catalogState.sort) {
    elements.sort.value = catalogState.sort;
  }

  if (elements.free) {
    elements.free.checked = catalogState.freeOnly;
  }
}

function syncHeaderSearch(catalogState) {
  const input = document.getElementById("search-input");

  if (!input || document.activeElement === input) {
    return;
  }

  if (input.value !== catalogState.q) {
    input.value = catalogState.q;
  }
}

function paintCatalog(catalogState, elements) {
  const books = sortCatalogBooks(
    filterCatalogBooks(catalogState),
    catalogState.sort
  );

  if (elements.heading) {
    elements.heading.textContent = catalogHeading(catalogState);
  }

  if (elements.count) {
    elements.count.textContent = `${formatCount(books.length)} کتاب`;
  }

  if (elements.results) {
    elements.results.replaceChildren(
      books.length === 0 ? createCatalogEmptyState() : createBookGrid(books)
    );
  }

  if (elements.clear) {
    elements.clear.hidden = !hasActiveCatalogFilters(catalogState);
  }

  renderCatalogChips(catalogState, elements.chips);
}

function applyCatalogState(catalogState, options) {
  const settings = options || {};
  const hash = buildCatalogHash(catalogState);

  if (window.location.hash !== hash) {
    window.history.replaceState(null, "", hash);
  }

  const elements = getCatalogElements();
  syncCatalogControls(catalogState, settings.source, elements);
  paintCatalog(catalogState, elements);
  syncHeaderSearch(catalogState);

  if (settings.focusSearch && elements.search) {
    elements.search.focus();
  }
}

function clearCatalogFilters() {
  applyCatalogState(
    { ...EMPTY_CATALOG_STATE },
    { source: "clear", focusSearch: true }
  );
}

function buildCatalogView(route) {
  const catalogState = readCatalogState(route.params);

  const page = document.createElement("section");
  page.className = "page";

  const head = document.createElement("div");
  head.className = "page-head";

  const title = document.createElement("h1");
  title.id = "catalog-heading";

  const lead = document.createElement("p");
  lead.className = "page-lead";
  lead.id = "catalog-count";
  lead.setAttribute("aria-live", "polite");

  head.appendChild(title);
  head.appendChild(lead);
  page.appendChild(head);

  const toolbar = createCatalogToolbar(catalogState);
  const chips = createCatalogChips();
  const results = document.createElement("div");
  results.id = "catalog-results";

  page.appendChild(toolbar);
  page.appendChild(chips);
  page.appendChild(results);

  paintCatalog(catalogState, {
    heading: title,
    count: lead,
    results,
    chips,
    clear: toolbar.querySelector("#catalog-clear")
  });

  return page;
}

/* ==========================================================================
   Book detail view
   ========================================================================== */

function buildBookDetailView(route) {
  const book = BOOK_BY_ID.get(route.bookId);

  if (!book) {
    return buildNotFoundView();
  }

  const page = document.createElement("section");
  page.className = "page";

  const back = document.createElement("a");
  back.className = "back-link";
  back.href = "#catalog";
  back.textContent = "← بازگشت به فهرست کتاب‌ها";

  const layout = document.createElement("div");
  layout.className = "book-detail";

  const cover = document.createElement("div");
  cover.className = "detail-cover";

  const image = document.createElement("img");
  image.src = book.cover;
  image.alt = `جلد کتاب ${book.title} اثر ${book.author}`;
  image.width = 400;
  image.height = 600;
  cover.appendChild(image);

  const info = document.createElement("div");
  info.className = "detail-info";

  const category = document.createElement("span");
  category.className = "detail-category";
  category.textContent = book.category;

  const heading = document.createElement("h1");
  heading.textContent = book.title;

  const author = document.createElement("p");
  author.className = "detail-author";
  author.textContent = `نوشتهٔ ${book.author}`;

  const meta = document.createElement("div");
  meta.className = "detail-meta";
  meta.appendChild(createRating(book));

  const price = document.createElement("p");
  price.className = "detail-price";
  if (book.price === 0) {
    price.classList.add("is-free");
  }
  price.textContent = formatPrice(book.price);

  const description = document.createElement("p");
  description.className = "detail-description";
  description.textContent = book.description;

  const actions = document.createElement("div");
  actions.className = "detail-actions";
  actions.appendChild(createFavoriteButton(book, "favorite-inline"));

  info.appendChild(category);
  info.appendChild(heading);
  info.appendChild(author);
  info.appendChild(meta);
  info.appendChild(price);
  info.appendChild(description);
  info.appendChild(actions);

  if (book.sampleParagraphs.length > 0) {
    const sample = document.createElement("section");
    sample.className = "detail-sample";

    const sampleTitle = document.createElement("h2");
    sampleTitle.textContent = "نمونه‌ای از کتاب";

    const quote = document.createElement("blockquote");
    quote.textContent = book.sampleParagraphs[0];

    sample.appendChild(sampleTitle);
    sample.appendChild(quote);
    info.appendChild(sample);
  } else {
    const note = document.createElement("p");
    note.className = "detail-note";
    note.textContent = "نمونهٔ متنی این کتاب هنوز اضافه نشده است.";
    info.appendChild(note);
  }

  layout.appendChild(cover);
  layout.appendChild(info);

  page.appendChild(back);
  page.appendChild(layout);
  return page;
}

/* ==========================================================================
   Library / login / fallback views
   ========================================================================== */

function buildLibraryView() {
  const books = state.ownedBooks
    .map((id) => BOOK_BY_ID.get(id))
    .filter(Boolean);

  const page = document.createElement("section");
  page.className = "page";

  const head = document.createElement("div");
  head.className = "page-head";

  const heading = document.createElement("h1");
  heading.textContent = "کتابخانه من";

  const lead = document.createElement("p");
  lead.className = "page-lead";
  lead.textContent = `${formatCount(books.length)} کتاب در کتابخانهٔ شما.`;

  head.appendChild(heading);
  head.appendChild(lead);
  page.appendChild(head);

  if (books.length === 0) {
    page.appendChild(
      createEmptyState(
        "کتابخانهٔ شما خالی است",
        "هنوز کتابی به کتابخانه اضافه نکرده‌اید. از فهرست کتاب‌ها شروع کنید و کتاب‌های دلخواهتان را نگه دارید.",
        "#catalog",
        "مرور فهرست کتاب‌ها"
      )
    );
  } else {
    page.appendChild(createBookGrid(books));
  }

  return page;
}

function buildLoginView() {
  const page = document.createElement("section");
  page.className = "page";

  const head = document.createElement("div");
  head.className = "page-head";

  const heading = document.createElement("h1");
  heading.textContent = "ورود / حساب کاربری";

  const lead = document.createElement("p");
  lead.className = "page-lead";
  lead.textContent = "حساب نمایشی برای نگه‌داشتن کتاب‌ها و علاقه‌مندی‌ها.";

  head.appendChild(heading);
  head.appendChild(lead);
  page.appendChild(head);

  const card = document.createElement("div");
  card.className = "account-card";

  if (state.user) {
    const name = document.createElement("p");
    name.className = "account-name";
    name.textContent = state.user.name;

    const phone = document.createElement("p");
    phone.className = "account-phone";
    phone.textContent = state.user.phone;

    const note = document.createElement("p");
    note.className = "account-note";
    note.textContent =
      "شما با حساب نمایشی وارد شده‌اید. کتابخانه و علاقه‌مندی‌ها روی همین مرورگر ذخیره می‌شوند.";

    card.appendChild(name);
    card.appendChild(phone);
    card.appendChild(note);
  } else {
    const title = document.createElement("h2");
    title.textContent = "هنوز وارد نشده‌اید";

    const note = document.createElement("p");
    note.className = "account-note";
    note.textContent =
      "این نسخهٔ نمایشی ورود واقعی ندارد؛ اما ساختار حساب کاربری و کتابخانهٔ شخصی آماده است. می‌توانید کتاب‌ها را مرور کنید و علاقه‌مندی‌هایتان را ذخیره کنید.";

    const link = document.createElement("a");
    link.className = "btn btn-primary";
    link.href = "#catalog";
    link.textContent = "مرور کتاب‌ها";

    card.appendChild(title);
    card.appendChild(note);
    card.appendChild(link);
  }

  page.appendChild(card);
  return page;
}

function buildReaderView(route) {
  const book = BOOK_BY_ID.get(route.bookId);
  const page = document.createElement("section");
  page.className = "page";

  const head = document.createElement("div");
  head.className = "page-head";

  const heading = document.createElement("h1");
  heading.textContent = book ? `خواندن نمونهٔ ${book.title}` : "خواندن نمونه";

  const lead = document.createElement("p");
  lead.className = "page-lead";
  lead.textContent =
    "نمونه‌خوان با تنظیمات اندازهٔ متن در مرحلهٔ بعدی تکمیل می‌شود.";

  head.appendChild(heading);
  head.appendChild(lead);

  const back = document.createElement("a");
  back.className = "back-link";
  back.href = book ? `#book/${encodeURIComponent(book.id)}` : "#catalog";
  back.textContent = book ? "← بازگشت به صفحهٔ کتاب" : "← بازگشت به فهرست کتاب‌ها";

  page.appendChild(back);
  page.appendChild(head);
  return page;
}

function buildNotFoundView() {
  const page = document.createElement("section");
  page.className = "page";

  const head = document.createElement("div");
  head.className = "page-head";

  const heading = document.createElement("h1");
  heading.textContent = "صفحه پیدا نشد";

  const lead = document.createElement("p");
  lead.className = "page-lead";
  lead.textContent =
    "نشانی واردشده معتبر نیست. می‌توانید به صفحهٔ اصلی برگردید و از آنجا ادامه دهید.";

  head.appendChild(heading);
  head.appendChild(lead);
  page.appendChild(head);
  page.appendChild(createEmptyState("چیزی برای نمایش نیست", "این مسیر وجود ندارد.", "#home", "بازگشت به خانه"));
  return page;
}

function buildView(route) {
  switch (route.name) {
    case "home":
      return buildHomeView();
    case "categories":
      return buildCategoriesView();
    case "catalog":
      return buildCatalogView(route);
    case "book":
      return buildBookDetailView(route);
    case "library":
      return buildLibraryView();
    case "login":
      return buildLoginView();
    case "reader":
      return buildReaderView(route);
    default:
      return buildNotFoundView();
  }
}

/* ==========================================================================
   Controls + boot
   ========================================================================== */

function handleReset() {
  resetState();
  navigate("home");
}

function initControls() {
  const themeToggle = document.getElementById("theme-toggle");
  const resetButton = document.getElementById("reset-state");
  const searchForm = document.getElementById("search-form");
  const searchInput = document.getElementById("search-input");

  if (themeToggle) {
    themeToggle.addEventListener("click", () => {
      setTheme(state.readingSettings.theme === "dark" ? "light" : "dark");
    });
  }

  if (resetButton) {
    resetButton.addEventListener("click", handleReset);
  }

  if (searchForm && searchInput) {
    searchForm.addEventListener("submit", (event) => {
      event.preventDefault();
      const query = searchInput.value.trim();

      if (parseRoute().name === "catalog") {
        applyCatalogState(
          { ...currentCatalogState(), q: query },
          { source: "header-search" }
        );
        return;
      }

      navigate(buildCatalogHash({ ...EMPTY_CATALOG_STATE, q: query }));
    });
  }

  if (searchInput) {
    searchInput.addEventListener("input", () => {
      const query = searchInput.value.trim();

      if (parseRoute().name === "catalog") {
        applyCatalogState(
          { ...currentCatalogState(), q: query },
          { source: "header-search" }
        );
        return;
      }

      if (!query) {
        return;
      }

      navigate(buildCatalogHash({ ...EMPTY_CATALOG_STATE, q: query }));
    });
  }
}

subscribe(() => {
  applyTheme();
  syncThemeControl();
  syncHeader();
  syncFavoriteButtons();
  syncStats();
});

initControls();
window.addEventListener("hashchange", () => {
  renderRoute({ focus: shouldFocusMain() });
});
renderRoute({ focus: false });
