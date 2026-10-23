import { store, getContext, getElement } from '@wordpress/interactivity';

const CAROUSEL_SYMBOL = Symbol.for( 'rt-carousel.carousel' );

/**
 * Original slide order per carousel container, captured on first filter so
 * "All" can restore it after filtered slides have been moved to the end.
 *
 * @type {WeakMap<HTMLElement, HTMLElement[]>}
 */
const originalSlides = new WeakMap();

/**
 * Show only the slides tagged with the given filter, then rebuild Embla
 * around the visible slides so snaps, dots, progress and prev/next state
 * reflect the filtered set.
 *
 * Hidden slides are moved after the visible ones because rt-carousel works
 * out a slide's index from its DOM position (for is-active/aria-current),
 * which must line up with Embla's index among the visible slides.
 *
 * @param {HTMLElement} carouselEl The .rt-carousel root element.
 * @param {string}      value      Filter slug, or an empty string for all.
 */
function applyFilter( carouselEl, value ) {
	const container = carouselEl.querySelector( '.embla__container' );
	if ( ! container ) {
		return;
	}

	if ( ! originalSlides.has( container ) ) {
		originalSlides.set(
			container,
			[ ...container.children ].filter( ( el ) =>
				el.matches( '.embla__slide' )
			)
		);
	}

	const visible = [];
	const hidden = [];

	originalSlides.get( container ).forEach( ( slide ) => {
		const tags = ( slide.dataset.carouselFilters ?? '' ).split( ' ' );
		const matches = ! value || tags.includes( value );
		slide.hidden = ! matches;
		( matches ? visible : hidden ).push( slide );
	} );

	[ ...visible, ...hidden ].forEach( ( slide ) =>
		container.appendChild( slide )
	);

	const embla = carouselEl.querySelector( '.embla' )?.[ CAROUSEL_SYMBOL ];
	if ( embla ) {
		embla.reInit( { slides: visible } );
		embla.scrollTo( 0, true );
	}
}

store( 'hm-carousel-filters', {
	state: {
		/**
		 * Whether the current button's filter is the selected one.
		 *
		 * @return {boolean} True when this button is pressed.
		 */
		get isActive() {
			const context = getContext();
			return context.active === context.value;
		},
	},
	actions: {
		/**
		 * Select this button's filter and apply it to the parent carousel.
		 */
		select() {
			const context = getContext();
			if ( context.active === context.value ) {
				return;
			}

			context.active = context.value;

			const carouselEl = getElement().ref.closest( '.rt-carousel' );
			if ( carouselEl ) {
				applyFilter( carouselEl, context.value );
			}
		},
	},
} );
