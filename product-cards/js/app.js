import { SHEET_URLS, SAMPLE_URLS, IMAGE_FOLDER, FREE_DELIVERY_TARGET, ORDER_ENDPOINT } from './config.js';
import { loadCatalogue } from './sheet.js';
import { renderGrid } from './catalogue-pagination.js';
import { Cart } from './cart.js';
import { CHECKOUT_LOADER_MS, setCheckoutButtonBusy } from './checkout-loading.js';

const $ = id => document.getElementById(id);
const urls = SHEET_URLS.products && SHEET_URLS.categories ? SHEET_URLS : SAMPLE_URLS;
const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
}[char]));
const money = value => `GH₵ ${Number(value || 0).toLocaleString('en-GH', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2
})}`;

function updateCount() {
  const count = Cart.count();
  document.querySelectorAll('.cart-count, [data-cart-count]').forEach(badge => {
    badge.textContent = count;
    badge.hidden = count === 0;
  });
  document.querySelectorAll('.cart-btn, .float-cart').forEach(button => {
    button.setAttribute('aria-label', count ? `Cart, ${count} items` : 'Cart, empty');
  });
}

document.addEventListener('cart:change', updateCount);
updateCount();

let toastTimer;
let toastScrollHandler;

function hideCartToast() {
  clearTimeout(toastTimer);

  if (toastScrollHandler) {
    window.removeEventListener('scroll', toastScrollHandler);
    toastScrollHandler = null;
  }

  const toast = $('cart-toast');
  if (toast) toast.hidden = true;
}

function showCartToast(item) {
  const toast = $('cart-toast');
  const label = $('cart-toast-item');

  if (!toast || !label) return;

  hideCartToast();

  label.textContent = [item.name, item.size, `Qty ${item.qty}`]
    .filter(Boolean)
    .join(' · ');

  const alreadyScrolled = document.body.classList.contains('scrolled');

  if (!alreadyScrolled) {
    toast.style.top = '128px';
  } else if (window.matchMedia('(max-width: 650px)').matches) {
    toast.style.top = '72px';
  } else {
    toast.style.top = '16px';
  }

  toast.hidden = false;
  toastTimer = setTimeout(hideCartToast, 5000);

  toastScrollHandler = hideCartToast;
  window.addEventListener('scroll', toastScrollHandler, {
    once: true,
    passive: true
  });
}

function skeleton(count = 6) {
  const grid = $('grid');
  if (!grid) return;
  grid.className = 'pc-grid';
  grid.innerHTML = Array.from({ length: count }, () => `
    <div class="pc-sk">
      <div style="height:256px"></div>
      <div style="height:200px"></div>
    </div>`).join('');
}

function buildNav(categories, select, first) {
  const nav = $('nav');
  if (!nav) return () => {};
  nav.innerHTML = categories.map(category => `
    <details${category.types.some(type => type.name === first) ? ' open' : ''}>
      <summary class="sl">
        ${esc(category.name)}
        <svg class="icon chev" aria-hidden="true"><use href="#i-chevron"></use></svg>
      </summary>
      <div class="sub-list">
        ${category.types.map(type => `
          <a href="#${encodeURIComponent(type.name)}"
            data-type="${esc(type.name)}"
            class="sub-link${type.name === first ? ' active' : ''}">${esc(type.name)}</a>
        `).join('')}
      </div>
    </details>`).join('');

  const groups = [...nav.querySelectorAll('details')];
  let extraOpen = null;
  const selectedGroup = () => nav.querySelector('a.active')?.closest('details');

  function syncGroups() {
    const selected = selectedGroup();
    if (extraOpen === selected || !extraOpen?.open) extraOpen = null;
    groups.forEach(group => {
      group.open = group === selected || group === extraOpen;
    });
  }

  groups.forEach(group => {
    group.addEventListener('toggle', () => {
      const selected = selectedGroup();
      if (group === selected) {
        if (!group.open) group.open = true;
        return;
      }
      if (group.open) {
        extraOpen = group;
        groups.forEach(other => {
          if (other !== selected && other !== group) other.open = false;
        });
      } else if (extraOpen === group) {
        extraOpen = null;
      }
    });
  });

  nav.addEventListener('click', event => {
    const link = event.target.closest('a[data-type]');
    if (!link || !nav.contains(link)) return;
    event.preventDefault();
    select(link.dataset.type);
    syncGroups();
    document.querySelectorAll('.pill .pill-label').forEach(label => {
      label.textContent = link.textContent.trim();
    });
    document.querySelectorAll('.pill').forEach(pill => pill.setAttribute('aria-expanded', 'false'));
    document.querySelector('.category-popup')?.setAttribute('hidden', '');
    document.querySelector('.category-popup-overlay')?.setAttribute('hidden', '');
    document.body.classList.remove('category-popup-open');
    $('top')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    history.replaceState(null, '', link.getAttribute('href'));
  });

  return syncGroups;
}

