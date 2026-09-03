import { store, getContext, getElement } from '@wordpress/interactivity';

const CAROUSEL_SYMBOL = Symbol.for( 'rt-carousel.carousel' );

// Set to true while syncActiveAccordionItem is programmatically clicking
// accordion toggle buttons so the heading's navigate action ignores those
// synthetic clicks and doesn't jump the carousel back to the section start.
let isSyncingAccordion = false;

/**
 * Per-carousel map of section boundaries.
 * Key: .rt-carousel element
 * Value: Array of { id: string|null, startSlide: number }
 *
 * Populated by initCarouselSections during query-loop DOM combining, so the
 * navigate action can resolve slide indices without re-querying a
 * potentially restructured DOM. For carousels with no query loops,
 * initCarouselSlideBoundaries populates it instead with one boundary per
 * static rt-carousel/carousel-slide block (id: null, matched by position).
 *
 * @type {Map<HTMLElement, Array<{id: string|null, startSlide: number}>>}
 */
const carouselSectionMap = new Map();

/**
 * Per-carousel map of panel container elements.
 * Key: .rt-carousel element
 * Value: <div class="hm-carousel-accordion-panel-container"> element
 *
 * @type {Map<HTMLElement, HTMLElement>}
 */
const panelContainerMap = new Map();

/**
 * Per-carousel map of the currently active accordion item element.
 * Used to close the previous item explicitly and skip redundant syncs.
 *
 * @type {Map<HTMLElement, HTMLElement|null>}
 */
const activeItemMap = new Map();

/**
 * Merge posts from multiple query-loop sections into the first post-template
 * so Embla sees a single continuous slide list.
 *
 * Records section start indices into carouselSectionMap before restructuring
 * the DOM so the navigate action can still resolve correct slide offsets.
 *
 * @param {HTMLElement} carouselEl The .rt-carousel root element.
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

	// Remove the section attribute from containers now that each post carries
	// its own copy. The first section stays in the DOM after combining so
	// leaving its attribute would falsely imply it contains only one section.
	sections.forEach( ( section ) =>
		section.removeAttribute( 'data-carousel-section' )
	);

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
 * Copy the active accordion item's panel content into the panel container.
 * Clears the container for nav-only items (which have no meaningful panel).
 *
 * @param {HTMLElement} carouselEl   The .rt-carousel root element.
 * @param {HTMLElement} activeItemEl The active .wp-block-accordion-item element.
 */
function updatePanelContainer( carouselEl, activeItemEl ) {
	const container = panelContainerMap.get( carouselEl );
	if ( ! container ) {
		return;
	}
	if ( activeItemEl.hasAttribute( 'data-carousel-nav-only' ) ) {
		container.innerHTML = '';
		return;
	}
	const panel = activeItemEl.querySelector( '.wp-block-accordion-panel' );
	if ( panel ) {
		container.innerHTML = panel.innerHTML;
	}
}

/**
 * Create the panel container element and insert it after the accordion block.
 * Populates it immediately with the first non-nav-only accordion item's panel.
 *
 * @param {HTMLElement} carouselEl The .rt-carousel root element.
 */
function initAccordionPanelContainer( carouselEl ) {
	const accordion = carouselEl.querySelector( '.wp-block-accordion' );
	if ( ! accordion ) {
		return;
	}

	const container = document.createElement( 'div' );
	container.className =
		'hm-carousel-accordion-panel-container is-layout-flow';
	accordion.after( container );
	panelContainerMap.set( carouselEl, container );

	const items = [
		...carouselEl.querySelectorAll( '.wp-block-accordion-item' ),
	];
	const initialItem = items.find(
		( el ) => ! el.hasAttribute( 'data-carousel-nav-only' )
	);
	if ( initialItem ) {
		updatePanelContainer( carouselEl, initialItem );
	}
}

/**
 * Fallback for carousels built from static rt-carousel/carousel-slide blocks
 * rather than query loops. Builds one boundary per slide (id: null, since
 * there is no category to key on) so accordion items map 1-to-1 by position
 * to the slide at the same index, the same way auto-mode section matching
 * works for query loops in initCarouselSections.
 *
 * No-ops if initCarouselSections already populated boundaries for this
 * carousel (query-loop carousels take precedence), if there's no accordion
 * to drive, or if a query loop is present but was skipped for having only
 * one section (data-carousel-section survives on that section since
 * initCarouselSections returns before stripping it).
 *
 * @param {HTMLElement} carouselEl The .rt-carousel root element.
 */
