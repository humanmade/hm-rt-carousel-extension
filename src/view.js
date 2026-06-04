import { store, getContext, getElement } from '@wordpress/interactivity';

const CAROUSEL_SYMBOL = Symbol.for( 'rt-carousel.carousel' );
const ACTIVE_CLASS = 'is-active';

// Set to true while syncActiveAccordionItem is programmatically clicking
// accordion toggle buttons so the heading's navigate action ignores those
// synthetic clicks and doesn't jump the carousel back to the section start.
let isSyncingAccordion = false;

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

/**
 * Adds ACTIVE_CLASS to the accordion item matching the current carousel
 * section and removes it from all others.
 *
 * Supports auto mode (index-based) and manual mode (data-carousel-target
 * attribute set by the PHP render filter).
 *
 * @param {HTMLElement} carouselEl The .rt-carousel root element.
 * @param {Array}       boundaries Section boundaries from carouselSectionMap.
 * @param {number}      slideIndex Currently selected Embla slide index.
 */
function syncActiveAccordionItem( carouselEl, boundaries, slideIndex ) {
	let sectionIdx = 0;
	for ( let i = 0; i < boundaries.length; i++ ) {
		if ( boundaries[ i ].startSlide <= slideIndex ) {
			sectionIdx = i;
		}
	}
	const sectionId = boundaries[ sectionIdx ]?.id;

	carouselEl
		.querySelectorAll( '.wp-block-accordion-item' )
		.forEach( ( item, i ) => {
			const target = item.dataset.carouselTarget;
			const active = target ? target === sectionId : i === sectionIdx;
			item.classList.toggle( ACTIVE_CLASS, active );

			if ( item.hasAttribute( 'data-carousel-nav-only' ) ) {
				return;
			}
			const button = item.querySelector(
				'.wp-block-accordion-heading__toggle'
			);
			if (
				button &&
				active !== ( button.getAttribute( 'aria-expanded' ) === 'true' )
			) {
				isSyncingAccordion = true;
				button.click();
				isSyncingAccordion = false;
			}
		} );
}

/**
 * Waits for Embla to initialise on the carousel's .embla element (deferred
 * by the rt-carousel plugin behind its own IntersectionObserver), then
 * subscribes to the `select` event to keep accordion active classes in sync.
 *
 * @param {HTMLElement} carouselEl The .rt-carousel root element.
 */
function initAccordionActiveState( carouselEl ) {
	if ( ! carouselEl.querySelector( '.wp-block-accordion-item' ) ) {
		return;
	}

	const emblaEl = carouselEl.querySelector( '.embla' );
	if ( ! emblaEl ) {
		return;
	}

	const io = new IntersectionObserver( ( entries, observer ) => {
		if ( ! entries[ 0 ].isIntersecting ) {
			return;
		}
		observer.disconnect();

		let attempts = 0;
		const poll = () => {
			const embla = emblaEl[ CAROUSEL_SYMBOL ];
			if ( embla ) {
				const boundaries = carouselSectionMap.get( carouselEl );
				if ( ! boundaries?.length ) {
					return;
				}
				const sync = () =>
					syncActiveAccordionItem(
						carouselEl,
						boundaries,
						embla.selectedScrollSnap()
					);
				embla.on( 'select', sync );
				sync();
			} else if ( attempts++ < 30 ) {
				requestAnimationFrame( poll );
			}
		};
		poll();
	} );

	io.observe( carouselEl );
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
			if ( isSyncingAccordion ) {
				return;
			}

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

			// Optimistically apply the active class before Embla's select event
			// fires so the UI updates instantly on click.
			const itemEl = ref.closest( '.wp-block-accordion-item' );
			if ( itemEl ) {
				carouselEl
					.querySelectorAll( '.wp-block-accordion-item' )
					.forEach( ( item ) =>
						item.classList.toggle( ACTIVE_CLASS, item === itemEl )
					);
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
	document.querySelectorAll( '.rt-carousel' ).forEach( ( carouselEl ) => {
		initCarouselSections( carouselEl );
		initAccordionActiveState( carouselEl );
	} );
}

if ( document.readyState === 'loading' ) {
	document.addEventListener( 'DOMContentLoaded', onDomReady );
} else {
	onDomReady();
}
