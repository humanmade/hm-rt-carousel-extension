import './editor.scss';

import { addFilter } from '@wordpress/hooks';
import { createHigherOrderComponent } from '@wordpress/compose';
import {
	InspectorControls,
	useSettings,
	getSpacingPresetCssVar,
} from '@wordpress/block-editor';
import {
	PanelBody,
	SelectControl,
	ToggleControl,
	BaseControl,
} from '@wordpress/components';
import { useSelect } from '@wordpress/data';
import { __ } from '@wordpress/i18n';
import { FetchAllTermSelectControl } from '@humanmade/block-editor-components';

const CAROUSEL_BLOCK = 'rt-carousel/carousel';

/**
 * Inspector control for selecting a theme spacing preset as the carousel slide gap.
 *
 * @param {Object}   props
 * @param {Object}   props.attributes    Block attributes.
 * @param {Function} props.setAttributes Block attribute setter.
 */
const SlideGapControl = ( { attributes, setAttributes } ) => {
	const { slideGapSlug } = attributes;

	const [ spacingSizes ] = useSettings( 'spacing.spacingSizes' );

	const options = [
		{ label: __( 'None', 'hm-rt-carousel-extension' ), value: '' },
		...( spacingSizes || [] ).map( ( size ) => ( {
			label: size.name,
			value: size.slug,
		} ) ),
	];

	return (
		<InspectorControls group="styles">
			<PanelBody
				title={ __( 'Slide Gap', 'hm-rt-carousel-extension' ) }
				className="hm-rt-carousel-extension-slide-gap-panel"
			>
				<SelectControl
					label={ __( 'Spacing size', 'hm-rt-carousel-extension' ) }
					hideLabelFromVision
					value={ slideGapSlug }
					options={ options }
					onChange={ ( slug ) =>
						setAttributes( { slideGapSlug: slug } )
					}
					__next40pxDefaultSize
				/>
			</PanelBody>
		</InspectorControls>
	);
};

/**
 * HOC that injects SlideGapControl into the rt-carousel/carousel inspector panel.
 */
const withSlideGapControl = createHigherOrderComponent( ( BlockEdit ) => {
	return ( props ) => {
		if ( props.name !== CAROUSEL_BLOCK ) {
			return <BlockEdit { ...props } />;
		}
		return (
			<>
				<BlockEdit { ...props } />
				<SlideGapControl
					attributes={ props.attributes }
					setAttributes={ props.setAttributes }
				/>
			</>
		);
	};
}, 'withSlideGapControl' );

/**
 * Adds the slideGapSlug attribute to rt-carousel/carousel block type settings.
 *
 * @param {Object} settings Block type settings.
 * @param {string} name     Block name.
 * @return {Object} Modified settings.
 */
const setCarouselAttributes = ( settings, name ) => {
	if ( name !== CAROUSEL_BLOCK ) {
		return settings;
	}
	return {
		...settings,
		attributes: {
			...settings.attributes,
			slideGapSlug: {
				type: 'string',
				default: '',
			},
		},
	};
};

const CONTROLS_BLOCK = 'rt-carousel/carousel-controls';

/**
 * Writes blockGap as a CSS custom property onto the saved block markup so the
 * frontend reflects custom spacing.
 *
 * @param {Object} props      Existing save props.
 * @param {Object} blockType  Block type definition.
 * @param {Object} attributes Block attributes.
 * @return {Object} Modified props.
 */
const addCarouselStylesProps = ( props, blockType, attributes ) => {
	if (
		blockType.name !== CONTROLS_BLOCK &&
		blockType.name !== CAROUSEL_BLOCK
	) {
		return props;
	}

	const blockGap = attributes?.style?.spacing?.blockGap;
	if ( ! blockGap ) {
		return props;
	}

	const cssValue = getSpacingPresetCssVar( blockGap ) ?? blockGap;

	return {
		...props,
		style: {
			...props.style,
			'--wp--style--block-gap': cssValue,
		},
	};
};

const justifyMap = {
	left: 'flex-start',
	center: 'center',
	right: 'flex-end',
	'space-between': 'space-between',
};

const verticalAlignMap = {
	top: 'flex-start',
	center: 'center',
	bottom: 'flex-end',
	stretch: 'stretch',
};

/**
 * HOC that forwards blockGap and layout justification as CSS custom properties
 * on the editor block wrapper.
 */
