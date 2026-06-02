import './editor.scss';

import { addFilter } from '@wordpress/hooks';
import { createHigherOrderComponent } from '@wordpress/compose';
import {
	InspectorControls,
	useSettings,
	getSpacingPresetCssVar,
} from '@wordpress/block-editor';
import { PanelBody, SelectControl } from '@wordpress/components';
import { __ } from '@wordpress/i18n';

const BLOCK_NAME = 'rt-carousel/carousel';

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

	const handleChange = ( slug ) => {
		if ( ! slug ) {
			setAttributes( { slideGapSlug: '' } );
			return;
		}
		setAttributes( { slideGapSlug: slug } );
	};

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
					onChange={ handleChange }
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
		if ( props.name !== BLOCK_NAME ) {
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
	if ( name !== BLOCK_NAME ) {
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

const CONTROLS_BLOCK_NAME = 'rt-carousel/carousel-controls';

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
		blockType.name !== CONTROLS_BLOCK_NAME &&
		blockType.name !== BLOCK_NAME
	) {
		return props;
	}

	const extraStyles = {};

	const blockGap = attributes?.style?.spacing?.blockGap;
	if ( blockGap ) {
		extraStyles[ '--wp--style--block-gap' ] =
			getSpacingPresetCssVar( blockGap ) ?? blockGap;
	}

	if ( blockType.name === CONTROLS_BLOCK_NAME ) {
		const layoutAlign = attributes?.layout?.verticalAlignment;
		const customAlign = attributes?.controlsVerticalAlign;
		const align = customAlign || layoutAlign;
		if ( align && verticalAlignMap[ align ] ) {
			extraStyles[ '--hm-rt-carousel-extension-controls-align' ] =
				verticalAlignMap[ align ];
			extraStyles[ '--hm-rt-carousel-extension-controls-padding-top' ] =
				paddingTopMap[ align ] ?? '0';
		}
	}

	if ( ! Object.keys( extraStyles ).length ) {
		return props;
	}

	return {
		...props,
		style: {
			...props.style,
			...extraStyles,
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

const paddingTopMap = {
	top: '12%',
	center: '0',
	bottom: '0',
	stretch: '0',
};

/**
 * Inspector control for selecting the vertical alignment of carousel controls.
 * Provides a UI for themes that disable the built-in layout verticalAlignment control.
 *
 * @param {Object}   props
 * @param {Object}   props.attributes    Block attributes.
 * @param {Function} props.setAttributes Block attribute setter.
 */
const VerticalAlignControl = ( { attributes, setAttributes } ) => {
	const { controlsVerticalAlign } = attributes;

	const options = [
		{ label: __( 'Default', 'hm-rt-carousel-extension' ), value: '' },
		{ label: __( 'Center', 'hm-rt-carousel-extension' ), value: 'center' },
		{ label: __( 'Bottom', 'hm-rt-carousel-extension' ), value: 'bottom' },
	];

	return (
		<InspectorControls group="styles">
			<PanelBody title={ __( 'Controls Alignment', 'hm-rt-carousel-extension' ) }>
				<SelectControl
					label={ __( 'Vertical alignment', 'hm-rt-carousel-extension' ) }
					value={ controlsVerticalAlign || '' }
					options={ options }
					onChange={ ( value ) => setAttributes( { controlsVerticalAlign: value } ) }
					__next40pxDefaultSize
				/>
			</PanelBody>
		</InspectorControls>
	);
};

/**
 * HOC that injects VerticalAlignControl into the rt-carousel/carousel-controls inspector panel.
 */
const withVerticalAlignControl = createHigherOrderComponent( ( BlockEdit ) => {
	return ( props ) => {
		if ( props.name !== CONTROLS_BLOCK_NAME ) {
			return <BlockEdit { ...props } />;
		}
		return (
			<>
				<BlockEdit { ...props } />
				<VerticalAlignControl
					attributes={ props.attributes }
					setAttributes={ props.setAttributes }
				/>
			</>
		);
	};
}, 'withVerticalAlignControl' );

/**
 * Adds the controlsVerticalAlign attribute to rt-carousel/carousel-controls block type settings.
 *
 * @param {Object} settings Block type settings.
 * @param {string} name     Block name.
 * @return {Object} Modified settings.
 */
const setControlsAttributes = ( settings, name ) => {
	if ( name !== CONTROLS_BLOCK_NAME ) {
		return settings;
	}
	return {
		...settings,
		attributes: {
			...settings.attributes,
			controlsVerticalAlign: {
				type: 'string',
				default: '',
			},
		},
	};
};

/**
 * HOC that forwards blockGap and layout justification as CSS custom properties
 * on the editor block wrapper.
 */
const withCarouselStyles = createHigherOrderComponent(
	( BlockListBlock ) => ( props ) => {
		if ( props.name !== CONTROLS_BLOCK_NAME && props.name !== BLOCK_NAME ) {
			return <BlockListBlock { ...props } />;
		}

		const blockGap = props.attributes?.style?.spacing?.blockGap;
		const justifyContent =
			justifyMap[ props.attributes?.layout?.justifyContent ];
		const layoutAlign =
			verticalAlignMap[ props.attributes?.layout?.verticalAlignment ];
		const customAlign = props.name === CONTROLS_BLOCK_NAME
			? props.attributes?.controlsVerticalAlign
			: null;
		const verticalAlignment = customAlign
			? verticalAlignMap[ customAlign ]
			: layoutAlign;
		const paddingTop = customAlign
			? paddingTopMap[ customAlign ]
			: paddingTopMap[ props.attributes?.layout?.verticalAlignment ];

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
						...( paddingTop !== undefined && {
							'--hm-rt-carousel-extension-controls-padding-top':
								paddingTop,
						} ),
					},
				} }
			/>
		);
	},
	'withCarouselStyles'
);

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
		namespace: 'hm-rt-carousel-extension/controls-vertical-align-attribute',
		callback: setControlsAttributes,
	},
	{
		hook: 'editor.BlockEdit',
		namespace: 'hm-rt-carousel-extension/controls-vertical-align-control',
		callback: withVerticalAlignControl,
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
