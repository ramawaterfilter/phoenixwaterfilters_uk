# PDP Performance Audit

URL audited: https://phoenixwaterfilters.co.uk/products/the-phoenix-gravity-water-filter?selling_plan=713373090176&variant=47471042953509

Audit date: 2026-06-03

## Summary

The page renders its main product content reasonably quickly in a local lab trace, but it has serious layout instability and excessive runtime weight from apps, tracking scripts, video, reviews, chat, popups, and oversized product media.

The highest priority issue is CLS. Chrome trace measured `CLS: 0.89`, which is far above the recommended maximum of `0.1`. The largest shift happened around `1.2s` after navigation.

## Key Metrics Observed

- Initial loaded resources: about `568`
- Requests after reload/session activity: about `690`
- Total transfer: about `3.65 MB`
- Decoded resource size: about `11.38 MB`
- Script resources: about `220`
- External script tags: about `96`
- Image elements: about `190`
- Product images using `width=1946`: `45`
- DOM elements after load: about `7,791`
- Inline `<style>` tags after load: about `4,080`
- Inline CSS characters after load: about `39.8 MB`
- Trace LCP: about `1.13s`
- Trace CLS: `0.89`
- Forced reflow time: about `678ms`

## Priority 1: Fix CLS

### Problem

The page has very high cumulative layout shift. Chrome identified a major shift cluster from around `1,239ms` to `2,287ms`, with a score of `0.889`.

One identified root cause is an unsized image:

```text
https://phoenixwaterfilters.co.uk/cdn/shop/files/jpeg-optimizer_10_year.webp?v=1762518088&width=80
```

This appears to be the warranty image near the product content.

### Impact

High CLS makes the page feel unstable. It can also hurt Core Web Vitals and conversion because buttons, price blocks, subscription UI, and content move while the customer is reading or trying to interact.

### Solution

Reserve space for all above-the-fold and near-fold dynamic content.

Actions:

- Add explicit `width` and `height` attributes to the warranty image.
- Add stable CSS dimensions to its wrapper.
- Reserve vertical space for Appstle subscription pricing before the app initializes.
- Reserve vertical space for Judge.me preview badge and review widgets.
- Reserve space for Klaviyo popup/teaser if it remains enabled on PDP.
- Avoid injecting price/app blocks above already-rendered product content after first paint.

Example direction:

```liquid
{{ image | image_url: width: 80 | image_tag: width: 80, height: 80, loading: 'lazy' }}
```

Also add fixed/min dimensions to the surrounding wrapper:

```css
.product-warranty-icon {
  width: 80px;
  height: 80px;
}

.appstle_subscription_wrapper {
  min-height: 220px;
}
```

Use the real selector names from the theme/app output when implementing.

## Priority 2: Reduce Third-Party Runtime Cost

### Problem

The page loads many third-party scripts on initial page load. The largest third-party costs from the trace were:

- Wistia: about `2.8 MB`, about `969ms` main-thread time
- Google Tag Manager: about `1.3 MB`, about `734ms`
- Klaviyo: about `484 KB`, about `481ms`
- Shopify scripts: about `1.4 MB`, about `453ms`
- Appstle: about `187ms`
- Facebook: about `215ms`
- Tidio, Judge.me, PayPal, UpPromote, Buystro, SealApps, Clarity also load

### Impact

Third-party scripts increase JavaScript parse/execute time, compete with product media, and cause layout recalculations. They also make real-user performance more variable because these domains are outside the theme's control.

### Solution

Move non-critical third-party scripts out of the initial critical path.

Actions:

- Delay Tidio chat until user interaction or after a long idle delay.
- Delay Klaviyo popup/teaser on PDP, or disable it for subscription PDP traffic.
- Lazy-load Wistia only when the video section scrolls near the viewport or when the play button is clicked.
- Load Judge.me full review widget only when the review section is near viewport; keep only the small rating badge above the fold.
- Audit GTM tags and remove duplicate or unused tags.
- Move affiliate/countdown/restock widgets off PDP unless they are essential.
- Keep PayPal messaging if needed, but load it after product price and subscription UI are stable.

Recommended loading rule:

```text
Above the fold: product content, first product image, price, variant selectors, add to cart.
After idle or interaction: chat, popup, analytics extras.
On scroll near section: Wistia, full reviews, lower-page widgets.
```

## Priority 3: Optimize Product Images

### Problem

The product gallery requests many images at `width=1946`, while visible gallery images render around `243px` in the current viewport. Chrome found `45` product images using `width=1946`.

Examples:

```text
The_Phoenix_Gravity.jpg?width=1946
01.webp?width=1946
02.webp?width=1946
04.webp?width=1946
```

### Impact

Oversized images waste bandwidth, memory, and decode time. They also increase pressure on the browser during page load and variant gallery updates.

### Solution

Use responsive image widths that match the actual gallery layout.

Actions:

- Keep the first visible product image eager and high priority.
- Lazy-load non-visible gallery images.
- Use smaller widths for thumbnails and mobile gallery images.
- Do not output `width=1946` for every variant/media image.
- Use `sizes` that reflect the layout.

Recommended pattern:

```liquid
{{ media.preview_image
  | image_url: width: 900
  | image_tag:
    widths: '320, 480, 640, 800, 900, 1100',
    sizes: '(max-width: 749px) 100vw, 50vw',
    loading: loading,
    fetchpriority: fetchpriority,
    alt: media.alt | escape
}}
```

For thumbnails:

```liquid
{{ media.preview_image
  | image_url: width: 160
  | image_tag:
    widths: '80, 120, 160, 240',
    sizes: '80px',
    loading: 'lazy'
}}
```