const withCarouselStyles = createHigherOrderComponent(
	( BlockListBlock ) => ( props ) => {
		if ( props.name !== CONTROLS_BLOCK && props.name !== CAROUSEL_BLOCK ) {
			return <BlockListBlock { ...props } />;
		}

		const blockGap = props.attributes?.style?.spacing?.blockGap;
		const justifyContent =
			justifyMap[ props.attributes?.layout?.justifyContent ];
		const verticalAlignment =
			verticalAlignMap[ props.attributes?.layout?.verticalAlignment ];

		if ( ! blockGap && ! justifyContent && ! verticalAlignment ) {
			return <BlockListBlock { ...props } />;
		}

		const gapCssValue = getSpacingPresetCssVar( blockGap ) ?? blockGap;

		return (
			<BlockListBlock
				{ ...props }
				wrapperProps={ {
					...props.wrapperProps,
					className: justifyContent
						? `is-content-justification-${ justifyContent }`
						: '',
					style: {
						...props.wrapperProps?.style,
						...( gapCssValue && {
							'--wp--style--block-gap': gapCssValue,
						} ),
						...( justifyContent && {
							'--hm-rt-carousel-extension-controls-justify':
								justifyContent,
						} ),
						...( verticalAlignment && {
							'--hm-rt-carousel-extension-controls-align':
								verticalAlignment,
						} ),
					},
				} }
			/>
		);
	},
	'withCarouselStyles'
);

const ACCORDION_ITEM_BLOCK = 'core/accordion-item';
const CAROUSEL_VIEWPORT_BLOCK = 'rt-carousel/carousel-viewport';
const QUERY_BLOCK = 'core/query';

/**
 * Recursively find the first block with a given name within a block list.
 *
 * @param {Array}  blocks Block list to search.
 * @param {string} name   Block name to find.
 * @return {Object|undefined} Matched block or undefined.
 */
const findBlock = ( blocks = [], name ) => {
	for ( const block of blocks ) {
		if ( block.name === name ) {
			return block;
		}
		const found = findBlock( block.innerBlocks, name );
		if ( found ) {
			return found;
		}
	}
	return undefined;
};

/**
 * Inspector panel rendered inside a core/accordion-item that lives inside a
 * carousel. Shows an auto/manual toggle and a category selector.
 *
 * Extracted as a named component so React hooks are always called
 * unconditionally (the parent HOC exits early for non-accordion blocks).
 *
 * @param {Object}   root0
 * @param {string}   root0.clientId      Block client ID.
 * @param {Object}   root0.attributes    Block attributes.
 * @param {Function} root0.setAttributes Block attribute setter.
 */
const AccordionCarouselNavInspector = ( {
	clientId,
	attributes,
	setAttributes,
} ) => {
	const { carouselBlock, itemIndex } = useSelect(
		( select ) => {
			const { getBlockParents, getBlock } = select( 'core/block-editor' );
			const parentIds = getBlockParents( clientId );
			const parentBlocks = parentIds.map( ( id ) => getBlock( id ) );

			const carousel = parentBlocks.find(
				( b ) => b?.name === CAROUSEL_BLOCK
			);
			const accordion = parentBlocks.find(
				( b ) => b?.name === 'core/accordion'
			);
			const idx =
				accordion?.innerBlocks?.findIndex(
					( b ) => b.clientId === clientId
				) ?? -1;

			return { carouselBlock: carousel, itemIndex: idx };
		},
		[ clientId ]
	);

	const viewport = findBlock(
		carouselBlock?.innerBlocks,
		CAROUSEL_VIEWPORT_BLOCK
	);
	const queryLoops = ( viewport?.innerBlocks ?? [] ).filter(
		( b ) => b.name === QUERY_BLOCK
	);
	const matchingQuery = itemIndex >= 0 ? queryLoops[ itemIndex ] : undefined;
	const inferredCategoryId =
		matchingQuery?.attributes?.query?.taxQuery?.include?.category?.[ 0 ] ??
		null;

	const inferredCategory = useSelect(
		( select ) => {
			if ( ! inferredCategoryId ) {
				return null;
			}
			return select( 'core' ).getEntityRecord(
				'taxonomy',
				'category',
				inferredCategoryId
			);
		},
		[ inferredCategoryId ]
	);

	const { carouselSectionAuto = true, carouselSection = '' } = attributes;

	return (
		<InspectorControls>
			<PanelBody
				title={ __(
					'Carousel Navigation',
					'hm-rt-carousel-extension'
				) }
			>
				<ToggleControl
					label={ __(
						'Auto-assign category',
						'hm-rt-carousel-extension'
					) }
					help={
						carouselSectionAuto
							? __(
									'Category is inferred from the query loop at the same position.',
									'hm-rt-carousel-extension'
							  )
							: __(
									'Choose the category this heading navigates to.',
									'hm-rt-carousel-extension'
							  )
					}
					checked={ carouselSectionAuto }
					onChange={ ( value ) =>
						setAttributes( {
							carouselSectionAuto: value,
							...( value && { carouselSection: '' } ),
						} )
					}
					__nextHasNoMarginBottom
				/>
				{ carouselSectionAuto ? (
					<BaseControl
						id="hm-rt-carousel-extension-assigned-category"
						label={ __(
							'Assigned category',
							'hm-rt-carousel-extension'
						) }
						__nextHasNoMarginBottom
					>
						<p style={ { margin: 0 } }>
							{ inferredCategory?.name ??
								( inferredCategoryId
									? __(
											'Loading…',
											'hm-rt-carousel-extension'
									  )
									: __(
											'None — add a query loop to the carousel viewport at the same position.',
											'hm-rt-carousel-extension'
									  ) ) }
						</p>
					</BaseControl>
				) : (
					<FetchAllTermSelectControl
						taxonomy="category"
						label={ __( 'Category', 'hm-rt-carousel-extension' ) }
						value={ carouselSection }
						onChange={ ( value ) =>
							setAttributes( {
								carouselSection: String( value ),
							} )
						}
						__next40pxDefaultSize
						__nextHasNoMarginBottom
					/>
				) }
			</PanelBody>
		</InspectorControls>
	);
};

