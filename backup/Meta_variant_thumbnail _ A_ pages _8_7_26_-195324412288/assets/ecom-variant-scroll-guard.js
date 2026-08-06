(function () {
  'use strict';

  var variantSelector =
    '.ecom-product-form--single .ecom-product-single__variant-picker, ' +
    '.ecom-product-form--single .ecom-product-single__variant-picker-container, ' +
    '.ecom-product-form--single .single-option-selector, ' +
    '.ecom-product-form--single .ecom-product-single__swatch-item, ' +
    '.ecom-product-form--single .ecom-product-single__swatch-select';
  var formSelector = '.ecom-product-form--single';
  var savedPosition = null;
  var expiresAt = 0;

  function savePosition() {
    savedPosition = {
      x: window.scrollX,
      y: window.scrollY,
    };
    expiresAt = Date.now() + 4000;
  }

  function hasActivePosition() {
    return savedPosition && Date.now() < expiresAt;
  }

  function clearPosition() {
    savedPosition = null;
    expiresAt = 0;
  }

  function restoreNow() {
    if (!hasActivePosition()) return;
    window.scrollTo(savedPosition.x, savedPosition.y);
  }

  function restorePosition() {
    if (!hasActivePosition()) return;
    restoreNow();
    requestAnimationFrame(restoreNow);
    setTimeout(restoreNow, 50);
    setTimeout(restoreNow, 150);
    setTimeout(restoreNow, 350);
  }

  function captureVariantInteraction(event) {
    if (!event.target || !event.target.closest) return;
    if (event.target.closest(variantSelector)) savePosition();
  }

  ['pointerdown', 'mousedown', 'touchstart', 'click', 'change'].forEach(function (eventName) {
    document.addEventListener(eventName, captureVariantInteraction, true);
  });

  document.addEventListener('ecomVariantChange', restorePosition, true);

  document.addEventListener(
    'change',
    function (event) {
      if (!event.target || !event.target.closest) return;
      if (event.target.closest(".ecom-product-form--single [name='id']")) restorePosition();
    },
    true
  );

  ['wheel', 'touchmove'].forEach(function (eventName) {
    window.addEventListener(
      eventName,
      function () {
        if (hasActivePosition()) clearPosition();
      },
      { passive: true }
    );
  });

  var observer = new MutationObserver(function (mutations) {
    if (!hasActivePosition()) return;
    var changedProductForm = mutations.some(function (mutation) {
      var target = mutation.target;
      return target && target.closest && target.closest(formSelector);
    });
    if (changedProductForm) restorePosition();
  });

  function observeProductChanges() {
    if (!document.body) return;
    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', observeProductChanges, { once: true });
  } else {
    observeProductChanges();
  }
})();
