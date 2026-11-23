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

  const productName = name.textContent.trim();
  const size = createSizePicker(card, productName);
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

  enableCompactPhotoPreview(card, productName);
}

let sizePickerId = 0;

function createSizePicker(card, productName) {
  const oldPicker = card.querySelector('[data-sz]');
  const chips = [...(oldPicker?.querySelectorAll('.sz__chip') ?? [])];
  if (!chips.length) return null;

  const picker = document.createElement('div');
  picker.className = 'pc-compact-size-picker';
  picker.innerHTML = `
    <button class="pc-compact-size" type="button"
      aria-haspopup="listbox" aria-expanded="false"></button>
    <svg class="icon pc-compact-size-chevron" aria-hidden="true" focusable="false">
      <use href="#i-chevron"></use>
    </svg>
    <div class="pc-compact-size-menu" role="listbox" hidden></div>`;

  const trigger = picker.querySelector('button');
  const menu = picker.querySelector('[role="listbox"]');
  menu.id = `pc-size-menu-${++sizePickerId}`;
  menu.setAttribute('aria-label', `Sizes of ${productName}`);
  trigger.setAttribute('aria-controls', menu.id);

  const choices = chips.map(chip => {
    const button = document.createElement('button');
    button.className = 'pc-compact-size-option';
    button.setAttribute('role', 'option');
    button.type = 'button';
    button.tabIndex = -1;
    button.textContent = readableSizeLabel(chip.textContent) || 'Standard';
    menu.append(button);
    return button;
  });

  let selected = 0;

  function syncSelectedSize() {
    const index = chips.findIndex(chip => chip.getAttribute('aria-checked') === 'true');
    if (index >= 0) selected = index;
    const label = choices[selected].textContent;
    trigger.textContent = label;
    trigger.setAttribute('aria-label', `Size of ${productName}: ${label}`);
    choices.forEach((option, index) => option.setAttribute('aria-selected', String(index === selected)));
  }

  function closeMenu(restoreFocus = false) {
    if (menu.hidden) return;
    menu.hidden = true;
    trigger.setAttribute('aria-expanded', 'false');
    document.removeEventListener('pointerdown', dismissOutside);
    if (restoreFocus) trigger.focus({ preventScroll: true });
  }

  function dismissOutside(event) {
    if (!picker.contains(event.target)) closeMenu();
  }

  function openMenu() {
    menu.hidden = false;
    trigger.setAttribute('aria-expanded', 'true');
    document.addEventListener('pointerdown', dismissOutside);
    choices[selected].focus();
  }

  trigger.addEventListener('click', () => {
    if (menu.hidden) openMenu();
    else closeMenu(true);
  });

  choices.forEach((option, index) => {
    option.addEventListener('click', () => {
      chips[index].click();
      syncSelectedSize();
      closeMenu(true);
    });
  });

  picker.addEventListener('focusout', event => {
    if (!picker.contains(event.relatedTarget)) closeMenu();
  });

  picker.addEventListener('keydown', event => {
    if (menu.hidden) {
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault();
        openMenu();
      }
      return;
    }
    if (event.key === 'Escape') {
      event.preventDefault();
      closeMenu(true);
      return;
    }
    const index = choices.indexOf(document.activeElement);
    let next;
    if (event.key === 'ArrowDown') next = index >= 0 ? Math.min(index + 1, choices.length - 1) : selected;
    if (event.key === 'ArrowUp') next = index >= 0 ? Math.max(index - 1, 0) : selected;
    if (event.key === 'Home') next = 0;
    if (event.key === 'End') next = choices.length - 1;
    if (next === undefined) return;
    event.preventDefault();
    choices[next].focus();
  });

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

