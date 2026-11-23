import { IMAGE_FOLDER } from './config.js';

const GAP = 8;
const FRAME = 24;

export const VARIANTS = {
  standard: { chip: 'auto', min: 76, flags: { tag: true, sale: true, qty: true } },
  pipe: { chip: 46, flags: { tag: true, sale: true, qty: true } }
};

const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
}[char]));

const fmt = value => Number(value).toLocaleString('en-GH', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2
});

const STOCK = {
  'In stock': 'ok',
  'Call to confirm': 'warn',
  'Out of stock': 'out'
};

function ensureIcons() {
  if (document.getElementById('pc-icon-symbols')) return;
  const sprite = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  sprite.id = 'pc-icon-symbols';
  sprite.setAttribute('aria-hidden', 'true');
  sprite.style.display = 'none';
  sprite.innerHTML = `
    <symbol id="pc-i-left" viewBox="0 0 24 24"><path d="m15 18-6-6 6-6"/></symbol>
    <symbol id="pc-i-right" viewBox="0 0 24 24"><path d="m9 18 6-6-6-6"/></symbol>
    <symbol id="pc-i-down" viewBox="0 0 24 24"><path d="m6 9 6 6 6-6"/></symbol>
    <symbol id="pc-i-check" viewBox="0 0 24 24"><path d="M20 6 9 17l-5-5"/></symbol>
  `;
  document.body.append(sprite);
}

const icon = (name, size) => `
  <svg width="${size}" height="${size}" viewBox="0 0 24 24"
    fill="none" stroke="currentColor" stroke-width="2"
    stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <use href="#pc-i-${name}"></use>
  </svg>`;

let canvasContext;
function textWidth(text) {
  canvasContext ||= document.createElement('canvas').getContext('2d');
  if (!canvasContext) return String(text).length * 9;
  canvasContext.font = '600 16px Inter, Arial, sans-serif';
  return canvasContext.measureText(text).width;
}

function imagePath(image, folder) {
  const path = String(image || '').trim();
  if (!path) return '';
  if (/^(?:https?:|data:|blob:|\/|\.\/|\.\.\/|assets\/)/i.test(path)) return path;
  return folder ? `${folder.replace(/\/?$/, '/')}${path}` : path;
}

function closeQuantityLists(except) {
  document.querySelectorAll('.qty__list').forEach(list => {
    if (list === except) return;
    list.hidden = true;
    list.parentElement.querySelector('.qty__btn')?.setAttribute('aria-expanded', 'false');
  });
}

let quantityCloseReady = false;
function wireQuantityClose() {
  if (quantityCloseReady) return;
  quantityCloseReady = true;
  document.addEventListener('click', event => {
    document.querySelectorAll('.qty__list:not([hidden])').forEach(list => {
      if (!list.parentElement.contains(event.target)) {
        list.hidden = true;
        list.parentElement.querySelector('.qty__btn')?.setAttribute('aria-expanded', 'false');
      }
    });
  });
}