/**
 * HOC that injects the carousel-navigation inspector into core/accordion-item.
 * Skips blocks that are not accordion items and accordion items that are not
 * inside a carousel (detected via the rt-carousel/isCarousel block context).
 */
const withAccordionCarouselNav = createHigherOrderComponent(
	( BlockEdit ) => ( props ) => {
		if ( props.name !== ACCORDION_ITEM_BLOCK ) {
			return <BlockEdit { ...props } />;
		}
		if ( ! props.context?.[ 'rt-carousel/isCarousel' ] ) {
			return <BlockEdit { ...props } />;
		}
		return (
			<>
				<BlockEdit { ...props } />
				<AccordionCarouselNavInspector
					clientId={ props.clientId }
					attributes={ props.attributes }
					setAttributes={ props.setAttributes }
				/>
			</>
		);
	},
	'withAccordionCarouselNav'
);

/**
 * Adds carouselSectionAuto and carouselSection attributes to core/accordion-item.
 *
 * @param {Object} settings Block type settings.
 * @param {string} name     Block name.
 * @return {Object} Modified settings.
 */
const setAccordionItemAttributes = ( settings, name ) => {
	if ( name !== ACCORDION_ITEM_BLOCK ) {
		return settings;
	}
	return {
		...settings,
		attributes: {
			...settings.attributes,
			carouselSectionAuto: {
				type: 'boolean',
				default: true,
			},
			carouselSection: {
				type: 'string',
				default: '',
			},
		},
	};
};

const filters = [
	{
		hook: 'blocks.getSaveContent.extraProps',
		namespace: 'hm-rt-carousel-extension/carousel-styles-props',
		callback: addCarouselStylesProps,
	},
	{
		hook: 'editor.BlockListBlock',
		namespace: 'hm-rt-carousel-extension/carousel-styles',
		callback: withCarouselStyles,
	},
	{
		hook: 'blocks.registerBlockType',
		namespace: 'hm-rt-carousel-extension/carousel-slide-gap-attribute',
		callback: setCarouselAttributes,
	},
	{
		hook: 'editor.BlockEdit',
		namespace: 'hm-rt-carousel-extension/carousel-slide-gap-control',
		callback: withSlideGapControl,
	},
	{
		hook: 'blocks.registerBlockType',
		namespace: 'hm-rt-carousel-extension/accordion-item-attributes',
		callback: setAccordionItemAttributes,
	},
	{
		hook: 'editor.BlockEdit',
		namespace: 'hm-rt-carousel-extension/accordion-carousel-nav',
		callback: withAccordionCarouselNav,
	},
];

filters.forEach( ( { hook, namespace, callback } ) => {
	addFilter( hook, namespace, callback );
} );

if ( module.hot ) {
	module.hot.accept();
	const { deregisterBlock, refreshEditor } = require( 'block-editor-hmr' );
	module.hot.dispose( deregisterBlock( '', { filters } ) );
	refreshEditor();
}
