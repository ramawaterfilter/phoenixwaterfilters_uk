if (!customElements.get('product-form')) {
  customElements.define(
    'product-form',
    class ProductForm extends HTMLElement {
      constructor() {
        super();

        this.form = this.querySelector('form');
        this.variantIdInput.disabled = false;
        this.form.addEventListener('submit', this.onSubmitHandler.bind(this));
        this.cart = document.querySelector('cart-notification') || document.querySelector('cart-drawer');
        this.submitButton = this.querySelector('[type="submit"]');
        this.submitButtonText = this.submitButton.querySelector('span');

        if (document.querySelector('cart-drawer')) this.submitButton.setAttribute('aria-haspopup', 'dialog');

        this.hideErrors = this.dataset.hideErrors === 'true';
      }

      onSubmitHandler(evt) {
        evt.preventDefault();
        if (this.submitButton.getAttribute('aria-disabled') === 'true') return;

        this.handleErrorMessage();

        this.submitButton.setAttribute('aria-disabled', true);
        this.submitButton.classList.add('loading');
        this.querySelector('.loading__spinner').classList.remove('hidden');

        const config = fetchConfig('javascript');
        config.headers['X-Requested-With'] = 'XMLHttpRequest';
        delete config.headers['Content-Type'];

        const formData = new FormData(this.form);
        this.updateVariantImageProperty(formData);
        if (this.cart) {
          formData.append(
            'sections',
            this.cart.getSectionsToRender().map((section) => section.id)
          );
          formData.append('sections_url', window.location.pathname);
          this.cart.setActiveElement(document.activeElement);
        }
        config.body = formData;

        const autoSubscriptionItems = this.getAutoSubscriptionItems(formData);
        const prepareRequest = autoSubscriptionItems
          ? fetch(`${routes.cart_url}.js`, { headers: { Accept: 'application/json' } })
              .then((response) => response.json())
              .then((cart) => {
                const [subscription, product] = autoSubscriptionItems;
                const subscriptionAlreadyExists = cart.items.some(
                  (item) =>
                    item.variant_id === subscription.id &&
                    Number(item.selling_plan_allocation?.selling_plan?.id) === subscription.selling_plan
                );

                if (subscriptionAlreadyExists) return;

                config.headers['Content-Type'] = 'application/json';
                config.body = JSON.stringify({
                  items: [product, subscription],
                  sections: formData.get('sections')?.split(','),
                  sections_url: formData.get('sections_url'),
                });
              })
          : Promise.resolve();

        prepareRequest
          .then(() => fetch(`${routes.cart_add_url}`, config))
          .then((response) => response.json())
          .then((response) => {
            if (!autoSubscriptionItems || !this.cart || response.status) return response;

            const sections = this.cart.getSectionsToRender().map((section) => section.id);
            return fetch(`${routes.cart_url}?sections=${sections.join(',')}`)
              .then((sectionResponse) => sectionResponse.json())
              .then((freshSections) => ({ ...response, sections: freshSections }))
              .catch(() => response);
          })
          .then((response) => {
            if (response.items) response = { ...response, ...response.items[0] };

            if (response.status) {
              publish(PUB_SUB_EVENTS.cartError, {
                source: 'product-form',
                productVariantId: formData.get('id'),
                errors: response.errors || response.description,
                message: response.message,
              });
              this.handleErrorMessage(response.description);

              const soldOutMessage = this.submitButton.querySelector('.sold-out-message');
              if (!soldOutMessage) return;
              this.submitButton.setAttribute('aria-disabled', true);
              this.submitButtonText.classList.add('hidden');
              soldOutMessage.classList.remove('hidden');
              this.error = true;
              return;
            } else if (!this.cart) {
              window.location = window.routes.cart_url;
              return;
            }

            const startMarker = CartPerformance.createStartingMarker('add:wait-for-subscribers');
            if (!this.error)
              publish(PUB_SUB_EVENTS.cartUpdate, {
                source: 'product-form',
                productVariantId: formData.get('id'),
                cartData: response,
              }).then(() => {
                CartPerformance.measureFromMarker('add:wait-for-subscribers', startMarker);
              });
            this.error = false;
            const quickAddModal = this.closest('quick-add-modal');
            if (quickAddModal) {
              document.body.addEventListener(
                'modalClosed',
                () => {
                  setTimeout(() => {
                    CartPerformance.measure("add:paint-updated-sections", () => {
                      this.cart.renderContents(response);
                    });
                  });
                },
                { once: true }
              );
              quickAddModal.hide(true);
            } else {
              CartPerformance.measure("add:paint-updated-sections", () => {
                this.cart.renderContents(response);
              });
            }
          })
          .catch((e) => {
            console.error(e);
          })
          .finally(() => {
            this.submitButton.classList.remove('loading');
            if (this.cart && this.cart.classList.contains('is-empty')) this.cart.classList.remove('is-empty');
            if (!this.error) this.submitButton.removeAttribute('aria-disabled');
            this.querySelector('.loading__spinner').classList.add('hidden');

            CartPerformance.measureFromEvent("add:user-action", evt);
          });
      }

      handleErrorMessage(errorMessage = false) {
        if (this.hideErrors) return;

        this.errorMessageWrapper =
          this.errorMessageWrapper || this.querySelector('.product-form__error-message-wrapper');
        if (!this.errorMessageWrapper) return;
        this.errorMessage = this.errorMessage || this.errorMessageWrapper.querySelector('.product-form__error-message');

        this.errorMessageWrapper.toggleAttribute('hidden', !errorMessage);

        if (errorMessage) {
          this.errorMessage.textContent = errorMessage;
        }
      }

      toggleSubmitButton(disable = true, text) {
        if (disable) {
          this.submitButton.setAttribute('disabled', 'disabled');
          if (text) this.submitButtonText.textContent = text;
        } else {
          this.submitButton.removeAttribute('disabled');
          this.submitButtonText.textContent = window.variantStrings.addToCart;
        }
      }

      get variantIdInput() {
        return this.form.querySelector('[name=id]');
      }

      getAutoSubscriptionItems(formData) {
        if (!this.dataset.autoSubscriptionVariantId) return null;

        const productInfo = this.closest('product-info');
        const variantJson = productInfo?.querySelector('[data-selected-variant]')?.textContent;
        const selectedOptions = variantJson ? JSON.parse(variantJson).options : [];
        const sellingPlan =
          formData.get('selling_plan') ||
          productInfo?.querySelector('input[name="selling_plan"]:checked, select[name="selling_plan"]')?.value ||
          (typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('selling_plan'));

        if (!selectedOptions.includes(this.dataset.autoSubscriptionOption) || !sellingPlan) return null;

        const bundleId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
        formData.set('selling_plan', sellingPlan);
        formData.set('properties[_bundle_id]', bundleId);
        formData.set('properties[_bundle_role]', 'parent');
        formData.set('properties[_bundle_type]', 'phoenix-auto-subscription');

        const properties = {};
        for (const [name, value] of formData) {
          const property = name.match(/^properties\[(.+)\]$/)?.[1];
          if (property) properties[property] = value;
        }

        return [
          {
            id: Number(this.dataset.autoSubscriptionVariantId),
            quantity: 1,
            selling_plan: Number(this.dataset.autoSubscriptionSellingPlanId),
            properties: {
              _bundle_id: bundleId,
              _bundle_role: 'subscription',
              _bundle_type: 'phoenix-auto-subscription',
            },
          },
          {
            id: Number(formData.get('id')),
            quantity: Number(formData.get('quantity')) || 1,
            selling_plan: Number(sellingPlan),
            properties,
          },
        ];
      }

      updateVariantImageProperty(formData) {
        const imageUrl = this.currentVariantImageUrl;
        if (!imageUrl) return;

        let input = this.form.querySelector('[data-variant-image-property]');
        if (!input) {
          input = document.createElement('input');
          input.type = 'hidden';
          input.name = 'properties[_variant_image]';
          input.dataset.variantImageProperty = '';
          this.form.appendChild(input);
        }

        input.value = imageUrl;
        formData.set('properties[_variant_image]', imageUrl);
      }

      get currentVariantImageUrl() {
        const productInfo = this.closest('product-info');
        const firstGalleryImage = productInfo?.querySelector('media-gallery .product__media-list img');
        return firstGalleryImage?.currentSrc || firstGalleryImage?.src || '';
      }
    }
  );
}