export function createCard(product, options = {}) {
  ensureIcons();
  const type = product.cardType === 'pipe' ? 'pipe' : 'standard';
  const config = VARIANTS[type];
  const labels = product.variants.map(variant => variant.size);
  const hasSizes = type !== 'pipe' && labels.some(Boolean);
  const image = imagePath(product.image, options.imageFolder ?? IMAGE_FOLDER);
  const state = { index: 0, page: 0, maxPage: 0, visibleCount: labels.length, pageWidth: 0, paged: false };

  const card = document.createElement('article');
  card.className = `pc pc--${type}`;
  card.dataset.product = product.id;
  card.innerHTML = `
    ${config.flags.tag ? '<span class="pc__tag" data-tag></span>' : ''}
    ${config.flags.sale ? '<span class="pc__sale" data-sale hidden></span>' : ''}
    <div class="pc__photo">
      ${image ? `<img class="pc__img" src="${esc(image)}" alt="${esc(product.name)}" loading="lazy" decoding="async">` : ''}
    </div>
    <div class="pc__body">
      <h3 class="pc__name">${esc(product.name)}</h3>
      ${hasSizes ? `
        <div class="sz" data-sz>
          <button type="button" class="sz__nav sz__nav--prev" aria-label="Show previous sizes">${icon('left', 24)}</button>
          <div class="sz__view">
            <div class="sz__track" role="radiogroup" aria-label="Size of ${esc(product.name)}">
              ${labels.map((label, index) => `
                <button type="button" class="sz__chip" role="radio" aria-checked="false" data-i="${index}">${esc(label)}</button>
              `).join('')}
            </div>
          </div>
          <button type="button" class="sz__nav sz__nav--next" aria-label="Show more sizes">${icon('right', 24)}</button>
        </div>` : ''}
      <div class="pc__row">
        <div class="pc__price" data-price></div>
        ${config.flags.qty ? `
          <div class="pc__qty">
            <span class="pc__qty-label">Qty:</span>
            <div class="qty">
              <input class="qty__input" inputmode="numeric" maxlength="4" value="1" aria-label="Quantity" autocomplete="off">
              <button type="button" class="qty__btn" aria-label="Choose quantity from list" aria-haspopup="listbox" aria-expanded="false">${icon('down', 16)}</button>
              <ul class="qty__list" role="listbox" hidden>
                ${Array.from({ length: 10 }, (_, index) => `<li role="option" data-n="${index + 1}">${index + 1}</li>`).join('')}
                <li role="option" data-custom="true">Custom</li>
              </ul>
            </div>
          </div>` : ''}
      </div>
      <button type="button" class="pc__add">+ Add to cart</button>
      <span class="sr-only" role="status" aria-live="polite" data-live></span>
    </div>`;

  const find = selector => card.querySelector(selector);
  const photo = find('.pc__photo');
  const tag = find('[data-tag]');
  const sale = find('[data-sale]');
  const price = find('[data-price]');
  const addButton = find('.pc__add');
  const live = find('[data-live]');
  const sizeBox = find('[data-sz]');
  const sizeTrack = find('.sz__track');
  const sizeView = find('.sz__view');
  const previousButton = find('.sz__nav--prev');
  const nextButton = find('.sz__nav--next');
  const chips = [...card.querySelectorAll('.sz__chip')];
  const quantityInput = find('.qty__input');
  const quantityButton = find('.qty__btn');
  const quantityList = find('.qty__list');
  const currentVariant = () => product.variants[state.index];
  let custom = false;
  let customTimer;

  if (!image) photo.classList.add('is-empty');
  find('.pc__img')?.addEventListener('error', () => photo.classList.add('is-empty'));

  function renderCard() {
    const variant = currentVariant();
    chips.forEach((chip, index) => {
      const selected = index === state.index;
      chip.classList.toggle('is-on', selected);
      chip.setAttribute('aria-checked', String(selected));
      chip.tabIndex = selected ? 0 : -1;
    });
    if (tag) {
      tag.textContent = variant.stock;
      tag.className = `pc__tag pc__tag--${STOCK[variant.stock] || 'ok'}`;
    }
    if (sale) {
      const show = variant.onSale && variant.pct > 0;
      sale.hidden = !show;
      sale.textContent = show ? `-${variant.pct}%` : '';
    }
    if (variant.current == null) {
      price.innerHTML = '<span class="pc__ask">Ask for price</span>';
    } else if (variant.onSale && variant.price != null && variant.current < variant.price) {
      price.innerHTML = `<strong>GH₵</strong><s>${fmt(variant.price)}</s><strong>${fmt(variant.current)}</strong>`;
    } else {
      price.innerHTML = `<strong>GH₵ ${fmt(variant.current)}</strong>`;
    }
    const out = variant.stock === 'Out of stock';
    addButton.disabled = out;
    addButton.textContent = out ? 'Unavailable' : '+ Add to cart';
    addButton.classList.remove('is-added');
  }

  function applySizePage(animate = true) {
    if (!sizeTrack) return;
    sizeTrack.style.transition = animate ? '' : 'none';
    sizeTrack.style.transform = `translateX(${-state.page * state.pageWidth}px)`;
    if (!animate) {
      void sizeTrack.offsetWidth;
      sizeTrack.style.transition = '';
    }
    const first = state.page <= 0;
    const last = state.page >= state.maxPage;
    previousButton.classList.toggle('is-off', first);
    previousButton.disabled = first;
    nextButton.classList.toggle('is-off', last);
    nextButton.disabled = last;
  }

  function layoutSizes() {
    if (!sizeBox || !sizeBox.clientWidth) return;
    const width = sizeBox.clientWidth;
    const count = chips.length;
    const chipSize = config.chip === 'auto'
      ? Math.max(config.min || 0, Math.ceil(Math.max(...labels.map(textWidth))) + 24)
      : config.chip;
    let paged = count * chipSize + (count - 1) * GAP > width;
    let visible = count;
    let gap = GAP;
    if (paged) {
      const available = width - 2 * FRAME - 2 * GAP;
      visible = Math.max(1, Math.floor((available + GAP) / (chipSize + GAP)));
      gap = visible > 1 ? Math.min(16, Math.max(GAP, (available - visible * chipSize) / (visible - 1))) : 0;
      if (visible >= count) { paged = false; visible = count; gap = GAP; }
    }
    Object.assign(state, {
      paged, visibleCount: visible, pageWidth: visible * (chipSize + gap),
      maxPage: paged ? Math.ceil(count / visible) - 1 : 0
    });
    state.page = Math.min(state.page, state.maxPage);
    sizeBox.style.setProperty('--chip', `${chipSize}px`);
    sizeBox.style.setProperty('--g', `${gap}px`);
    sizeBox.style.setProperty('--view', `${visible * chipSize + (visible - 1) * gap}px`);
    sizeBox.classList.toggle('is-paged', paged);
    applySizePage(false);
    sizeBox.classList.add('is-ready');
  }

  function showSizePage(index) {
    if (!state.paged) return;
    state.page = Math.floor(index / state.visibleCount);
    applySizePage();
  }

  function chooseSize(index, focus = false) {
    state.index = index;
    renderCard();
    showSizePage(index);
    if (focus) chips[index].focus();
  }

  function moveSizePage(direction) {
    state.page = Math.max(0, Math.min(state.maxPage, state.page + direction));
    applySizePage();
  }

  if (hasSizes) {
    previousButton.addEventListener('click', () => moveSizePage(-1));
    nextButton.addEventListener('click', () => moveSizePage(1));
    chips.forEach((chip, index) => {
      chip.addEventListener('click', () => chooseSize(index));
      chip.addEventListener('focus', () => showSizePage(index));
      chip.addEventListener('keydown', event => {
        if (['ArrowRight', 'ArrowDown'].includes(event.key)) {
          event.preventDefault(); chooseSize(Math.min(chips.length - 1, index + 1), true);
        }
        if (['ArrowLeft', 'ArrowUp'].includes(event.key)) {
          event.preventDefault(); chooseSize(Math.max(0, index - 1), true);
        }
      });
    });

    let dragging = false;
    let startX = 0;
    let distance = 0;
    let moved = false;
    sizeView.addEventListener('pointerdown', event => {
      if (!state.paged || (event.pointerType === 'mouse' && event.button !== 0)) return;
      dragging = true; moved = false; startX = event.clientX; distance = 0;
      sizeTrack.style.transition = 'none';
      window.addEventListener('pointermove', onMove);
      window.addEventListener('pointerup', onUp);
      window.addEventListener('pointercancel', onUp);
    });
    function onMove(event) {
      distance = event.clientX - startX;
      if (Math.abs(distance) > 5) moved = true;
      const edge = (state.page === 0 && distance > 0) || (state.page === state.maxPage && distance < 0);
      sizeTrack.style.transform = `translateX(${-state.page * state.pageWidth + (edge ? distance / 3 : distance)}px)`;
    }
    function onUp() {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
      if (!dragging) return;
      dragging = false;
      sizeTrack.style.transition = '';
      if (Math.abs(distance) > state.pageWidth * 0.2) moveSizePage(distance < 0 ? 1 : -1);
      else applySizePage();
    }
    sizeView.addEventListener('click', event => {
      if (moved) { event.preventDefault(); event.stopPropagation(); moved = false; }
    }, true);

    if ('ResizeObserver' in window) {
      new ResizeObserver(() => requestAnimationFrame(layoutSizes)).observe(sizeBox);
    } else {
      window.addEventListener('resize', layoutSizes);
    }
  }

  function closeQuantityList() {
    if (!quantityList) return;
    quantityList.hidden = true;
    quantityButton.setAttribute('aria-expanded', 'false');
  }

  function resetQuantity() {
    clearTimeout(customTimer);
    custom = false;
    if (!quantityInput) return;
    quantityInput.value = '1';
    quantityInput.placeholder = '';
    quantityButton.hidden = false;
    closeQuantityList();
  }

  function restartCustomTimer() {
    clearTimeout(customTimer);
    if (custom && Number(quantityInput.value) > 0) {
      customTimer = setTimeout(resetQuantity, 5000);
    }
  }

  function openQuantityList() {
    closeQuantityLists(quantityList);
    quantityList.hidden = false;
    quantityButton.setAttribute('aria-expanded', 'true');
  }

  if (quantityInput) {
    wireQuantityClose();
    quantityInput.addEventListener('click', () => {
      if (custom) { openQuantityList(); restartCustomTimer(); }
    });
    quantityInput.addEventListener('input', () => {
      quantityInput.value = quantityInput.value.replace(/\D/g, '').slice(0, 4);
      if (quantityInput.value !== '' && Number(quantityInput.value) === 0) {
        resetQuantity(); return;
      }
      closeQuantityList();
      restartCustomTimer();
    });
    quantityInput.addEventListener('blur', () => {
      if (!quantityInput.value || Number(quantityInput.value) === 0) resetQuantity();
    });
    quantityButton.addEventListener('click', event => {
      event.stopPropagation();
      if (quantityList.hidden) openQuantityList();
      else closeQuantityList();
    });
    // Keep the input focused while choosing an option, so blur cannot erase it first.
    quantityList.addEventListener('pointerdown', event => event.preventDefault());
    quantityList.addEventListener('click', event => {
      const option = event.target.closest('li');
      if (!option) return;
      clearTimeout(customTimer);
      closeQuantityList();
      if (option.dataset.custom === 'true') {
        custom = true;
        quantityInput.value = '';
        quantityInput.placeholder = '';
        quantityButton.hidden = true;
      } else {
        custom = false;
        quantityInput.value = option.dataset.n;
        quantityButton.hidden = false;
      }
      quantityInput.focus();
    });
    quantityInput.addEventListener('keydown', event => {
      if (event.key === 'ArrowDown') {
        event.preventDefault(); openQuantityList();
      }
    });
    card.addEventListener('keydown', event => {
      if (event.key === 'Escape' && !quantityList.hidden) {
        event.preventDefault(); closeQuantityList(); quantityInput.focus();
      }
    });
  }

  addButton.addEventListener('click', () => {
    const variant = currentVariant();
    if (variant.stock === 'Out of stock' || addButton.disabled) return;
    clearTimeout(customTimer);
    const quantity = Math.max(1, Math.min(9999, parseInt(quantityInput?.value || '1', 10) || 1));
    const item = {
      id: product.id, name: product.name, size: variant.size, unit: variant.unit,
      qty: quantity, price: variant.current, regularPrice: variant.price,
      image: product.image, type: product.type, stock: variant.stock
    };
    options.onAdd?.(item);
    document.dispatchEvent(new CustomEvent('cart:add', { detail: item }));
    closeQuantityList();
    addButton.classList.add('is-added');
    addButton.innerHTML = `${icon('check', 20)}<span>Added</span>`;
    addButton.disabled = true;
    live.textContent = `${quantity} × ${product.name}${variant.size ? ` ${variant.size}` : ''} added to cart`;
    setTimeout(() => {
      state.index = 0;
      state.page = 0;
      resetQuantity();
      if (hasSizes) applySizePage(false);
      renderCard();
      live.textContent = '';
    }, 1600);
  });

  renderCard();
  requestAnimationFrame(() => { if (hasSizes) layoutSizes(); });
  return card;
}

export function renderGrid(container, products, options = {}) {
  container.classList.add('pc-grid');
  container.replaceChildren(...products.map(product => createCard(product, options)));
}