## Priority 4: Fix Appstle Selector Conflicts

### Problem

The console reported Appstle warnings:

```text
3 elements of price selector found. Use more specific selector or use widget parent selector.
Update price on quantity change will not work because QUANTITY SELECTOR is missing.
There are other elements named selling_plan present from other app like Preorder which might impact Appstle's app compatibility.
```

### Impact

Appstle is likely scanning and updating multiple price nodes. This can cause extra layout recalculation, forced reflow, visual price jumps, and possible subscription selection bugs.

### Solution

Scope Appstle selectors to this PDP's product form.

Actions:

- Configure Appstle to target one specific product price wrapper.
- Remove duplicate hidden Appstle product JSON blocks from the product template.
- Ensure only one app controls `selling_plan` inputs inside the product form.
- Add a stable wrapper around price/subscription UI with reserved height.
- If the quantity selector is intentionally hidden, update Appstle settings so it does not look for it.

Recommended selector direction:

```text
#ProductInfo-template--28796746465664__main .price
#product-form-template--28796746465664__main
```

Use the live DOM IDs from the current Shopify section, not generic `.price` selectors.

## Priority 5: Reduce Forced Reflows

### Problem

The trace reported about `678ms` of forced reflow. Major contributors included:

- Inline PDP price/subscription code
- Wistia player
- Clarity
- Judge.me text clamping
- Appstle/restock app scripts
- Theme/global script visibility checks

### Impact

Forced reflows block the main thread and hurt interaction responsiveness. They are especially noticeable on mobile devices.

### Solution

Reduce DOM reads after DOM writes and delay expensive widgets.

Actions:

- Fix Appstle selectors so price updates touch one scoped DOM area.
- Delay Wistia until interaction or near-viewport scroll.
- Delay Judge.me full reviews until near the review section.
- Remove or defer scripts that repeatedly check dimensions during startup.
- Avoid custom scripts that loop over many nodes and call layout properties like `offsetWidth`, `offsetHeight`, `getBoundingClientRect`, or `getComputedStyle` after style mutations.

## Priority 6: Reduce DOM and Inline CSS Size

### Problem

After load, the page had about:

- `7,791` DOM elements
- `4,080` inline style tags
- about `39.8 MB` of inline CSS text

This is extremely high for a PDP.

### Impact

Large DOM and large inline style output increase style recalculation, layout, memory usage, and browser work. This also makes app scripts more expensive because many of them query the DOM repeatedly.

### Solution

Reduce repeated/generated markup and inline CSS.

Actions:

- Move repeated custom CSS from section settings into theme assets.
- Remove duplicated carousel/repeated cards where possible.
- Avoid rendering hidden full review/product media content on initial page load.
- Use lazy section rendering for lower PDP sections where possible.
- Rebuild high-traffic PDP sections as native theme sections instead of generated builder output.

## Priority 7: Review Popup and Chat Behavior

### Problem

The page opens/loads Klaviyo popup and teaser elements on PDP load. Tidio chat also loads during startup.

### Impact

Popups and chat add JavaScript, network requests, layout changes, and user distraction. On mobile they can hurt INP and CLS.

### Solution

Actions:

- Disable the Klaviyo signup popup for this product page, especially because the URL already includes a subscription selling plan.
- Show discount capture only after exit intent, scroll depth, or time delay.
- Delay Tidio until click/tap on a chat button or after the page is idle.

## Priority 8: Fix Console Errors and Warnings

### Problem

Console issues observed:

```text
Uncaught TypeError: Cannot read properties of null (reading 'addEventListener')
Failed to load resource: 400
Ecom popup data element not found
paypal_messages_content_unavailable
Appstle selector warnings
Tidio preload warnings
```

### Impact

Console errors usually mean scripts are running on pages where their expected DOM does not exist. This wastes main-thread time and can break features silently.

### Solution

Actions:

- Guard all custom scripts with element existence checks before calling `addEventListener`.
- Disable EComposer popup script if this PDP does not use EComposer popup data.
- Check PayPal message configuration for this product/subscription price.
- Remove unused preloads from Tidio or delay Tidio entirely.

Example:

```js
const button = document.querySelector('[data-size-guide]');

if (button) {
  button.addEventListener('click', openSizeGuide);
}
```

## Recommended Implementation Order

1. Fix CLS by sizing the warranty image and reserving space for subscription/review widgets.
2. Configure Appstle selectors to target only one product form and one price block.
3. Change PDP gallery image sizing so non-visible images are lazy and not requested at `width=1946`.
4. Delay Wistia until click or near-viewport scroll.
5. Delay Judge.me full reviews until near the review section.
6. Disable or delay Klaviyo popup and Tidio chat on PDP.
7. Audit GTM and remove duplicate/unused tags.
8. Reduce generated inline CSS and duplicated DOM in lower PDP sections.

## Expected Outcome

After the first three fixes, expected improvements:

- CLS should drop toward the good range, ideally below `0.1`.
- Initial image transfer should drop substantially.
- Main-thread layout work should reduce because Appstle and gallery updates will touch fewer nodes.

After third-party deferral:

- Lower script transfer and parse/execute time.
- Better mobile responsiveness.
- Lower chance of app-related layout shifts.
- More stable real-user Core Web Vitals.

## Notes

The trace file from this audit was saved locally at:

```text
C:\tmp\phoenix-pdp-trace.json
```

The Lighthouse report was saved locally at:

```text
C:\tmp\phoenix-lh\report.html
```

