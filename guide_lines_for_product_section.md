# Product Section Variant And Gallery Guide

This document explains how `sections/main-product.liquid` handles product variants, variant-specific content, and the product image gallery. It is written so another AI agent or developer can recreate the same behavior in another Shopify theme.

## Main Structure

`sections/main-product.liquid` renders the product page as two main columns:

```liquid
<div class="product__media-wrapper">
  {% render 'product-media-gallery', variant_images: variant_images %}
</div>

<div class="product__info-wrapper">
  ... product title, price, variants, buy buttons, tabs ...
</div>
```

The important files are:

- `sections/main-product.liquid`: main product section shell.
- `snippets/product-media-gallery.liquid`: product image gallery and custom gallery JavaScript.
- `snippets/product-variant-picker.liquid`: variant picker UI and variant JSON output.
- `assets/product-info.js`: AJAX variant update logic.
- `assets/global.js`: `variant-selects`, `slider-component`, and theme event utilities.

The product media gallery in this theme does not use the Swiper library. It uses Shopify/Dawn-style `slider-component` plus custom JavaScript in `snippets/product-media-gallery.liquid`.

## Variant Picker Logic

The variant picker is rendered from `snippets/product-variant-picker.liquid`.

It creates a custom element:

```liquid
<variant-selects
  id="variant-selects-{{ section.id }}"
  data-section="{{ section.id }}"
>
```

It loops through all product options:

```liquid
{% for option in product.options_with_values %}
```

Depending on the block settings, each option is rendered as one of these picker types:

- `swatch`
- `button` / pill
- `dropdown`
- `swatch_dropdown`

At the bottom of the picker, it outputs two JSON scripts:

```liquid
<script type="application/json" data-selected-variant>
  {{ product.selected_or_first_available_variant | json }}
</script>

<script type="application/json" data-product-variants>
  {{ product.variants | json }}
</script>
```

These JSON blocks are required. `assets/product-info.js` reads them to know the current selected variant and all possible product variants.

## Variant Change Flow

When a customer changes a radio button or select option, the `VariantSelects` class in `assets/global.js` runs.

It updates the visible selected option label and publishes:

```js
PUB_SUB_EVENTS.optionValueSelectionChange
```

The `ProductInfo` class in `assets/product-info.js` subscribes to that event:

```js
subscribe(
  PUB_SUB_EVENTS.optionValueSelectionChange,
  this.handleOptionValueChange.bind(this)
);
```

Then `handleOptionValueChange()` runs.

The flow is:

1. Read selected option value IDs from `variant-selects`.
2. Find the matching variant from `[data-product-variants]`.
3. Update hidden product form inputs:

   ```js
   input[name="id"] = variant.id
   ```

4. Update the browser URL:

   ```text
   /product-handle?variant=123456789
   ```

5. Fetch the current product section again using:

   ```text
   ?section_id={{ section.id }}&option_values=...
   ```

6. Parse the returned HTML.
7. Replace price, SKU, inventory, quantity rules, and media gallery.
8. Publish:

   ```js
   PUB_SUB_EVENTS.variantChange
   ```

9. Dispatch this custom event after the gallery DOM has been updated:

   ```js
   variant:media:updated
   ```

The custom gallery script listens for `variant:media:updated` so it can refresh slide data and reset the active image.

## Product Form Variant ID

The selected variant ID is written into all product form hidden inputs:

```js
this.querySelectorAll(
  `#product-form-${this.dataset.section}, #product-form-installment-${this.dataset.section}`
).forEach((productForm) => {
  const input = productForm.querySelector('input[name="id"]');
  input.value = variantId ?? '';
  input.dispatchEvent(new Event('change', { bubbles: true }));
});
```

This is what makes the Add to Cart form submit the currently selected variant.

## Inventory Logic

Inside `sections/main-product.liquid`, the price block contains a custom stock indicator:

```liquid
<div id="inventory-indicator" class="inventory-box">
  {% if variant.available %}
    <span class="inventory-status inventory-available">
      In Stock
    </span>
  {% else %}
    <span class="inventory-status inventory-unavailable">
      Out of stock
    </span>
  {% endif %}
