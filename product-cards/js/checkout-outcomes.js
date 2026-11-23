// Use this entire file as product-cards/js/checkout-outcomes.js.

import { Cart } from './cart.js';
import { FREE_DELIVERY_TARGET } from './config.js';

function connectCheckoutOutcomes() {
  const panel = document.getElementById('checkout-panel');

  if (
    !panel?.querySelector('#checkout-outcome-failed') ||
    !panel.querySelector('#checkout-outcome-received') ||
    !panel.querySelector('#checkout-outcome-copy-order-number')
  ) return;

  installPaymentFreeDeliveryNotice(panel);
  const screens = createCheckoutOutcomeScreens(panel);


  // Temporary local preview. Remove this block after reviewing the screens.
const previewUrl = new URL(window.location.href);
const previewHost = previewUrl.hostname;
const privateAddress =
  /^\d{1,3}(?:\.\d{1,3}){3}$/.test(previewHost) &&
  /^(?:127\.|10\.|192\.168\.|172\.(?:1[6-9]|2\d|3[01])\.)/.test(previewHost);

const localPreview =
  previewUrl.searchParams.get('checkout-preview') === '1' &&
  (previewHost === 'localhost' || previewHost === '[::1]' || privateAddress);

if (localPreview) {
  const overlay = document.getElementById('cart-overlay');
  const toolbar = document.createElement('div');
  toolbar.style.cssText =
    'display:flex; flex:none; flex-wrap:wrap; align-items:center; gap:6px; padding:8px 12px; background:#f6feff; border-bottom:1px solid #dbe3ea;';
  toolbar.setAttribute('role', 'group');
  toolbar.setAttribute('aria-label', 'Local checkout preview');

  const label = document.createElement('strong');
  label.textContent = 'Preview';
  toolbar.append(label);

  const previewButtons = new Map();
  const sampleItems = [
    { name: 'PVC elbow', size: '½ inch', qty: 2, price: 12 },
    { name: 'PVC tee', size: '½ inch', qty: 1, price: 16 }
  ];
  const freeDeliveryItems = [
    {
      name: 'PVC pipe',
      size: '4 inch',
      qty: 10,
      price: Math.ceil(FREE_DELIVERY_TARGET / 10)
    }
  ];

  function showPreview(state) {
    // Keep the selected screen when Live Server reloads after an edit.
    previewUrl.searchParams.set('checkout-state', state);
    window.history.replaceState(window.history.state, '', previewUrl);

    for (const [name, button] of previewButtons) {
      const active = name === state;
      button.setAttribute('aria-pressed', String(active));
      button.style.background = active ? '#12263a' : '#fff';
      button.style.color = active ? '#fff' : '#12263a';
    }

    if (state === 'failed') {
      screens.showFailure();
      return;
    }

    const freeDelivery = state === 'free-delivery';

    screens.showSuccess({
      orderId: 'TB-123456',
      transactionId: '012345678901',
      customer: { method: freeDelivery ? 'delivery' : state },
      items: freeDelivery ? freeDeliveryItems : sampleItems
    });
  }

  for (const [state, title] of [
    ['failed', 'Failed order'],
    ['pickup', 'Pickup received'],
    ['delivery', 'Delivery received'],
    ['free-delivery', 'Free delivery received']
  ]) {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = title;
    button.style.cssText =
      'font:inherit; padding:4px 8px; border:1px solid #dbe3ea; border-radius:6px; cursor:pointer;';
    button.addEventListener('click', () => showPreview(state));
    previewButtons.set(state, button);
    toolbar.append(button);
  }

  function exitPreview() {
    previewUrl.searchParams.delete('checkout-preview');
    previewUrl.searchParams.delete('checkout-state');
    window.location.replace(previewUrl);
  }

  document.addEventListener('click', event => {
    const target = event.target;
    if (!(target instanceof Element)) return;

    if (
      target === overlay ||
      (panel.contains(target) &&
        target.closest('#checkout-close, #checkout-outcome-done'))
    ) {
      event.preventDefault();
      event.stopImmediatePropagation();
      exitPreview();
    } else if (
      panel.contains(target) &&
      target.closest('#checkout-outcome-retry, a[href^="tel:"]')
    ) {
      event.preventDefault();
      event.stopImmediatePropagation();
    } else if (event.isTrusted && !panel.contains(target)) {
      // Keep clicks on the shop behind the drawer from reaching the cart.
      event.preventDefault();
      event.stopImmediatePropagation();
    }
  }, true);

  document.addEventListener('keydown', event => {
    if (event.key !== 'Escape') return;
    event.preventDefault();
    event.stopImmediatePropagation();
    exitPreview();
  }, true);

  document.addEventListener('submit', event => {
    event.preventDefault();
    event.stopImmediatePropagation();
  }, true);

  panel.prepend(toolbar);
  if (overlay) overlay.hidden = false;
  panel.hidden = false;

  const initialScreen = previewUrl.searchParams.get('checkout-state');
  showPreview(previewButtons.has(initialScreen) ? initialScreen : 'failed');
  return;
}
// End of temporary local preview.



  let submittedOrder = null;

  // Read the submission before app.js starts sending it.
  document.addEventListener('checkout:payment-submitted', event => {
    const order = event.detail;

    if (
      panel.hidden ||
      submittedOrder ||
      !order?.orderId ||
      !['pickup', 'delivery'].includes(order.customer?.method) ||
      !Array.isArray(order.items)
    ) return;

    submittedOrder = {
      orderId: order.orderId,
      transactionId: order.transactionId,
      customer: { method: order.customer.method },
      items: order.items.map(item => ({
        name: item.name,
        size: item.size,
        qty: item.qty,
        price: item.price
      }))
    };
  }, true);

  document.addEventListener('checkout:order-saved', event => {
    if (!submittedOrder || event.detail?.orderId !== submittedOrder.orderId) return;

    const order = submittedOrder;
    submittedOrder = null;

    // Let the existing checkout finish its own success action first.
    queueMicrotask(() => {
      if (!panel.hidden) screens.showSuccess(order);
    });
  });

  document.addEventListener('checkout:order-save-failed', event => {
    if (!submittedOrder) return;
    const failedOrderId = event.detail?.orderId;
    if (failedOrderId && failedOrderId !== submittedOrder.orderId) return;

    submittedOrder = null;
    queueMicrotask(() => {
      if (!panel.hidden) screens.showFailure();
    });
  });

  // Reset the outcome after X, Escape, or any other action closes checkout.
  new MutationObserver(() => {
    if (!panel.hidden) return;
    submittedOrder = null;
    screens.hide();
  }).observe(panel, { attributes: true, attributeFilter: ['hidden'] });
}

