/**
 * External dependencies
 */
import classnames from 'classnames';
import { map, some } from 'lodash';

/**
 * WordPress dependencies
 */
import { RichText, useBlockProps } from '@wordpress/block-editor';
import { createBlock } from '@wordpress/blocks';

/**
 * Internal dependencies
 */
import {
	LINK_DESTINATION_ATTACHMENT,
	LINK_DESTINATION_MEDIA,
	LINK_DESTINATION_NONE,
} from './constants';

const DEPRECATED_LINK_DESTINATION_MEDIA = 'file';
const DEPRECATED_LINK_DESTINATION_ATTACHMENT = 'post';

/**
 * Original function to determine default number of columns from a block's
 * attributes.
 *
 * Used in deprecations: v1-6.
 *
 * @param  {Object} attributes Block attributes.
 * @return {number}            Default number of columns for the gallery.
 */
export function defaultColumnsNumberV1( attributes ) {
	return Math.min( 3, attributes.images.length );
}

/**
 * Original function to determines new href and linkDestination values for an image block from the
 * supplied Gallery link destination.
 *
 * Used in deprecations: v1-6.
 *
 * @param {Object} image       Gallery image.
 * @param {string} destination Gallery's selected link destination.
 * @return {Object}            New attributes to assign to image block.
 */
export function getHrefAndDestination( image, destination ) {
	// Need to determine the URL that the selected destination maps to.
	// Gutenberg and WordPress use different constants so the new link
	// destination also needs to be tweaked.
	switch ( destination ) {
		case DEPRECATED_LINK_DESTINATION_MEDIA:
			return {
				href: image?.source_url || image?.url, // eslint-disable-line camelcase
				linkDestination: LINK_DESTINATION_MEDIA,
			};
		case DEPRECATED_LINK_DESTINATION_ATTACHMENT:
			return {
				href: image?.link,
				linkDestination: LINK_DESTINATION_ATTACHMENT,
			};
		case LINK_DESTINATION_MEDIA:
			return {
				href: image?.source_url || image?.url, // eslint-disable-line camelcase
				linkDestination: LINK_DESTINATION_MEDIA,
			};
		case LINK_DESTINATION_ATTACHMENT:
			return {
				href: image?.link,
				linkDestination: LINK_DESTINATION_ATTACHMENT,
			};
		case LINK_DESTINATION_NONE:
			return {
				href: undefined,
				linkDestination: LINK_DESTINATION_NONE,
			};
	}

	return {};
}

const v1 = {
	attributes: {
		images: {
			type: 'array',
			default: [],
			source: 'query',
			selector: 'div.wp-block-gallery figure.blocks-gallery-image img',
			query: {
				url: {
					source: 'attribute',
					attribute: 'src',
				},
				alt: {
					source: 'attribute',
					attribute: 'alt',
					default: '',
				},
				id: {
					source: 'attribute',
					attribute: 'data-id',
				},
			},
		},
		columns: {
			type: 'number',
		},
		imageCrop: {
			type: 'boolean',
			default: true,
		},
		linkTo: {
			type: 'string',
			default: 'none',
		},
		align: {
			type: 'string',
			default: 'none',
		},
	},
	supports: {
		align: true,
	},
	save( { attributes } ) {
		const {
			images,
			columns = defaultColumnsNumberV1( attributes ),
			align,
			imageCrop,
			linkTo,
		} = attributes;
		const className = classnames( `columns-${ columns }`, {
			alignnone: align === 'none',
			'is-cropped': imageCrop,
		} );
		return (
			<div className={ className }>
				{ images.map( ( image ) => {
					let href;

					switch ( linkTo ) {
						case 'media':
							href = image.url;
							break;
						case 'attachment':
							href = image.link;
							break;
					}

					const img = (
						<img
							src={ image.url }
							alt={ image.alt }
							data-id={ image.id }
						/>
					);

					return (
						<figure
							key={ image.id || image.url }
							className="blocks-gallery-image"
						>
							{ href ? <a href={ href }>{ img }</a> : img }
						</figure>
					);
				} ) }
			</div>
		);
	},
	isEligible( { imageCount } ) {
		return ! imageCount;
	},
	migrate( { images, imageCrop, linkTo, sizeSlug, columns, caption } ) {
		const imageBlocks = images.map( ( image ) => {
			return createBlock( 'core/image', {
				id: parseInt( image.id ),
				url: image.url,
				alt: image.alt,
				caption: image.caption,
				sizeSlug,
				...getHrefAndDestination( image, linkTo ),
			} );
		} );
		return [
			{
				caption,
				columns,
				imageCrop,
				linkTo,
				sizeSlug,
				imageCount: imageBlocks.length,
				allowResize: false,
				isGrouped: true,
			},
			imageBlocks,
		];
	},
};

