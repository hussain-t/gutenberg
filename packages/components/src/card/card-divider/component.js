/**
 * Internal dependencies
 */
import { contextConnect } from '../../ui/context';
import { Divider } from '../../divider';
import { useCardDivider } from './hook';

/**
 * @param {import('../../ui/context').PolymorphicComponentProps<import('../../divider').DividerProps, 'hr'>} props
 * @param {import('react').Ref<any>} forwardedRef
 */
function CardDivider( props, forwardedRef ) {
	const dividerProps = useCardDivider( props );

	return <Divider { ...dividerProps } ref={ forwardedRef } />;
}

/**
 * CardDivider renders an optional divider within a `<Card />`.
 * It is typically used to divide `<CardBody />`'s from each other.
 *
 * @example
 * ```jsx
 * import { Card, CardBody, CardDivider } from `@wordpress/components`;
 *
 * <Card>
 *  <CardBody>...</CardBody>
 *  <CardDivider />
 *  <CardBody>...</CardBody>
 * </Card>
 * ```
 */
const ConnectedCardDivider = contextConnect( CardDivider, 'CardDivider' );

export default ConnectedCardDivider;