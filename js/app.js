/**
 * Renders the library from BOOKS. Everything is built with
 * document.createElement and textContent only.
 */

const numberFormatter = new Intl.NumberFormat("fa-IR");
const ratingFormatter = new Intl.NumberFormat("fa-IR", {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1
});

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
    free: document.getElementById("stat-free"),
    samples: document.getElementById("stat-samples")
  };

  return {
    total: (value) => { nodes.total.textContent = numberFormatter.format(value); },
    categories: (value) => { nodes.categories.textContent = numberFormatter.format(value); },
    free: (value) => { nodes.free.textContent = numberFormatter.format(value); },
    samples: (value) => { nodes.samples.textContent = numberFormatter.format(value); }
  };
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
  update.free(freeCount);
  update.samples(sampleCount);
}

function renderBooks() {
  const grid = document.getElementById("book-grid");
  const fragment = document.createDocumentFragment();

  for (const book of BOOKS) {
    fragment.appendChild(createBookCard(book));
  }

  grid.appendChild(fragment);
}

renderSummary();
renderBooks();