const v2 = {
	attributes: {
		images: {
			type: 'array',
			default: [],
			source: 'query',
			selector: 'ul.wp-block-gallery .blocks-gallery-item',
			query: {
				url: {
					source: 'attribute',
					selector: 'img',
					attribute: 'src',
				},
				alt: {
					source: 'attribute',
					selector: 'img',
					attribute: 'alt',
					default: '',
				},
				id: {
					source: 'attribute',
					selector: 'img',
					attribute: 'data-id',
				},
				link: {
					source: 'attribute',
					selector: 'img',
					attribute: 'data-link',
				},
				caption: {
					type: 'array',
					source: 'children',
					selector: 'figcaption',
				},
			},
		},
		columns: {
			type: 'number',
		},
		imageCrop: {
			type: 'boolean',
			default: true,
		},
		linkTo: {
			type: 'string',
			default: 'none',
		},
	},
	isEligible( { images, ids } ) {
		return (
			images &&
			images.length > 0 &&
			( ( ! ids && images ) ||
				( ids && images && ids.length !== images.length ) ||
				some( images, ( id, index ) => {
					if ( ! id && ids[ index ] !== null ) {
						return true;
					}
					return parseInt( id, 10 ) !== ids[ index ];
				} ) )
		);
	},
	migrate( attributes ) {
		return {
			...attributes,
			ids: map( attributes.images, ( { id } ) => {
				if ( ! id ) {
					return null;
				}
				return parseInt( id, 10 );
			} ),
		};
	},
	supports: {
		align: true,
	},
	save( { attributes } ) {
		const {
			images,
			columns = defaultColumnsNumberV1( attributes ),
			imageCrop,
			linkTo,
		} = attributes;
		return (
			<ul
				className={ `columns-${ columns } ${
					imageCrop ? 'is-cropped' : ''
				}` }
			>
				{ images.map( ( image ) => {
					let href;

					switch ( linkTo ) {
						case 'media':
							href = image.url;
							break;
						case 'attachment':
							href = image.link;
							break;
					}

					const img = (
						<img
							src={ image.url }
							alt={ image.alt }
							data-id={ image.id }
							data-link={ image.link }
							className={
								image.id ? `wp-image-${ image.id }` : null
							}
						/>
					);

					return (
						<li
							key={ image.id || image.url }
							className="blocks-gallery-item"
						>
							<figure>
								{ href ? <a href={ href }>{ img }</a> : img }
								{ image.caption && image.caption.length > 0 && (
									<RichText.Content
										tagName="figcaption"
										value={ image.caption }
									/>
								) }
							</figure>
						</li>
					);
				} ) }
			</ul>
		);
	},
};

