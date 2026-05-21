import { Elysia, t } from 'elysia';
import { prisma } from '../lib/prisma';
import { isAuthenticated, isAdmin } from '../lib/auth';
import { NotFoundError, BadRequestError } from '../lib/error';
import {
	CartItemBodySchema,
	CartItemUpdateSchema,
	CartParamsSchema,
	CartItemParamsSchema,
    BulkCartItemUpdateSchema,
} from '../lib/validation';

const cartRoute = new Elysia({ prefix: '/carts' })
	.use(isAuthenticated)
	.group('/my', (app) =>
		app
			.get('/', async ({ user }) => {
				const cart = await prisma.carts.upsert({
					where: { user_id: user!.id },
					update: {},
					create: { user_id: user!.id },
					include: {
						cart_items: {
							include: { products: true },
						},
					},
				});

				const total_items = cart.cart_items.reduce((sum, item) => sum + item.quantity, 0);
				const total_price = cart.cart_items.reduce(
					(sum, item) => sum + item.quantity * Number(item.products?.price || 0),
					0
				);

				return {
					data: {
						...cart,
						total_items,
						total_price,
					},
				};
			})
			.post(
				'/items',
				async ({ body, user, set }) => {
					let cart = await prisma.carts.findUnique({
						where: { user_id: user!.id },
					});

					if (!cart) {
						cart = await prisma.carts.create({
							data: { user_id: user!.id },
						});
					}

					const product = await prisma.products.findUnique({
						where: { id: body.product_id },
					});

					if (!product) {
						throw new NotFoundError('Product not found');
					}

					const existingItem = await prisma.cart_items.findUnique({
						where: {
							cart_id_product_id: {
								cart_id: cart.id,
								product_id: body.product_id,
							},
						},
					});

					let newQuantity = existingItem
						? existingItem.quantity + body.quantity
						: body.quantity;

					let warning: string | undefined;
					if (newQuantity > product.stock) {
						newQuantity = product.stock;
						warning = `Quantity capped at available stock (${product.stock})`;
					}

					if (newQuantity === 0) {
						throw new BadRequestError('Product is currently out of stock');
					}

					let cartItem;
					if (existingItem) {
						cartItem = await prisma.cart_items.update({
							where: { id: existingItem.id },
							data: { quantity: newQuantity },
						});
					} else {
						cartItem = await prisma.cart_items.create({
							data: {
								cart_id: cart.id,
								product_id: body.product_id,
								quantity: newQuantity,
							},
						});
					}

					set.status = 201;
					return {
						data: cartItem,
						warning,
					};
				},
				{
					body: CartItemBodySchema,
				}
			)
			.put(
				'/items',
				async ({ body, user }) => {
					const cart = await prisma.carts.findUnique({
						where: { user_id: user!.id },
					});

					if (!cart) {
						throw new NotFoundError('Cart not found');
					}

					const itemIds = body.items.map((i) => i.itemId);
					const existingItems = await prisma.cart_items.findMany({
						where: { id: { in: itemIds }, cart_id: cart.id },
						include: { products: true },
					});

					const existingItemsMap = new Map(existingItems.map((i) => [i.id, i]));
					
					const updatePromises = [];
					const warnings: string[] = [];

					for (const itemUpdate of body.items) {
						const cartItem = existingItemsMap.get(itemUpdate.itemId);

						if (!cartItem) {
							continue; // Skip items that don't exist or belong to someone else
						}

						let newQuantity = itemUpdate.quantity;
						if (cartItem.products && newQuantity > cartItem.products.stock) {
							newQuantity = cartItem.products.stock;
							warnings.push(
								`Item ${cartItem.products.name} capped at available stock (${cartItem.products.stock})`
							);
						}

						if (newQuantity === 0) {
							warnings.push(`Item ${cartItem.products?.name} is out of stock and was removed`);
							updatePromises.push(
								prisma.cart_items.delete({ where: { id: cartItem.id } })
							);
						} else {
							updatePromises.push(
								prisma.cart_items.update({
									where: { id: cartItem.id },
									data: { quantity: newQuantity },
								})
							);
						}
					}

					const updatedItems = await prisma.$transaction(updatePromises);

					return {
						data: updatedItems,
						warning: warnings.length > 0 ? warnings.join('. ') : undefined,
					};
				},
				{
					body: BulkCartItemUpdateSchema,
				}
			)
			.delete('/items', async ({ user, set }) => {
				const cart = await prisma.carts.findUnique({
					where: { user_id: user!.id },
				});

				if (!cart) {
					throw new NotFoundError('Cart not found');
				}

				await prisma.cart_items.deleteMany({
					where: { cart_id: cart.id },
				});

				set.status = 204;
			})
			.put(
				'/items/:itemId',
				async ({ params: { itemId }, body, user }) => {
					const cart = await prisma.carts.findUnique({
						where: { user_id: user!.id },
					});

					if (!cart) {
						throw new NotFoundError('Cart not found');
					}

					const cartItem = await prisma.cart_items.findUnique({
						where: { id: itemId },
						include: { products: true },
					});

					if (!cartItem || cartItem.cart_id !== cart.id) {
						throw new NotFoundError('Cart item not found');
					}

					let newQuantity = body.quantity;
					let warning: string | undefined;

					if (cartItem.products && newQuantity > cartItem.products.stock) {
						newQuantity = cartItem.products.stock;
						warning = `Quantity capped at available stock (${cartItem.products.stock})`;
					}

					const updatedItem = await prisma.cart_items.update({
						where: { id: itemId },
						data: { quantity: newQuantity },
					});

					return {
						data: updatedItem,
						warning,
					};
				},
				{
					params: CartItemParamsSchema,
					body: CartItemUpdateSchema,
				}
			)
			.delete(
				'/items/:itemId',
				async ({ params: { itemId }, user, set }) => {
					const cart = await prisma.carts.findUnique({
						where: { user_id: user!.id },
					});

					if (!cart) {
						throw new NotFoundError('Cart not found');
					}

					const cartItem = await prisma.cart_items.findUnique({
						where: { id: itemId },
					});

					if (!cartItem || cartItem.cart_id !== cart.id) {
						throw new NotFoundError('Cart item not found');
					}

					await prisma.cart_items.delete({
						where: { id: itemId },
					});

					set.status = 204;
				},
				{
					params: CartItemParamsSchema,
				}
			)
	)
	.use(isAdmin)
	.get('/', async () => {
		const carts = await prisma.carts.findMany({
			include: { users: true },
		});

		return {
			data: carts,
		};
	})
	.get(
		'/:id',
		async ({ params: { id } }) => {
			const cart = await prisma.carts.findUnique({
				where: { id },
				include: {
					cart_items: {
						include: { products: true },
					},
					users: true,
				},
			});

			if (!cart) {
				throw new NotFoundError('Cart not found');
			}

			const total_items = cart.cart_items.reduce((sum, item) => sum + item.quantity, 0);
			const total_price = cart.cart_items.reduce(
				(sum, item) => sum + item.quantity * Number(item.products?.price || 0),
				0
			);

			return {
				data: {
					...cart,
					total_items,
					total_price,
				},
			};
		},
		{
			params: CartParamsSchema,
		}
	)
	.delete(
		'/:id',
		async ({ params: { id }, set }) => {
			try {
				await prisma.carts.delete({
					where: { id },
				});
				set.status = 204;
			} catch (e) {
				throw new NotFoundError('Cart not found');
			}
		},
		{
			params: CartParamsSchema,
		}
	);

export default cartRoute;
