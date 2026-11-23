/* ==========================================================
   MENU (tablet and mobile)
   ========================================================== */

const burgers = document.querySelectorAll('.burger');
const menu = document.getElementById('menu');

function setMenu(open) {
    burgers.forEach(burger => {
        burger.setAttribute('aria-expanded', open);
        burger.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
    });
    menu.hidden = !open;
}

burgers.forEach(burger => {
    burger.addEventListener('click', () => {
        setMenu(burger.getAttribute('aria-expanded') !== 'true');
    });
});

menu.querySelector('.menu-overlay').addEventListener('click', () => setMenu(false));

menu.querySelectorAll('a').forEach(link => {
    link.addEventListener('click', () => setMenu(false));
});

window.matchMedia('(min-width: 1201px)').addEventListener('change', event => {
    if (event.matches) setMenu(false);
});







/* ==========================================================
   SCROLLED STATE (sticky bar, floating cart, back to top)
   ========================================================== */

const headerArea = document.querySelector('.header-area');

new IntersectionObserver(([entry]) => {
    document.body.classList.toggle('scrolled', !entry.isIntersecting);
}).observe(headerArea);









/* ==========================================================
   FLOATING BUTTONS — SCROLL DIRECTION + PAGE END
   ========================================================== */

let lastScrollY = window.scrollY;

window.addEventListener("scroll", () => {

    const currentScrollY = window.scrollY;

    const atPageEnd =
        window.innerHeight + currentScrollY >=
        document.documentElement.scrollHeight - 5;

    if (currentScrollY <= 100 || atPageEnd) {
        document.body.classList.remove("scrolling-up");
    }
    else if (currentScrollY < lastScrollY) {
        document.body.classList.add("scrolling-up");
    }
    else if (currentScrollY > lastScrollY) {
        document.body.classList.remove("scrolling-up");
    }

    lastScrollY = currentScrollY;

}, { passive: true });









/* ==========================================================
   CART COUNT
   ========================================================== */

let cart = [];

try {
    cart = JSON.parse(localStorage.getItem('cart')) || [];
} catch (error) {
    cart = [];
}

function cartTotal() {
    return cart.reduce((sum, item) => sum + item.qty, 0);
}

function updateCartBadge() {
    const total = cartTotal();
    const label = total === 0
        ? 'Cart, empty'
        : 'Cart, ' + total + (total === 1 ? ' item' : ' items');

    document.querySelectorAll('.cart-count').forEach(badge => {
        badge.textContent = total > 99 ? '99+' : total;
        badge.hidden = total === 0;
    });

    document.querySelectorAll('.cart-btn').forEach(button => {
        button.setAttribute('aria-label', label);
    });
}

function saveCart() {
    try {
        localStorage.setItem('cart', JSON.stringify(cart));
    } catch (error) {}
    updateCartBadge();
}

/* Used later by the "+ Add to cart" buttons: addToCart('sku', quantity) */
function addToCart(sku, qty = 1) {
    const found = cart.find(item => item.sku === sku);

    if (found) {
        found.qty += qty;
    } else {
        cart.push({ sku, qty });
    }

    saveCart();
}

updateCartBadge();













/* ==========================================================
   CATEGORY DROPDOWNS
   ========================================================== */

const categoryList = document.querySelector('.cat-list');

if (categoryList) {

    const categoryDropdowns = [...categoryList.querySelectorAll('details')];

    categoryList.addEventListener('click', function(event) {

        const summary = event.target.closest('summary');

        if (!summary) return;

        const clicked = summary.parentElement;

        if (!categoryDropdowns.includes(clicked)) return;

        event.preventDefault();

        const isOpen = clicked.open;
        const hasActive = clicked.querySelector('.sub-link.active');

        if (isOpen && hasActive) return;

        categoryDropdowns.forEach(dropdown => {

            const containsActive = dropdown.querySelector('.sub-link.active');

            if (!containsActive) {
                dropdown.open = false;
            }

        });

        if (!isOpen) {
            clicked.open = true;
        }

    });

}





/* ==========================================================
   FLOATING CATEGORY POPUP
   ========================================================== */

const pills = document.querySelectorAll('.pill');
const sidebar = document.querySelector('.sidebar');
const catList = document.querySelector('.cat-list');

const popup = document.querySelector('.category-popup');
const popupList = document.querySelector('.category-popup-list');
const popupOverlay = document.querySelector('.category-popup-overlay');
const popupClose = document.querySelector('.category-popup-close');