function initCarouselSlideBoundaries( carouselEl ) {
	if ( carouselSectionMap.has( carouselEl ) ) {
		return;
	}

	if ( ! carouselEl.querySelector( '.wp-block-accordion' ) ) {
		return;
	}

	if ( carouselEl.querySelector( '[data-carousel-section]' ) ) {
		return;
	}

	const slides = [ ...carouselEl.querySelectorAll( '.embla__slide' ) ];
	if ( slides.length < 2 ) {
		return;
	}

	carouselSectionMap.set(
		carouselEl,
		slides.map( ( slide, index ) => ( { id: null, startSlide: index } ) )
	);
}

/**
 * Resolve the Embla instance from any element inside a .rt-carousel.
 *
 * @param {HTMLElement} el
 * @return {Object|null} Embla API or null.
 */
function getEmbla( el ) {
	const emblaEl = el.closest( '.rt-carousel' )?.querySelector( '.embla' );
	return emblaEl?.[ CAROUSEL_SYMBOL ] ?? null;
}

/**
 * Open or close an accordion item.
 *
 * Sets is-open directly on the element for instant visual feedback (including
 * nav-only items which have no button). For regular items, also clicks the
 * toggle button so the Interactivity API's panel inert binding and
 * aria-expanded attribute stay accurate. The API's own async class update
 * becomes a no-op since we set is-open synchronously first.
 *
 * @param {HTMLElement} item       The .wp-block-accordion-item element.
 * @param {boolean}     shouldOpen True to open, false to close.
 */
function setAccordionItemOpen( item, shouldOpen ) {
	item.classList.toggle( 'is-open', shouldOpen );

	if ( item.hasAttribute( 'data-carousel-nav-only' ) ) {
		return;
	}

	const button = item.querySelector( '.wp-block-accordion-heading__toggle' );
	if ( ! button ) {
		return;
	}
	const isCurrentlyOpen = button.getAttribute( 'aria-expanded' ) === 'true';
	if ( isCurrentlyOpen !== shouldOpen ) {
		isSyncingAccordion = true;
		button.click();
		isSyncingAccordion = false;
	}
}

/**
 * Update the accordion's open state to match the current carousel position.
 *
 * Tracks the previously active item via activeItemMap to close it explicitly
 * before opening the new one. This avoids stale aria-expanded reads that arise
 * when all items are iterated and buttons are clicked in rapid succession.
 *
 * @param {HTMLElement} carouselEl The .rt-carousel root element.
 * @param {Array}       boundaries Section boundaries from carouselSectionMap.
 * @param {number}      slideIndex Current slide index to resolve the active section.
 */
function syncActiveAccordionItem( carouselEl, boundaries, slideIndex ) {
	let sectionIdx = 0;
	for ( let i = 0; i < boundaries.length; i++ ) {
		if ( boundaries[ i ].startSlide <= slideIndex ) {
			sectionIdx = i;
		}
	}
	const sectionId = boundaries[ sectionIdx ]?.id;

	// Find the accordion item that corresponds to the active section.
	let newActiveItem = null;
	carouselEl
		.querySelectorAll( '.wp-block-accordion-item' )
		.forEach( ( item, i ) => {
			const target = item.dataset.carouselTarget;
			if ( target ? target === sectionId : i === sectionIdx ) {
				newActiveItem = item;
			}
		} );

	const prevActiveItem = activeItemMap.get( carouselEl );
	if ( newActiveItem === prevActiveItem ) {
		return;
	}

	activeItemMap.set( carouselEl, newActiveItem );

	// Close the previously active item before opening the new one so that
	// accordion auto-close behaviour (one-open mode) doesn't race with the
	// open call below.
	if ( prevActiveItem ) {
		setAccordionItemOpen( prevActiveItem, false );
	}

	if ( newActiveItem ) {
		setAccordionItemOpen( newActiveItem, true );
		updatePanelContainer( carouselEl, newActiveItem );
	}
}

