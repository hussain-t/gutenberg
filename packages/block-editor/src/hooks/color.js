/**
 * External dependencies
 */
import classnames from 'classnames';
import { isObject, setWith, clone } from 'lodash';

/**
 * WordPress dependencies
 */
import { addFilter } from '@wordpress/hooks';
import { getBlockSupport } from '@wordpress/blocks';
import { __ } from '@wordpress/i18n';
import { useRef, useEffect, useMemo, Platform } from '@wordpress/element';
import { createHigherOrderComponent } from '@wordpress/compose';

/**
 * Internal dependencies
 */
import {
	getColorClassName,
	getColorObjectByColorValue,
	getColorObjectByAttributeValues,
} from '../components/colors';
import {
	__experimentalGetGradientClass,
	getGradientValueBySlug,
	getGradientSlugByValue,
} from '../components/gradients';
import { shouldSkipSerialization } from './style';
import { cleanEmptyObject } from './utils';
import ColorPanel from './color-panel';
import useSetting from '../components/use-setting';

export const COLOR_SUPPORT_KEY = 'color';

const EMPTY_OBJECT = {};

const hasColorSupport = ( blockType ) => {
	const colorSupport = getBlockSupport( blockType, COLOR_SUPPORT_KEY );
	return (
		colorSupport &&
		( colorSupport.link === true ||
			colorSupport.gradient === true ||
			colorSupport.background !== false ||
			colorSupport.text !== false )
	);
};

const hasLinkColorSupport = ( blockType ) => {
	if ( Platform.OS !== 'web' ) {
		return false;
	}

	const colorSupport = getBlockSupport( blockType, COLOR_SUPPORT_KEY );

	return isObject( colorSupport ) && !! colorSupport.link;
};

const hasGradientSupport = ( blockType ) => {
	const colorSupport = getBlockSupport( blockType, COLOR_SUPPORT_KEY );

	return isObject( colorSupport ) && !! colorSupport.gradients;
};

const hasBackgroundColorSupport = ( blockType ) => {
	const colorSupport = getBlockSupport( blockType, COLOR_SUPPORT_KEY );

	return colorSupport && colorSupport.background !== false;
};

const hasTextColorSupport = ( blockType ) => {
	const colorSupport = getBlockSupport( blockType, COLOR_SUPPORT_KEY );

	return colorSupport && colorSupport.text !== false;
};

/**
 * Filters registered block settings, extending attributes to include
 * `backgroundColor` and `textColor` attribute.
 *
 * @param {Object} settings Original block settings.
 *
 * @return {Object} Filtered block settings.
 */
function addAttributes( settings ) {
	if ( ! hasColorSupport( settings ) ) {
		return settings;
	}

	// allow blocks to specify their own attribute definition with default values if needed.
	if ( ! settings.attributes.backgroundColor ) {
		Object.assign( settings.attributes, {
			backgroundColor: {
				type: 'string',
			},
		} );
	}
	if ( ! settings.attributes.textColor ) {
		Object.assign( settings.attributes, {
			textColor: {
				type: 'string',
			},
		} );
	}

	if ( hasGradientSupport( settings ) && ! settings.attributes.gradient ) {
		Object.assign( settings.attributes, {
			gradient: {
				type: 'string',
			},
		} );
	}

	return settings;
}

/**
 * Override props assigned to save component to inject colors classnames.
 *
 * @param {Object} props      Additional props applied to save element.
 * @param {Object} blockType  Block type.
 * @param {Object} attributes Block attributes.
 *
 * @return {Object} Filtered props applied to save element.
 */
export function addSaveProps( props, blockType, attributes ) {
	if (
		! hasColorSupport( blockType ) ||
		shouldSkipSerialization( blockType, COLOR_SUPPORT_KEY )
	) {
		return props;
	}

	const hasGradient = hasGradientSupport( blockType );
	const { backgroundColor, textColor, gradient, style } = attributes;

	const shouldSerialize = ( feature ) =>
		! shouldSkipSerialization( blockType, COLOR_SUPPORT_KEY, feature );

	// Primary color classes must come before the `has-text-color`,
	// `has-background` and `has-link-color` classes to maintain backwards
	// compatibility and avoid block invalidations.
	const textClass = shouldSerialize( 'text' )
		? getColorClassName( 'color', textColor )
		: undefined;

	const gradientClass = shouldSerialize( 'gradients' )
		? __experimentalGetGradientClass( gradient )
		: undefined;

	const backgroundClass = shouldSerialize( 'background' )
		? getColorClassName( 'background-color', backgroundColor )
		: undefined;

	const serializeHasBackground =
		shouldSerialize( 'background' ) || shouldSerialize( 'gradients' );
	const hasBackground =
		backgroundColor ||
		style?.color?.background ||
		( hasGradient && ( gradient || style?.color?.gradient ) );

	const newClassName = classnames(
		props.className,
		textClass,
		gradientClass,
		{
			// Don't apply the background class if there's a custom gradient
			[ backgroundClass ]:
				( ! hasGradient || ! style?.color?.gradient ) &&
				!! backgroundClass,
			'has-text-color':
				shouldSerialize( 'text' ) &&
				( textColor || style?.color?.text ),
			'has-background': serializeHasBackground && hasBackground,
			'has-link-color':
				shouldSerialize( 'link' ) && style?.elements?.link?.color,
		}
	);
	props.className = newClassName ? newClassName : undefined;

	return props;
}

