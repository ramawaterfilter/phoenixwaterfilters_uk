# Appstle Support Issue: Repeated CSS Injection On PDP

## Store / Page

Store: Phoenix Gravity Water Filters UK

Affected page:

```text
https://phoenixwaterfilters.co.uk/products/the-phoenix-gravity-water-filter?selling_plan=713373090176&variant=47471042953509
```

## Issue Summary

On the product detail page, Appstle appears to inject the same subscription widget CSS thousands of times into the page.

This is causing:

- Chrome DevTools CSS inspection to become difficult/unreliable.
- Very large inline CSS output.
- Extra memory usage.
- Extra style recalculation work.
- PDP performance degradation.

The page CSS itself is not missing. Theme stylesheets load successfully, but Appstle-generated inline CSS is flooding the document.

## Evidence From Chrome DevTools

Observed on the live PDP:

```text
Appstle style count: 4010
Appstle inline CSS size: ~39.6 MB
Repeated Appstle CSS block count: ~1600+
```

The repeated CSS block starts with:

```css
.WIDGET_TYPE_7 .appstle_subscription_wrapper_option:not(.appstle_include_dropdown),
.WIDGET_TYPE_7 .appstle_subscription_wrapper_option.appstle_include_dropdown
```

Another repeated Appstle CSS block starts with:

```css
.appstle_subscribesavetext {
  background-color: #c00303;
  color: #fff;
  padding: 4px 8px;
}
```

These blocks are injected repeatedly into `<style>` tags in the page `<head>`.

## Console Warnings

Chrome console shows multiple Appstle warnings:

```text
Appstle Subscription Widget Log.
- Shopify object is not present here

Appstle Subscription Widget Log.
- Update price on quantity change will not work because QUANTITY SELECTOR is missing.

Appstle Subscription Widget Log.
- Collection page price text field seems empty. Please add {{subscriptionPrice}} as value.

Appstle Subscription Widget Log.
- 3 elements of price selector found. Use more specific selector or use widget parent selector.

Appstle Subscription Widget Log.
- There are other elements named selling_plan present from other app like Preorder which might impact Appstle's app compatibility.
```

## Current Appstle DOM

The PDP has one visible Appstle subscription widget:

```text
#appstle_subscription_widget0
```

Widget class:

```text
appstle_sub_widget WIDGET_TYPE_7
```

The page also has Appstle price elements such as:

```text
appstle_subscription_final_price
appstle_subscription_amount
appstle_subscription_compare_amount
appstle_stand_alone_price_display_selector_processed
```

## Theme-Side Duplicate Found

The product template currently contains two duplicate hidden Appstle standalone price selectors:

```liquid
<span class="appstle_stand_alone_price_display_selector" data-product-data="{{ product | json | escape }}" style="display:none;"></span>
```

Locations in local theme:

```text
templates/product.json line 62
templates/product.json line 68
```

We can remove one duplicate from the theme, but this does not explain thousands of repeated Appstle style tags by itself. The repeated style injection appears to come from the Appstle script/widget initialization.

## What We Need Appstle To Investigate

Please check why Appstle is injecting the same widget CSS thousands of times on this PDP.

Specific questions:

1. Why are Appstle `<style>` tags being inserted repeatedly instead of once?
2. Can the widget prevent duplicate CSS injection by checking whether its style block already exists?
3. Are the duplicate standalone price selector spans causing repeated widget initialization?
4. Why is Appstle detecting `3 elements of price selector found`?
5. What exact price selector should we use for this PDP?
6. How should Appstle be configured when the quantity selector is hidden?
7. Why is the widget reporting collection page price text settings on a product page?
8. Why is Appstle warning about other `selling_plan` elements on this page, and how should those be scoped?

## Requested Fix / Recommendation

Recommended Appstle-side behavior:

- Inject each Appstle CSS block only once per page.
- Add a stable ID or marker to Appstle style tags, for example:

```html
<style id="appstle-widget-type-7-css">
```

- Before injecting CSS, check:

```js
if (!document.querySelector('#appstle-widget-type-7-css')) {
  // inject CSS once
}
```

- Scope price updates to the current product form/widget only.
- Avoid global repeated scans of all price selectors.

## Expected Outcome

After the issue is fixed:

- Appstle should inject only one copy of its widget CSS.
- Inline CSS size should drop dramatically.
- Chrome DevTools should show CSS normally.
- PDP style recalculation and memory usage should improve.
- Appstle console warnings should be reduced or removed.

