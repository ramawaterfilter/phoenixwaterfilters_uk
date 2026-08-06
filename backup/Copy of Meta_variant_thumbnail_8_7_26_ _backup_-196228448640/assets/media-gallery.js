if (!customElements.get('media-gallery')) {
  customElements.define(
    'media-gallery',
    class MediaGallery extends HTMLElement {
      constructor() {
        super();
        this.elements = {
          liveRegion: this.querySelector('[id^="GalleryStatus"]'),
          viewer: this.querySelector('[id^="GalleryViewer"]'),
          thumbnails: this.querySelector('[id^="GalleryThumbnails"]'),
        };
        this.mql = window.matchMedia('(min-width: 750px)');
        this.initializeLooping();
        if (!this.elements.thumbnails) return;

        this.elements.viewer.addEventListener('slideChanged', debounce(this.onSlideChanged.bind(this), 500));
        this.elements.thumbnails.querySelectorAll('[data-target]').forEach((mediaToSwitch) => {
          mediaToSwitch
            .querySelector('button')
            .addEventListener('click', this.setActiveMedia.bind(this, mediaToSwitch.dataset.target, false));
        });
        if (this.dataset.desktopLayout.includes('thumbnail') && this.mql.matches) this.removeListSemantic();
      }

      initializeLooping() {
        const viewer = this.elements.viewer;
        const thumbnails = this.elements.thumbnails;

        if (!viewer?.slider) return;

        this.enableLoopingControls(viewer);
        viewer.addEventListener('click', this.onViewerButtonClick.bind(this), true);

        if (thumbnails?.slider) {
          this.enableLoopingControls(thumbnails);
          thumbnails.addEventListener('click', this.onThumbnailButtonClick.bind(this), true);
        }
      }

      enableLoopingControls(component) {
        component.enableSliderLooping = true;
        component.prevButton?.removeAttribute('disabled');
        component.nextButton?.removeAttribute('disabled');
      }

      onViewerButtonClick(event) {
        const button = event.target.closest?.('button[name="previous"], button[name="next"]');
        const viewer = this.elements.viewer;

        if (!button || button.closest('slider-component') !== viewer) return;

        const slides = Array.from(viewer.slider.querySelectorAll('.product__media-item')).filter(
          (slide) => slide.clientWidth > 0
        );
        if (slides.length < 2) return;

        let activeIndex = slides.findIndex((slide) => slide.classList.contains('is-active'));
        if (activeIndex < 0) {
          activeIndex = slides.reduce((closestIndex, slide, index) => {
            const currentDistance = Math.abs(slide.offsetLeft - viewer.slider.scrollLeft);
            const closestDistance = Math.abs(slides[closestIndex].offsetLeft - viewer.slider.scrollLeft);
            return currentDistance < closestDistance ? index : closestIndex;
          }, 0);
        }

        const isPreviousWrap = button.name === 'previous' && activeIndex === 0;
        const isNextWrap = button.name === 'next' && activeIndex === slides.length - 1;
        if (!isPreviousWrap && !isNextWrap) return;

        event.preventDefault();
        event.stopImmediatePropagation();

        const targetSlide = isPreviousWrap ? slides[slides.length - 1] : slides[0];
        this.setActiveMedia(targetSlide.dataset.mediaId, false, true);
      }

      onThumbnailButtonClick(event) {
        const button = event.target.closest?.('button[name="previous"], button[name="next"]');
        const thumbnails = this.elements.thumbnails;

        if (!button || button.closest('slider-component') !== thumbnails) return;

        const maxScroll = Math.max(0, thumbnails.slider.scrollWidth - thumbnails.slider.clientWidth);
        if (maxScroll <= 1) return;

        const isPreviousWrap = button.name === 'previous' && thumbnails.slider.scrollLeft <= 1;
        const isNextWrap = button.name === 'next' && thumbnails.slider.scrollLeft >= maxScroll - 1;
        if (!isPreviousWrap && !isNextWrap) return;

        event.preventDefault();
        event.stopImmediatePropagation();
        thumbnails.setSlidePosition(isPreviousWrap ? maxScroll : 0);
      }

      onSlideChanged(event) {
        const thumbnail = this.elements.thumbnails.querySelector(
          `[data-target="${event.detail.currentElement.dataset.mediaId}"]`
        );
        this.setActiveThumbnail(thumbnail);
      }

      setActiveMedia(mediaId, prepend, preventPageScroll = false) {
        const activeMedia =
          this.elements.viewer.querySelector(`[data-media-id="${mediaId}"]`) ||
          this.elements.viewer.querySelector('[data-media-id]');
        if (!activeMedia) {
          return;
        }
        this.elements.viewer.querySelectorAll('[data-media-id]').forEach((element) => {
          element.classList.remove('is-active');
        });
        activeMedia?.classList?.add('is-active');

        if (prepend) {
          activeMedia.parentElement.firstChild !== activeMedia && activeMedia.parentElement.prepend(activeMedia);

          if (this.elements.thumbnails) {
            const activeThumbnail = this.elements.thumbnails.querySelector(`[data-target="${mediaId}"]`);
            if (activeThumbnail) {
              activeThumbnail.parentElement.firstChild !== activeThumbnail &&
                activeThumbnail.parentElement.prepend(activeThumbnail);
            }
          }

          if (this.elements.viewer.slider) this.elements.viewer.resetPages();
        }

        this.preventStickyHeader();
        window.setTimeout(() => {
          if (!this.mql.matches || this.elements.thumbnails) {
            activeMedia.parentElement.scrollTo({ left: activeMedia.offsetLeft });
          }
          if (!preventPageScroll) {
            const activeMediaRect = activeMedia.getBoundingClientRect();
            // Don't scroll if the image is already in view
            if (activeMediaRect.top > -0.5) return;
            const top = activeMediaRect.top + window.scrollY;
            window.scrollTo({ top: top, behavior: 'smooth' });
          }
        });
        this.playActiveMedia(activeMedia);

        if (!this.elements.thumbnails) return;
        const activeThumbnail = this.elements.thumbnails.querySelector(`[data-target="${mediaId}"]`);
        if (!activeThumbnail) return;
        this.setActiveThumbnail(activeThumbnail);
        this.announceLiveRegion(activeMedia, activeThumbnail.dataset.mediaPosition);
      }

      setActiveThumbnail(thumbnail) {
        if (!this.elements.thumbnails || !thumbnail) return;

        this.elements.thumbnails
          .querySelectorAll('button')
          .forEach((element) => element.removeAttribute('aria-current'));
        thumbnail.querySelector('button').setAttribute('aria-current', true);
        if (this.elements.thumbnails.isSlideVisible(thumbnail, 10)) return;

        this.elements.thumbnails.slider.scrollTo({ left: thumbnail.offsetLeft });
      }

      announceLiveRegion(activeItem, position) {
        const image = activeItem.querySelector('.product__modal-opener--image img');
        if (!image) return;
        image.onload = () => {
          this.elements.liveRegion.setAttribute('aria-hidden', false);
          this.elements.liveRegion.innerHTML = window.accessibilityStrings.imageAvailable.replace('[index]', position);
          setTimeout(() => {
            this.elements.liveRegion.setAttribute('aria-hidden', true);
          }, 2000);
        };
        image.src = image.src;
      }

      playActiveMedia(activeItem) {
        window.pauseAllMedia();
        const deferredMedia = activeItem.querySelector('.deferred-media');
        if (deferredMedia) deferredMedia.loadContent(false);
      }

      preventStickyHeader() {
        this.stickyHeader = this.stickyHeader || document.querySelector('sticky-header');
        if (!this.stickyHeader) return;
        this.stickyHeader.dispatchEvent(new Event('preventHeaderReveal'));
      }

      removeListSemantic() {
        if (!this.elements.viewer.slider) return;
        this.elements.viewer.slider.setAttribute('role', 'presentation');
        this.elements.viewer.sliderItems.forEach((slide) => slide.setAttribute('role', 'presentation'));
      }
    }
  );
}