/**
 * Filters registered block settings to extend the block edit wrapper
 * to apply the desired styles and classnames properly.
 *
 * @param {Object} settings Original block settings.
 *
 * @return {Object} Filtered block settings.
 */
export function addEditProps( settings ) {
	if (
		! hasColorSupport( settings ) ||
		shouldSkipSerialization( settings, COLOR_SUPPORT_KEY )
	) {
		return settings;
	}
	const existingGetEditWrapperProps = settings.getEditWrapperProps;
	settings.getEditWrapperProps = ( attributes ) => {
		let props = {};
		if ( existingGetEditWrapperProps ) {
			props = existingGetEditWrapperProps( attributes );
		}
		return addSaveProps( props, settings, attributes );
	};

	return settings;
}

const getLinkColorFromAttributeValue = ( colors, value ) => {
	const attributeParsed = /var:preset\|color\|(.+)/.exec( value );
	if ( attributeParsed && attributeParsed[ 1 ] ) {
		return getColorObjectByAttributeValues( colors, attributeParsed[ 1 ] )
			.color;
	}
	return value;
};

function immutableSet( object, path, value ) {
	return setWith( object ? clone( object ) : {}, path, value, clone );
}

/**
 * Inspector control panel containing the color related configuration
 *
 * @param {Object} props
 *
 * @return {WPElement} Color edit element.
 */
export function ColorEdit( props ) {
	const { name: blockName, attributes } = props;
	// Some color settings have a special handling for deprecated flags in `useSetting`,
	// so we can't unwrap them by doing const { ... } = useSetting('color')
	// until https://github.com/WordPress/gutenberg/issues/37094 is fixed.
	const userPalette = useSetting( 'color.palette.custom' );
	const themePalette = useSetting( 'color.palette.theme' );
	const defaultPalette = useSetting( 'color.palette.default' );
	const allSolids = useMemo(
		() => [
			...( userPalette || [] ),
			...( themePalette || [] ),
			...( defaultPalette || [] ),
		],
		[ userPalette, themePalette, defaultPalette ]
	);
	const gradientsPerOrigin = useSetting( 'color.gradients' ) || EMPTY_OBJECT;
	const areCustomSolidsEnabled = useSetting( 'color.custom' );
	const areCustomGradientsEnabled = useSetting( 'color.customGradient' );
	const isBackgroundEnabled = useSetting( 'color.background' );
	const isLinkEnabled = useSetting( 'color.link' );
	const isTextEnabled = useSetting( 'color.text' );

	const solidsEnabled =
		areCustomSolidsEnabled || ! themePalette || themePalette?.length > 0;

	const gradientsEnabled =
		areCustomGradientsEnabled ||
		! gradientsPerOrigin?.theme ||
		gradientsPerOrigin?.theme?.length > 0;

	const allGradients = useMemo(
		() => [
			...( gradientsPerOrigin?.custom || [] ),
			...( gradientsPerOrigin?.theme || [] ),
			...( gradientsPerOrigin?.default || [] ),
		],
		[ gradientsPerOrigin ]
	);

	// Shouldn't be needed but right now the ColorGradientsPanel
	// can trigger both onChangeColor and onChangeBackground
	// synchronously causing our two callbacks to override changes
	// from each other.
	const localAttributes = useRef( attributes );
	useEffect( () => {
		localAttributes.current = attributes;
	}, [ attributes ] );

	if ( ! hasColorSupport( blockName ) ) {
		return null;
	}

	const hasLinkColor =
		hasLinkColorSupport( blockName ) && isLinkEnabled && solidsEnabled;
	const hasTextColor =
		hasTextColorSupport( blockName ) && isTextEnabled && solidsEnabled;
	const hasBackgroundColor =
		hasBackgroundColorSupport( blockName ) &&
		isBackgroundEnabled &&
		solidsEnabled;
	const hasGradientColor =
		hasGradientSupport( blockName ) && gradientsEnabled;

	if (
		! hasLinkColor &&
		! hasTextColor &&
		! hasBackgroundColor &&
		! hasGradientColor
	) {
		return null;
	}

	const { style, textColor, backgroundColor, gradient } = attributes;
	let gradientValue;
	if ( hasGradientColor && gradient ) {
		gradientValue = getGradientValueBySlug( allGradients, gradient );
	} else if ( hasGradientColor ) {
		gradientValue = style?.color?.gradient;
	}

	const onChangeColor = ( name ) => ( value ) => {
		const colorObject = getColorObjectByColorValue( allSolids, value );
		const attributeName = name + 'Color';
		const newStyle = {
			...localAttributes.current.style,
			color: {
				...localAttributes.current?.style?.color,
				[ name ]: colorObject?.slug ? undefined : value,
			},
		};

		const newNamedColor = colorObject?.slug ? colorObject.slug : undefined;
		const newAttributes = {
			style: cleanEmptyObject( newStyle ),
			[ attributeName ]: newNamedColor,
		};

		props.setAttributes( newAttributes );
		localAttributes.current = {
			...localAttributes.current,
			...newAttributes,
		};
	};

	const onChangeGradient = ( value ) => {
		const slug = getGradientSlugByValue( allGradients, value );
		let newAttributes;
		if ( slug ) {
			const newStyle = {
				...localAttributes.current?.style,
				color: {
					...localAttributes.current?.style?.color,
					gradient: undefined,
				},
			};
			newAttributes = {
				style: cleanEmptyObject( newStyle ),
				gradient: slug,
			};
		} else {
			const newStyle = {
				...localAttributes.current?.style,
				color: {
					...localAttributes.current?.style?.color,
					gradient: value,
				},
			};
			newAttributes = {
				style: cleanEmptyObject( newStyle ),
				gradient: undefined,
			};
		}
		props.setAttributes( newAttributes );
		localAttributes.current = {
			...localAttributes.current,
			...newAttributes,
		};
	};

	const onChangeLinkColor = ( value ) => {
		const colorObject = getColorObjectByColorValue( allSolids, value );
		const newLinkColorValue = colorObject?.slug
			? `var:preset|color|${ colorObject.slug }`
			: value;

		const newStyle = cleanEmptyObject(
			immutableSet(
				style,
				[ 'elements', 'link', 'color', 'text' ],
				newLinkColorValue
			)
		);
		props.setAttributes( { style: newStyle } );
	};

	return (
		<ColorPanel
			enableContrastChecking={
				// Turn on contrast checker for web only since it's not supported on mobile yet.
				Platform.OS === 'web' && ! gradient && ! style?.color?.gradient
			}
			clientId={ props.clientId }
			settings={ [
				...( hasTextColor
					? [
							{
								label: __( 'Text color' ),
								onColorChange: onChangeColor( 'text' ),
								colorValue: getColorObjectByAttributeValues(
									allSolids,
									textColor,
									style?.color?.text
								).color,
							},
					  ]
					: [] ),
				...( hasBackgroundColor || hasGradientColor
					? [
							{
								label: __( 'Background color' ),
								onColorChange: hasBackgroundColor
									? onChangeColor( 'background' )
									: undefined,
								colorValue: getColorObjectByAttributeValues(
									allSolids,
									backgroundColor,
									style?.color?.background
								).color,
								gradientValue,
								onGradientChange: hasGradientColor
									? onChangeGradient
									: undefined,
							},
					  ]
					: [] ),
				...( hasLinkColor
					? [
							{
								label: __( 'Link Color' ),
								onColorChange: onChangeLinkColor,
								colorValue: getLinkColorFromAttributeValue(
									allSolids,
									style?.elements?.link?.color?.text
								),
								clearable: !! style?.elements?.link?.color
									?.text,
							},
					  ]
					: [] ),
			] }
		/>
	);
}

