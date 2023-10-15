const fetchConfig = {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Accept: `application/json` }
}
class CartRemoveButton extends HTMLElement {
  constructor() {
    super();

    this.addEventListener('click', (event) => {
      event.preventDefault();
      const cartItems = this.closest('cart-items') || this.closest('cart-drawer-items');
      cartItems.updateQuantity(this.dataset.index, 0);
    });
  }
}

customElements.define('cart-remove-button', CartRemoveButton);

class CartItems extends HTMLElement {
  constructor() {
    super();
    this.cart = null
    this.lineItemStatusElement = document.getElementById('shopping-cart-line-item-status') || document.getElementById('CartDrawer-LineItemStatus');
    const debouncedOnChange = debounce((event) => {
      this.onChange(event);
    }, 300);

    this.initLoading()
    this.addEventListener('change', debouncedOnChange.bind(this));
  }

  cartUpdateUnsubscriber = undefined;

  connectedCallback() {
    this.cartUpdateUnsubscriber = window.FoxThemeEvents.subscribe('ON_ITEM_ADDED', async (parsedState) => {
      if (window.FoxThemeSettings.template === 'cart') {
        this.renderContents(parsedState)
      }
      const cart = await FoxThemeCartHelpers.getState()
      if (cart) {
        this.cart = cart
        FoxThemeCartHelpers.updateCartCount(cart.item_count)
      }
    });

    window.FoxThemeEvents.subscribe('ON_CART_UPDATED', (cart) => {
      this.cart = cart
      FoxThemeCartHelpers.updateCartCount(cart.item_count)
      this.classList.toggle('is-empty', cart.item_count === 0);
    });
  }

  disconnectedCallback() {
    if (this.cartUpdateUnsubscriber) {
      this.cartUpdateUnsubscriber();
    }
  }

  initLoading() {
    this.loading = new window.FoxTheme.AnimateLoading(document.body, { overlay: this.querySelector('.f-cart__items')})
  }

  onChange(event) {
    if (event.target.getAttribute('name') !== 'updates[]') return;
    this.updateQuantity(event.target.dataset.index, event.target.value, document.activeElement.getAttribute('name'));
  }

  getSectionsToRender() {
    return [
      {
        id: 'main-cart-items',
        section: document.getElementById('main-cart-items').dataset.id,
        selector: '.js-contents',
      },
      {
        id: 'cart-live-region-text',
        section: 'cart-live-region-text',
        selector: '.shopify-section',
      },
    ];
  }

  updateQuantity(line, quantity, name) {
    this.enableLoading();

    const body = JSON.stringify({
      line,
      quantity,
      sections: this.getSectionsToRender().map((section) => section.section),
      sections_url: window.location.pathname,
    });

    fetch(`${FoxThemeSettings.routes.cart_change_url}`, { ...fetchConfig, ...{ body } })
    .then((response) => {
      return response.text();
    })
    .then((state) => {
      const parsedState = JSON.parse(state);
      const updatedLine = this.querySelector(`#CartItem-${line}, #CartDrawer-Item-${line}`)

      const quantityElement = updatedLine.querySelector('[name="updates[]"]');
      const items = document.querySelectorAll('.f-cart-item');

      if (parsedState.errors) {
        quantityElement.value = quantityElement.getAttribute('value');
        this.updateLiveRegions(line, parsedState.errors);
        return;
      }

      const cartDrawer = document.querySelector('cart-drawer');

      this.classList.toggle('is-empty', parsedState.item_count === 0);
      const cartFooter = document.getElementById('main-cart-footer');

      if (cartFooter) cartFooter.classList.toggle('is-empty', parsedState.item_count === 0);
      if (cartDrawer) cartDrawer.classList.toggle('is-empty', parsedState.item_count === 0);

      this.renderContents(parsedState)
      const updatedValue = parsedState.items[line - 1] ? parsedState.items[line - 1].quantity : undefined;

      let message = '';
      if (items.length === parsedState.items.length && updatedValue !== parseInt(quantityElement.value)) {
        if (typeof updatedValue === 'undefined') {
          message = window.FoxThemeStrings.cartError;
        } else {
          message = window.FoxThemeStrings.quantityError.replace('[quantity]', updatedValue);
        }
      }

      this.updateLiveRegions(line, message);

      const lineItem = document.getElementById(`CartItem-${line}`) || document.getElementById(`CartDrawer-Item-${line}`);
      if (lineItem && lineItem.querySelector(`[name="${name}"]`)) {
        cartDrawer
          ? trapFocus(cartDrawer, lineItem.querySelector(`[name="${name}"]`))
          : lineItem.querySelector(`[name="${name}"]`).focus();
      } else if (parsedState.item_count === 0 && cartDrawer) {
        //TODO: Check later
        // trapFocus(cartDrawer.querySelector('.drawer__inner-empty'), cartDrawer.querySelector('a'));
      } else if (document.querySelector('.f-cart-item') && cartDrawer) {
        trapFocus(cartDrawer, document.querySelector('.f-cart-item__name'));
      }
      window.FoxThemeEvents.emit(`ON_CART_UPDATED`, parsedState)
    })
    .catch(() => {
      const errors = document.querySelector('#cart-errors, #CartDrawer-CartErrors');
      if (errors) {
        errors.textContent = window.FoxThemeStrings.cartError;
      }
    })
    .finally(() => {
      this.loading.finish()
    });
  }

  renderContents(parsedState) {
    this.getSectionsToRender().forEach((section) => {
      const elementToReplace = document.getElementById(section.id).querySelector(section.selector) || document.getElementById(section.id);
      if (elementToReplace) {
        elementToReplace.innerHTML = this.getSectionInnerHTML(
          parsedState.sections[section.section],
          section.selector
        );
      }
    });
  }

  updateLiveRegions(line, message) {
    if (!message) return;
    const lineItemError = this.querySelector(`#CartItem-${line}, #CartDrawer-Item-${line}`);

    window.FoxTheme.Notification.show({
      target: lineItemError.querySelector('.f-cart-item__quantity, .f-cart-drawer__error'),
      method: 'appendChild',
      type: 'warning',
      message: message,
      last: 5000
    })

    this.lineItemStatusElement.setAttribute('aria-hidden', true);

    const cartStatus =
      document.getElementById('cart-live-region-text') || document.getElementById('CartDrawer-LiveRegionText');
    cartStatus.setAttribute('aria-hidden', false);

    setTimeout(() => {
      cartStatus.setAttribute('aria-hidden', true);
    }, 1000);
  }

  getSectionInnerHTML(html, selector) {
    const domParser = new DOMParser().parseFromString(html, 'text/html')
    console.log(domParser, selector, 'domParser')
    return domParser.querySelector(selector) ? domParser.querySelector(selector).innerHTML : '';
  }

  enableLoading() {
    this.loading.start()
    document.activeElement.blur();
    this.lineItemStatusElement.setAttribute('aria-hidden', false);
  }
}

customElements.define('cart-items', CartItems);