</div>
```

It also defines:

```js
function updateStock(variant) {
  const container = document.getElementById('inventory-indicator');
  if (!container || !variant) return;

  if (variant.available) {
    container.innerHTML = `
      <span class="inventory-status inventory-available">
        In stock
      </span>
    `;
  } else {
    container.innerHTML = `
      <span class="inventory-status inventory-unavailable">
        Out of stock
      </span>
    `;
  }
}
```

In this file, the function exists but is not directly wired to `variantChange`. To recreate it cleanly, connect it to the theme variant event:

```js
subscribe(PUB_SUB_EVENTS.variantChange, ({ data }) => {
  updateStock(data.variant);
});
```

or listen to a custom variant-change event if the theme uses a different event system.

## Variant Description Logic

The description block supports variant-level descriptions.

It checks the selected variant metafield:

```liquid
assign selected_variant = product.selected_or_first_available_variant
assign variant_description = selected_variant.metafields.custom.variant_level_description
```

Then it renders the variant description if it exists:

```liquid
{% if variant_description != blank %}
  {{ variant_description | metafield_tag }}
{% else %}
  {{ product.description }}
{% endif %}
```

To recreate this feature, create a variant metafield:

```text
namespace: custom
key: variant_level_description
owner: variant
type: rich text or multi-line text
```

If the selected variant has this metafield, show it. Otherwise show the normal product description.

## Variant Metafield Accordion

The product section includes a custom block type:

```liquid
variant_metafield_tab
```

It reads namespace and key from block settings:

```liquid
assign metafield_namespace = block.settings.metafield_namespace | strip
assign metafield_key = block.settings.metafield_key | strip
assign variant_metafield = selected_variant.metafields[metafield_namespace][metafield_key]
```

Then it renders the selected variant metafield inside an accordion:

```liquid
<variant-metafield-accordion>
  <details>
    <summary>...</summary>
    <div data-variant-metafield-content>
      {{ variant_metafield | metafield_tag }}
    </div>
  </details>
</variant-metafield-accordion>
```

To recreate this:

1. Add a product section block with settings for heading, icon, metafield namespace, and metafield key.
2. Read the selected variant metafield dynamically.
3. Hide the accordion if the metafield is blank and the block setting says to hide empty content.

## Product Gallery Logic

The product gallery is rendered from `snippets/product-media-gallery.liquid`.

At the top, it checks whether the selected variant has custom variant images:

```liquid
assign selected_variant = product.selected_or_first_available_variant
assign variant_file_images = selected_variant.metafields.custom.variant_images.value
assign use_variant_file_images = false

if variant_file_images != blank
  assign use_variant_file_images = true
endif
```

There are two gallery modes.

## Gallery Mode 1: Variant Metafield Images

If `selected_variant.metafields.custom.variant_images.value` is not blank, the gallery uses only those images.

The `<media-gallery>` receives:

```liquid
data-variant-file-gallery
```

The main image list loops through:

```liquid
{% for image in variant_file_images %}
```

Each image gets a generated media ID:

```liquid
{{ section.id }}-variant-{{ selected_variant.id }}-file-{{ forloop.index }}
```

That generated ID is used consistently in:

- main slide `data-media-id`
- zoom button `data-media-id`
- desktop thumbnail grid button `data-media-id`
- thumbnail slider `data-target`

To recreate this feature, create a variant metafield:

```text
namespace: custom
key: variant_images
owner: variant
type: list.file_reference
```

When this metafield exists, render the gallery from the variant image list instead of `product.media`.

## Gallery Mode 2: Normal Product Media

If the variant does not have custom variant images, the gallery uses:

```liquid
product.media
```

If the selected variant has `featured_media`, that media is placed first and marked active:

```liquid
class="... is-active"
```

Then the rest of `product.media` is rendered after it.

If `section.settings.hide_variants` is enabled, the theme can hide media that are attached to variants:

```liquid
variant_images = product.images | where: 'attached_to_variant?', true | map: 'src'
```

and then skip media where:

```liquid
variant_images contains media.src
```

## Gallery UI Pieces

The gallery renders several synced UI parts.

Main large image list:

```liquid
<ul
  id="Slider-Gallery-{{ section.id }}"
  class="product__media-list contains-media grid grid--peek list-unstyled slider slider--mobile"
