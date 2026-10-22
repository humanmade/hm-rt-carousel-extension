<?php
/**
 * Server render for hm-rt-carousel-extension/carousel-filters.
 *
 * Outputs an "All" button plus one button per filter tag found on the
 * carousel's slides. The tags arrive through block context, collected by
 * HM\RtCarouselExtension\collect_carousel_filter_tags().
 *
 * @package HM\RtCarouselExtension
 *
 * @var array     $attributes Block attributes.
 * @var \WP_Block $block      Block instance.
 */

$filter_tags = $block->context['hm-rt-carousel-extension/filterTags'] ?? [];

if ( empty( $filter_tags ) ) {
	return;
}

wp_interactivity_state(
	'hm-carousel-filters',
	[
		'isActive' => static function (): bool {
			$context = wp_interactivity_get_context();
			return ( $context['active'] ?? '' ) === ( $context['value'] ?? '' );
		},
	]
);

// Union rather than array_merge() so numeric slugs (e.g. "2024") keep their keys.
$buttons = [ '' => $attributes['allLabel'] ? $attributes['allLabel'] : __( 'All', 'hm-rt-carousel-extension' ) ] + $filter_tags;

$wrapper_attributes = get_block_wrapper_attributes(
	[
		'role'       => 'group',
		'aria-label' => __( 'Filter slides', 'hm-rt-carousel-extension' ),
	]
);
?>
<div
	<?php echo $wrapper_attributes; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- escaped by get_block_wrapper_attributes(). ?>
	data-wp-interactive="hm-carousel-filters"
	<?php echo wp_interactivity_data_wp_context( [ 'active' => '' ] ); // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- escaped by wp_interactivity_data_wp_context(). ?>
>
	<?php foreach ( $buttons as $filter_value => $label ) : ?>
		<button
			type="button"
			class="wp-element-button wp-block-hm-rt-carousel-extension-carousel-filters__button"
			<?php echo wp_interactivity_data_wp_context( [ 'value' => (string) $filter_value ] ); // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- escaped by wp_interactivity_data_wp_context(). ?>
			data-wp-bind--aria-pressed="state.isActive"
			data-wp-on--click="actions.select"
		><?php echo esc_html( $label ); ?></button>
	<?php endforeach; ?>
</div>
