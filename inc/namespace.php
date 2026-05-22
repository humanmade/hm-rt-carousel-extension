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
	add_action( 'enqueue_block_editor_assets', __NAMESPACE__ . '\\enqueue_block_editor_assets' );
	add_filter( 'render_block_rt-carousel/carousel', __NAMESPACE__ . '\\render_carousel_slide_gap', 10, 2 );
	add_filter( 'block_type_metadata', __NAMESPACE__ . '\\extend_carousel_supports' );
	add_filter( 'block_type_metadata', __NAMESPACE__ . '\\extend_carousel_viewport_supports' );
	add_filter( 'block_type_metadata', __NAMESPACE__ . '\\extend_carousel_controls_supports' );
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
			'blockGap' => true,
		]
	);

	$metadata['supports']['layout'] = [
		'allowSwitching'         => false,
		'allowInheriting'        => false,
		'allowOrientation'       => false,
		'allowVerticalAlignment' => false,
		'default'                => [ 'type' => 'flex' ],
	];

	$metadata['supports']['align'] = [ 'wide' ];

	return $metadata;
}
