export const CHECKOUT_LOADER_MS = 500;

export function setCheckoutButtonBusy(button, busy) {
  button.disabled = busy;
  if (busy) button.setAttribute('aria-busy', 'true');
  else button.removeAttribute('aria-busy');
}
