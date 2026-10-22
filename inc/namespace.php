<?php
/**
 * HM rtCarousel Extension namespace.
 *
 * @package HM\RtCarouselExtension
 */

namespace HM\RtCarouselExtension;

/**
 * Connect namespace functions to hooks.
 *
 * @return void
 */
function bootstrap(): void {
	add_action( 'init', __NAMESPACE__ . '\\register_frontend_styles' );
	add_action( 'init', __NAMESPACE__ . '\\register_carousel_accordion_module' );
	add_action( 'enqueue_block_editor_assets', __NAMESPACE__ . '\\enqueue_block_editor_assets' );
	add_filter( 'render_block_rt-carousel/carousel', __NAMESPACE__ . '\\render_carousel_slide_gap', 10, 2 );
	add_filter( 'block_type_metadata', __NAMESPACE__ . '\\extend_carousel_supports' );
	add_filter( 'block_type_metadata', __NAMESPACE__ . '\\extend_carousel_viewport_supports' );
	add_filter( 'block_type_metadata', __NAMESPACE__ . '\\extend_carousel_controls_supports' );
	add_filter( 'block_type_metadata', __NAMESPACE__ . '\\extend_carousel_dots_supports' );
	add_filter( 'block_type_metadata', __NAMESPACE__ . '\\extend_carousel_context' );
	add_filter( 'render_block_core/query', __NAMESPACE__ . '\\filter_query_in_carousel', 10, 3 );
	add_filter( 'render_block_core/accordion-item', __NAMESPACE__ . '\\filter_accordion_item_in_carousel', 10, 3 );
	add_action( 'init', __NAMESPACE__ . '\\register_blocks' );
	add_filter( 'render_block_context', __NAMESPACE__ . '\\collect_carousel_filter_tags', 10, 2 );
	add_filter( 'render_block_rt-carousel/carousel-slide', __NAMESPACE__ . '\\render_slide_filter_tags', 10, 2 );
}

/**
 * Register the blocks this plugin owns.
 *
 * @return void
 */
function register_blocks(): void {
	register_block_type( dirname( __DIR__ ) . '/build/blocks/carousel-filters' );
}

/**
 * Get a slide's filter tags keyed by slug, de-duplicated by slug.
 *
 * @param array $block Parsed rt-carousel/carousel-slide block.
 * @return array<string, string> Tag labels keyed by slug.
 */
function get_slide_filter_tags( array $block ): array {
	$tags = [];

	foreach ( (array) ( $block['attrs']['filterTags'] ?? [] ) as $label ) {
		$label = trim( (string) $label );
		$slug  = sanitize_title( $label );
		if ( $slug && ! isset( $tags[ $slug ] ) ) {
			$tags[ $slug ] = $label;
		}
	}

	return $tags;
}

/**
 * Collect the filter tags from every slide in a carousel and add them to the
 * carousel's context, which WordPress passes on to all of its descendants,
 * including the carousel filters block. Tags keep the order they first
 * appear in.
 *
 * Context is used rather than a render-time attribute because WP_Block caches
 * its attributes, so attributes added in render_block_data never reach the
 * context a nested carousel provides.
 *
 * Nested carousels are skipped; they collect their own tags when rendered.
 *
 * @param array $context      Block context.
 * @param array $parsed_block Parsed block.
 * @return array Context, with the carousel's filter tags for carousels.
 */
function collect_carousel_filter_tags( array $context, array $parsed_block ): array {
	if ( ( $parsed_block['blockName'] ?? '' ) !== 'rt-carousel/carousel' ) {
		return $context;
	}

	$tags = [];

	$walk = function ( array $blocks ) use ( &$walk, &$tags ): void {
		foreach ( $blocks as $block ) {
			switch ( $block['blockName'] ?? '' ) {
				case 'rt-carousel/carousel':
					break;

				case 'rt-carousel/carousel-slide':
					$tags += get_slide_filter_tags( $block );
					break;

				default:
					$walk( $block['innerBlocks'] ?? [] );
			}
		}
	};

	$walk( $parsed_block['innerBlocks'] ?? [] );

	$context['hm-rt-carousel-extension/filterTags'] = $tags;

	return $context;
}