/**
 * Waits for Embla to initialise on the carousel's .embla element (deferred
 * by the rt-carousel plugin behind its own IntersectionObserver), then
 * subscribes to two Embla events:
 *
 * select — fires when a snap is committed (start of animation). Uses
 * selectedScrollSnap() so the accordion updates immediately, before the
 * carousel finishes moving.
 *
 * settle — fires after animation completes. Uses slidesInView()[0] for the
 * accurate final position; also catches drag navigation where select may not
 * have fired. activeItemMap prevents a redundant transition if select already
 * activated the correct section.
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
				// select fires when a snap is committed (start of animation).
				// selectedScrollSnap() already holds the target snap at this
				// point so the accordion updates immediately, before animation.
				const syncOnSelect = () =>
					syncActiveAccordionItem(
						carouselEl,
						boundaries,
						embla.selectedScrollSnap()
					);

				// settle fires after animation completes. slidesInView()[0]
				// is the accurate leftmost slide index at the final position,
				// covering drag navigation where select may not have fired.
				const syncOnSettle = () => {
					const inView = embla.slidesInView();
					syncActiveAccordionItem(
						carouselEl,
						boundaries,
						inView.length ? inView[ 0 ] : embla.selectedScrollSnap()
					);
				};

				embla.on( 'select', syncOnSelect );
				embla.on( 'settle', syncOnSettle );
				syncOnSelect();
			} else if ( attempts++ < 30 ) {
				requestAnimationFrame( poll );
			}
		};
		poll();
	} );

	io.observe( carouselEl );
}

const ACCORDION_MOBILE_BREAKPOINT = 781; // Matches the ≤781px stacked-accordion breakpoint in style.scss.
const HEIGHT_LOCK_MEASURING_CLASS = 'hm-carousel-accordion-measuring';

/**
 * Find the nearest DOM ancestor that contains both given elements — the
 * row/wrapper whose height must be locked (e.g. the wp:columns row holding
 * the accordion "tabs" column and the carousel-viewport column).
 *
 * @param {HTMLElement} a
 * @param {HTMLElement} b
 * @return {HTMLElement|null} The shared ancestor, or null if none exists.
 */
function findCommonAncestor( a, b ) {
	let node = a.parentElement;
	while ( node && ! node.contains( b ) ) {
		node = node.parentElement;
	}
	return node;
}

/**
 * Force an accordion panel closed for measurement, independent of which
 * core/accordion implementation is active: the bundled core block hides a
 * closed panel via `inert` (plus `aria-hidden`), while the Gutenberg plugin
 * version uses `hidden`/`hidden="until-found"`. Setting all three covers
 * either mechanism's CSS regardless of which is live.
 *
 * @param {HTMLElement} panel The .wp-block-accordion-panel element.
 */
function forceClosePanel( panel ) {
	panel.setAttribute( 'inert', '' );
	panel.setAttribute( 'aria-hidden', 'true' );
	panel.setAttribute( 'hidden', '' );
}

/**
 * Force an accordion panel open for measurement by stripping whichever of
 * the hidden-state attributes the active accordion implementation set.
 *
 * @param {HTMLElement} panel The .wp-block-accordion-panel element.
 */
function forceOpenPanel( panel ) {
	panel.removeAttribute( 'inert' );
	panel.removeAttribute( 'aria-hidden' );
	panel.removeAttribute( 'hidden' );
}

/**
 * Locks the row containing the accordion "tabs" and the carousel viewport to
 * the height of its tallest accordion panel, so switching tabs doesn't
 * reflow the carousel's slides/images beside it.
 *
 * No-ops unless the carousel actually has this two-part composition: an
 * accordion and a carousel-viewport sharing a common flex/grid ancestor
 * distinct from the carousel root (a plain accordion with no carousel, or a
 * carousel with an accordion stacked above/below rather than beside it, is
 * left untouched).
 *
 * Desktop-only: below the accordion's mobile breakpoint the accordion
 * becomes a wrapped row of tab buttons with a shared panel underneath (see
 * style.scss), where a locked row height doesn't apply — it resets to auto.
 *
 * Measures by directly toggling each panel's hidden-state attributes rather
 * than clicking through the Interactivity API: closed panels are dropped out
 * of layout entirely under both accordion implementations, so scrollHeight
 * can't be read while closed, and going through a real click risks reading
 * a mid-transition height (the two-column accordion style animates height
 * over 500ms). Transitions are suppressed for the duration via
 * hm-carousel-accordion-measuring so every open/close applies instantly;
 * the whole pass runs synchronously so nothing paints mid-measurement, and
 * real application state (which item is actually open) is never touched.
 *
 * @param {HTMLElement} carouselEl The .rt-carousel root element.
 */
