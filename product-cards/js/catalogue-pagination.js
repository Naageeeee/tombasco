import { renderGrid as renderCompactGrid } from './compact-cards.js';

const pagers = new WeakMap();

export function renderGrid(grid, products, options = {}) {
  if (!pagers.has(grid)) pagers.set(grid, createPager(grid));
  pagers.get(grid)(products, options);
}

function createPager(grid) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'btn-primary catalogue-load-more';
  button.textContent = 'Load more';
  button.setAttribute('aria-controls', grid.id);
  button.hidden = true;
  grid.after(button);

  let products = [];
  let cardOptions = {};
  let cards = [];
  let visibleCount = 0;
  let expanded = false;
  let columns = 1;

  function batchSizes() {
    return columns <= 3
      ? { first: 12, more: 12 }
      : { first: 4 * columns, more: 2 * columns };
  }

  function showCount(limit) {
    const nextCount = Math.min(limit, products.length);
    if (nextCount > cards.length) {
      const batch = document.createElement('div');
      renderCompactGrid(batch, products.slice(cards.length, nextCount), cardOptions);
      cards.push(...batch.children);
    }

    if (nextCount > visibleCount) {
      grid.append(...cards.slice(visibleCount, nextCount));
    }
    while (visibleCount > nextCount) {
      grid.lastElementChild.remove();
      visibleCount -= 1;
    }

    visibleCount = nextCount;
    button.hidden = visibleCount >= products.length;
  }

  function syncGrid() {
    if (!products.length) return;

    const style = getComputedStyle(grid);
    const minimum = parseFloat(style.getPropertyValue('--compact-card-min')) || 240;
    const gap = parseFloat(style.columnGap) || 0;
    const width = grid.getBoundingClientRect().width;
    columns = Math.max(1, Math.floor((width + gap) / (minimum + gap)));

    if (grid.dataset.columns !== String(columns)) {
      grid.dataset.columns = String(columns);
      grid.style.setProperty('--compact-columns', String(columns));
    }

    if (!expanded) showCount(batchSizes().first);
  }

  button.addEventListener('click', event => {
    if (button.hidden) return;

    const firstNewCard = visibleCount;
    expanded = true;
    showCount(visibleCount + batchSizes().more);

    if (event.detail === 0 || (button.hidden && document.activeElement === button)) {
      const card = cards[firstNewCard];
      card.tabIndex = -1;
      card.focus({ preventScroll: true });
    }
  });

  window.addEventListener('scroll', () => {
    if (!expanded || window.scrollY > 1) return;
    expanded = false;
    syncGrid();
  }, { passive: true });

  new ResizeObserver(syncGrid).observe(grid);

  return (nextProducts, nextOptions) => {
    products = nextProducts;
    cardOptions = nextOptions;
    cards = [];
    visibleCount = 0;
    expanded = false;
    grid.replaceChildren();
    button.hidden = true;

    if (products.length) {
      grid.classList.add('pc-grid', 'pc-grid--compact');
      syncGrid();
    }
  };
}