const FREE_DELIVERY_MESSAGE = 'Free delivery applied';

const PAID_DELIVERY_MESSAGE = 'Your driver will confirm the delivery fee separately.';

function installPaymentFreeDeliveryNotice(panel) {
  installCheckoutDetailsDeliveryNotice(panel);

  const payment = panel.querySelector('#checkout-payment');
  const total = payment?.querySelector('#payment-total');
  if (!total) return;

  const notice = document.createElement('p');
  notice.className = 'checkout-fulfilment-note is-free-delivery';
  notice.hidden = true;
  const truck = panel.querySelector('#checkout-outcome-delivery-note .icon');
  if (truck) notice.append(truck.cloneNode(true));
  const label = document.createElement('strong');
  label.textContent = FREE_DELIVERY_MESSAGE;
  notice.append(label);

  const totalLine = total.closest('p, .checkout-total-row') || total;
  totalLine.before(notice);

  function updateNotice() {
    const selected = panel.querySelector('[data-checkout-method][aria-pressed="true"]');
    const method = selected?.dataset.checkoutMethod;
    notice.hidden = payment.hidden || method !== 'delivery';
    if (notice.hidden) return;

    const freeDelivery = qualifiesForFreeDelivery(method, Cart.get());
    notice.classList.toggle('is-free-delivery', freeDelivery);
    label.textContent = freeDelivery ? FREE_DELIVERY_MESSAGE : PAID_DELIVERY_MESSAGE;
  }

  new MutationObserver(updateNotice)
    .observe(payment, { attributes: true, attributeFilter: ['hidden'] });
  updateNotice();
}