if (sidebar && catList && popup && popupList && popupOverlay && popupClose) {

    const pillLabels = document.querySelectorAll('.pill .pill-label');

    let selectedCategory =
        document.querySelector('.sub-link.active')?.textContent.trim() || 'Categories';

    const sidebarPlaceholder = document.createComment('Category list position');

    catList.parentNode.insertBefore(sidebarPlaceholder, catList);

    function moveCategoryList() {
  if (window.matchMedia('(max-width: 650px)').matches) {
    popupList.appendChild(catList);
  } else {
    if (!popup.hidden) setCategories(false);
    sidebarPlaceholder.parentNode.insertBefore(catList, sidebarPlaceholder);
  }
}

    moveCategoryList();

    window.addEventListener('resize', moveCategoryList);

    function updateCategoryLabel() {

        pillLabels.forEach(label => {
            label.textContent = selectedCategory;
        });

    }

    function setCategories(open) {

        popup.hidden = !open;
        popupOverlay.hidden = !open;

        document.body.classList.toggle('category-popup-open', open);

        pills.forEach(pill => {
            pill.setAttribute('aria-expanded', open);
        });

    }

    pills.forEach(pill => {

        pill.addEventListener('click', () => {
            setCategories(popup.hidden);
        });

    });

    popupClose.addEventListener('click', () => setCategories(false));

    popupOverlay.addEventListener('click', () => setCategories(false));

    document.querySelectorAll('.sub-link').forEach(link => {

    link.addEventListener('click', event => {

        event.preventDefault();

        document.querySelectorAll('.sub-link.active').forEach(item => {
            item.classList.remove('active');
        });

        link.classList.add('active');

        selectedCategory = link.textContent.trim();

        updateCategoryLabel();

        setCategories(false);

    });

});

    document.addEventListener('keydown', event => {

        if (event.key === 'Escape') {
            setCategories(false);
        }

    });

    updateCategoryLabel();

}









/* ==========================================================
   REQUEST QUOTE
   ========================================================== */