>
```

Desktop custom arrows:

```liquid
<button id="galleryPrev-{{ section.id }}" class="gallery-arrow gallery-arrow--prev">
<button id="galleryNext-{{ section.id }}" class="gallery-arrow gallery-arrow--next">
```

Mobile slider counter:

```liquid
<span class="slider-counter--current">1</span>
<span class="slider-counter--total">{{ media_count }}</span>
```

Mobile dots:

```liquid
<div class="product-media-mobile-dots" data-gallery-dots>
```

Desktop custom 2x6 thumbnail grid:

```liquid
<div id="GalleryThumbnails2x6-{{ section.id }}" class="thumbnail-grid-2x6">
```

Shopify/Dawn thumbnail slider:

```liquid
<slider-component id="GalleryThumbnails-{{ section.id }}">
```

## Gallery JavaScript

The custom gallery JavaScript lives near the bottom of `snippets/product-media-gallery.liquid`.

Important functions:

```js
initGallery(sectionId)
refreshMediaData()
goToSlide(index)
updateArrows()
updateCounter()
updateDots()
updateGrid()
handleVariantChange(resetToFirst)
setupTouchSwipe()
```

`initGallery(sectionId)` finds the gallery elements for one section:

```js
const gallery = document.getElementById('MediaGallery-' + sectionId);
const slider = document.getElementById('Slider-Gallery-' + sectionId);
const grid = document.getElementById('GalleryThumbnails2x6-' + sectionId);
const prevBtn = document.getElementById('galleryPrev-' + sectionId);
const nextBtn = document.getElementById('galleryNext-' + sectionId);
```

`refreshMediaData()` collects all current slides:

```js
li[data-media-id]
```

and builds an array with:

```js
mediaId
element
alt
src
```

`goToSlide(index)`:

1. Normalizes the index.
2. Updates `currentIndex`.
3. Adds `is-active` to the selected slide.
4. Removes `is-active` from other slides.
5. Scrolls the slider to the active slide.
6. Updates arrows, counter, dots, and thumbnail grid.

`updateGrid()` rebuilds the custom desktop thumbnail grid from the current gallery media. Each thumbnail button jumps to the matching slide.

`setupTouchSwipe()` listens for horizontal swipes on the gallery and moves previous/next.

## Variant Change To Gallery Update

This is the complete chain:

1. Customer changes a product option.
2. `VariantSelects` publishes selected option values.
3. `ProductInfo.handleOptionValueChange()` fetches updated section HTML.
4. `ProductInfo.updateMedia()` replaces the media gallery DOM.
5. `ProductInfo.updateMedia()` dispatches:

   ```js
   document.dispatchEvent(new CustomEvent('variant:media:updated', {
     detail: { sectionId: this.dataset.section }
   }));
   ```

6. Gallery JavaScript listens:

   ```js
   document.addEventListener('variant:media:updated', (event) => {
     if (!event.detail?.sectionId || event.detail.sectionId === sectionId) {
       handleVariantChange(true);
     }
   });
   ```

7. `handleVariantChange(true)` waits briefly, refreshes slide data, resets to the first image, and updates arrows/counter/dots/grid.

When gallery has `data-variant-file-gallery`, it treats the gallery as a fresh variant-specific image set.

When gallery does not have `data-variant-file-gallery`, it can reorder media based on active image alt text.

## Media Replacement In product-info.js

`ProductInfo.updateMedia(html, variantFeaturedMediaId)` is the important function.

It reads the current gallery:

```js
const mediaGallerySource = this.querySelector('media-gallery ul');
const sourceGallery = this.querySelector('media-gallery');
```

and the fetched gallery:

```js
const mediaGalleryDestination = html.querySelector(`media-gallery ul`);
const destinationGallery = html.querySelector('media-gallery');
```

If the new gallery has `data-variant-file-gallery`, it fully replaces:

```js
media-gallery ul.product__media-list
media-gallery ul.thumbnail-list
media-gallery .thumbnail-grid-2x6
```

If not, it:

1. Removes old media not in the new destination.
2. Prepends new media not already in the DOM.
3. Sorts source media to match destination order.
4. Replaces thumbnail lists and thumbnail grid.
5. Updates total counter.
6. Calls `setActiveMedia()` for the selected variant featured media.
7. Updates modal media content.
8. Dispatches `variant:media:updated`.

## Stand Popup Logic

At the bottom of `sections/main-product.liquid`, there is custom popup logic for stand variants.

It expects:

```js
window.productVariants
```

Then it gets the selected variant ID from:

```js
document.querySelector('[name="id"]').value
```

It finds the selected variant:

```js
variants.find(v => v.id == selectedId)
```

Then it checks:

```js
variant.option1 || variant.option2 || variant.option3
```

and matches that to:

```js
const standPopupData = {
  "Stainless Steel Stand": {
    title: "Stainless Steel Stand",
    desc: "Premium stainless steel stand. Strong, durable and modern design.",
    img: "..."
  },
  "No Stand": {
    title: "Filter System (No Stand)",
    desc: "Filter system without stand. Perfect for countertop placement.",
    img: "..."
  },
  "Teak Wood Stand": {
    title: "Teak Wood Stand",
    desc: "Beautiful natural teak wood stand. Elegant and stylish look.",
    img: "..."
  }
};
```

Then it fills:

```js
titleEl.textContent = data.title;
textEl.innerHTML = data.desc;
imageDiv.style.backgroundImage = `url('${data.img}')`;
popup.style.display = "flex";
```

Important recreate note: `main-product.liquid` reads `window.productVariants`, but this file does not define it. For a clean implementation, add this before the popup script:

```liquid
<script>
  window.productVariants = {{ product.variants | json }};