const v3 = {
	attributes: {
		images: {
			type: 'array',
			default: [],
			source: 'query',
			selector: 'ul.wp-block-gallery .blocks-gallery-item',
			query: {
				url: {
					source: 'attribute',
					selector: 'img',
					attribute: 'src',
				},
				fullUrl: {
					source: 'attribute',
					selector: 'img',
					attribute: 'data-full-url',
				},
				alt: {
					source: 'attribute',
					selector: 'img',
					attribute: 'alt',
					default: '',
				},
				id: {
					source: 'attribute',
					selector: 'img',
					attribute: 'data-id',
				},
				link: {
					source: 'attribute',
					selector: 'img',
					attribute: 'data-link',
				},
				caption: {
					type: 'array',
					source: 'children',
					selector: 'figcaption',
				},
			},
		},
		ids: {
			type: 'array',
			default: [],
		},
		columns: {
			type: 'number',
		},
		imageCrop: {
			type: 'boolean',
			default: true,
		},
		linkTo: {
			type: 'string',
			default: 'none',
		},
	},
	supports: {
		align: true,
	},
	save( { attributes } ) {
		const {
			images,
			columns = defaultColumnsNumberV1( attributes ),
			imageCrop,
			linkTo,
		} = attributes;
		return (
			<ul
				className={ `columns-${ columns } ${
					imageCrop ? 'is-cropped' : ''
				}` }
			>
				{ images.map( ( image ) => {
					let href;

					switch ( linkTo ) {
						case 'media':
							href = image.fullUrl || image.url;
							break;
						case 'attachment':
							href = image.link;
							break;
					}

					const img = (
						<img
							src={ image.url }
							alt={ image.alt }
							data-id={ image.id }
							data-full-url={ image.fullUrl }
							data-link={ image.link }
							className={
								image.id ? `wp-image-${ image.id }` : null
							}
						/>
					);

					return (
						<li
							key={ image.id || image.url }
							className="blocks-gallery-item"
						>
							<figure>
								{ href ? <a href={ href }>{ img }</a> : img }
								{ image.caption && image.caption.length > 0 && (
									<RichText.Content
										tagName="figcaption"
										value={ image.caption }
									/>
								) }
							</figure>
						</li>
					);
				} ) }
			</ul>
		);
	},
	isEligible( { imageCount } ) {
		return ! imageCount;
	},
	migrate( { images, imageCrop, linkTo, sizeSlug, columns, caption } ) {
		const imageBlocks = images.map( ( image ) => {
			return createBlock( 'core/image', {
				id: parseInt( image.id ),
				url: image.url,
				alt: image.alt,
				caption: image.caption,
				sizeSlug,
				...getHrefAndDestination( image, linkTo ),
			} );
		} );

		return [
			{
				caption,
				columns,
				imageCrop,
				linkTo,
				sizeSlug,
				imageCount: imageBlocks.length,
				allowResize: false,
				isGrouped: true,
			},
			imageBlocks,
		];
	},
};

const v4 = {
	attributes: {
		images: {
			type: 'array',
			default: [],
			source: 'query',
			selector: '.blocks-gallery-item',
			query: {
				url: {
					source: 'attribute',
					selector: 'img',
					attribute: 'src',
				},
				fullUrl: {
					source: 'attribute',
					selector: 'img',
					attribute: 'data-full-url',
				},
				link: {
					source: 'attribute',
					selector: 'img',
					attribute: 'data-link',
				},
				alt: {
					source: 'attribute',
					selector: 'img',
					attribute: 'alt',
					default: '',
				},
				id: {
					source: 'attribute',
					selector: 'img',
					attribute: 'data-id',
				},
				caption: {
					type: 'string',
					source: 'html',
					selector: '.blocks-gallery-item__caption',
				},
			},
		},
		ids: {
			type: 'array',
			default: [],
		},
		columns: {
			type: 'number',
		},
		caption: {
			type: 'string',
			source: 'html',
			selector: '.blocks-gallery-caption',
		},
		imageCrop: {
			type: 'boolean',
			default: true,
		},
		linkTo: {
			type: 'string',
			default: 'none',
		},
	},
	supports: {
		align: true,
	},
	isEligible( { ids } ) {
		return ids && ids.some( ( id ) => typeof id === 'string' );
	},
	migrate( { images, imageCrop, linkTo, sizeSlug, columns, caption } ) {
		const imageBlocks = images.map( ( image ) => {
			return createBlock( 'core/image', {
				id: parseInt( image.id ),
				url: image.url,
				alt: image.alt,
				caption: image.caption,
				sizeSlug,
				...getHrefAndDestination( image, linkTo ),
			} );
		} );

		return [
			{
				caption,
				columns,
				imageCrop,
				linkTo,
				sizeSlug,
				imageCount: imageBlocks.length,
				allowResize: false,
				isGrouped: true,
			},
			imageBlocks,
		];
	},
	save( { attributes } ) {
		const {
			images,
			columns = defaultColumnsNumberV1( attributes ),
			imageCrop,
			caption,
			linkTo,
		} = attributes;

		return (
			<figure
				className={ `columns-${ columns } ${
					imageCrop ? 'is-cropped' : ''
				}` }
			>
				<ul className="blocks-gallery-grid">
					{ images.map( ( image ) => {
						let href;

						switch ( linkTo ) {
							case 'media':
								href = image.fullUrl || image.url;
								break;
							case 'attachment':
								href = image.link;
								break;
						}

						const img = (
							<img
								src={ image.url }
								alt={ image.alt }
								data-id={ image.id }
								data-full-url={ image.fullUrl }
								data-link={ image.link }
								className={
									image.id ? `wp-image-${ image.id }` : null
								}
							/>
						);

						return (
							<li
								key={ image.id || image.url }
								className="blocks-gallery-item"
							>
								<figure>
									{ href ? (
										<a href={ href }>{ img }</a>
									) : (
										img
									) }
									{ ! RichText.isEmpty( image.caption ) && (
										<RichText.Content
											tagName="figcaption"
											className="blocks-gallery-item__caption"
											value={ image.caption }
										/>
									) }
								</figure>
							</li>
						);
					} ) }
				</ul>
				{ ! RichText.isEmpty( caption ) && (
					<RichText.Content
						tagName="figcaption"
						className="blocks-gallery-caption"
						value={ caption }
					/>
				) }
			</figure>
		);
	},
};

