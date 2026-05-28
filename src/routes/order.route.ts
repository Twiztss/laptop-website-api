import { Elysia } from 'elysia';
import { prisma } from '../lib/prisma';
import { isAuthenticated, isAdmin } from '../lib/auth';
import { NotFoundError, BadRequestError } from '../lib/error';
import { OrderParamsSchema, OrderUpdateSchema } from '../lib/validation';
import { OrderStatus } from '../lib/constants';
import { Prisma } from '../generated/prisma/client';

const orderRoute = new Elysia({ prefix: '/orders' })
	.use(isAuthenticated)
	.group('/my', (app) =>
		app
			.get('/', async ({ user }) => {
				const orders = await prisma.orders.findMany({
					where: { user_id: user!.id },
					include: {
						order_items: {
							include: { products: true },
						},
					},
					orderBy: { created_at: 'desc' },
				});

				return {
					data: orders,
				};
			})
			.get(
				'/:id',
				async ({ params: { id }, user }) => {
					const order = await prisma.orders.findFirst({
						where: { id, user_id: user!.id },
						include: {
							order_items: {
								include: { products: true },
							},
						},
					});

					if (!order) {
						throw new NotFoundError('Order not found');
					}

					return {
						data: order,
					};
				},
				{
					params: OrderParamsSchema,
				}
			)
			.post('/', async ({ user, set }) => {
				const cart = await prisma.carts.findUnique({
					where: { user_id: user!.id },
					include: {
						cart_items: {
							include: { products: true },
						},
					},
				});

				if (!cart || cart.cart_items.length === 0) {
					throw new BadRequestError('Cart is empty');
				}

				const order = await prisma.$transaction(async (tx) => {
					let total = new Prisma.Decimal(0);
					const orderItemsData = [];

					for (const item of cart.cart_items) {
						if (!item.products) {
							throw new BadRequestError(`Product in cart no longer exists`);
						}

						// Re-fetch product within transaction to ensure up-to-date stock and price
						const product = await tx.products.findUnique({
							where: { id: item.product_id! },
						});

						if (!product) {
							throw new BadRequestError(`Product ${item.products.name} no longer exists`);
						}

						if (item.quantity > product.stock) {
							throw new BadRequestError(`Product ${product.name} has insufficient stock`);
						}

						total = total.add(product.price.mul(item.quantity));
						
						orderItemsData.push({
							product_id: item.product_id,
							quantity: item.quantity,
							price_at_purchase: product.price,
						});

						// Decrement stock
						await tx.products.update({
							where: { id: item.product_id! },
							data: {
								stock: {
									decrement: item.quantity,
								},
							},
						});
					}

					// 1. Create order
					const newOrder = await tx.orders.create({
						data: {
							user_id: user!.id,
							total,
							status: OrderStatus.PENDING,
							order_items: {
								create: orderItemsData,
							},
						},
					});

					// 3. Clear cart
					await tx.cart_items.deleteMany({
						where: { cart_id: cart.id },
					});

					return newOrder;
				});

				set.status = 201;
				return {
					data: order,
				};
			})
			.put(
				'/:id/cancel',
				async ({ params: { id }, user }) => {
					const order = await prisma.orders.findFirst({
						where: { id, user_id: user!.id },
						include: { order_items: true },
					});

					if (!order) {
						throw new NotFoundError('Order not found');
					}

					if (order.status !== OrderStatus.PENDING) {
						throw new BadRequestError('Only pending orders can be cancelled');
					}

					const updatedOrder = await prisma.$transaction(async (tx) => {
						// 1. Update status
						const updated = await tx.orders.update({
							where: { id: order.id },
							data: { status: OrderStatus.CANCELLED },
						});

						// 2. Restore stock
						for (const item of order.order_items) {
							if (!item.product_id) continue;
							
							// Check if product still exists before restoring stock
							const product = await tx.products.findUnique({
								where: { id: item.product_id },
							});

							if (product) {
								await tx.products.update({
									where: { id: item.product_id },
									data: {
										stock: {
											increment: item.quantity,
										},
									},
								});
							}
						}

						return updated;
					});

					return {
						data: updatedOrder,
					};
				},
				{
					params: OrderParamsSchema,
				}
			)
	)
	.use(isAdmin)
	.get('/', async () => {
		const orders = await prisma.orders.findMany({
			include: {
				users: {
					select: { id: true, name: true, email: true },
				},
			},
			orderBy: { created_at: 'desc' },
		});

		return {
			data: orders,
		};
	})
	.get(
		'/:id',
		async ({ params: { id } }) => {
			const order = await prisma.orders.findUnique({
				where: { id },
				include: {
					order_items: {
						include: { products: true },
					},
					users: {
						select: { id: true, name: true, email: true },
					},
				},
			});

			if (!order) {
				throw new NotFoundError('Order not found');
			}

			return {
				data: order,
			};
		},
		{
			params: OrderParamsSchema,
		}
	)
	.put(
		'/:id',
		async ({ params: { id }, body }) => {
			const order = await prisma.orders.findUnique({
				where: { id },
			});

			if (!order) {
				throw new NotFoundError('Order not found');
			}

			const updatedOrder = await prisma.orders.update({
				where: { id },
				data: { status: body.status },
			});

			return {
				data: updatedOrder,
			};
		},
		{
			params: OrderParamsSchema,
			body: OrderUpdateSchema,
		}
	)
	.delete(
		'/:id',
		async ({ params: { id }, set }) => {
			try {
				await prisma.orders.delete({
					where: { id },
				});
				set.status = 204;
			} catch (e) {
				throw new NotFoundError('Order not found');
			}
		},
		{
			params: OrderParamsSchema,
		}
	);

export default orderRoute;
