if (!customElements.get('variant-picker')) {
	const {getVariantFromOptionArray} = window.FoxTheme.ProductHelper
	class VariantPicker extends HTMLElement {
		constructor() {
			super()
			this.selectors = {
				container: '[data-variant-picker]',
				variantIdInput: 'input[name="id"]',
				pickerFields: ['[data-picker-field]'],
				optionNodes: ['.variant-picker__option'],
				productSku: '[data-product-sku]',
				productAvailability: '[data-product-availability]',
				shareUrlInput: '[data-share-url]',
			}
			this.container = this.closest(this.selectors.container)
			this.domNodes = queryDomNodes(this.selectors, this.container)

			this.setupData()
			this.initOptionSwatches()
			this.addEventListener('change', this.onVariantChange)
		}

		async setupData() {

			this.productId = this.container.dataset.productId
			this.sectionId = this.container.dataset.section
			this.productUrl = this.container.dataset.productUrl
			this.productHandle = this.container.dataset.productHandle
			this.section = this.container.closest(`[data-section-id="${this.sectionId}"]`)
			this.variantData = this.getVariantData()
			this.productData = await this.getProductJson(this.productUrl)

			const selectedVariantId = this.section && this.section.querySelector(this.selectors.variantIdInput).value
			this.currentVariant = this.variantData.find(variant => variant.id === Number(selectedVariantId))
			if (this.currentVariant) {
				this.hideSoldOutAndUnavailableOptions()
			}
		}

		onVariantChange() {
			this.getSelectedOptions()
			this.getSelectedVariant()
			this.updateButton(true, '', false)
			this.updatePickupAvailability()
			this.removeErrorMessage()

			if (!this.currentVariant) {
				this.updateButton(true, '', true)
				this.setUnavailable()
			} else {
				this.updateMedia()
				this.updateBrowserHistory()
				this.updateVariantInput()
				this.updateProductMeta()
				this.updatePrice()
				this.updateShareUrl()
				this.updateButton(!this.currentVariant.available, window.FoxThemeStrings.soldOut)
				this.hideSoldOutAndUnavailableOptions()
			}

			window.FoxThemeEvents.emit(`${this.productId}__VARIANT_CHANGE`, this.currentVariant, this)
		}

		getProductJson(productUrl) {
			return fetch(productUrl + '.js').then(function (response) {
				return response.json()
			})
		}

		getSelectedVariant() {
			let variant = getVariantFromOptionArray(this.productData, this.options)
			let options = [...this.options]
			if (!variant) {
				options.pop()
				variant = getVariantFromOptionArray(this.productData, options)
				if (!variant) {
					options.pop()
					variant = getVariantFromOptionArray(this.productData, options)
				}
				if (variant && variant.options) {
					this.options = [...variant.options]
				}
				this.updateSelectedOptions()
			}
			this.currentVariant = variant
		}

		getSelectedOptions() {
			const pickerFields = Array.from(this.querySelectorAll('[data-picker-field]'))
			this.options = pickerFields.map((field) => {
				const type = field.dataset.pickerField
				if (type === 'radio') return Array.from(field.querySelectorAll('input')).find((radio) => radio.checked).value
				return field.querySelector('select') && field.querySelector('select').value
			})
		}

		updateSelectedOptions() {
			this.domNodes.pickerFields.forEach((field, index) => {
				const selectedValue = field.dataset.selectedValue
				if (selectedValue !== this.options[index]) {
					const selectedOption = field.querySelector(`input[value="${this.options[index]}"]`)
					if (selectedOption) {
						selectedOption.checked = true
						field.updateSelectedValue()
					}
				}
			})
		}

		updateMedia() {
			if (!this.currentVariant) return
			if (!this.currentVariant.featured_media) return
			const mediaGallery = this.section.querySelector('media-gallery')
			mediaGallery && mediaGallery.setActiveMedia(this.currentVariant.featured_media.id)
		}

		updateBrowserHistory() {
			if (!this.currentVariant || this.dataset.updateUrl === 'false') return
			window.history.replaceState({}, '', `${this.productUrl}?variant=${this.currentVariant.id}`)
		}

		updateShareUrl() {
			const url = `${window.location.origin}${this.productUrl}?variant=${this.currentVariant.id}`
			const shareUrlInput = document.querySelectorAll(this.selectors.shareUrlInput)
			shareUrlInput && shareUrlInput.forEach(input => input.setAttribute('value', url))
		}

		updateVariantInput() {
			const productForms = document.querySelectorAll(`#product-form-${this.sectionId}, #product-form-installment`)
			productForms.forEach((productForm) => {
				const variantIdInput = productForm.querySelector(this.selectors.variantIdInput)
				variantIdInput.value = this.currentVariant.id
				variantIdInput.dispatchEvent(new Event('change', {bubbles: true}))
			})
		}

		updatePickupAvailability() {
			const pickUpAvailability = this.section && this.section.querySelector('pickup-availability')
			if (!pickUpAvailability) return

			if (this.currentVariant && this.currentVariant.available) {
				pickUpAvailability.fetchAvailability(this.currentVariant.id)
			} else {
				pickUpAvailability.removeAttribute('available')
				pickUpAvailability.innerHTML = ''
			}
		}

		removeErrorMessage() {
			const section = this.closest('section')
			if (!section) return

			const productForm = section.querySelector('product-form')
			// if (productForm) productForm.handleErrorMessage()
		}

		updatePrice() {
			const classes = {
				onSale: 'f-price--on-sale',
				soldOut: 'f-price--sold-out'
			}
			const selectors = {
				priceWrapper: '.f-price',
				salePrice: '.f-price-item--sale',
				compareAtPrice: ['.f-price-item--regular'],
				unitPrice: '.f-price__unit',
				saleBadge: '.f-price__badge-sale',
				saleAmount: '[data-sale-value]'
			}
			const money_format = window.FoxThemeSettings.money_format
			const {
				priceWrapper,
				salePrice,
				unitPrice,
				compareAtPrice,
				saleBadge,
				saleAmount
			} = queryDomNodes(selectors, this.section)

			const {compare_at_price, price, unit_price_measurement} = this.currentVariant

			const onSale = compare_at_price && compare_at_price > price
			const soldOut = !this.currentVariant.available

			if (onSale) {
				priceWrapper.classList.add(classes.onSale)
			} else {
				priceWrapper.classList.remove(classes.onSale)
			}

			if (soldOut) {
				priceWrapper.classList.add(classes.soldOut)
			} else {
				priceWrapper.classList.remove(classes.soldOut)
			}

			if (priceWrapper) priceWrapper.classList.remove('visibility-hidden')
			if (salePrice) salePrice.innerHTML = formatMoney(price, money_format)

			if (compareAtPrice && compareAtPrice.length && compare_at_price > price) {
				compareAtPrice.forEach(item => item.innerHTML = formatMoney(compare_at_price, money_format))
			} else {
				compareAtPrice.forEach(item => item.innerHTML = formatMoney(price, money_format))
			}

			if (saleBadge && compare_at_price > price) {
				const type = saleBadge.dataset.type
				if (type === 'text') return
				let value
				if (type === 'percentage') {
					const saving = (compare_at_price - price) * 100 / compare_at_price
					value = Math.round(saving) + '%'
				}
				if (type === 'fixed_amount') {
					value = formatMoney(compare_at_price - price, money_format)
				}

				saleAmount.textContent = value
			}

			if (unit_price_measurement && unitPrice) {
				unitPrice.classList.remove('f-hidden')
				const unitPriceContent = `<span>${formatMoney(this.currentVariant.unit_price, money_format)}</span>/<span data-unit-price-base-unit>${this._getBaseUnit()}</span>`
				unitPrice.innerHTML = unitPriceContent
			} else {
				unitPrice.classList.add('f-hidden')
			}
		}

		_getBaseUnit() {
			return this.currentVariant.unit_price_measurement.reference_value === 1
				? this.currentVariant.unit_price_measurement.reference_unit
				: this.currentVariant.unit_price_measurement.reference_value +
				this.currentVariant.unit_price_measurement.reference_unit
		}

		updateButton(disable = true, text, modifyClass = true) {
			const productForm = document.getElementById(`product-form-${this.sectionId}`)
			if (!productForm) return
			const addButton = productForm.querySelector('[name="add"]')
			const addButtonText = productForm.querySelector('[name="add"] > span:not(.f-icon)')

			if (!addButton) return

			if (disable) {
				addButton.setAttribute('disabled', 'disabled')
				if (text) addButtonText.textContent = text
			} else {
				addButton.removeAttribute('disabled')
				addButtonText.textContent = window.FoxThemeStrings.addToCart
			}
		}

		updateProductMeta() {
			const {available, sku, noSku} = this.currentVariant
			const {inStock, outOfStock} = window.FoxThemeStrings
			const productAvailability = this.section && this.section.querySelector(this.selectors.productAvailability)
			const productSku = this.section && this.section.querySelector(this.selectors.productSku)

			if (productSku) {
				if (sku) {
					productSku.textContent = sku
				} else {
					productSku.textContent = noSku
				}
			}

			if (productAvailability) {
				if (available) {
					productAvailability.textContent = inStock
					productAvailability.classList.remove('out-of-stock')
				} else {
					productAvailability.textContent = outOfStock
					productAvailability.classList.add('out-of-stock')
				}
			}
		}

		setUnavailable() {
			const button = document.getElementById(`product-form-${this.sectionId}`)
			const addButton = button.querySelector('[name="add"]')
			const addButtonText = button.querySelector('[name="add"] > span:not(.f-icon)')
			const priceWrapper = this.section.querySelector('.f-price')
			if (!addButton) return
			addButtonText.textContent = window.FoxThemeStrings.unavailable
			if (priceWrapper) priceWrapper.classList.add('visibility-hidden')
		}

		hideSoldOutAndUnavailableOptions() {
			const classes = {
				soldOut: 'variant-picker__option--soldout',
				unavailable: 'variant-picker__option--unavailable'
			}
			const variant = this.currentVariant
			const {optionNodes} = this.domNodes
			const {
				productData,
				productData: {variants, options: {length: maxOptions}}
			} = this

			optionNodes.forEach(optNode => {
				const {optionPosition, value} = optNode.dataset
				const optPos = Number(optionPosition)
				const isSelectOption = optNode.tagName === 'OPTION'

				let matchVariants = []
				if (optPos === maxOptions) {
					const optionsArray = Array.from(variant.options)
					optionsArray[maxOptions - 1] = value
					matchVariants.push(getVariantFromOptionArray(productData, optionsArray))
				} else {
					matchVariants = variants.filter(v => v.options[optPos - 1] === value && v.options[optPos - 2] === variant[`option${optPos - 1}`])
				}

				matchVariants = matchVariants.filter(Boolean)
				if (matchVariants.length) {
					optNode.classList.remove(classes.unavailable)
					isSelectOption && optNode.removeAttribute('disabled')
					const isSoldOut = matchVariants.every(v => v.available === false)
					const method = isSoldOut ? 'add' : 'remove'
					optNode.classList[method](classes.soldOut)
				} else {
					optNode.classList.add(classes.unavailable)
					isSelectOption && optNode.setAttribute('disabled', 'true')
				}
			})
		}


		getVariantData() {
			this.variantData = this.variantData || JSON.parse(this.container.querySelector('[type="application/json"]').textContent)
			return this.variantData
		}

		initOptionSwatches() {
			const {colorSwatches = []} = window.FoxThemeSettings
			this.domNodes.optionNodes.forEach(optNode => {
				let variantImage
				const {optionPosition, value, fallbackValue, optionType, hasCustomImage} = optNode.dataset
				if (optionType === 'color') {
					const variant = this.variantData.find(v => v[`option${optionPosition}`] && v[`option${optionPosition}`].toLowerCase() === value.toLowerCase())
					const check = colorSwatches.find(c => c.key.toLowerCase() === value.toLowerCase())
					const customColor = check ? check.value : ''

					if (variant && optionType === 'color' && hasCustomImage !== 'true') {
						variantImage = variant.featured_image ? variant.featured_image.src : ''
						if (variantImage && !customColor) {
							optNode.querySelector('label').style = `background-image: url(${ getSizedImageUrl(variantImage, '60x')}) !important;`
						}
					}

					if (customColor) {
						optNode.style.setProperty('--option-color', `${customColor}`)
					}

					if (!customColor && !variantImage) {
						optNode.style.setProperty('--option-color', `${fallbackValue}`)
					}
					return false;
				}
			})
		}
	}

	customElements.define('variant-picker', VariantPicker)
}
if (!customElements.get('variant-button')) {
	class VariantButton extends HTMLElement {
		constructor() {
			super()
			this.selectedSpan = this.querySelector('.selected-value')
			this.addEventListener('change', this.updateSelectedValue)
		}

		updateSelectedValue() {
			this.value = Array.from(this.querySelectorAll('input')).find((radio) => radio.checked).value
			this.setAttribute('data-selected-value', this.value)
			if (this.selectedSpan) this.selectedSpan.textContent = this.value
		}
	}

	customElements.define('variant-button', VariantButton)

	if (!customElements.get('variant-select')) {
		class VariantSelect extends VariantButton {
			constructor() {
				super()
			}

			updateSelectedValue() {
				this.value = this.querySelector('select').value
				this.setAttribute('data-selected-value', this.value)
				if (this.selectedSpan) this.selectedSpan.textContent = this.value
			}
		}

		customElements.define('variant-select', VariantSelect)
	}
	if (!customElements.get('variant-image')) {
		class VariantImage extends VariantButton {
			constructor() {
				super()
			}
		}

		customElements.define('variant-image', VariantImage)
	}
	if (!customElements.get('variant-color')) {
		class VariantColor extends VariantButton {
			constructor() {
				super()
			}
		}
		customElements.define('variant-color', VariantColor)
	}
}