function installCheckoutDetailsDeliveryNotice(panel) {
  const message = panel.querySelector('#checkout-method-message');
  const row = message?.closest('.checkout-fulfilment-note');
  const deliveryButton = panel.querySelector('[data-checkout-method="delivery"]');
  if (!row || !deliveryButton) return;

  const deliveryText = message.textContent.trim();
  const copy = document.createElement('span');
  const feeNote = document.createElement('span');
  feeNote.hidden = true;
  feeNote.append(document.createElement('br'), PAID_DELIVERY_MESSAGE);
  message.replaceWith(copy);
  copy.append(message, feeNote);

  function updateDetailsNotice() {
    const isDelivery = deliveryButton.getAttribute('aria-pressed') === 'true';
    const items = Cart.get();
    const freeDelivery = isDelivery && qualifiesForFreeDelivery('delivery', items);

    feeNote.hidden = !isDelivery || !items.length || freeDelivery;
    row.classList.toggle('is-free-delivery', freeDelivery);
    if (isDelivery) {
      message.textContent = freeDelivery ? FREE_DELIVERY_MESSAGE : deliveryText;
    }
  }

  new MutationObserver(updateDetailsNotice)
    .observe(deliveryButton, { attributes: true, attributeFilter: ['aria-pressed'] });
  document.addEventListener('cart:change', updateDetailsNotice);
  updateDetailsNotice();
}


function createCheckoutOutcomeScreens(panel) {
  const find = id => panel.querySelector(`#${id}`);
  const failed = find('checkout-outcome-failed');
  const received = find('checkout-outcome-received');
  const failureTitle = find('checkout-outcome-failed-title');
  const successTitle = find('checkout-outcome-received-title');
  const reference = find('checkout-outcome-order-number');
  const copyButton = find('checkout-outcome-copy-order-number');
  const pickup = find('checkout-outcome-pickup');
  const delivery = find('checkout-outcome-delivery');
  const deliveryNote = find('checkout-outcome-delivery-note');
  const deliveryNoteText = deliveryNote?.querySelector('span');
  const regularDeliveryText = PAID_DELIVERY_MESSAGE;
  const map = find('checkout-outcome-map');
  const downloadMessage = find('checkout-outcome-download-message');
  let confirmedOrder;
  let copyFeedbackTimer;

  const paymentCopy = find('copy-order-number');
  if (paymentCopy?.childNodes.length) {
    copyButton.replaceChildren(...[...paymentCopy.childNodes].map(node => node.cloneNode(true)));
  }
  const copyButtonContent = [...copyButton.childNodes].map(node => node.cloneNode(true));

  function resetCopyButton() {
    clearTimeout(copyFeedbackTimer);
    copyButton.replaceChildren(...copyButtonContent.map(node => node.cloneNode(true)));
    copyButton.setAttribute('aria-label', 'Copy order number');
  }

  function hide() {
    delete panel.dataset.checkoutOutcome;
    delete received.dataset.fulfilment;
    failed.hidden = true;
    received.hidden = true;
    downloadMessage.hidden = true;
    downloadMessage.textContent = '';
    reference.textContent = '';
    confirmedOrder = null;
    resetCopyButton();
  }

  function showFailure() {
    hide();
    panel.dataset.checkoutOutcome = 'failed';
    failed.hidden = false;
    failed.querySelector('.checkout-outcome-body').scrollTop = 0;
    failureTitle.focus({ preventScroll: true });
  }

  function showSuccess(order) {
    const method = order.customer.method;
    hide();

    // Keep the submitted items available after the cart is cleared.
    confirmedOrder = {
      ...order,
      items: order.items.map(item => ({ ...item })),
      receivedAt: order.receivedAt ?? new Date()
    };

    reference.textContent = order.orderId;
    received.dataset.fulfilment = method;
    pickup.hidden = method !== 'pickup';
    delivery.hidden = method !== 'delivery';
    if (deliveryNoteText) {
      const freeDelivery = qualifiesForFreeDelivery(method, order.items);
      deliveryNote.classList.toggle('is-free-delivery', freeDelivery);
      deliveryNoteText.textContent = freeDelivery ? FREE_DELIVERY_MESSAGE : regularDeliveryText;
    }

    if (method === 'pickup' && !map.firstElementChild) {
      const visitMap = panel.ownerDocument.querySelector('#visit .visit-map');
      if (visitMap) {
        map.append(visitMap.cloneNode(true));
        map.hidden = false;
      }
    }

    panel.dataset.checkoutOutcome = 'received';
    received.hidden = false;
    received.querySelector('.checkout-outcome-body').scrollTop = 0;
    successTitle.focus({ preventScroll: true });
  }

  find('checkout-outcome-retry').addEventListener('click', () => {
    hide();
    find('payment-submit-feedback')?.remove();
    find('payment-done')?.focus();
  });

  find('checkout-outcome-done').addEventListener('click', () => {
    hide();
    find('checkout-close')?.click();
  });

  const downloadButton = find('checkout-outcome-download');
  downloadButton.addEventListener('click', async () => {
    const order = confirmedOrder;
    if (!order || downloadButton.disabled) return;

    downloadMessage.hidden = true;
    downloadButton.disabled = true;
    downloadButton.setAttribute('aria-busy', 'true');

    try {
      await downloadInvoice(order);
    } catch (error) {
      if (confirmedOrder === order) {
        downloadMessage.textContent = 'The invoice could not be downloaded. Please try again.';
        downloadMessage.hidden = false;
      }
    } finally {
      downloadButton.disabled = false;
      downloadButton.removeAttribute('aria-busy');
    }
  });

  copyButton.addEventListener('click', async () => {
    const order = confirmedOrder;
    if (!order) return;

    let feedback = 'Copied';
    try {
      await copyOrderNumber(order.orderId);
    } catch {
      feedback = 'Copy failed';
    }

    if (confirmedOrder !== order) return;
    clearTimeout(copyFeedbackTimer);
    copyButton.textContent = feedback;
    copyButton.setAttribute('aria-label', feedback);
    copyFeedbackTimer = setTimeout(resetCopyButton, 1200);
  });

  return { hide, showFailure, showSuccess };
}

