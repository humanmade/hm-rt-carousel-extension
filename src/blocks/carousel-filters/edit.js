import {
	InspectorControls,
	getTypographyClassesAndStyles,
	useBlockProps,
	useSettings,
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
 * @param {string}   props.__unstableLayoutClassNames Flex layout classes. Blocks without inner blocks must apply these themselves.
 */
function Edit( {
	clientId,
	attributes,
	setAttributes,
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

	const blockProps = useBlockProps( { className: layoutClassNames } );

	// Font size is applied to each button, not the wrapper, because the
	// theme's button styles set the buttons' own size (as with core/button).
	const [ fluidTypographySettings, layout ] = useSettings(
		'typography.fluid',
		'layout'
	);
	const typography = getTypographyClassesAndStyles( attributes, {
		typography: { fluid: fluidTypographySettings },
		layout: { wideSize: layout?.wideSize },
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
			</InspectorControls>
			<div { ...blockProps }>
				{ tags.length ? (
					labels.map( ( label, index ) => (
						<button
							key={ label }
							type="button"
							className={ [
								'wp-element-button wp-block-hm-rt-carousel-extension-carousel-filters__button',
								typography.className,
							]
								.filter( Boolean )
								.join( ' ' ) }
							style={ typography.style }
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

export default Edit;
