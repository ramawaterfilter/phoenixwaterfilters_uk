(function (root) {
  const CONFIG = {
    handle: 'the-phoenix-gravity-water-filter',
    bundleType: 'phoenix-auto-subscription',
    options: {
      'Smart Carbon Cartridges': {
        code: 'carbon',
        mainVariants: [
          '47471042953509',
          '49477221974309',
          '49477222039845',
          '47471044002085',
          '49477222138149',
          '49477222170917',
          '47471044034853',
          '49477222269221',
          '49682687230245',
        ],
        mainSellingPlan: '738997633408',
        companions: ['58414723465600'],
      },
      'Smart Carbon + Fluoride Removal': {
        code: 'carbon-fluoride',
        mainVariants: [
          '47482131153189',
          '49477222072613',
          '49477222105381',
          '47482131185957',
          '49477222203685',
          '49477222236453',
          '47482131218725',
          '49477222334757',
          '49584030581029',
        ],
        mainSellingPlan: '738997600640',
        companions: ['58414723465600', '58780018377088'],
      },
    },
    companionSellingPlans: {
      '58414723465600': {
        '738997633408': '739030598016',
        '738997600640': '739030598016',
      },
      '58780018377088': { '738997600640': '739030565248' },
    },
  };

  const numeric = (value) => /^\d+$/.test(String(value || ''));
  const propertiesOf = (item) => item.properties || {};
  const isAutomatic = (item, role) => {
    const properties = propertiesOf(item);
    return properties._bundle_type === CONFIG.bundleType && properties._bundle_role === role;
  };
  const sellingPlanId = (item) =>
    String(item.selling_plan_allocation?.selling_plan?.id || item.selling_plan || item.selling_plan_id || '');
  const pairKey = (variant, plan) => `${variant}:${plan}`;

  function addOptionValues(formData, options = []) {
    for (const [index, value] of options.entries()) formData.append(`_phoenix_selected_option_${index}`, value);
    return formData;
  }

  function addNativeVariantOptions(formData, form) {
    const checkedPlanInput =
      form.querySelector('[name="selling_plan"]:checked') ||
      root.document?.querySelector('[name="selling_plan"]:checked');
    if (checkedPlanInput && !numeric(checkedPlanInput.value)) {
      formData.delete('selling_plan');
    } else if (!formData.get('selling_plan')) {
      const planInput =
        checkedPlanInput ||
        form.querySelector('select[name="selling_plan"], input[name="selling_plan"]') ||
        root.document.querySelector(
          'select[name="selling_plan"], input[name="selling_plan"]'
        );
      const plan = planInput?.value || new URLSearchParams(root.location?.search || '').get('selling_plan');
      if (numeric(plan)) formData.set('selling_plan', plan);
    }
    if (Array.from(formData.values()).some((value) => CONFIG.options[value])) return formData;
    const selectedVariant = form.closest('product-info')?.querySelector('variant-selects [data-selected-variant]');
    if (!selectedVariant) return formData;
    try {
      return addOptionValues(formData, JSON.parse(selectedVariant.textContent).options);
    } catch (error) {
      console.warn('Phoenix subscription could not read the selected variant options.', error);
      return formData;
    }
  }

  function selectionFrom(formData, handle) {
    if (handle !== CONFIG.handle) return null;
    const optionName = Array.from(formData.values()).find((value) => CONFIG.options[value]);
    const option = CONFIG.options[optionName];
    const variant = String(formData.get('id') || '');
    const plan = String(formData.get('selling_plan') || '');
    if (!option || !numeric(variant) || !numeric(plan)) return null;
    const validVariants = option.mainVariants || [option.mainVariant];
    if (!validVariants.includes(variant) || plan !== option.mainSellingPlan) return null;

    const companions = option.companions.map((id) => ({
      id,
      sellingPlan: CONFIG.companionSellingPlans[id]?.[plan],
    }));
    return companions.every((item) => numeric(item.sellingPlan)) ? { option, variant, plan, companions } : null;
  }

  function bundleId() {
    if (root.crypto?.randomUUID) return root.crypto.randomUUID();
    return `phoenix-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }

  function parseRequirements(cart) {
    const required = new Map();
    for (const item of cart.items || []) {
      if (!isAutomatic(item, 'parent') || item.quantity < 1) continue;
      const id = propertiesOf(item)._bundle_id;
      for (const pair of String(propertiesOf(item)._bundle_companions || '').split(',')) {
        const [variant, plan] = pair.split(':');
        if (numeric(variant) && numeric(plan) && !required.has(pairKey(variant, plan))) {
          required.set(pairKey(variant, plan), id);
        }
      }
    }
    return required;
  }

  function synchronization(cart, additionalRequirements = new Map()) {
    const required = parseRequirements(cart);
    for (const [pair, id] of additionalRequirements) required.set(pair, id);

    const updates = {};
    const kept = new Set();
    for (const item of cart.items || []) {
      if (!isAutomatic(item, 'subscription')) continue;
      const pair = pairKey(String(item.variant_id || item.id), sellingPlanId(item));
      if (!required.has(pair) || kept.has(pair)) updates[item.key] = 0;
      else {
        kept.add(pair);
        if (item.quantity !== 1) updates[item.key] = 1;
      }
    }

    const additions = [];
    for (const [pair, id] of required) {
      if (kept.has(pair)) continue;
      const [variant, plan] = pair.split(':');
      additions.push({
        id: Number(variant),
        quantity: 1,
        selling_plan: Number(plan),
        properties: { _bundle_id: id, _bundle_type: CONFIG.bundleType, _bundle_role: 'subscription' },
      });
    }
    return { updates, additions };
  }

  function buildAddPlan(formData, handle, cart, makeId = bundleId) {
    const selection = selectionFrom(formData, handle);
    if (!selection) return null;

    const id = makeId();
    const companionList = selection.companions.map((item) => pairKey(item.id, item.sellingPlan));
    const requirements = new Map(companionList.map((pair) => [pair, id]));
    const reconciliation = synchronization(cart, requirements);
    const properties = {};
    for (const [name, value] of formData.entries()) {
      const match = name.match(/^properties\[(.+)]$/);
      if (match) properties[match[1]] = value;
    }
    Object.assign(properties, {
      _bundle_id: id,
      _bundle_type: CONFIG.bundleType,
      _bundle_role: 'parent',
      _bundle_option: selection.option.code,
      _bundle_companions: companionList.join(','),
    });

    const parent = {
      id: Number(selection.variant),
      quantity: Math.max(1, Number(formData.get('quantity')) || 1),
      selling_plan: Number(selection.plan),
      properties,
    };
    return { items: [parent, ...reconciliation.additions], reconciliation, parentBundleId: id };
  }

  function visibleCount(cart) {
    return (cart.items || []).reduce(
      (count, item) => count + (isAutomatic(item, 'subscription') ? 0 : Number(item.quantity) || 0),
      0
    );
  }

  async function jsonRequest(url, options) {
    const response = await fetch(url, options);
    const data = await response.json();
    if (!response.ok || data.status) throw new Error(data.description || data.message || 'Cart request failed');
    return data;
  }

  const jsonOptions = (body) => ({
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(body),
  });
  const cartStateUrl = () =>
    root.routes.cart_url.endsWith('.js') ? root.routes.cart_url : `${root.routes.cart_url}.js`;

  async function freshSections(sectionIds) {
    if (!sectionIds.length) return {};
    return jsonRequest(`${root.routes.cart_url}?sections=${sectionIds.join(',')}`);
  }

  async function syncCart(cart, sectionIds = [], sectionsUrl = root.location?.pathname || '/') {
    const plan = synchronization(cart);
    if (!Object.keys(plan.updates).length && !plan.additions.length) return cart;

    let fallbackSections = cart.sections || {};
    if (Object.keys(plan.updates).length) {
      const response = await jsonRequest(
        root.routes.cart_update_url,
        jsonOptions({ updates: plan.updates, sections: sectionIds, sections_url: sectionsUrl })
      );
      fallbackSections = response.sections || fallbackSections;
    }
    if (plan.additions.length) {
      const response = await jsonRequest(
        root.routes.cart_add_url,
        jsonOptions({ items: plan.additions, sections: sectionIds, sections_url: sectionsUrl })
      );
      fallbackSections = response.sections || fallbackSections;
    }

    const finalCart = await jsonRequest(cartStateUrl());
    try {
      finalCart.sections = await freshSections(sectionIds);
    } catch (error) {
      console.warn('Phoenix subscription sections could not be refreshed; using mutation response.', error);
      finalCart.sections = fallbackSections;
    }
    return finalCart;
  }

  const productHandle = (form) =>
    form.dataset.handle || form.dataset.productHandle || form.closest('product-form')?.dataset.productHandle;

  async function submitBundle(form, formData, renderer) {
    const cart = await jsonRequest(cartStateUrl());
    const plan = buildAddPlan(formData, productHandle(form), cart);
    if (!plan) return false;

    const sectionIds = renderer ? renderer.getSectionsToRender().map((section) => section.id) : ['cart-icon-bubble'];
    if (Object.keys(plan.reconciliation.updates).length) {
      await jsonRequest(root.routes.cart_update_url, jsonOptions({ updates: plan.reconciliation.updates }));
    }
    const response = await jsonRequest(
      root.routes.cart_add_url,
      jsonOptions({ items: plan.items, sections: sectionIds, sections_url: root.location.pathname })
    );
    const parent = (response.items || []).find((item) => propertiesOf(item)._bundle_role === 'parent');
    if (parent) Object.assign(response, { id: parent.id, key: parent.key });
    try {
      response.sections = await freshSections(sectionIds);
    } catch (error) {
      console.warn('Phoenix subscription sections could not be refreshed; using add response.', error);
    }

    if (typeof publish === 'function' && typeof PUB_SUB_EVENTS !== 'undefined') {
      publish(PUB_SUB_EVENTS.cartUpdate, {
        source: 'phoenix-auto-subscription',
        productVariantId: formData.get('id'),
        cartData: response,
      });
    }
    if (renderer) {
      renderer.renderContents(response);
      renderer.classList.remove('is-empty');
    } else root.location.assign(root.routes.cart_url);
    return true;
  }

  const api = {
    CONFIG,
    addOptionValues,
    addNativeVariantOptions,
    selectionFrom,
    buildAddPlan,
    synchronization,
    visibleCount,
    syncCart,
    submitBundle,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.PhoenixAutoSubscription = api;

  if (typeof document !== 'undefined') {
    document.addEventListener(
      'submit',
      async (event) => {
        const form = event.target;
        if (!form?.matches?.('form')) return;
        const formData = addNativeVariantOptions(new FormData(form), form);
        form.closest('product-form')?.updateVariantImageProperty?.(formData);
        if (!selectionFrom(formData, productHandle(form))) return;

        event.preventDefault();
        event.stopImmediatePropagation();
        const button = form.querySelector('[type="submit"]');
        const spinner = button?.querySelector('.loading__spinner');
        const errorBox = form.querySelector('[data-phoenix-auto-subscription-error]');
        errorBox?.remove();
        button?.setAttribute('aria-disabled', 'true');
        button?.classList.add('loading');
        spinner?.classList.remove('hidden');
        try {
          const renderer = document.querySelector('cart-notification') || document.querySelector('cart-drawer');
          renderer?.setActiveElement?.(document.activeElement);
          await submitBundle(form, formData, renderer);
        } catch (error) {
          console.error(error);
          if (typeof publish === 'function' && typeof PUB_SUB_EVENTS !== 'undefined') {
            publish(PUB_SUB_EVENTS.cartError, {
              source: 'phoenix-auto-subscription',
              productVariantId: formData.get('id'),
              errors: error.message,
              message: error.message,
            });
          }
          const nativeError = form.querySelector('.product-form__error-message-wrapper');
          if (nativeError) {
            nativeError.removeAttribute('hidden');
            nativeError.querySelector('.product-form__error-message').textContent = error.message;
          } else {
            const message = document.createElement('div');
            message.dataset.phoenixAutoSubscriptionError = '';
            message.setAttribute('role', 'alert');
            message.textContent = error.message;
            button?.after(message);
          }
        } finally {
          button?.removeAttribute('aria-disabled');
          button?.classList.remove('loading');
          spinner?.classList.add('hidden');
        }
      },
      true
    );
  }
})(typeof window !== 'undefined' ? window : globalThis);