/**
 * Add a data-carousel-filters attribute holding the slide's space-separated
 * filter tag slugs, read by the carousel filters view module.
 *
 * @param string $content Rendered block HTML.
 * @param array  $block   Parsed block array.
 * @return string Modified HTML.
 */
function render_slide_filter_tags( string $content, array $block ): string {
	$tags = get_slide_filter_tags( $block );
	if ( empty( $tags ) ) {
		return $content;
	}

	$p = new \WP_HTML_Tag_Processor( $content );
	if ( $p->next_tag() ) {
		$p->set_attribute( 'data-carousel-filters', implode( ' ', array_keys( $tags ) ) );
	}

	return (string) $p;
}


/**
 * Extend block metadata so the carousel block provides a context flag to all
 * descendants, and core/query and core/accordion-item consume it.
 *
 * This lets render filters check $instance->context['rt-carousel/isCarousel'] to see if the block is inside a carousel.
 *
 * @param array $metadata Block metadata.
 * @return array Modified metadata.
 */
function extend_carousel_context( array $metadata ): array {
	switch ( $metadata['name'] ?? '' ) {
		case 'rt-carousel/carousel':
			$metadata['attributes']['isCarousel'] = [
				'type'    => 'boolean',
				'default' => true,
			];
			$metadata['providesContext']['rt-carousel/isCarousel'] = 'isCarousel';
			break;

		case 'rt-carousel/carousel-slide':
			$metadata['attributes']['filterTags'] = [
				'type'    => 'array',
				'items'   => [ 'type' => 'string' ],
				'default' => [],
			];
			break;

		case 'rt-carousel/carousel-viewport':
			// Lets accordion items tell slide content apart from carousel navigation.
			$metadata['attributes']['isCarouselViewport'] = [
				'type'    => 'boolean',
				'default' => true,
			];
			$metadata['providesContext']['rt-carousel/isInViewport'] = 'isCarouselViewport';
			break;

		case 'core/query':
			$metadata['usesContext'] = array_values(
				array_unique(
					array_merge(
						$metadata['usesContext'] ?? [],
						[ 'rt-carousel/isCarousel' ]
					)
				)
			);
			break;

		case 'core/accordion-item':
			$metadata['usesContext'] = array_values(
				array_unique(
					array_merge(
						$metadata['usesContext'] ?? [],
						[ 'rt-carousel/isCarousel', 'rt-carousel/isInViewport' ]
					)
				)
			);
			break;
	}

	return $metadata;
}

/**
 * Check whether a core/accordion-item block's panel contains only empty
 * paragraphs (or no blocks at all).
 *
 * The accordion-item's inner blocks are core/accordion-heading and
 * core/accordion-panel. We inspect the panel's inner blocks.
 *
 * @param array $block Parsed block array.
 * @return bool True when the panel has no meaningful content.
 */
function is_empty_accordion_panel( array $block ): bool {
	$panel_block = null;

	foreach ( $block['innerBlocks'] ?? [] as $inner ) {
		if ( ( $inner['blockName'] ?? '' ) === 'core/accordion-panel' ) {
			$panel_block = $inner;
			break;
		}
	}

	if ( ! $panel_block ) {
		return true;
	}

	$panel_inner = $panel_block['innerBlocks'] ?? [];

	if ( empty( $panel_inner ) ) {
		return true;
	}

	foreach ( $panel_inner as $b ) {
		if ( ( $b['blockName'] ?? '' ) !== 'core/paragraph' ) {
			return false;
		}
		if ( trim( wp_strip_all_tags( $b['innerHTML'] ?? '' ) ) !== '' ) {
			return false;
		}
	}

	return true;
}

/**
 * Inject data-carousel-section on core/query blocks that live inside a
 * carousel, keyed by the slug of the first category in their taxQuery.
 *
 * Query blocks with no category filter receive the sentinel value
 * "__all__" so they are included in the JS boundary tracking and
 * auto-mode accordion items stay index-aligned with their query loop.
 * Falls back to the numeric term ID if the term cannot be resolved.
 *
 * @param string    $content  Rendered block HTML.
 * @param array     $block    Parsed block array.
 * @param \WP_Block $instance Block instance (carries context).
 * @return string Modified HTML.
 */
