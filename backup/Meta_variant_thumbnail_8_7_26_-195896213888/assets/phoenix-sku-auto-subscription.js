(function (root) {
  const CONFIG = {
    handle:
      'the-phoenix-gravity-water-filter-with-postreat-fluoride-removal-filter-cartridge-8l',
    mainVariant: '47245643481381',
    mainSellingPlan: '739100656000',
    bundleType: 'phoenix-auto-subscription',
    bundleOption: '8l-kokocarb-postreat',
    companions: [
      {
        variant: '58414723465600',
        sellingPlan: '739030598016',
      },
      {
        variant: '58780018377088',
        sellingPlan: '739030565248',
      },
    ],
  };

  const numeric = (value) =>
    /^\d+$/.test(String(value || ''));

  const propertiesOf = (item) =>
    item?.properties || {};

  const pairKey = (variant, plan) =>
    `${variant}:${plan}`;

  const sellingPlanId = (item) =>
    String(
      item?.selling_plan_allocation?.selling_plan?.id ||
        item?.selling_plan ||
        item?.selling_plan_id ||
        ''
    );

  const isAutomatic = (item, role) => {
    const properties = propertiesOf(item);
    return (
      properties._bundle_type === CONFIG.bundleType &&
      properties._bundle_role === role
    );
  };

  function getProductHandle(form) {
    const handle =
      form.dataset.handle ||
      form.dataset.productHandle ||
      form.closest('product-form')?.dataset.productHandle ||
      form.closest('[data-product-handle]')?.dataset.productHandle;
    if (handle) {
      return handle;
    }

    const match =
      root.location?.pathname?.match(
        /\/products\/([^/?]+)/
      );

    return match
      ? decodeURIComponent(match[1])
      : '';
  }

  function getVariantId(form, formData) {
    let variant =
      String(formData.get('id') || '');

    if (numeric(variant)) {
      return variant;
    }

    const variantInput =
      form.querySelector('[name="id"]') ||
      form.closest('product-form')?.querySelector('[name="id"]');

    variant =
      String(variantInput?.value || '');

    if (numeric(variant)) {
      formData.set('id', variant);
      return variant;
    }

    if (form.closest('product-form')) {
      const urlVariant =
        new URLSearchParams(
          root.location?.search || ''
        ).get('variant');

      if (numeric(urlVariant)) {
        formData.set('id', urlVariant);
        return urlVariant;
      }
    }

    if (numeric(urlVariant)) {
      formData.set('id', urlVariant);
      return urlVariant;
    }
    return '';
  }

  function getSellingPlan(form, formData) {
    let plan =
      String(
        formData.get('selling_plan') || ''
      );

    if (numeric(plan)) {
      return plan;
    }
    const checked =
      form.querySelector(
        '[name="selling_plan"]:checked'
      ) ||
      form.closest('product-info')?.querySelector(
        '[name="selling_plan"]:checked'
      ) ||
      root.document.querySelector(
        '[name="selling_plan"]:checked'
      );
    plan =
      String(checked?.value || '');
    if (numeric(plan)) {
      formData.set(
        'selling_plan',
        plan
      );
      return plan;
    }
    const planInput =
      form.querySelector(
        'input[name="selling_plan"], select[name="selling_plan"]'
      ) ||
      form.closest('product-info')?.querySelector(
        'input[name="selling_plan"], select[name="selling_plan"]'
      ) ||
      root.document.querySelector(
        'input[name="selling_plan"], select[name="selling_plan"]'
      );
    plan =
      String(planInput?.value || '');
    if (numeric(plan)) {
      formData.set(
        'selling_plan',
        plan
      );
      return plan;
    }
    if (form.closest('product-form')) {
      const urlPlan =
        new URLSearchParams(
          root.location?.search || ''
        ).get('selling_plan');

      if (numeric(urlPlan)) {
        formData.set(
          'selling_plan',
          urlPlan
        );
        return urlPlan;
      }
    }

    if (numeric(urlPlan)) {
      formData.set(
        'selling_plan',
        urlPlan
      );
      return urlPlan;
    }
    return '';
  }

  function getSelection(form, formData) {
    const handle =
      getProductHandle(form);
    if (handle !== CONFIG.handle) {
      return null;
    }
    const variant =
      getVariantId(
        form,
        formData
      );
    const plan =
      getSellingPlan(
        form,
        formData
      );
    if (
      variant !== CONFIG.mainVariant ||
      plan !== CONFIG.mainSellingPlan
    ) {
      return null;
    }
    return {
      variant,
      plan,
    };
  }

  function createBundleId() {
    if (root.crypto?.randomUUID) {
      return root.crypto.randomUUID();
    }

    return (
      `phoenix-8l-${Date.now()}-` +
      Math.random()
        .toString(16)
        .slice(2)
    );
  }

  async function jsonRequest(url, options) {
    const response =
      await fetch(url, options);
    let data;
    try {
      data =
        await response.json();
    } catch (error) {
      throw new Error(
        'Shopify returned an invalid cart response.'
      );
    }
    if (
      !response.ok ||
      data?.status
    ) {
      throw new Error(
        data?.description ||
          data?.message ||
          'Unable to add subscription bundle to cart.'
      );
    }
    return data;
  }
  const jsonOptions = (body) => ({
    method: 'POST',
    headers: {
      'Content-Type':
        'application/json',
      Accept:
        'application/json',
    },
    body:
      JSON.stringify(body),
  });
  const cartStateUrl = () =>
    root.routes.cart_url.endsWith('.js')
      ? root.routes.cart_url
      : `${root.routes.cart_url}.js`;

  function existingAutomaticPairs(cart) {
    const pairs =
      new Map();
    for (const item of cart.items || []) {
      if (
        !isAutomatic(
          item,
          'subscription'
        )
      ) {
        continue;
      }
      const variant =
        String(
          item.variant_id ||
            item.id ||
            ''
        );
      const plan =
        sellingPlanId(item);
      if (
        numeric(variant) &&
        numeric(plan)
      ) {
        pairs.set(
          pairKey(
            variant,
            plan
          ),
          item
        );
      }
    }
    return pairs;
  }

  function buildItems(
    formData,
    cart
  ) {
    const bundleId =
      createBundleId();
    const companionPairs =
      CONFIG.companions.map(
        (companion) =>
          pairKey(
            companion.variant,
            companion.sellingPlan
          )
      );
    const parentProperties = {};

    for (
      const [
        name,
        value,
      ] of formData.entries()
    ) {
      const match =
        name.match(
          /^properties\[(.+)]$/
        );

      if (match) {
        parentProperties[
          match[1]
        ] = value;
      }
    }

    Object.assign(
      parentProperties,
      {
        _bundle_id:
          bundleId,

        _bundle_type:
          CONFIG.bundleType,

        _bundle_role:
          'parent',

        _bundle_option:
          CONFIG.bundleOption,

        _bundle_companions:
          companionPairs.join(','),
      }
    );

    const parent = {
      id:
        Number(
          CONFIG.mainVariant
        ),
      quantity:
        Math.max(
          1,
          Number(
            formData.get(
              'quantity'
            )
          ) || 1
        ),
      selling_plan:
        Number(
          CONFIG.mainSellingPlan
        ),
      properties:
        parentProperties,
    };

    const existing =
      existingAutomaticPairs(cart);
    const companions = [];
    for (
      const companion of
        CONFIG.companions
    ) {
      const pair =
        pairKey(
          companion.variant,
          companion.sellingPlan
        );
      if (existing.has(pair)) {
        continue;
      }
      companions.push({
        id:
          Number(
            companion.variant
          ),
        quantity: 1,
        selling_plan:
          Number(
            companion.sellingPlan
          ),
        properties: {
          _bundle_id:
            bundleId,

          _bundle_type:
            CONFIG.bundleType,

          _bundle_role:
            'subscription',
        },
      });
    }
    return [
      parent,
      ...companions,
    ];
  }

  async function refreshSections(
    sectionIds
  ) {
    if (!sectionIds.length) {
      return {};
    }

    const url =
      `${root.routes.cart_url}` +
      `?sections=${sectionIds.join(',')}`;
    return jsonRequest(url);
  }
  async function addBundle(
    form,
    formData,
    renderer
  ) {
    const cart =
      await jsonRequest(
        cartStateUrl()
      );

    const items =
      buildItems(
        formData,
        cart
      );

    let sectionIds =
      ['cart-icon-bubble'];

    if (
      renderer &&
      typeof renderer.getSectionsToRender ===
        'function'
    ) {
      sectionIds =
        renderer
          .getSectionsToRender()
          .map(
            (section) =>
              section.id
          );
    }
    const response =
      await jsonRequest(
        root.routes.cart_add_url,

        jsonOptions({
          items,
          sections:
            sectionIds,
          sections_url:
            root.location.pathname,
        })
      );

    const parent =
      (
        response.items || []
      ).find(
        (item) =>
          propertiesOf(item)
            ._bundle_role ===
          'parent'
      );

    if (parent) {
      response.id =
        parent.id;

      response.key =
        parent.key;
    }

    try {
      response.sections =
        await refreshSections(
          sectionIds
        );
    } catch (error) {
      console.warn(
        'Phoenix 8L subscription: cart sections could not be refreshed.',
        error
      );
    }

    if (
      typeof publish === 'function' &&
      typeof PUB_SUB_EVENTS !==
        'undefined'
    ) {
      publish(
        PUB_SUB_EVENTS.cartUpdate,
        {
          source:
            'phoenix-8l-subscription',

          productVariantId:
            CONFIG.mainVariant,

          cartData:
            response,
        }
      );
    }

    if (
      renderer &&
      typeof renderer.renderContents ===
        'function'
    ) {
      renderer.renderContents(
        response
      );

      renderer.classList.remove(
        'is-empty'
      );
    } else {
      root.location.assign(
        root.routes.cart_url
      );
    }
    return response;
  }

  root.Phoenix8LSubscription = {
    CONFIG,
    getProductHandle,
    getVariantId,
    getSellingPlan,
    getSelection,
    buildItems,
    addBundle,
  };
  if (
    typeof document ===
    'undefined'
  ) {
    return;
  }

  document.addEventListener(
  'submit',
  async (event) => {
    const form = event.target;
    if (!form?.matches?.('form')) {
      return;
    }

    const productForm = form.closest('product-form');
    if (!productForm) {
      return;
    }

    const formAction = form.getAttribute('action') || '';
    const isAddToCartForm =
      formAction.includes('/cart/add');
    if (!isAddToCartForm) {
      return;
    }
    const formData = new FormData(form);
      const selection =
        getSelection(
          form,
          formData
        );

      if (!selection) {
        return;
      }
      event.preventDefault();
      event.stopImmediatePropagation();
      const submitButton =
        form.querySelector(
          '[type="submit"]'
        );

      const spinner =
        submitButton?.querySelector(
          '.loading__spinner'
        );

      const existingError =
        form.querySelector(
          '[data-phoenix-8l-subscription-error]'
        );

      existingError?.remove();
      submitButton?.setAttribute(
        'aria-disabled',
        'true'
      );
      submitButton?.classList.add(
        'loading'
      );
      spinner?.classList.remove(
        'hidden'
      );
      try {
        const renderer =
          document.querySelector(
            'cart-notification'
          ) ||
          document.querySelector(
            'cart-drawer'
          );
        renderer?.setActiveElement?.(
          document.activeElement
        );
        await addBundle(
          form,
          formData,
          renderer
        );
      } catch (error) {
        console.error(
          'Phoenix 8L subscription error:',
          error
        );
        if (
          typeof publish ===
            'function' &&
          typeof PUB_SUB_EVENTS !==
            'undefined'
        ) {
          publish(
            PUB_SUB_EVENTS.cartError,
            {
              source:
                'phoenix-8l-subscription',

              productVariantId:
                CONFIG.mainVariant,

              errors:
                error.message,

              message:
                error.message,
            }
          );
        }

        const nativeError =
          form.querySelector(
            '.product-form__error-message-wrapper'
          );

        if (nativeError) {
          nativeError.removeAttribute(
            'hidden'
          );

          const errorMessage =
            nativeError.querySelector(
              '.product-form__error-message'
            );

          if (errorMessage) {
            errorMessage.textContent =
              error.message;
          }
        } else {
          const message =
            document.createElement(
              'div'
            );

          message.dataset
            .phoenix8lSubscriptionError =
            '';

          message.setAttribute(
            'role',
            'alert'
          );

          message.textContent =
            error.message;

          submitButton?.after(
            message
          );
        }
      } finally {
        submitButton?.removeAttribute(
          'aria-disabled'
        );

        submitButton?.classList.remove(
          'loading'
        );
        spinner?.classList.add(
          'hidden'
        );
      }
    },
    true
  );

})(
  typeof window !== 'undefined'
    ? window
    : globalThis
);