</script>
```

## Size Guide Logic

The size guide code is in `snippets/product-variant-picker.liquid`.

The size guide button appears on the last option group:

```liquid
{% if forloop.last %}
  <button type="button" class="size-guide-btn" id="openSizeGuide">
    SIZE GUIDE
  </button>
{% endif %}
```

The script only shows this button when the URL includes:

```text
the-phoenix-gravity-water-filter
```

When clicked, it searches product option groups for one whose legend contains `stand`:

```js
if (legend && legend.textContent.trim().toLowerCase().includes('stand')) {
  const checked = fieldset.querySelector('input[type="radio"]:checked');
  return checked ? checked.value.trim().toLowerCase() : null;
}
```

Then it maps the selected stand value to a size guide image:

```js
const sizeGuideImages = {
  "no stand": "...",
  "teak wood stand": "...",
  "stainless steel stand": "..."
};
```

Finally it opens the modal:

```js
modal.style.display = "flex";
```

## Fullscreen And Video Gallery Extras

`snippets/product-media-gallery.liquid` also includes extra JavaScript for:

- fullscreen image modal custom close button
- modal previous/next arrows
- keyboard navigation with left/right/escape
- swipe inside modal
- custom video fullscreen modal
- video previous/next navigation
- custom expand button on video media

These features are separate from variant selection, but they depend on the same `.product__media-item` and `is-active` gallery state.

## Recreate Checklist

To recreate the full feature in another Shopify theme:

1. Build a `product-info` wrapper with `data-section`, `data-product-id`, `data-url`, and `data-update-url="true"`.
2. Render product media with a separate `product-media-gallery` snippet.
3. Render variant controls with a `variant-selects` custom element.
4. Output current selected variant JSON and all variants JSON.
5. On option change, find the matching variant and update all `input[name="id"]` fields.
6. Update the URL with `?variant=VARIANT_ID`.
7. Fetch the product section HTML using `section_id` and selected option values.
8. Replace price, SKU, inventory, quantity rules, and gallery from the fetched HTML.
9. Dispatch `variant:media:updated` after replacing gallery HTML.
10. In the gallery script, listen for `variant:media:updated`, recollect slides, reset to the first slide, and sync arrows/counter/dots/thumbnails.
11. Support variant image metafield `custom.variant_images` as `list.file_reference`.
12. Support variant description metafield `custom.variant_level_description`.
13. Support configurable variant metafield accordion blocks.
14. Add optional stand popup logic based on selected variant option.
15. Add optional size guide modal based on selected stand option.

## Required Variant Metafields

Variant-specific gallery:

```text
namespace: custom
key: variant_images
owner: variant
type: list.file_reference
```

Variant-specific description:

```text
namespace: custom
key: variant_level_description
owner: variant
type: rich text or multi-line text
```

Any variant accordion content:

```text
namespace: configurable in block settings
key: configurable in block settings
owner: variant
type: any renderable metafield type
```