function filter_query_in_carousel( string $content, array $block, \WP_Block $instance ): string {
	if ( ! ( $instance->context['rt-carousel/isCarousel'] ?? false ) ) {
		return $content;
	}

	$tax_query    = $block['attrs']['query']['taxQuery'] ?? [];
	$category_ids = $tax_query['include']['category'] ?? [];
	$first_id     = ! empty( $category_ids ) ? reset( $category_ids ) : null;

	if ( $first_id ) {
		$term = get_term( absint( $first_id ), 'category' );
		$slug = ( $term && ! is_wp_error( $term ) ) ? $term->slug : (string) absint( $first_id );
	} else {
		// No category filter — use a sentinel that cannot collide with a real
		// category slug (WordPress slugs never contain underscores).
		$slug = '__all__';
	}

	$p = new \WP_HTML_Tag_Processor( $content );

	if ( $p->next_tag() ) {
		$p->set_attribute( 'data-carousel-section', $slug );
	}

	return (string) $p;
}

/**
 * Inject carousel-navigation Interactivity API directives into
 * core/accordion-item blocks that live inside a carousel, outside its
 * viewport. Accordions inside slides are ordinary slide content and are left
 * untouched.
 *
 * For each item we:
 *   1. Add data-carousel-nav, plus data-carousel-nav-only and/or
 *      data-carousel-target, to the wrapper.
 *   2. Add data-wp-interactive, data-wp-context, and data-wp-on--click to the
 *      heading element, placing it in the hm-carousel-accordion namespace.
 *   3. Re-qualify the toggle button's directives with the explicit
 *      core/accordion:: prefix so they survive the nested namespace change.
 *   4. For nav-only items make the panel permanently inert.
 *
 * @param string    $content  Rendered block HTML.
 * @param array     $block    Parsed block array.
 * @param \WP_Block $instance Block instance (carries context).
 * @return string Modified HTML.
 */