function cartImagePath(image) {
  const path = String(image || '').trim();
  if (!path) return '';
  if (/^(?:https?:|data:|blob:|\/|\.\/|\.\.\/|assets\/)/i.test(path)) return path;
  return IMAGE_FOLDER ? `${IMAGE_FOLDER.replace(/\/?$/, '/')}${path}` : path;
}

function updateDeliveryProgress(subtotal) {
  const target = FREE_DELIVERY_TARGET;
  const progress = Math.min(100, Math.max(0, subtotal / target * 100));
  const remaining = Math.max(0, target - subtotal);
  const fill = $('delivery-progress-fill');
  const percent = $('delivery-progress-percent');
  const message = $('delivery-progress-message') ||
    fill?.closest('.delivery-progress')?.querySelector('.delivery-progress-label span');

  if (fill) {
    fill.style.width = `${progress}%`;
    const track = fill.parentElement;
    track.setAttribute('role', 'progressbar');
    track.setAttribute('aria-label', 'Progress toward free delivery');
    track.setAttribute('aria-valuemin', '0');
    track.setAttribute('aria-valuemax', '100');
    track.setAttribute('aria-valuenow', String(Math.round(progress)));
  }
  if (percent) percent.textContent = `${Math.round(progress)}%`;
  if (message) {
    message.textContent = remaining > 0
      ? `Add ${money(remaining)} more for free delivery`
      : 'You qualify for free delivery';
  }
}