/**
 * This adds inline styles for color palette colors.
 * Ideally, this is not needed and themes should load their palettes on the editor.
 *
 * @param {Function} BlockListBlock Original component.
 *
 * @return {Function} Wrapped component.
 */
export const withColorPaletteStyles = createHigherOrderComponent(
	( BlockListBlock ) => ( props ) => {
		const { name, attributes } = props;
		const { backgroundColor, textColor } = attributes;
		const userPalette = useSetting( 'color.palette.custom' ) || [];
		const themePalette = useSetting( 'color.palette.theme' ) || [];
		const defaultPalette = useSetting( 'color.palette.default' ) || [];
		const colors = useMemo(
			() => [
				...( userPalette || [] ),
				...( themePalette || [] ),
				...( defaultPalette || [] ),
			],
			[ userPalette, themePalette, defaultPalette ]
		);
		if (
			! hasColorSupport( name ) ||
			shouldSkipSerialization( name, COLOR_SUPPORT_KEY )
		) {
			return <BlockListBlock { ...props } />;
		}
		const extraStyles = {};

		if ( textColor ) {
			extraStyles.color = getColorObjectByAttributeValues(
				colors,
				textColor
			)?.color;
		}
		if ( backgroundColor ) {
			extraStyles.backgroundColor = getColorObjectByAttributeValues(
				colors,
				backgroundColor
			)?.color;
		}

		let wrapperProps = props.wrapperProps;
		wrapperProps = {
			...props.wrapperProps,
			style: {
				...extraStyles,
				...props.wrapperProps?.style,
			},
		};

		return <BlockListBlock { ...props } wrapperProps={ wrapperProps } />;
	}
);

addFilter(
	'blocks.registerBlockType',
	'core/color/addAttribute',
	addAttributes
);

addFilter(
	'blocks.getSaveContent.extraProps',
	'core/color/addSaveProps',
	addSaveProps
);

addFilter(
	'blocks.registerBlockType',
	'core/color/addEditProps',
	addEditProps
);

addFilter(
	'editor.BlockListBlock',
	'core/color/with-color-palette-styles',
	withColorPaletteStyles
);
