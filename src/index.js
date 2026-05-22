import './editor.scss';

import { addFilter } from '@wordpress/hooks';
import { createHigherOrderComponent } from '@wordpress/compose';
import { InspectorControls, useSettings } from '@wordpress/block-editor';
import { PanelBody, SelectControl } from '@wordpress/components';
import { useEffect } from '@wordpress/element';
import { __ } from '@wordpress/i18n';

const BLOCK_NAME = 'rt-carousel/carousel';

/**
 * Inspector control for selecting a theme spacing preset as the carousel slide gap.
 *
 * @param {Object}   props
 * @param {Object}   props.attributes    Block attributes.
 * @param {Function} props.setAttributes Block attribute setter.
 */
const SlideGapControl = ({ attributes, setAttributes }) => {
	const { slideGap, slideGapSlug } = attributes;

	const [spacingSizes] = useSettings('spacing.spacingSizes');

	const options = [
		{ label: __('None', 'hm-rt-carousel-extension'), value: '' },
		...(spacingSizes || []).map((size) => ({
			label: size.name,
			value: size.slug,
		})),
	];

	// When the RangeControl changes slideGap to a value that no longer matches the
	// selected preset, clear the preset so the frontend uses the raw px value.
	useEffect(() => {
		if (!slideGapSlug) {
			return;
		}
		const expectedPx = parseInt(slideGapSlug.split('-').pop(), 10) || 0;
		if (slideGap !== expectedPx) {
			setAttributes({ slideGapSlug: '' });
		}
	}, [slideGap, slideGapSlug, setAttributes]);

	const handleChange = (slug) => {
		if (!slug) {
			setAttributes({ slideGapSlug: '', slideGap: 0 });
			return;
		}
		// The pixel value in the slug (e.g. "sm-16" → 16) gives a close editor preview.
		const px = parseInt(slug.split('-').pop(), 10) || 0;
		setAttributes({ slideGapSlug: slug, slideGap: px });
	};

	return (
		<InspectorControls group="styles">
			<PanelBody
				title={__('Slide Gap', 'hm-rt-carousel-extension')}
				className="hm-rt-carousel-extension-slide-gap-panel"
			>
				<SelectControl
					label={__('Spacing size', 'hm-rt-carousel-extension')}
					hideLabelFromVision
					value={slideGapSlug}
					options={options}
					onChange={handleChange}
					__next40pxDefaultSize
				/>
			</PanelBody>
		</InspectorControls>
	);
};

/**
 * HOC that injects SlideGapControl into the rt-carousel/carousel inspector panel.
 */
const withSlideGapControl = createHigherOrderComponent((BlockEdit) => {
	return (props) => {
		if (props.name !== BLOCK_NAME) {
			return <BlockEdit {...props} />;
		}
		return (
			<>
				<BlockEdit {...props} />
				<SlideGapControl
					attributes={props.attributes}
					setAttributes={props.setAttributes}
				/>
			</>
		);
	};
}, 'withSlideGapControl');

/**
 * Adds the slideGapSlug attribute to rt-carousel/carousel block type settings.
 *
 * @param {Object} settings Block type settings.
 * @param {string} name     Block name.
 * @return {Object} Modified settings.
 */
const setCarouselAttributes = (settings, name) => {
	if (name !== BLOCK_NAME) {
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
const addCarouselStylesProps = (props, blockType, attributes) => {
	if (
		blockType.name !== CONTROLS_BLOCK_NAME &&
		blockType.name !== BLOCK_NAME
	) {
		return props;
	}

	const blockGap = attributes?.style?.spacing?.blockGap;
	if (!blockGap) {
		return props;
	}

	const cssValue = blockGap.startsWith('var:preset|spacing|')
		? `var(--wp--preset--spacing--${blockGap.replace('var:preset|spacing|', '')})`
		: blockGap;

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

/**
 * HOC that forwards blockGap and layout justification as CSS custom properties
 * on the editor block wrapper.
 */
const withCarouselStyles = createHigherOrderComponent(
	(BlockListBlock) => (props) => {
		if (props.name !== CONTROLS_BLOCK_NAME && props.name !== BLOCK_NAME) {
			return <BlockListBlock {...props} />;
		}

		const blockGap = props.attributes?.style?.spacing?.blockGap;
		const justifyContent =
			justifyMap[props.attributes?.layout?.justifyContent];

		if (!blockGap && !justifyContent) {
			return <BlockListBlock {...props} />;
		}

		const gapCssValue = blockGap?.startsWith('var:preset|spacing|')
			? `var(--wp--preset--spacing--${blockGap.replace('var:preset|spacing|', '')})`
			: blockGap;

		return (
			<BlockListBlock
				{...props}
				wrapperProps={{
					...props.wrapperProps,
					style: {
						...props.wrapperProps?.style,
						...(gapCssValue && {
							'--wp--style--block-gap': gapCssValue,
						}),
						...(justifyContent && {
							'--hm-rt-carousel-extension-controls-justify': justifyContent,
						}),
					},
				}}
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
];

filters.forEach(({ hook, namespace, callback }) => {
	addFilter(hook, namespace, callback);
});

if (module.hot) {
	module.hot.accept();
	const { deregisterBlock, refreshEditor } = require('block-editor-hmr');
	module.hot.dispose(deregisterBlock('', { filters }));
	refreshEditor();
}