(() => {
    const form = document.getElementById('quote-form');
    const submit = document.querySelector('#quote .quote-actions > button.quote-whatsapp');
    if (!form || !submit) return;

    const endpoint = 'https://script.google.com/macros/s/AKfycbwt2ntlydChvL2REcgpxvW2kXuHnbhie92QeMVmsMzt2gacy-qOkUwtWdZbebhhO-I6/exec';
    const trigger = document.getElementById('fitting-trigger');
    const popup = document.getElementById('fitting-popup');
    const list = popup.querySelector('.fitting-popup-list');
    const label = trigger.querySelector('.fitting-label');
    const submitLabel = submit.querySelector('span') || submit;
    const layout = form.closest('.quote-layout');
    const errorSummary = document.createElement('div');
    errorSummary.className = 'checkout-error-summary';
    errorSummary.hidden = true;
    errorSummary.tabIndex = -1;
    errorSummary.setAttribute('role', 'alert');
    errorSummary.innerHTML = `
        <div class="checkout-error-title">
            <svg class="icon" aria-hidden="true"><use href="#i-checkout-alert"></use></svg>
            <strong></strong>
        </div>
        <p id="quote-error-description"></p>`;
    layout.before(errorSummary);
    const errorTitle = errorSummary.querySelector('strong');
    const errorDescription = errorSummary.querySelector('p');

    const status = document.createElement('p');
    status.className = 'quote-submit-status';
    status.setAttribute('role', 'status');
    layout.after(status);

    trigger.removeAttribute('aria-haspopup');
    popup.setAttribute('role', 'group');
    popup.setAttribute('aria-label', 'Fitting categories');

    const nameInput = form.elements.namedItem('name');
    const numberInput = form.elements.namedItem('number');
    const messageInput = form.elements.namedItem('message');
    nameInput.maxLength = 120;
    numberInput.maxLength = 32;
    messageInput.maxLength = 4000;
    messageInput.required = true;
    form.noValidate = true;

    const selected = new Set();
    let previousAttempt;
    let buttonResetTimer;

    function setPopup(open) {
        popup.hidden = !open;
        trigger.setAttribute('aria-expanded', String(open));
    }

    function updateLabel() {
        if (!selected.size) label.textContent = 'Select a fitting';
        else if (selected.size === 1) label.textContent = [...selected][0];
        else label.textContent = `${selected.size} categories selected`;
    }

    function refreshFittings() {
        const names = new Set([...document.querySelectorAll('#nav > details > summary')]
            .map(summary => summary.textContent.trim()).filter(Boolean));
        list.replaceChildren();

        for (const name of names) {
            const option = document.createElement('button');
            option.type = 'button';

            function updateOption() {
                const checked = selected.has(name);
                option.textContent = checked ? `✓ ${name}` : name;
                option.setAttribute('aria-label', name);
                option.setAttribute('aria-pressed', String(checked));
            }

            updateOption();
            option.addEventListener('click', () => {
                if (selected.has(name)) selected.delete(name);
                else selected.add(name);
                updateOption();
                updateLabel();
                refreshValidation();
            });
            list.append(option);
        }

        if (!names.size) list.textContent = 'Fitting categories are unavailable. Please try again.';
    }

    trigger.addEventListener('click', () => {
        if (popup.hidden) refreshFittings();
        setPopup(popup.hidden);
    });

    document.addEventListener('click', event => {
        if (!trigger.contains(event.target) && !popup.contains(event.target)) setPopup(false);
    });

    document.addEventListener('keydown', event => {
        if (event.key !== 'Escape' || popup.hidden) return;
        setPopup(false);
        trigger.focus();
    });

    function showError(title, description, kind) {
        if (kind === 'validation') {
            if (errorSummary.nextElementSibling !== layout) layout.before(errorSummary);
        } else if (errorSummary.previousElementSibling !== status) {
            status.after(errorSummary);
        }
        errorTitle.textContent = title;
        errorDescription.textContent = description;
        errorSummary.dataset.kind = kind;
        errorSummary.hidden = false;
    }

    function clearError() {
        errorSummary.hidden = true;
        errorSummary.dataset.kind = '';
    }

    function validateQuote(data) {
        const digits = data.number.replace(/\D/g, '').length;
        const hasValidNumber = digits >= 7 && digits <= 15 && /^\+?[\d ().-]+$/.test(data.number);
        const checks = [
            [nameInput, !data.name && 'enter your name'],
            [numberInput, !hasValidNumber && 'check your phone number'],
            [trigger, !data.fittings.length && 'choose a fitting category'],
            [messageInput, !data.message && 'enter a message']
        ];

        for (const [field, error] of checks) {
            if (error) {
                field.setAttribute('aria-invalid', 'true');
                field.setAttribute('aria-errormessage', errorDescription.id);
            } else {
                field.removeAttribute('aria-invalid');
                field.removeAttribute('aria-errormessage');
            }
        }

        const instructions = checks.map(([, error]) => error).filter(Boolean);
        if (!instructions.length) {
            clearError();
            return true;
        }

        const hint = new Intl.ListFormat('en').format(instructions);
        showError(
            `Please fix ${instructions.length} ${instructions.length === 1 ? 'thing' : 'things'} to continue`,
            `${hint.charAt(0).toUpperCase()}${hint.slice(1)}.`,
            'validation'
        );
        return false;
    }

    function refreshValidation() {
        if (errorSummary.dataset.kind === 'validation') validateQuote(readQuote());
    }

    function setButtonState(state) {
        const states = {
            idle: { label: 'Send Quote' },
            sending: { label: 'Sending...', message: 'Sending your quote request…' },
            sent: { label: 'Sent', message: 'Quote request sent. We’ll contact you shortly.' },
            failed: { label: 'Try again', message: '' }
        };
        const { label, message } = states[state];
        clearTimeout(buttonResetTimer);
        submit.dataset.quoteState = state;
        submitLabel.textContent = label;
        submit.disabled = state === 'sending' || state === 'sent';
        if (message !== undefined) status.textContent = message;

        if (state === 'sent' || state === 'failed') {
            buttonResetTimer = setTimeout(() => setButtonState('idle'), 1800);
        }
    }

    function readQuote() {
        const fields = new FormData(form);
        return {
            name: fields.get('name').trim(),
            number: fields.get('number').trim(),
            fittings: [...selected].sort(),
            message: fields.get('message').trim()
        };
    }

    function sendQuote(payload) {
        return new Promise((resolve, reject) => {
            const frame = document.createElement('iframe');
            frame.name = `tb-quote-${payload.requestId}`;
            frame.title = 'Quote submission response';
            frame.hidden = true;

            const transport = document.createElement('form');
            transport.method = 'POST';
            transport.action = endpoint;
            transport.target = frame.name;
            transport.hidden = true;

            const field = document.createElement('input');
            field.type = 'hidden';
            field.name = 'payload';
            field.value = JSON.stringify(payload);
            transport.append(field);

            function cleanUp() {
                clearTimeout(timer);
                window.removeEventListener('message', onReceipt);
                frame.remove();
            }

            function onReceipt(event) {
                const isGoogleScript = /^https:\/\/(?:script\.google\.com|[\w.-]+-script\.googleusercontent\.com|script\.googleusercontent\.com)$/.test(event.origin);
                const reply = event.data;
                if (!isGoogleScript || reply?.type !== 'tb-quote-result' || reply.requestId !== payload.requestId) return;
                cleanUp();
                resolve(reply.ok === true);
            }

            const timer = setTimeout(() => {
                cleanUp();
                reject(new Error('Quote confirmation timed out'));
            }, 30000);

            window.addEventListener('message', onReceipt);
            document.body.append(frame, transport);
            try {
                transport.submit();
            } catch (error) {
                cleanUp();
                reject(error);
            } finally {
                transport.remove();
            }
        });
    }

    form.addEventListener('input', refreshValidation);
    submit.addEventListener('click', () => form.requestSubmit());

    form.addEventListener('submit', async event => {
        event.preventDefault();
        if (submit.disabled) return;

        status.textContent = '';
        const data = readQuote();
        if (!validateQuote(data)) {
            errorSummary.focus();
            return;
        }
        if (!/^https:\/\/script\.google\.com\/(?:macros|a\/macros\/[\w.-]+)\/s\/[\w-]+\/exec$/.test(endpoint)) {
            setButtonState('failed');
            showError('Quote requests are unavailable', 'Please call us or send your request via WhatsApp.', 'submission');
            return;
        }

        const key = JSON.stringify(data);
        if (previousAttempt?.key !== key) {
            const bytes = crypto.getRandomValues(new Uint8Array(16));
            const requestId = Array.from(bytes, value => value.toString(16).padStart(2, '0')).join('');
            previousAttempt = { key, requestId };
        }

        setButtonState('sending');
        setPopup(false);

        try {
            const saved = await sendQuote({ ...data, requestId: previousAttempt.requestId });
            if (!saved) throw new Error('Quote was not saved');

            if (JSON.stringify(readQuote()) === key) {
                form.reset();
                selected.clear();
                setPopup(false);
                updateLabel();
            }
            previousAttempt = undefined;
            setButtonState('sent');
        } catch (error) {
            setButtonState('failed');
            showError('We couldn’t confirm your quote request', 'Try again or call us.', 'submission');
        }
    });
})();





