function setupCart() {
  const panel = $('cart-panel');
  const overlay = $('cart-overlay');
  const itemsBox = $('cart-items');
  const emptyBox = $('cart-empty');
  const footer = $('cart-footer');
  const checkoutPanel = $('checkout-panel');
  const checkoutButton = $('cart-checkout');
  if (!panel || !overlay || !itemsBox) return;

  function renderCart() {
    const items = Cart.get();
    const subtotal = items.reduce((total, item) => total + Number(item.price || 0) * Number(item.qty), 0);
    if ($('cart-total-items')) $('cart-total-items').textContent = Cart.count();
    if ($('cart-subtotal')) $('cart-subtotal').textContent = money(subtotal);
    updateDeliveryProgress(subtotal);
    itemsBox.hidden = items.length === 0;
    if (emptyBox) emptyBox.hidden = items.length > 0;
    if (footer) {
  footer.hidden = items.length === 0;
  footer.style.display = items.length === 0 ? 'none' : 'grid';
}

    itemsBox.innerHTML = items.map(item => {
      const image = cartImagePath(item.image);
      const key = esc(encodeURIComponent(item.key));
      const size = item.size ? `Size: ${item.size} · ` : '';
      return `
        <div class="cart-row" data-key="${key}">
          <div class="cart-photo">
            ${image ? `<img src="${esc(image)}" alt="${esc(item.name)}">` : '<span>Photo</span>'}
          </div>
          <div class="cart-info">
            <strong>${esc(item.name)}</strong>
            <span>${esc(size)}${item.price == null ? 'Ask for price' : money(item.price)}</span>
            <div class="cart-controls">
              <button type="button" class="cart-minus" aria-label="Decrease quantity of ${esc(item.name)}">−</button>
              <span>${Number(item.qty)}</span>
              <button type="button" class="cart-plus" aria-label="Increase quantity of ${esc(item.name)}">+</button>
            </div>
          </div>
          <button type="button" class="cart-remove" aria-label="Remove ${esc(item.name)}">
            <svg class="icon" aria-hidden="true"><use href="#i-delete"></use></svg>
          </button>
        </div>`;
    }).join('');
  }

  let previousFocus;
  let checkoutTimer;

  function stopOpeningCheckout() {
    if (checkoutTimer === undefined) return;
    clearTimeout(checkoutTimer);
    checkoutTimer = undefined;
    setCheckoutButtonBusy(checkoutButton, false);
  }

  function openCart() {
    stopOpeningCheckout();
    previousFocus = document.activeElement;
    hideCartToast();
    renderCart();
    if (checkoutPanel) checkoutPanel.hidden = true;
    panel.hidden = false;
    overlay.hidden = false;
  }

  function closePanels() {
    stopOpeningCheckout();
    panel.hidden = true;
    if (checkoutPanel) checkoutPanel.hidden = true;
    overlay.hidden = true;
    if (previousFocus instanceof HTMLElement) previousFocus.focus({ preventScroll: true });
  }

  document.querySelectorAll('.cart-btn, .float-cart').forEach(button => {
    button.addEventListener('click', openCart);
  });
  $('cart-close')?.addEventListener('click', closePanels);
  $('cart-browse')?.addEventListener('click', closePanels);
  overlay.addEventListener('click', closePanels);
  $('checkout-close')?.addEventListener('click', closePanels);
  $('checkout-back')?.addEventListener('click', openCart);

  checkoutButton?.addEventListener('click', () => {
    if (!checkoutPanel || panel.hidden || !Cart.count() || checkoutButton.disabled) return;
    hideCartToast();
    setCheckoutButtonBusy(checkoutButton, true);

    checkoutTimer = setTimeout(() => {
      stopOpeningCheckout();
      if (panel.hidden || !Cart.count()) return;

      panel.hidden = true;
      overlay.hidden = false;
      checkoutPanel.hidden = false;
      checkoutPanel.dispatchEvent(new Event('checkout:opened'));
    }, CHECKOUT_LOADER_MS);
  });

  $('toast-view-cart')?.addEventListener('click', openCart);
  $('toast-keep-shopping')?.addEventListener('click', hideCartToast);

  itemsBox.addEventListener('click', event => {
    const button = event.target.closest('button');
    const row = button?.closest('.cart-row');
    if (!button || !row) return;
    event.preventDefault();
    const key = decodeURIComponent(row.dataset.key);
    const item = Cart.get().find(cartItem => cartItem.key === key);
    if (!item) return;
    if (button.classList.contains('cart-minus')) {
      Cart.update(key, Number(item.qty) - 1);
    } else if (button.classList.contains('cart-plus')) {
      Cart.update(key, Number(item.qty) + 1);
    } else if (button.classList.contains('cart-remove')) {
      Cart.remove(key);
    }
  });

  document.addEventListener('keydown', event => {
    if (event.key !== 'Escape') return;

    if (checkoutPanel && !checkoutPanel.hidden) {
      $('checkout-close')?.click();
    } else if (!panel.hidden) {
      closePanels();
    }
  });
  document.addEventListener('cart:change', renderCart);
  renderCart();
}

function setupOrderSubmission() {
  let isSubmitting = false;
  let submissionStartedAt;
  let timeoutId;
  let responseFrame;
  let messageHandler;

  function finishSubmission(eventName, detail) {
    clearTimeout(timeoutId);
    if (messageHandler) window.removeEventListener('message', messageHandler);
    responseFrame?.remove();
    responseFrame = null;
    messageHandler = null;
    const publishResult = () => {
      isSubmitting = false;
      document.dispatchEvent(new CustomEvent(eventName, { detail }));
    };
    const remaining = CHECKOUT_LOADER_MS - (performance.now() - submissionStartedAt);
    if (remaining > 0) setTimeout(publishResult, remaining);
    else publishResult();
  }

  document.addEventListener('checkout:payment-submitted', event => {
    const orderId = event.detail?.orderId;
    if (isSubmitting) {
      document.dispatchEvent(new CustomEvent('checkout:order-save-failed', {
        detail: { orderId, message: 'Your previous order is still sending. Please wait before trying again.' }
      }));
      return;
    }

    isSubmitting = true;
    submissionStartedAt = performance.now();

    if (!ORDER_ENDPOINT || !ORDER_ENDPOINT.endsWith('/exec')) {
      finishSubmission('checkout:order-save-failed', {
        orderId,
        message: 'The order endpoint is not set up yet. Please call us.'
      });
      return;
    }

    const requestId = window.crypto?.randomUUID
      ? window.crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

    responseFrame = document.createElement('iframe');
    responseFrame.name = `tb-order-response-${Date.now()}`;
    responseFrame.title = 'Order submission response';
    responseFrame.hidden = true;
    document.body.appendChild(responseFrame);

    const submissionForm = document.createElement('form');
    submissionForm.method = 'POST';
    submissionForm.action = ORDER_ENDPOINT;
    submissionForm.target = responseFrame.name;
    submissionForm.hidden = true;

    const payloadInput = document.createElement('input');
    payloadInput.type = 'hidden';
    payloadInput.name = 'payload';
    payloadInput.value = JSON.stringify({ ...event.detail, requestId });
    submissionForm.appendChild(payloadInput);
    document.body.appendChild(submissionForm);

    messageHandler = messageEvent => {
      const reply = messageEvent.data;
      if (
        !reply ||
        reply.type !== 'tb-order-result' ||
        reply.requestId !== requestId
      ) return;

      finishSubmission(
        reply.ok ? 'checkout:order-saved' : 'checkout:order-save-failed',
        {
          orderId: reply.orderId || orderId || '',
          message: reply.message || ''
        }
      );
    };
    window.addEventListener('message', messageHandler);

    timeoutId = setTimeout(() => {
      finishSubmission('checkout:order-save-failed', {
        orderId,
        message: 'We could not confirm the order was saved. Please try again or call us.'
      });
    }, 30000);

    try {
      submissionForm.submit();
    } catch (error) {
      finishSubmission('checkout:order-save-failed', {
        orderId,
        message: 'We could not send the order. Please try again or call us.'
      });
    } finally {
      submissionForm.remove();
    }
  });
}

