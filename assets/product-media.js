if (!customElements.get('media-gallery')) {
	customElements.define('media-gallery', class MediaGallery extends HTMLElement {
		constructor() {
			super()
			this.selectors = {
				mediaGallery: '[id^=Media-Gallery]',
				liveRegion: '[id^="GalleryStatus"]',
				viewer: '[id^="GalleryViewer"]',
				thumbnailsWrapper: '.f-product__media-thumbnails-wrapper',
				thumbnails: '[id^="GalleryThumbnails"]',
				thumbnailItems: ['[id^="GalleryThumbnailItem"]'],
				videos: ['.f-video__embed'],
				models: ['product-model'],
				medias: ['.f-product__media'],
				xrButton: '[data-first-xr-button]',
				sliderCounter: '.flickity-counter--current',
				toggleZoom: ['.js-photoswipe--zoom']
			}
		}

		connectedCallback() {
			this.init()
		}

		disconnectedCallback() {
			clearInterval(this.check)
		}

		init() {
			this.domNodes = queryDomNodes(this.selectors, this)
			this.mediaLayout = this.domNodes.mediaGallery.dataset.mediaLayout
			this.onlyImage = this.dataset.onlyImage === 'true'
			this.enableZoom = this.dataset.enableZoom === 'true'
			if (this.onlyImage) this.removeAttribute('data-media-loading')
			if (this.mediaLayout === 'carousel') {
				this.domNodes.thumbnails && this.domNodes.thumbnails.initSlider()
				this.initGallerySlider()
			} else {
				const allMediaAnimate = this.domNodes.mediaGallery.querySelectorAll('.f-scroll-trigger')
				if (FoxThemeSettings.isMobile) {
					this.domNodes.mediaGallery && this.domNodes.mediaGallery.initSlider()
					this.domNodes.thumbnails && this.domNodes.thumbnails.initSlider()
					if (allMediaAnimate.length > 0) {
						allMediaAnimate.forEach(media => {
							media.classList.remove('f-scroll-trigger')
						})
					}
				}
				document.addEventListener('matchMobile', () => {
					this.domNodes.mediaGallery && this.domNodes.mediaGallery.initSlider()
					this.domNodes.thumbnails && this.domNodes.thumbnails.initSlider()
					if (allMediaAnimate.length > 0) {
						allMediaAnimate.forEach(media => {
							media.classList.remove('f-scroll-trigger')
						})
					}
				})
				document.addEventListener('unmatchMobile', () => {
					this.domNodes.mediaGallery && this.domNodes.mediaGallery.destroy()
					this.domNodes.thumbnails && this.domNodes.thumbnails.destroy()
					if (allMediaAnimate.length > 0) {
						allMediaAnimate.forEach(media => {
							media.classList.remove('f-scroll-trigger')
						})
					}
				})
				this.removeAttribute('data-media-loading')
				if (this.enableZoom) this.initImageZoom()
			}
			if (this.onlyImage && this.enableZoom) this.initImageZoom()
		}

		update() {
			if (this.domNodes.mediaGallery) this.domNodes.mediaGallery.update()
			if (this.domNodes.thumbnails) this.domNodes.thumbnails.update()
		}

		initGallerySlider() {
			if (!this.domNodes.medias.length) return
			this.selectedSlide = null
			this.selectedMediaType = ''
			this.check = setInterval(() => {
				this.mediaGallery = this.domNodes.mediaGallery.slider && this.domNodes.mediaGallery.slider.instance
				this.thumbnails = this.domNodes.thumbnails && this.domNodes.thumbnails.slider && this.domNodes.thumbnails.slider.instance

				if (this.mediaGallery && typeof this.mediaGallery == 'object') {
					clearInterval(this.check)
					this.removeAttribute('data-media-loading')
					this.mediaGallery.on('change', this.onSlideChanged.bind(this))

					if (this.thumbnails) {
						if (this.thumbnails.cells && this.thumbnails.cells[0]) this.thumbnails.select(0)
						this.handleScreenChange()
					}
					if (this.enableZoom) this.initImageZoom()
				}
			}, 100)
      // prevent swipe to navigate gesture
      this.domNodes.mediaGallery.addEventListener('touchstart', (e) => {
        e.preventDefault();
      });
		}

		initImageZoom() {
			let dataSource = [];
			const allMedia = this.querySelectorAll('.f-product__media')
			if (allMedia) {
				allMedia.forEach(media => {
					if (media.dataset.mediaType === 'image') {
						dataSource.push({
							id: media.dataset.mediaIndex,
							src: media.dataset.src,
							width: media.dataset.pswpWidth,
							height: media.dataset.pswpHeight,
							mediaType: media.dataset.mediaType
						})
					}
					if (media.dataset.mediaType === 'model') {
						const html = `<div class="pswp__item--${media.dataset.mediaType}">${media.querySelector('product-model').outerHTML}</div>`
						dataSource.push({
							id: media.dataset.mediaIndex,
							html: html,
							mediaType: media.dataset.mediaType
						})
					}

					if (media.dataset.mediaType === 'video' || media.dataset.mediaType == 'external_video') {
						const html = `<div class="pswp__item--${media.dataset.mediaType}">${media.querySelector('deferred-media').outerHTML}</div>`
						dataSource.push({
							id: media.dataset.mediaIndex,
							html: html,
							mediaType: media.dataset.mediaType
						})
					}
				});
			}

			const options = {
				dataSource: dataSource,
				pswpModule: window.FoxTheme.PhotoSwipe,
				bgOpacity: 1,
				arrowPrev: false,
				arrowNext: false,
				zoom: false,
				close: false,
				counter: false,
				preloader: false 
			}

			const lightbox = new window.FoxTheme.PhotoSwipeLightbox(options)

			lightbox.addFilter('thumbEl', (thumbEl, data, index) => {
				const el = this.querySelector('[data-media-index="' + data.id + '"] img');
				if (el) {
					return el;
				}
				return thumbEl;
			});

			lightbox.addFilter('placeholderSrc', (placeholderSrc, slide) => {
				const el = this.querySelector('[data-media-index="' + slide.data.id + '"] img');
				if (el) {
					return el.src;
				}
				return placeholderSrc;
			});

			lightbox.on('change', () => {
				const currIndex = lightbox.pswp.currIndex
				if (!this.onlyImage) {
					const slider = this.domNodes.mediaGallery.slider && this.domNodes.mediaGallery.slider.instance
					if (slider) {
						setTimeout(() => {
							slider.select(currIndex, false, true)
						}, 300)
					}
				}
			});

			lightbox.on('pointerDown', (e) => {
				const currSlide = lightbox.pswp.currSlide.data
				if (currSlide.mediaType === 'video' || currSlide.mediaType === 'model' || currSlide.mediaType === 'external_video') {
					e.preventDefault()
				}
			});

			lightbox.on('uiRegister', () => {
				if (!this.onlyImage) {
					lightbox.pswp.ui.registerElement({
						name: 'next',
						ariaLabel: 'Next slide',
						order: 3,
						isButton: true,
						html: '<svg class="pswp-icon-next" viewBox="0 0 100 100"><path d="M 10,50 L 60,100 L 65,90 L 25,50  L 65,10 L 60,0 Z" class="arrow" transform="translate(100, 100) rotate(180) "></path></svg>',
						onClick: (event, el) => {
							lightbox.pswp.next();
						}
					})
					lightbox.pswp.ui.registerElement({
						name: 'prev',
						ariaLabel: 'Previous slide',
						order: 1,
						isButton: true,
						html: '<svg class="pswp-icon-prev" viewBox="0 0 100 100"><path d="M 10,50 L 60,100 L 65,90 L 25,50  L 65,10 L 60,0 Z" class="arrow"></path></svg>',
						onClick: (event, el) => {
							lightbox.pswp.prev();
						}
					})
				}
				
				lightbox.pswp.ui.registerElement({
					name: 'close-zoom',
					ariaLabel: 'Close zoom image',
					order: 2,
					isButton: true,
					html: '<svg xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false" role="presentation" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="f-icon-svg f-icon--medium  f-icon-close"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>',
					onClick: (event, el) => {
						lightbox.pswp.close(); 
					}
				})
			})

			lightbox.init()

			addEventDelegate({
				selector: this.selectors.toggleZoom[0],
				context: this,
				handler: (e, media) => {
					const isImage = media.dataset.mediaType === 'image'
					if (isImage) {
						const index = Number(media.dataset.mediaIndex) || 0
						lightbox.loadAndOpen(index);
					}
				}
			})
		}

		onSlideChanged(index) {
			this.draggable = true
			this.selectedSlide = this.mediaGallery.selectedElement
			this.selectedMediaType = this.selectedSlide.dataset.mediaType
			this.selectedMediaId = this.selectedSlide.dataset.mediaId

			const mediaAspectRatio = this.selectedSlide.dataset.aspectRatio
			this.domNodes.viewer.style.setProperty('--media-aspect-ratio', mediaAspectRatio)

			if ('model,external_video,video'.includes(this.selectedMediaType) && this.draggable) {
				this.toggleDraggable()
			} else {
				this.toggleDraggable(true)
			}

			if (this.selectedMediaType === 'model') {
				this.domNodes.xrButton && this.domNodes.xrButton.setAttribute('data-shopify-model3d-id', this.selectedMediaId)
			}

			if (this.thumbnails) {
				this.thumbnails.select(index)
			}

			if (this.domNodes.sliderCounter) {
				this.domNodes.sliderCounter.textContent = index + 1
			}

			this.domNodes.mediaGallery.classList.remove('pointer-move')

			this.playActiveMedia(this.selectedSlide)
		}

		handleScreenChange() {
			document.addEventListener('matchMobile', () => {
				this.domNodes.thumbnails.update()
				if (this.thumbnails.cells.length > 4) {
					this.thumbnails.options.wrapAround = true
					this.domNodes.thumbnails.update()
				}
			})
			document.addEventListener('unmatchMobile', () => {
				this.domNodes.thumbnails.update()
				if (this.thumbnails.cells.length < 6) {
					this.thumbnails.options.wrapAround = false
					this.domNodes.thumbnails.update()
				}
			})
			if (this.thumbnails.cells.length > 5) {
				this.domNodes.thumbnails.update()
				this.thumbnails.options.wrapAround = true
				this.domNodes.thumbnails.update()
			}
		}

		toggleDraggable(status = false) {
			this.draggable = status
			this.mediaGallery.options.draggable = status
			this.mediaGallery.updateDraggable()
		}
		playActiveMedia(selected) {
			window.pauseAllMedia()
			const deferredMedia = selected.querySelector('.deferred-media')
			if (deferredMedia) deferredMedia.loadContent(false)
		}

		setActiveMedia(mediaId) {
			const selectedMedia = this.domNodes.mediaGallery.querySelector(`[data-media-id="${mediaId}"]`)
			if (!selectedMedia) return
			const mediaIndex = Number(selectedMedia.dataset.mediaIndex)
			this.mediaGallery && this.mediaGallery.select(mediaIndex, true, false)

			this.scrollIntoView(selectedMedia)
			this.preventStickyHeader()
		}

		preventStickyHeader() {
			this.stickyHeader = this.stickyHeader || document.querySelector('sticky-header')
			if (!this.stickyHeader) return
			this.stickyHeader.dispatchEvent(new Event('preventHeaderReveal'))
		}

		scrollIntoView(selectedMedia) {
			if (this.mediaLayout !== 'stacked' || FoxThemeSettings.isMobile) return;
			selectedMedia.scrollIntoView({
				behavior: 'smooth'
			})
		}
	})
}
