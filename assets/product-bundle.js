if (!customElements.get('product-bundle')) {
  customElements.define('product-bundle', class ProductBundle extends HTMLElement {
    constructor() {
      super()
      this.selectors = {
        bundleTotalPrice: ['[data-total-price]'],
        productItem: ['.product-bundle__product'],
        btnAddBundle: '[data-add-bundle]',
        variantPickers: ['[name="id"]'],
        productVariants: ['[data-product-variants]'],
        errorWrapper: '.product-bundle__error'
      }

      this.domNodes = queryDomNodes(this.selectors, this)
    }

    connectedCallback() {
      this.init()
    }
    init() {
      this.productVariants = {}
      this.domNodes.productVariants.map(variant => {
        const productId = variant.dataset.productId
        const variantJSon = variant.innerHTML ? JSON.parse(variant.innerHTML) : []
        this.productVariants[productId] = variantJSon
      })

      addEventDelegate({
        context: this,
        event: 'change',
        selector: this.selectors.variantPickers[0],
        handler: (e) => this._handleChangePrice(e)
      })

      addEventDelegate({
        context: this,
        selector: this.selectors.btnAddBundle,
        handler: (e, button) => this._handleAddItems(e, button)
      })
    }

    _handleChangePrice(evt) {
      const product = evt.target && evt.target.closest(this.selectors.productItem[0])
      if (!product) return;
      const selectedVariant = evt.target && evt.target.value
      const productId = product.dataset.productId
      const variantsJSon = this.productVariants[productId]

      const price = product.querySelector('[data-price]')
      const regularPrice = product.querySelector('[data-regular-price]')
      const comparePrice = product.querySelector('[data-compare-price]')

      const variant = variantsJSon.find(v => v.id === parseInt(selectedVariant))

      regularPrice
        .innerHTML = formatMoney(variant.price, window.FoxThemeSettings.money_format)
      regularPrice.dataset.price = variant.price
      if (variant.compare_at_price && variant.compare_at_price > variant.price) {
        price.classList.add('price--on-sale')
        comparePrice.innerHTML = formatMoney(variant.compare_at_price, window.FoxThemeSettings.money_format)
      } else {
        price.classList.remove('price--on-sale')
      }

      this._calculateTotalPrice()
    }

    _calculateTotalPrice() {
      const selectedVariants =  Array.from(this.querySelectorAll(this.selectors.productItem)).map(product => {
        const productId = product.dataset.productId
        const variants =  this.productVariants[productId]

        const select = product.querySelector('[name="id"]')
        return variants && select && variants.find(v => v.id === Number(select.value))
      }).filter(Boolean)

      const totalPrice = selectedVariants.reduce((s, v) => s + v.price, 0)
      const savedPrice = selectedVariants.reduce((s, v) => {
        if (v.compare_at_price) return s + v.compare_at_price
        return s + v.price
      }, 0)
      this.querySelector('[data-total-price]').innerHTML = formatMoney(totalPrice, window.FoxThemeSettings.money_format)
      this.querySelector('[data-saved-price]').innerHTML = formatMoney(savedPrice, window.FoxThemeSettings.money_format)
    }

    _handleAddItems(e, button) {
      e.preventDefault()
      const {FoxThemeStrings} = window
      const inputIds = this.querySelectorAll('[name="id"]')
      const errorWrapper = this.querySelector(this.selectors.errorWrapper)

      const ids = [...inputIds].map(input => input.value)
      const data = { items: ids.map(id => ({ id, quantity: 1 })) }

      const config = {
        mode: 'same-origin',
        credentials: 'same-origin',
        headers: {
          'X-Requested-With': 'XMLHttpRequest',
          'Content-Type': 'application/json'
        }
      }
      config.method = 'POST'
      config.body = JSON.stringify(data)

      this._toggleLoading(true, button)
      // TODO: Handle response message
      fetch('/cart/add.js', config)
        .then(async res => {
          if (!res.ok) {
            const err = await res.json()
            this._showError(err.description ? err.description : "Failed to add all items to cart!", errorWrapper)
          } else {
            if (!FoxThemeSettings.cart.openDrawerWhenAdded || FoxThemeSettings.cart.cartType === 'page') {
              this.Notification.show({
                target: this.domNodes.errorWrapper,
                method: 'appendChild',
                type: 'success',
                message: FoxThemeStrings.item_added,
                last: 3000
              })
            }
            if (FoxThemeSettings.cart.cartType === 'page') {
              FoxThemeCartHelpers.getState().then(state => {
                FoxThemeCartHelpers.updateCartCount(state.item_count)
              })
            }
            FoxThemeEvents.emit(`ON_ITEM_ADDED`, res)
          }
        })
        .catch(err => {
          this._showError(err && err.toString(), errorWrapper)
        })
        .finally(() => {
          this._toggleLoading(false, button)
        })
    }
    _showError(err, errorWrapper) {
      FoxTheme.Notification.show({
        target: errorWrapper,
        method: 'appendChild',
        type: 'warning',
        message: err,
        last: 3000
      })
    }
    _toggleLoading(loading, button) {
      if (loading) {
        button.classList.add('btn--loading')
      } else {
        button.classList.remove('btn--loading')
      }
    }
  })
}
