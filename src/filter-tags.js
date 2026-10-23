import { cleanForSlug } from '@wordpress/url';

export const CAROUSEL_BLOCK = 'rt-carousel/carousel';
export const SLIDE_BLOCK = 'rt-carousel/carousel-slide';

/**
 * Collect the unique filter tags from a carousel's slides, in the order they
 * first appear. Mirrors collect_carousel_filter_tags() in PHP: tags are
 * de-duplicated by slug, and nested carousels are skipped.
 *
 * @param {Object|null} carouselBlock The rt-carousel/carousel block.
 * @return {string[]} Tag labels.
 */
export const getCarouselFilterTags = ( carouselBlock ) => {
	const tags = new Map();

	const walk = ( blocks = [] ) => {
		blocks.forEach( ( block ) => {
			if ( block.name === CAROUSEL_BLOCK ) {
				return;
			}
			if ( block.name === SLIDE_BLOCK ) {
				( block.attributes.filterTags ?? [] ).forEach( ( tag ) => {
					const slug = cleanForSlug( tag );
					if ( slug && ! tags.has( slug ) ) {
						tags.set( slug, tag );
					}
				} );
				return;
			}
			walk( block.innerBlocks );
		} );
	};

	walk( carouselBlock?.innerBlocks );

	return [ ...tags.values() ];
};
