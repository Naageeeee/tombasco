import { renderGrid as renderExistingGrid } from './cards.js';

export function renderGrid(container, products, options = {}) {
  renderExistingGrid(container, products, options);
  container.classList.add('pc-grid--compact');
  for (const card of container.querySelectorAll('.pc')) {
    compactCard(card);
  }
}

function compactCard(card) {
  const body = card.querySelector('.pc__body');
  const name = card.querySelector('.pc__name');
  const price = card.querySelector('.pc__price');
  const row = card.querySelector('.pc__row');
  const qty = card.querySelector('.pc__qty');
  const add = card.querySelector('.pc__add');
  if (!body || !name || !price || !row || !add) return;

  const heading = document.createElement('div');
  heading.className = 'pc-compact-heading';
  name.before(heading);
  heading.append(name, price);

  const size = createSizeSelect(card, name.textContent.trim());
  row.classList.add('pc-compact-controls');
  if (size) row.prepend(size);

  // Keep the existing quantity validation and prevent its dropdown shortcut.
  qty?.querySelector('.qty__input')?.addEventListener('keydown', event => {
    if (event.key === 'ArrowDown') event.stopImmediatePropagation();
  }, true);

  const addWrap = document.createElement('div');
  addWrap.className = 'pc-compact-add';
  const art = document.createElement('span');
  art.className = 'pc-compact-cart-icon';
  art.setAttribute('aria-hidden', 'true');
  art.innerHTML = `<span>+</span><svg class="icon" focusable="false">
    <use href="#i-cart"></use>
  </svg>`;

  addWrap.append(add, art);
  row.append(addWrap);
  card.classList.add('pc--compact');

  enableCompactPhotoPreview(card, name.textContent.trim());

  const quantityField = qty?.querySelector('.qty');
  if (size && quantityField) {
    function matchSizeWidth() {
      const width = size.getBoundingClientRect().width;
      if (width > 0) quantityField.style.setProperty('--compact-qty-width', `${width}px`);
    }

    matchSizeWidth();
    if ('ResizeObserver' in window) {
      new ResizeObserver(matchSizeWidth).observe(size);
    } else {
      size.addEventListener('change', matchSizeWidth);
    }
  }
}

function createSizeSelect(card, productName) {
  const oldPicker = card.querySelector('[data-sz]');
  const chips = [...(oldPicker?.querySelectorAll('.sz__chip') ?? [])];
  if (!chips.length) return null;

  const select = document.createElement('select');
  select.className = 'pc-compact-size';
  select.setAttribute('aria-label', `Size of ${productName}`);

  const picker = document.createElement('div');
  picker.className = 'pc-compact-size-picker';
  const measure = document.createElement('span');
  measure.className = 'pc-compact-size-measure';
  measure.setAttribute('aria-hidden', 'true');
  picker.innerHTML = `<svg class="icon pc-compact-size-chevron" aria-hidden="true" focusable="false">
    <use href="#i-chevron"></use>
  </svg>`;
  picker.prepend(measure, select);

  chips.forEach((chip, index) => {
    const option = document.createElement('option');
    option.value = String(index);
    option.textContent = readableSizeLabel(chip.textContent) || 'Standard';
    select.append(option);
  });

  function syncSelectedSize() {
    const index = chips.findIndex(chip => chip.getAttribute('aria-checked') === 'true');
    if (index >= 0) select.value = String(index);
    measure.textContent = select.selectedOptions[0]?.textContent ?? 'Size';
  }

  select.addEventListener('change', () => {
    chips[Number(select.value)]?.click();
    syncSelectedSize();
  });

  // The existing card updates the selected variant after an item is added.
  new MutationObserver(syncSelectedSize).observe(oldPicker, {
    subtree: true,
    attributes: true,
    attributeFilter: ['aria-checked']
  });

  syncSelectedSize();
  oldPicker.hidden = true;
  return picker;
}

function readableSizeLabel(label) {
  return label.trim()
    .replace(/(\d)?([¼½¾⅐⅑⅒⅓⅔⅕⅖⅗⅘⅙⅚⅛⅜⅝⅞])/g, (_, whole, fraction) => {
      const digits = fraction.normalize('NFKC');
      return whole ? `${whole} ${digits}` : digits;
    })
    .replace(/⁄/g, '/');
}



let photoPreview;
let photoPreviewTrigger;

function enableCompactPhotoPreview(card, name) {
  const photo = card.querySelector('.pc__photo');
  const image = photo?.querySelector('.pc__img');
  if (!image) return;

  const trigger = document.createElement('button');
  trigger.type = 'button';
  trigger.className = 'pc-compact-preview-trigger';
  trigger.setAttribute('aria-label', `Enlarge photo of ${name}`);
  trigger.setAttribute('aria-haspopup', 'dialog');

  function updateTrigger() {
    trigger.hidden = !image.naturalWidth;
  }

  trigger.addEventListener('click', () => {
    photoPreview ??= createCompactPhotoPreview();

    const { dialog, enlarged } = photoPreview;
    photoPreviewTrigger = trigger;
    enlarged.alt = image.alt || name;
    enlarged.src = image.currentSrc || image.src;
    dialog.setAttribute('aria-label', `Photo of ${name}`);
    if (!dialog.open) dialog.showModal();
  });

  image.addEventListener('load', updateTrigger);
  image.addEventListener('error', updateTrigger);
  updateTrigger();
  photo.append(trigger);
}


 function createCompactPhotoPreview() {
  const dialog = document.createElement('dialog');
  dialog.className = 'pc-image-preview';
  dialog.innerHTML = `
    <img class="pc-image-preview-photo" alt="">
    <button type="button" class="pc-image-preview-close" aria-label="Close photo preview" autofocus>
      <svg class="icon" aria-hidden="true"><use href="#i-close"></use></svg>
    </button>`;

  const closeButton = dialog.querySelector('.pc-image-preview-close');
  const closeIcon = closeButton.querySelector('.icon');
  let closeSpin;

  closeButton.addEventListener('click', () => {
    if (closeSpin) return;

    if (!closeIcon?.animate || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      dialog.close();
      return;
    }

    const current = getComputedStyle(closeIcon).transform;
    const start = current === 'none' ? 'rotate(0deg)' : current;
    closeSpin = closeIcon.animate([
      { transform: start },
      { transform: `${start} rotate(90deg)` }
    ], { duration: 180, easing: 'ease-out', fill: 'forwards' });
    closeSpin.onfinish = () => {
      if (dialog.open) dialog.close();
    };
  });
  dialog.addEventListener('click', event => {
    if (event.target === dialog) dialog.close();
  });
  dialog.addEventListener('close', () => {
    closeSpin?.cancel();
    closeSpin = null;
    if (photoPreviewTrigger?.isConnected) photoPreviewTrigger.focus({ preventScroll: true });
    photoPreviewTrigger = null;
  });

  document.body.append(dialog);
  return { dialog, enlarged: dialog.querySelector('.pc-image-preview-photo') };
}