function filter_accordion_item_in_carousel( string $content, array $block, \WP_Block $instance ): string {
	if ( ! ( $instance->context['rt-carousel/isCarousel'] ?? false ) ) {
		return $content;
	}

	if ( $instance->context['rt-carousel/isInViewport'] ?? false ) {
		return $content;
	}

	wp_enqueue_script_module( '@hm/carousel-accordion-view' );

	$is_nav_only       = is_empty_accordion_panel( $block );
	$manual_target_id  = isset( $block['attrs']['carouselSection'] )
		? absint( $block['attrs']['carouselSection'] )
		: 0;
	$manual_target_term = $manual_target_id ? get_term( $manual_target_id, 'category' ) : null;
	$manual_target      = ( $manual_target_term && ! is_wp_error( $manual_target_term ) )
		? $manual_target_term->slug
		: ( $manual_target_id ? (string) $manual_target_id : '' );

	$p = new \WP_HTML_Tag_Processor( $content );

	// ── 1. Accordion item wrapper ─────────────────────────────────────────
	if ( ! $p->next_tag( [ 'class_name' => 'wp-block-accordion-item' ] ) ) {
		return $content;
	}

	$p->set_attribute( 'data-carousel-nav', '' );

	if ( $is_nav_only ) {
		$p->set_attribute( 'data-carousel-nav-only', '' );
	}

	if ( $manual_target ) {
		$p->set_attribute( 'data-carousel-target', $manual_target );
	}

	// ── 2. Heading element (h2–h6) ────────────────────────────────────────
	// Adding data-wp-interactive here creates a nested namespace scope for
	// the heading and its children (the toggle button).
	if ( ! $p->next_tag( [ 'class_name' => 'wp-block-accordion-heading' ] ) ) {
		return (string) $p;
	}

	$p->set_attribute( 'data-wp-interactive', 'hm-carousel-accordion' );
	$p->set_attribute(
		'data-wp-context',
		wp_json_encode(
			[ 'manualTarget' => $manual_target ],
			JSON_UNESCAPED_SLASHES
		)
	);
	// Fires on any click within the heading, including bubbled clicks from
	// the toggle button.
	$p->set_attribute( 'data-wp-on--click', 'actions.navigate' );

	// ── 3. Toggle button ──────────────────────────────────────────────────
	// The button is now inside the hm-carousel-accordion namespace scope, so
	// its bare directive values must be explicitly prefixed with the
	// core/accordion namespace to keep working.
	if ( ! $p->next_tag( [ 'class_name' => 'wp-block-accordion-heading__toggle' ] ) ) {
		return (string) $p;
	}

	if ( $is_nav_only ) {
		// Nav-only: remove toggle behaviour entirely.
		$p->remove_attribute( 'data-wp-on--click' );
		$p->remove_attribute( 'data-wp-on--keydown' );
		$p->remove_attribute( 'data-wp-bind--aria-expanded' );
		$p->set_attribute( 'aria-expanded', 'false' );
	} else {
		$p->set_attribute( 'data-wp-on--click', 'core/accordion::actions.toggle' );
		$p->set_attribute( 'data-wp-on--keydown', 'core/accordion::actions.handleKeyDown' );
		$p->set_attribute( 'data-wp-bind--aria-expanded', 'core/accordion::state.isOpen' );
	}

	// ── 4. Panel (nav-only only) ──────────────────────────────────────────
	// The panel is a sibling of the heading, outside the nested namespace,
	// so its existing core/accordion directives are unaffected.
	// For nav-only items we make it permanently inert to prevent the
	// Interactivity API from ever un-hiding it.
	if ( $is_nav_only ) {
		if ( $p->next_tag( [ 'class_name' => 'wp-block-accordion-panel' ] ) ) {
			$p->remove_attribute( 'data-wp-bind--inert' );
			$p->set_attribute( 'inert', '' );
			$p->set_attribute( 'aria-hidden', 'true' );
		}
	}

	return (string) $p;
}

/**
 * Register the frontend view module for the carousel accordion behaviour.
 * Enqueueing is handled lazily inside filter_accordion_item_in_carousel so
 * the module is only loaded on pages that actually render the pattern.
 *
 * @return void
 */
function register_carousel_accordion_module(): void {
	$asset_file = plugin_dir_path( PLUGIN_FILE ) . 'build/view.asset.php';

	if ( ! file_exists( $asset_file ) ) {
		return;
	}

	$asset = require $asset_file; // phpcs:ignore WordPressVIPMinimum.Files.IncludingFile.UsingVariable -- path is constructed from a plugin constant and validated with file_exists().

	wp_register_script_module(
		'@hm/carousel-accordion-view',
		plugins_url( 'build/view.js', PLUGIN_FILE ),
		$asset['dependencies'],
		$asset['version']
	);
}

/**
 * Register the frontend stylesheet for rt-carousel/carousel, loaded on demand
 * only when the block is present on the page.
 *
 * @return void
 */
function register_frontend_styles(): void {
	$style_file = plugin_dir_path( PLUGIN_FILE ) . 'build/style-style.css';

	wp_enqueue_block_style(
		'rt-carousel/carousel',
		[
			'handle' => 'hm-rt-carousel-extension',
			'src'    => plugins_url( 'build/style-style.css', PLUGIN_FILE ),
			'path'   => $style_file,
			'ver'    => is_readable( $style_file ) ? hash_file( 'crc32', $style_file ) : false,
		]
	);
}

/**
 * Enqueue editor-only assets.
 *
 * @return void
 */
function enqueue_block_editor_assets(): void {
	$asset = file_exists( __DIR__ . '/../build/index.asset.php' )
		? require __DIR__ . '/../build/index.asset.php'
		: [ 'dependencies' => [], 'version' => '1.0' ];

	wp_enqueue_script(
		'hm-rt-carousel-extension-editor',
		plugins_url( 'build/index.js', PLUGIN_FILE ),
		$asset['dependencies'],
		$asset['version']
	);

	wp_enqueue_style(
		'hm-rt-carousel-extension-editor',
		plugins_url( 'build/index.css', PLUGIN_FILE ),
		[],
		$asset['version']
	);
}

