import { Cart } from './cart.js';
import { CHECKOUT_LOADER_MS, setCheckoutButtonBusy } from './checkout-loading.js';

const panel = document.getElementById('checkout-panel');

if (panel) {
  const find = id => panel.querySelector(`#${id}`);
  const form = find('checkout-form');
  const nameInput = find('checkout-name');
  const phoneInput = find('checkout-phone');
  // Let the JavaScript validator accept international numbers even if the
  // original HTML still has a Ghana-only pattern or length limit.
  phoneInput.removeAttribute('maxlength');
  phoneInput.removeAttribute('minlength');
  phoneInput.removeAttribute('pattern');
  const locationInput = find('checkout-location');
  const gpsInput = find('checkout-gps');
  const noteInput = find('checkout-note');
  const transactionInput = find('payment-transaction-id');
  const methodButtons = [...panel.querySelectorAll('[data-checkout-method]')];
  const fields = [nameInput, phoneInput, locationInput];
  const errors = new Map();

  let method = 'delivery';
  let attempted = false;
  let pendingOrder = null;
  let orderSending = false;
  let orderSaved = false;
  let paymentTransitionTimer;
  const makePaymentButton = find('place-order');
  const paymentButton = find('payment-done');
  const transactionLabel = transactionInput?.closest('label');
  const paymentHeading = panel.querySelector('#checkout-payment h1, #checkout-payment h2, #checkout-payment h3');
  const originalPaymentHeading = paymentHeading?.textContent || '';

  const money = amount => `GH₵ ${Number(amount).toLocaleString('en-GH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })}`;

  function normalizePhone(value) {
    let compact = value.trim().replace(/[\s().-]/g, '');
    if (compact.startsWith('00')) compact = `+${compact.slice(2)}`;

    const digits = compact.replace(/^\+/, '');
    const validFormat = /^\+?\d{7,15}$/.test(compact);
    const repeatedDigits = /^(\d)\1+$/.test(digits);

    return validFormat && !repeatedDigits ? compact : '';
  }

  function validateField(input) {
    const value = input.value.trim();

    if (input === nameInput && (value.length < 2 || !/\p{L}/u.test(value))) {
      return 'Enter your full name.';
    }

    if (input === phoneInput && !normalizePhone(value)) {
      return 'Enter a valid phone number, with country code if needed.';
    }

    if (input === locationInput && method === 'delivery' && value.length < 3) {
      return 'Tell us where to deliver your order.';
    }

    return '';
  }

  function showFieldError(input, message) {
    const line = find(`${input.id}-error`);

    if (message) {
      errors.set(input.id, message);
      input.setAttribute('aria-invalid', 'true');
    } else {
      errors.delete(input.id);
      input.removeAttribute('aria-invalid');
    }

    line.hidden = !message;
    line.querySelector('span').textContent = message;
  }

  function updateErrorSummary() {
    const summary = find('checkout-errors');
    const count = errors.size;

    summary.hidden = count === 0;
    if (!count) return;

    find('checkout-error-title').textContent =
      `Please fix ${count} ${count === 1 ? 'thing' : 'things'} to continue`;

    const instructions = [];
    if (errors.has(nameInput.id)) instructions.push('enter your full name');
    if (errors.has(phoneInput.id)) instructions.push('check your phone number');
    if (errors.has(locationInput.id)) instructions.push('tell us where to deliver');

    const text = instructions.length > 1
      ? `${instructions.slice(0, -1).join(', ')} and ${instructions.at(-1)}`
      : instructions[0];

    find('checkout-error-description').textContent =
      `${text.charAt(0).toUpperCase()}${text.slice(1)}.`;
  }

  function getCartTotal(items) {
    return items.reduce(
      (sum, item) => sum + Number(item.price || 0) * Number(item.qty || 0),
      0
    );
  }

  function cartHasKnownPrices(items) {
    return items.every(item =>
      item.price !== null &&
      item.price !== '' &&
      item.price !== undefined &&
      Number.isFinite(Number(item.price))
    );
  }

  function updateTotals() {
    const items = Cart.get();
    const count = items.reduce((sum, item) => sum + Number(item.qty || 0), 0);
    const total = getCartTotal(items);

    find('checkout-item-count').textContent =
      `${count} ${count === 1 ? 'item' : 'items'}`;

    find('checkout-subtotal').textContent =
      cartHasKnownPrices(items) ? money(total) : 'Price to confirm';

    makePaymentButton.disabled = count === 0 || paymentTransitionTimer !== undefined || orderSending;
  }

  function chooseMethod(next) {
    method = next;
    const delivery = method === 'delivery';

    methodButtons.forEach(button => {
      button.setAttribute(
        'aria-pressed',
        String(button.dataset.checkoutMethod === method)
      );
    });

    find('checkout-delivery').hidden = !delivery;
    find('checkout-pickup').hidden = delivery;

    locationInput.required = delivery;
    locationInput.disabled = !delivery;
    gpsInput.disabled = !delivery;

    find('checkout-method-icon').setAttribute(
      'href',
      delivery ? '#i-truck' : '#i-checkout-ready'
    );

    find('checkout-method-message').textContent = delivery
      ? 'Same day delivery around Kumasi and its environs'
      : 'Ready after we confirm your order';

    find('checkout-privacy-note').textContent = delivery
      ? 'We only use your details to deliver your order.'
      : 'We only use your details to arrange your pickup.';

    showFieldError(
      locationInput,
      attempted && delivery ? validateField(locationInput) : ''
    );

    updateErrorSummary();
  }

  function showDetailsScreen() {
    panel.querySelector('.checkout-body').hidden = false;
    find('checkout-details-footer').hidden = false;
    find('checkout-payment').hidden = true;
    find('checkout-payment-footer').hidden = true;
    updateTotals();

    panel.querySelector('.checkout-body')
      .scrollTo({ top: 0, behavior: 'smooth' });
  }

  function stopOpeningPayment() {
    if (paymentTransitionTimer === undefined) return;
    clearTimeout(paymentTransitionTimer);
    paymentTransitionTimer = undefined;
    setCheckoutButtonBusy(makePaymentButton, false);
    updateTotals();
  }

  function resetCheckoutForm() {
    stopOpeningPayment();
    form.reset();
    pendingOrder = null;
    orderSending = false;
    orderSaved = false;
    attempted = false;
    errors.clear();

    fields.forEach(input => showFieldError(input, ''));
    find('payment-transaction-error').hidden = true;
    transactionLabel?.removeAttribute('hidden');
    if (paymentHeading) paymentHeading.textContent = originalPaymentHeading;
    if (paymentButton) {
      setCheckoutButtonBusy(paymentButton, false);
      paymentButton.textContent = 'Place order';
    }
    find('payment-submit-feedback')?.remove();

    showDetailsScreen();
    chooseMethod('delivery');
  }

  function createPendingOrder() {
    const items = Cart.get();
    const orderId = pendingOrder?.orderId ||
      `TB-${Math.floor(100000 + Math.random() * 900000)}`;

    pendingOrder = {
      orderId,
      customer: {
        name: nameInput.value.trim(),
        phone: normalizePhone(phoneInput.value),
        method,
        location: method === 'delivery' ? locationInput.value.trim() : '',
        gps: method === 'delivery' ? gpsInput.value.trim() : '',
        note: noteInput.value.trim()
      },
      items
    };

    find('payment-order-number').textContent = orderId;
    find('payment-reference').textContent = orderId;

    find('payment-total').textContent = cartHasKnownPrices(items)
      ? money(getCartTotal(items))
      : 'Price to confirm';

    panel.querySelector('.checkout-body').hidden = true;
    find('checkout-details-footer').hidden = true;
    find('checkout-payment').hidden = false;
    find('checkout-payment-footer').hidden = false;

    find('checkout-payment').scrollTop = 0;
  }

  async function copyText(value, button) {
    const originalContent = button.innerHTML;

    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(value);
      } else {
        const temporaryInput = document.createElement('textarea');
        temporaryInput.value = value;
        temporaryInput.style.position = 'fixed';
        temporaryInput.style.opacity = '0';
        document.body.appendChild(temporaryInput);
        temporaryInput.select();
        document.execCommand('copy');
        temporaryInput.remove();
      }

      button.textContent = 'Copied';
      setTimeout(() => {
        button.innerHTML = originalContent;
      }, 1200);
    } catch {
      button.textContent = 'Copy failed';
      setTimeout(() => {
        button.innerHTML = originalContent;
      }, 1200);
    }
  }

  methodButtons.forEach(button => {
    button.addEventListener('click', () => {
      chooseMethod(button.dataset.checkoutMethod);
    });
  });

  fields.forEach(input => {
    input.addEventListener('input', () => {
      if (!attempted) return;
      showFieldError(input, validateField(input));
      updateErrorSummary();
    });
  });

  function validateDetails() {
    attempted = true;
    fields.forEach(input => showFieldError(input, validateField(input)));
    updateErrorSummary();

    if (!errors.size) return true;
    const firstInvalidField = fields.find(input => errors.has(input.id));
    firstInvalidField.focus({ preventScroll: true });
    panel.querySelector('.checkout-body')
      .scrollTo({ top: 0, behavior: 'smooth' });
    return false;
  }

  form.addEventListener('submit', event => {
    event.preventDefault();
    if (panel.hidden || !find('checkout-payment').hidden || paymentTransitionTimer !== undefined || orderSending) return;
    if (!validateDetails() || !Cart.count()) return;

    setCheckoutButtonBusy(makePaymentButton, true);

    paymentTransitionTimer = setTimeout(() => {
      stopOpeningPayment();
      if (!panel.hidden && Cart.count() && validateDetails()) createPendingOrder();
    }, CHECKOUT_LOADER_MS);
  });

  panel.querySelector('#checkout-back')?.addEventListener('click', event => {
    if (!find('checkout-payment').hidden) {
      event.preventDefault();
      event.stopImmediatePropagation();
      showDetailsScreen();
      return;
    }

    resetCheckoutForm();
  }, true);

  panel.querySelector('#checkout-close')
    ?.addEventListener('click', resetCheckoutForm);

  document.getElementById('cart-overlay')?.addEventListener('click', () => {
    if (!panel.hidden) resetCheckoutForm();
  }, true);

  find('copy-order-number')?.addEventListener('click', event => {
    copyText(find('payment-order-number').textContent, event.currentTarget);
  });

  find('copy-payment-phone')?.addEventListener('click', event => {
    copyText(find('payment-phone').textContent, event.currentTarget);
  });

  function showSubmissionFeedback(message, isError) {
    const footer = find('checkout-payment-footer');
    let feedback = find('payment-submit-feedback');

    if (!footer) return;
    if (!feedback) {
      feedback = document.createElement('p');
      feedback.id = 'payment-submit-feedback';
      feedback.setAttribute('role', 'status');
      feedback.style.margin = '0';
      feedback.style.fontSize = '14px';
      footer.prepend(feedback);
    }

    feedback.textContent = message;
    feedback.style.color = isError ? '#B3261E' : '#14633A';
  }

  document.addEventListener('checkout:order-saved', event => {
    if (!pendingOrder || event.detail?.orderId !== pendingOrder.orderId) return;

    // Empty the shopping cart only after Apps Script confirms the order was saved.
    Cart.clear();
    orderSending = false;
    orderSaved = true;
    if (paymentHeading) paymentHeading.textContent = 'Order received';
    transactionLabel?.setAttribute('hidden', '');
    find('payment-transaction-error').hidden = true;
    if (paymentButton) {
      setCheckoutButtonBusy(paymentButton, false);
      paymentButton.textContent = 'Done';
    }
    showSubmissionFeedback(
      'Your order is saved. We will verify your payment and contact you about your order.',
      false
    );
  });

  document.addEventListener('checkout:order-save-failed', event => {
    if (!pendingOrder) return;
    if (event.detail?.orderId && event.detail.orderId !== pendingOrder.orderId) return;

    orderSending = false;
    updateTotals();
    if (paymentButton) {
      setCheckoutButtonBusy(paymentButton, false);
      paymentButton.textContent = 'Place order';
    }
    showSubmissionFeedback(
      event.detail?.message || 'We could not save your order. Please try again or call us.',
      true
    );
  });

  paymentButton?.addEventListener('click', () => {
    if (orderSaved) {
      find('checkout-close')?.click();
      return;
    }

    if (orderSending) return;

    const transactionId = transactionInput.value.trim();
    const error = find('payment-transaction-error');

    if (!transactionId) {
      error.hidden = false;
      transactionInput.focus();
      return;
    }

    error.hidden = true;

    if (!pendingOrder) return;

    orderSending = true;
    setCheckoutButtonBusy(paymentButton, true);
    paymentButton.textContent = 'Sending order…';
    find('payment-submit-feedback')?.remove();

    form.dispatchEvent(new CustomEvent('checkout:payment-submitted', {
      bubbles: true,
      detail: {
        ...pendingOrder,
        transactionId,
        paymentStatus: 'Pending Verification',
        orderStatus: 'Pending'
      }
    }));
  });

  document.addEventListener('cart:change', updateTotals);

  panel.addEventListener('checkout:opened', () => {
    updateTotals();
    if (!panel.hidden && find('checkout-payment').hidden) {
      const firstInvalidField = fields.find(input => errors.has(input.id));
      (firstInvalidField || nameInput).focus({ preventScroll: true });
    }
  });

  chooseMethod('delivery');
  updateTotals();
}
