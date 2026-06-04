# HM rtCarousel Extension

WordPress plugin that extends the [rt-carousel](https://github.com/rtCamp/rt-carousel-block) block with additional block supports, a theme-preset slide gap picker, accordion-based carousel navigation, and on-demand frontend styles.

## Requirements

- The [rt-carousel](https://github.com/rtCamp/rt-carousel-block) plugin must be active. The plugin will not bootstrap if `RT_CAROUSEL_PATH` is not defined.

## Features

### Block supports

Adds editor supports not included in rt-carousel by default:

| Block                           | Supports added                                                     |
| ------------------------------- | ------------------------------------------------------------------ |
| `rt-carousel/carousel`          | Spacing (margin top/bottom, blockGap), disables background colour  |
| `rt-carousel/carousel-viewport` | Spacing (margin top/bottom)                                        |
| `rt-carousel/carousel-controls` | Spacing (margin top/bottom, blockGap), flex layout, wide alignment |

### Slide gap preset picker

Replaces the plugin's pixel-based slide gap range control with a `SelectControl` that maps to theme spacing presets. On the frontend, the chosen preset is rendered as a `var(--wp--preset--spacing--*)` CSS variable rather than a fixed pixel value, giving responsive spacing for free.

### Accordion carousel navigation

Enables a `core/accordion` block placed alongside the carousel viewport to act as a navigation control. Each accordion item's heading scrolls the carousel to the section of posts matching its category.

**How it works:**

- Place one or more `core/query` blocks inside the carousel viewport, each filtered by a different category. The plugin combines their post output into a single slide list on the frontend and records each section's start position.
- Place a `core/accordion` block (with one item per query loop) alongside the viewport inside the same carousel. Each accordion item gets a **Carousel Navigation** inspector panel.
- **Auto mode** (default) — the category is inferred from the query loop at the same position. The assigned category is shown read-only in the inspector.
- **Manual mode** — toggle off "Auto-assign category" and pick the category from a dropdown.
- If an accordion item's panel contains only an empty paragraph (or no content), the expand icon is hidden and the panel never opens; the heading acts purely as a navigation control.

Each post slide carries a `data-carousel-section` attribute (category slug) after combining. The accordion heading click is handled by an Interactivity API store (`hm-carousel-accordion`) that resolves the correct slide index and calls Embla's `scrollTo`.

The active accordion item (the one whose section is currently in view) receives an `is-active` class on its `.wp-block-accordion-item` element. This is updated both on heading click and whenever the carousel position changes (e.g. via prev/next controls). Use `.wp-block-accordion-item.is-active` to style the active state.

### Frontend styles

Registers a stylesheet for `rt-carousel/carousel` that is only loaded when the block is present on the page. It sets a default `--wp--style--block-gap` and provides `--rt-carousel-slide-width` calculations for 2-, 3-, and 4-column post template layouts.

## Development

Install dependencies and build assets from the plugin root:

```bash
npm install
npm run build
```

| Command              | Description                            |
| -------------------- | -------------------------------------- |
| `npm run build`      | Production build to `build/`           |
| `npm run start`      | Watch mode with hot module replacement |
| `npm run lint:js`    | Lint JavaScript source                 |
| `npm run lint:style` | Lint SCSS source                       |