const v5 = {
	attributes: {
		images: {
			type: 'array',
			default: [],
			source: 'query',
			selector: '.blocks-gallery-item',
			query: {
				url: {
					type: 'string',
					source: 'attribute',
					selector: 'img',
					attribute: 'src',
				},
				fullUrl: {
					type: 'string',
					source: 'attribute',
					selector: 'img',
					attribute: 'data-full-url',
				},
				link: {
					type: 'string',
					source: 'attribute',
					selector: 'img',
					attribute: 'data-link',
				},
				alt: {
					type: 'string',
					source: 'attribute',
					selector: 'img',
					attribute: 'alt',
					default: '',
				},
				id: {
					type: 'string',
					source: 'attribute',
					selector: 'img',
					attribute: 'data-id',
				},
				caption: {
					type: 'string',
					source: 'html',
					selector: '.blocks-gallery-item__caption',
				},
			},
		},
		ids: {
			type: 'array',
			items: {
				type: 'number',
			},
			default: [],
		},
		columns: {
			type: 'number',
			minimum: 1,
			maximum: 8,
		},
		caption: {
			type: 'string',
			source: 'html',
			selector: '.blocks-gallery-caption',
		},
		imageCrop: {
			type: 'boolean',
			default: true,
		},
		linkTo: {
			type: 'string',
			default: 'none',
		},
		sizeSlug: {
			type: 'string',
			default: 'large',
		},
	},
	supports: {
		align: true,
	},
	isEligible( { linkTo, imageCount } ) {
		return (
			! imageCount &&
			( ! linkTo || linkTo === 'attachment' || linkTo === 'media' )
		);
	},
	migrate( attributes ) {
		let linkTo = attributes.linkTo;
		if ( ! attributes.linkTo ) {
			linkTo = 'none';
		}
		const imageBlocks = attributes.images.map( ( image ) => {
			return createBlock( 'core/image', {
				id: parseInt( image.id ),
				url: image.url,
				alt: image.alt,
				caption: image.caption,
				sizeSlug: attributes.sizeSlug,
				...getHrefAndDestination( image, linkTo ),
			} );
		} );
		return [
			{
				caption: attributes.caption,
				columns: attributes.columns,
				imageCrop: attributes.imageCrop,
				linkTo,
				sizeSlug: attributes.sizeSlug,
				imageCount: imageBlocks.length,
				allowResize: false,
				isGrouped: true,
			},
			imageBlocks,
		];
	},
	save( { attributes } ) {
		const {
			images,
			columns = defaultColumnsNumberV1( attributes ),
			imageCrop,
			caption,
			linkTo,
		} = attributes;

		return (
			<figure
				className={ `columns-${ columns } ${
					imageCrop ? 'is-cropped' : ''
				}` }
			>
				<ul className="blocks-gallery-grid">
					{ images.map( ( image ) => {
						let href;

						switch ( linkTo ) {
							case 'media':
								href = image.fullUrl || image.url;
								break;
							case 'attachment':
								href = image.link;
								break;
						}

						const img = (
							<img
								src={ image.url }
								alt={ image.alt }
								data-id={ image.id }
								data-full-url={ image.fullUrl }
								data-link={ image.link }
								className={
									image.id ? `wp-image-${ image.id }` : null
								}
							/>
						);

						return (
							<li
								key={ image.id || image.url }
								className="blocks-gallery-item"
							>
								<figure>
									{ href ? (
										<a href={ href }>{ img }</a>
									) : (
										img
									) }
									{ ! RichText.isEmpty( image.caption ) && (
										<RichText.Content
											tagName="figcaption"
											className="blocks-gallery-item__caption"
											value={ image.caption }
										/>
									) }
								</figure>
							</li>
						);
					} ) }
				</ul>
				{ ! RichText.isEmpty( caption ) && (
					<RichText.Content
						tagName="figcaption"
						className="blocks-gallery-caption"
						value={ caption }
					/>
				) }
			</figure>
		);
	},
};