async function copyOrderNumber(orderId) {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(orderId);
      return;
    } catch {
      // Try the local-server clipboard fallback below.
    }
  }

  const input = document.createElement('textarea');
  const focused = document.activeElement;
  input.value = orderId;
  input.readOnly = true;
  input.style.position = 'fixed';
  input.style.opacity = '0';
  document.body.append(input);

  try {
    input.select();
    if (!document.execCommand('copy')) throw new Error('Could not copy order number.');
  } finally {
    input.remove();
    if (document.activeElement === document.body) focused?.focus({ preventScroll: true });
  }
}

const money = new Intl.NumberFormat('en-GH', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2
});

const orderDate = new Intl.DateTimeFormat('en-GH', {
  dateStyle: 'medium',
  timeStyle: 'short',
  timeZone: 'Africa/Accra'
});

function formatAmount(amount) {
  return amount === null ? 'To be confirmed' : `GH₵ ${money.format(amount)}`;
}

function lineAmount(price, quantity) {
  if (typeof price !== 'number' && typeof price !== 'string') return null;
  if (typeof price === 'string' && !price.trim()) return null;

  const unitPrice = Number(price);
  const amount = unitPrice * quantity;
  return unitPrice >= 0 && Number.isFinite(amount) ? amount : null;
}

function qualifiesForFreeDelivery(method, items) {
  if (method !== 'delivery' || !items.length) return false;

  let subtotal = 0;
  for (const item of items) {
    const quantity = Number(item.qty);
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 9999) return false;

    const amount = lineAmount(item.price, quantity);
    if (amount === null) return false;
    subtotal += amount;
  }

  return Number.isFinite(subtotal) && subtotal >= FREE_DELIVERY_TARGET;
}

async function downloadInvoice(order) {
  const orderId = String(order?.orderId ?? '');
  const items = order?.items;
  if (!/^TB-\d{5,6}$/.test(orderId) || !Array.isArray(items) || !items.length) {
    throw new Error('The invoice is unavailable.');
  }

  const lines = items.map(item => {
    const quantity = Number(item.qty);
    const description = [item.name, item.size].filter(Boolean).join(' ');
    return { description, quantity, amount: lineAmount(item.price, quantity) };
  });
  const subtotal = lines.some(line => line.amount === null)
    ? null
    : lines.reduce((sum, line) => sum + line.amount, 0);
  const method = order.customer?.method;
  let fulfilment = method === 'pickup' ? 'Pickup' : 'Delivery';
  if (qualifiesForFreeDelivery(method, items)) fulfilment = 'Free delivery';
  const receivedAt = order.receivedAt ? new Date(order.receivedAt) : null;
  const received = receivedAt && Number.isFinite(receivedAt.getTime())
    ? orderDate.format(receivedAt)
    : '';

  const { createInvoicePdf } = await import('./invoice-pdf.js');
  const pdf = await createInvoicePdf({
    orderId,
    received,
    fulfilment,
    transactionId: order.transactionId,
    items: lines.map(line => ({ ...line, amount: formatAmount(line.amount) })),
    subtotal: formatAmount(subtotal)
  });

  const url = URL.createObjectURL(new Blob([pdf], { type: 'application/pdf' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = `${orderId}-invoice.pdf`;
  document.body.append(link);

  try {
    link.click();
  } finally {
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
  }
}

connectCheckoutOutcomes();
