# Product Image Resolution Suggestions

## Recommended Source Image Size

For the PDP product gallery, use square source images at:

```text
1600 x 1600px
```

Optional upper range:

```text
1800 x 1800px
```

Avoid using oversized product images by default. The current PDP loads many gallery images at `width=1946`, which is larger than needed for the visible gallery area.

## Main Product Image

Recommended Shopify responsive widths:

```text
480, 640, 800, 1000, 1200, 1400, 1600
```

Desktop display target:

```text
1000-1400px delivered width
```

Mobile display target:

```text
720-900px delivered width
```

Use the largest `1600px` version only when the desktop gallery can actually display a large image. Do not request `1946px` for every product media item.

## Thumbnail Images

Recommended thumbnail delivered widths:

```text
80, 120, 160, 200
```

Typical thumbnail display size:

```text
60-100px
```

No thumbnail should load at `400px+`, and thumbnails should never load at `1946px`.

## Recommended Liquid For Main Gallery

```liquid
{{ media.preview_image
  | image_url: width: 1600
  | image_tag:
    widths: '480, 640, 800, 1000, 1200, 1400, 1600',
    sizes: '(max-width: 749px) 100vw, (max-width: 1199px) 50vw, 650px',
    loading: loading,
    fetchpriority: fetchpriority,
    alt: media.alt | escape
}}
```

## Recommended Liquid For Thumbnails

```liquid
{{ media.preview_image
  | image_url: width: 200
  | image_tag:
    widths: '80, 120, 160, 200',
    sizes: '80px',
    loading: 'lazy',
    alt: media.alt | escape
}}
```

## Loading Strategy

Use this loading behavior:

- First visible product image: `loading: 'eager'`
- First visible product image: `fetchpriority: 'high'`
- Other gallery images: `loading: 'lazy'`
- Thumbnail images: `loading: 'lazy'`
- Hidden variant images: lazy-load or defer until the variant is selected

## Practical Rule

Keep original product images at `1600 x 1600px`, compress them well, and let Shopify generate responsive sizes.

For this PDP, `1946px` is too large for normal gallery display and should not be used as the default image width.

