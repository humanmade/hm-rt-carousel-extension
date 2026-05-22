# HM rtCarousel Extension

WordPress plugin that extends the [rt-carousel](https://github.com/rtCamp/rt-carousel-block) block with additional block supports, a theme-preset slide gap picker, and on-demand frontend styles.

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

Replaces the plugin's pixel-based slide gap range control with a `SelectControl` that maps to theme spacing presets (e.g. `sm-16`, `md-40`). On the frontend, the chosen preset is rendered as a `var(--wp--preset--spacing--*)` CSS variable rather than a fixed pixel value, giving responsive spacing for free.

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