hideCartToast();
setupCart();
setupOrderSubmission();

const catalogueEntry = new URL(window.location.href);
const searchFromLink = catalogueEntry.searchParams.get('q');
const catalogueSearch = document.getElementById('catalog-search');

if (catalogueSearch && searchFromLink !== null) {
  catalogueSearch.value = searchFromLink.trim();
}

if (catalogueEntry.searchParams.get('cart') === '1') {
  catalogueEntry.searchParams.delete('cart');
  window.history.replaceState(window.history.state, '', catalogueEntry);
  document.querySelector('.header .cart-btn')?.click();
}

(async function init() {
  if (!$('grid') || !$('nav')) return;
  skeleton();
  let data;
  try {
    ({ data } = await loadCatalogue({ ...urls, settings: '' }));
  } catch (error) {
    if ($('title')) $('title').textContent = 'Products';
    $('grid').className = '';
    $('grid').innerHTML = '<div class="demo-error">We could not load the products. Please check your connection and try again.</div>';
    console.error('Could not load the catalogue:', error);
    return;
  }

  const { products, categories } = data;
  const allTypes = categories.flatMap(category =>
    category.types.map(type => ({ ...type, category: category.name }))
  );
  let start = '';
  try { start = decodeURIComponent(location.hash.slice(1)); } catch (error) {}
  const firstWithProducts = allTypes.find(type => products.some(product => product.type === type.name));
  let current = allTypes.some(type => type.name === start)
    ? start
    : (firstWithProducts || allTypes[0] || {}).name;

  function show(typeName) {
    current = typeName;
    const type = allTypes.find(item => item.name === typeName) || { name: typeName || 'Products', description: '' };
    if ($('title')) $('title').textContent = type.name;
    if ($('blurb')) $('blurb').textContent = type.description;
    $('nav').querySelectorAll('a[data-type]').forEach(link => {
      link.classList.toggle('active', link.dataset.type === typeName);
    });
    document.querySelectorAll('.pill .pill-label').forEach(label => { label.textContent = type.name; });

    const query = $('catalog-search')?.value.trim().toLowerCase() || '';
    const matchesSearch = product => [
      product.name, product.category, product.type, product.searchWords,
      ...product.variants.map(variant => `${variant.size} ${variant.unit}`)
    ].join(' ').toLowerCase().includes(query);
    const list = query ? products.filter(matchesSearch) : products.filter(product => product.type === typeName);
    if (!list.length) {
      renderGrid($('grid'), []);
      $('grid').className = '';
      $('grid').innerHTML = query
        ? `<div class="demo-empty">No products found for “${esc(query)}”.</div>`
        : `<div class="demo-empty">No products in ${esc(type.name)} yet.</div>`;
      return;
    }
    renderGrid($('grid'), list, {
      onAdd: item => { Cart.add(item); showCartToast(item); }
    });
  }

  buildNav(categories, show, current);
  $('catalog-search')?.addEventListener('input', () => show(current));
  show(current);
})();