/**
 * Replace the pixel-based --rt-carousel-gap with the responsive WordPress spacing
 * preset CSS variable when a slideGapSlug is set on the block.
 *
 * @param string $block_content Rendered block HTML.
 * @param array  $block         Parsed block data.
 * @return string Modified block HTML.
 */
function render_carousel_slide_gap( string $block_content, array $block ): string {
	$slug = $block['attrs']['slideGapSlug'] ?? '';
	if ( empty( $slug ) ) {
		return $block_content;
	}

	$css_var       = 'var(--wp--preset--spacing--' . sanitize_key( $slug ) . ')';
	$block_content = preg_replace(
		'/--rt-carousel-gap:[^;"]+/',
		'--rt-carousel-gap:' . $css_var,
		$block_content,
		1
	);

	return $block_content;
}

/**
 * Add blockGap and margin supports to rt-carousel/carousel.
 *
 * @param array $metadata Block metadata from block.json.
 * @return array Modified metadata.
 */
function extend_carousel_supports( array $metadata ): array {
	if ( ( $metadata['name'] ?? '' ) !== 'rt-carousel/carousel' ) {
		return $metadata;
	}

	$metadata['supports']['color']['background'] = false;

	$metadata['supports']['spacing'] = array_merge(
		$metadata['supports']['spacing'] ?? [],
		[
			'margin'   => [ 'top', 'bottom' ],
			'blockGap' => true,
		]
	);

	return $metadata;
}

/**
 * Add margin support to rt-carousel/carousel-viewport.
 *
 * @param array $metadata Block metadata from block.json.
 * @return array Modified metadata.
 */
function extend_carousel_viewport_supports( array $metadata ): array {
	if ( ( $metadata['name'] ?? '' ) !== 'rt-carousel/carousel-viewport' ) {
		return $metadata;
	}

	$metadata['supports']['spacing'] = array_merge(
		$metadata['supports']['spacing'] ?? [],
		[ 'margin' => [ 'top', 'bottom' ] ]
	);

	return $metadata;
}

/**
 * Add blockGap, margin, padding, layout, and wide alignment supports to rt-carousel/carousel-dots.
 *
 * @param array $metadata Block metadata from block.json.
 * @return array Modified metadata.
 */
function extend_carousel_dots_supports( array $metadata ): array {
	if ( ( $metadata['name'] ?? '' ) !== 'rt-carousel/carousel-dots' ) {
		return $metadata;
	}

	$metadata['supports']['spacing'] = array_merge(
		$metadata['supports']['spacing'] ?? [],
		[
			'margin'   => [ 'top', 'bottom' ],
			'padding'  => [ 'top', 'bottom' ],
			'blockGap' => true,
		]
	);

	$metadata['supports']['layout'] = [
		'allowSwitching'   => false,
		'allowInheriting'  => false,
		'allowOrientation' => false,
		'default'          => [ 'type' => 'flex' ],
	];

	$metadata['supports']['align'] = [ 'wide' ];

	return $metadata;
}

/**
 * Add blockGap, margin, layout, and wide alignment supports to rt-carousel/carousel-controls.
 *
 * @param array $metadata Block metadata from block.json.
 * @return array Modified metadata.
 */
function extend_carousel_controls_supports( array $metadata ): array {
	if ( ( $metadata['name'] ?? '' ) !== 'rt-carousel/carousel-controls' ) {
		return $metadata;
	}

	$metadata['supports']['spacing'] = array_merge(
		$metadata['supports']['spacing'] ?? [],
		[
			'margin'   => [ 'top', 'bottom' ],
			'padding'  => [ 'top', 'bottom' ],
			'blockGap' => true,
		]
	);

	$metadata['supports']['layout'] = [
		'allowSwitching'         => false,
		'allowInheriting'        => false,
		'allowOrientation'       => false,
		'default'                => [ 'type' => 'flex' ],
	];

	$metadata['supports']['align'] = [ 'wide' ];

	return $metadata;
}