const v6 = {
	attributes: {
		images: {
			type: 'array',
			default: [],
			source: 'query',
			selector: '.blocks-gallery-item',
			query: {
				url: {
					type: 'string',
					source: 'attribute',
					selector: 'img',
					attribute: 'src',
				},
				fullUrl: {
					type: 'string',
					source: 'attribute',
					selector: 'img',
					attribute: 'data-full-url',
				},
				link: {
					type: 'string',
					source: 'attribute',
					selector: 'img',
					attribute: 'data-link',
				},
				alt: {
					type: 'string',
					source: 'attribute',
					selector: 'img',
					attribute: 'alt',
					default: '',
				},
				id: {
					type: 'string',
					source: 'attribute',
					selector: 'img',
					attribute: 'data-id',
				},
				caption: {
					type: 'string',
					source: 'html',
					selector: '.blocks-gallery-item__caption',
				},
			},
		},
		ids: {
			type: 'array',
			items: {
				type: 'number',
			},
			default: [],
		},
		columns: {
			type: 'number',
			minimum: 1,
			maximum: 8,
		},
		caption: {
			type: 'string',
			source: 'html',
			selector: '.blocks-gallery-caption',
		},
		imageCrop: {
			type: 'boolean',
			default: true,
		},
		linkTo: {
			type: 'string',
		},
		sizeSlug: {
			type: 'string',
			default: 'large',
		},
	},
	supports: {
		anchor: true,
		align: true,
	},
	save( { attributes } ) {
		const {
			images,
			columns = defaultColumnsNumberV1( attributes ),
			imageCrop,
			caption,
			linkTo,
		} = attributes;
		const className = `columns-${ columns } ${
			imageCrop ? 'is-cropped' : ''
		}`;

		return (
			<figure { ...useBlockProps.save( { className } ) }>
				<ul className="blocks-gallery-grid">
					{ images.map( ( image ) => {
						let href;

						switch ( linkTo ) {
							case DEPRECATED_LINK_DESTINATION_MEDIA:
								href = image.fullUrl || image.url;
								break;
							case DEPRECATED_LINK_DESTINATION_ATTACHMENT:
								href = image.link;
								break;
						}

						const img = (
							<img
								src={ image.url }
								alt={ image.alt }
								data-id={ image.id }
								data-full-url={ image.fullUrl }
								data-link={ image.link }
								className={
									image.id ? `wp-image-${ image.id }` : null
								}
							/>
						);

						return (
							<li
								key={ image.id || image.url }
								className="blocks-gallery-item"
							>
								<figure>
									{ href ? (
										<a href={ href }>{ img }</a>
									) : (
										img
									) }
									{ ! RichText.isEmpty( image.caption ) && (
										<RichText.Content
											tagName="figcaption"
											className="blocks-gallery-item__caption"
											value={ image.caption }
										/>
									) }
								</figure>
							</li>
						);
					} ) }
				</ul>
				{ ! RichText.isEmpty( caption ) && (
					<RichText.Content
						tagName="figcaption"
						className="blocks-gallery-caption"
						value={ caption }
					/>
				) }
			</figure>
		);
	},
	isEligible( { imageCount } ) {
		return ! imageCount;
	},
	migrate( { images, imageCrop, linkTo, sizeSlug, columns, caption } ) {
		if ( linkTo === 'post' ) {
			linkTo = 'attachment';
		} else if ( linkTo === 'file' ) {
			linkTo = 'media';
		}
		const imageBlocks = images.map( ( image ) => {
			return createBlock( 'core/image', {
				id: parseInt( image.id ),
				url: image.url,
				alt: image.alt,
				caption: image.caption,
				sizeSlug,
				...getHrefAndDestination( image, linkTo ),
			} );
		} );
		return [
			{
				caption,
				columns,
				imageCrop,
				linkTo,
				sizeSlug,
				imageCount: imageBlocks.length,
				allowResize: false,
				isGrouped: true,
			},
			imageBlocks,
		];
	},
};

export default [ v6, v5, v4, v3, v2, v1 ];