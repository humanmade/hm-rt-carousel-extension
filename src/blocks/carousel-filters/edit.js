import {
	InspectorControls,
	PanelColorSettings,
	useBlockProps,
	withColors,
} from '@wordpress/block-editor';
import { PanelBody, TextControl } from '@wordpress/components';
import { useSelect } from '@wordpress/data';
import { useMemo } from '@wordpress/element';
import { __ } from '@wordpress/i18n';

import { CAROUSEL_BLOCK, getCarouselFilterTags } from '../../filter-tags';

/**
 * Editor preview for the carousel filters block. Shows the buttons that will
 * render on the front end, built from the parent carousel's slide tags, with
 * "All" shown as the selected filter.
 *
 * @param {Object}   props                            Block edit props.
 * @param {string}   props.clientId                   Block client ID.
 * @param {Object}   props.attributes                 Block attributes.
 * @param {Function} props.setAttributes              Block attribute setter.
 * @param {Object}   props.activeBackgroundColor      Active background colour, from withColors.
 * @param {Function} props.setActiveBackgroundColor   Active background colour setter.
 * @param {Object}   props.activeTextColor            Active text colour, from withColors.
 * @param {Function} props.setActiveTextColor         Active text colour setter.
 * @param {string}   props.__unstableLayoutClassNames Flex layout classes. Blocks without inner blocks must apply these themselves.
 */
function Edit( {
	clientId,
	attributes,
	setAttributes,
	activeBackgroundColor,
	setActiveBackgroundColor,
	activeTextColor,
	setActiveTextColor,
	__unstableLayoutClassNames: layoutClassNames,
} ) {
	const { allLabel } = attributes;

	const carouselBlock = useSelect(
		( select ) => {
			const { getBlockParentsByBlockName, getBlock } =
				select( 'core/block-editor' );
			const [ carouselId ] = getBlockParentsByBlockName(
				clientId,
				CAROUSEL_BLOCK,
				true
			);
			return carouselId ? getBlock( carouselId ) : null;
		},
		[ clientId ]
	);

	const tags = useMemo(
		() => getCarouselFilterTags( carouselBlock ),
		[ carouselBlock ]
	);

	const blockProps = useBlockProps( {
		className: [
			layoutClassNames,
			activeBackgroundColor.color && 'has-active-background',
			activeTextColor.color && 'has-active-text',
		]
			.filter( Boolean )
			.join( ' ' ),
		style: {
			'--hm-carousel-filters-active-background':
				activeBackgroundColor.color,
			'--hm-carousel-filters-active-text': activeTextColor.color,
		},
	} );

	const labels = [
		allLabel || __( 'All', 'hm-rt-carousel-extension' ),
		...tags,
	];

	return (
		<>
			<InspectorControls>
				<PanelBody
					title={ __( 'Settings', 'hm-rt-carousel-extension' ) }
				>
					<TextControl
						label={ __(
							'"All" button label',
							'hm-rt-carousel-extension'
						) }
						value={ allLabel }
						placeholder={ __( 'All', 'hm-rt-carousel-extension' ) }
						onChange={ ( value ) =>
							setAttributes( { allLabel: value } )
						}
						__next40pxDefaultSize
						__nextHasNoMarginBottom
					/>
				</PanelBody>
				<PanelColorSettings
					title={ __(
						'Active filter colors',
						'hm-rt-carousel-extension'
					) }
					colorSettings={ [
						{
							value: activeBackgroundColor.color,
							onChange: setActiveBackgroundColor,
							label: __(
								'Background',
								'hm-rt-carousel-extension'
							),
						},
						{
							value: activeTextColor.color,
							onChange: setActiveTextColor,
							label: __( 'Text', 'hm-rt-carousel-extension' ),
						},
					] }
				/>
			</InspectorControls>
			<div { ...blockProps }>
				{ tags.length ? (
					labels.map( ( label, index ) => (
						<button
							key={ label }
							type="button"
							className="wp-element-button wp-block-hm-rt-carousel-extension-carousel-filters__button"
							aria-pressed={ index === 0 }
						>
							{ label }
						</button>
					) )
				) : (
					<p>
						{ __(
							'Add filter tags to the carousel slides to show filter buttons.',
							'hm-rt-carousel-extension'
						) }
					</p>
				) }
			</div>
		</>
	);
}

export default withColors( {
	activeBackgroundColor: 'background-color',
	activeTextColor: 'color',
} )( Edit );
