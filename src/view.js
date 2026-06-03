import { store, getContext, getElement } from '@wordpress/interactivity';

const CAROUSEL_SYMBOL = Symbol.for( 'rt-carousel.carousel' );

/**
 * Per-carousel map of section boundaries built during DOM combining.
 * Key: .rt-carousel element
 * Value: Array of { id: string, startSlide: number }
 *
 * Populated before Embla initialises so the navigate action can resolve
 * slide indices without re-querying a potentially restructured DOM.
 *
 * @type {Map<HTMLElement, Array<{id: string, startSlide: number}>>}
 */
const carouselSectionMap = new Map();

/**
 * Merge posts from multiple query-loop sections into the first post-template
 * so Embla sees a single continuous slide list.
 *
 * Records section start indices into carouselSectionMap before restructuring
 * the DOM so the navigate action can still resolve correct slide offsets.
 *
 * @param {HTMLElement} carouselEl - The .rt-carousel root element.
 */
function initCarouselSections( carouselEl ) {
	const sections = [
		...carouselEl.querySelectorAll( '[data-carousel-section]' ),
	];

	if ( ! sections.length || sections.length <= 1 ) {
		return;
	}

	// Record section boundaries and stamp posts before any DOM changes.
	const boundaries = [];
	let slideCount = 0;

	sections.forEach( ( section ) => {
		const sectionId = section.dataset.carouselSection;
		const posts = [ ...section.querySelectorAll( '.wp-block-post' ) ];

		boundaries.push( {
			id: sectionId,
			startSlide: slideCount,
		} );

		posts.forEach( ( post ) => {
			post.dataset.carouselSection = sectionId;
		} );

		slideCount += posts.length;
	} );

	carouselSectionMap.set( carouselEl, boundaries );

	// Combine: move all posts into the first section's post-template.
	const firstTemplate = sections[ 0 ].querySelector(
		'.wp-block-post-template'
	);

	if ( ! firstTemplate ) {
		return;
	}

	sections.slice( 1 ).forEach( ( section ) => {
		[ ...section.querySelectorAll( '.wp-block-post' ) ].forEach( ( post ) =>
			firstTemplate.appendChild( post )
		);

		section.remove();
	} );
}

/**
 * Resolve the Embla instance from any element inside a .rt-carousel.
 *
 * @param {HTMLElement} el
 * @return {object|null} Embla API or null.
 */
function getEmbla( el ) {
	const emblaEl = el.closest( '.rt-carousel' )?.querySelector( '.embla' );
	return emblaEl?.[ CAROUSEL_SYMBOL ] ?? null;
}

store( 'hm-carousel-accordion', {
	actions: {
		/**
		 * Fired when an accordion heading (h3/h4/etc.) is clicked.
		 * Scrolls the sibling carousel to the section that corresponds to
		 * this accordion item.
		 *
		 * For auto mode the accordion item's DOM position maps 1-to-1 with
		 * the carousel sections recorded in carouselSectionMap.
		 * For manual mode the context carries a manualTarget term-ID string
		 * that is matched against each section's data-carousel-section value.
		 */
		navigate() {
			const { ref } = getElement(); // ref is the heading element (h3, h4, …)

			const carouselEl = ref.closest( '.rt-carousel' );
			if ( ! carouselEl ) {
				return;
			}

			const boundaries = carouselSectionMap.get( carouselEl );
			if ( ! boundaries?.length ) {
				return;
			}

			let boundary;

			const { manualTarget } = getContext();
			if ( manualTarget ) {
				boundary = boundaries.find( ( b ) => b.id === manualTarget );
			} else {
				// Auto mode: match this item's position among accordion items
				// inside the carousel to the same-index section boundary.
				const items = [
					...carouselEl.querySelectorAll(
						'.wp-block-accordion-item'
					),
				];
				const itemEl = ref.closest( '.wp-block-accordion-item' );
				const index = items.indexOf( itemEl );
				boundary = index >= 0 ? boundaries[ index ] : undefined;
			}

			if ( ! boundary ) {
				return;
			}

			// For nav-only items the panel never opens; the heading click only
			// drives the carousel. For normal items the accordion toggle fires
			// independently (on the button) so we only handle scrolling here.
			const embla = getEmbla( ref );
			embla?.scrollTo( boundary.startSlide );
		},
	},
} );

// Initialise section combining before Embla creates its snap-point list.
// Embla is deferred behind an IntersectionObserver so this synchronous pass
// on DOM-ready always completes first.
function onDomReady() {
	document.querySelectorAll( '.rt-carousel' ).forEach( initCarouselSections );
}

if ( document.readyState === 'loading' ) {
	document.addEventListener( 'DOMContentLoaded', onDomReady );
} else {
	onDomReady();
}