function initAccordionCarouselHeightLock( carouselEl ) {
	const accordion = carouselEl.querySelector( '.wp-block-accordion' );
	const viewport = carouselEl.querySelector(
		'.wp-block-rt-carousel-carousel-viewport'
	);
	if ( ! accordion || ! viewport ) {
		return;
	}

	const row = findCommonAncestor( accordion, viewport );
	if ( ! row || row === carouselEl ) {
		return;
	}

	const rowDisplay = getComputedStyle( row ).display;
	if ( ! /flex|grid/.test( rowDisplay ) ) {
		return;
	}

	const panels = [
		...accordion.querySelectorAll( '.wp-block-accordion-item' ),
	]
		.filter( ( item ) => ! item.hasAttribute( 'data-carousel-nav-only' ) )
		.map( ( item ) => item.querySelector( '.wp-block-accordion-panel' ) )
		.filter( Boolean );

	if ( panels.length < 2 ) {
		return;
	}

	const measure = () => {
		if ( window.innerWidth <= ACCORDION_MOBILE_BREAKPOINT ) {
			row.style.height = '';
			return;
		}

		const originalAttrs = panels.map( ( panel ) => ( {
			inert: panel.getAttribute( 'inert' ),
			ariaHidden: panel.getAttribute( 'aria-hidden' ),
			hidden: panel.getAttribute( 'hidden' ),
		} ) );

		row.classList.add( HEIGHT_LOCK_MEASURING_CLASS );
		row.style.height = '';

		panels.forEach( forceClosePanel );

		let maxHeight = 0;
		panels.forEach( ( panel ) => {
			forceOpenPanel( panel );
			maxHeight = Math.max(
				maxHeight,
				row.getBoundingClientRect().height
			);
			forceClosePanel( panel );
		} );

		panels.forEach( ( panel, index ) => {
			const { inert, ariaHidden, hidden } = originalAttrs[ index ];
			if ( inert === null ) {
				panel.removeAttribute( 'inert' );
			} else {
				panel.setAttribute( 'inert', inert );
			}
			if ( ariaHidden === null ) {
				panel.removeAttribute( 'aria-hidden' );
			} else {
				panel.setAttribute( 'aria-hidden', ariaHidden );
			}
			if ( hidden === null ) {
				panel.removeAttribute( 'hidden' );
			} else {
				panel.setAttribute( 'hidden', hidden );
			}
		} );

		row.classList.remove( HEIGHT_LOCK_MEASURING_CLASS );
		row.style.height = `${ maxHeight }px`;
	};

	measure();

	let resizeTimeout;
	window.addEventListener( 'resize', () => {
		clearTimeout( resizeTimeout );
		resizeTimeout = setTimeout( measure, 150 );
	} );
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
		 * For manual mode the context carries a manualTarget slug that is
		 * matched against each section's data-carousel-section value.
		 *
		 * The panel container is updated immediately for instant feedback.
		 * The accordion item's is-open state is driven by syncActiveAccordionItem
		 * via the select event Embla fires after scrollTo.
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

			const itemEl = ref.closest( '.wp-block-accordion-item' );

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
				const index = items.indexOf( itemEl );
				boundary = index >= 0 ? boundaries[ index ] : undefined;
			}

			if ( ! boundary ) {
				return;
			}

			// Update the panel container immediately so the content switches
			// at click time rather than waiting for Embla's select event.
			if ( itemEl ) {
				updatePanelContainer( carouselEl, itemEl );
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
		initCarouselSlideBoundaries( carouselEl );
		initAccordionPanelContainer( carouselEl );
		initAccordionActiveState( carouselEl );
		initAccordionCarouselHeightLock( carouselEl );
	} );
}

if ( document.readyState === 'loading' ) {
	document.addEventListener( 'DOMContentLoaded', onDomReady );
} else {
	onDomReady();
}