/* ==========================================================
   TERMS & CONDITIONS + PRIVACY POLICY
   MOBILE NAVIGATION PILL
   ========================================================== */

document.querySelectorAll('.policy-sidebar').forEach(sidebar => {
    const pill = sidebar.querySelector('.policy-pill');
    const label = pill?.querySelector('.pill-label');
    const popup = document.querySelector('.policy-popup');
    const overlay = document.querySelector('.policy-popup-overlay');
    const closeButton = document.querySelector('.policy-popup-close');
    const nav = popup?.querySelector('.policy-nav');

    if (!pill || !label || !popup || !overlay || !closeButton || !nav) return;

    function closePopup() {
        popup.hidden = true;
        overlay.hidden = true;
        pill.setAttribute('aria-expanded', 'false');
        document.body.classList.remove('category-popup-open');
    }

    function openPopup() {
        popup.hidden = false;
        overlay.hidden = false;
        pill.setAttribute('aria-expanded', 'true');
        document.body.classList.add('category-popup-open');
    }

    pill.addEventListener('click', () => {
        popup.hidden ? openPopup() : closePopup();
    });

    closeButton.addEventListener('click', closePopup);
    overlay.addEventListener('click', closePopup);

    document.querySelectorAll('.policy-nav a').forEach(link => {
    link.addEventListener('click', () => {
        const selectedHref = link.getAttribute('href');

        document.querySelectorAll('.policy-nav a').forEach(item => {
            item.classList.toggle(
                'active',
                item.getAttribute('href') === selectedHref
            );
        });

        label.textContent = link.textContent.trim();
        closePopup();
    });
});

    document.addEventListener('keydown', event => {
        if (event.key === 'Escape') closePopup();
    });
});