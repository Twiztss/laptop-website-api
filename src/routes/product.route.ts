import { Elysia } from 'elysia';
import { prisma } from '../lib/prisma';
import { ProductBodySchema, ProductEditSchema, ProductParamsSchema, ProductQuerySchema } from '../lib/validation';
import { NotFoundError } from '../lib/error';
import { authPlugin, isAdmin } from '../lib/auth';
import { LogAction, recordLog } from '../lib/logger';

const productRoute = new Elysia({ prefix: '/products' })
	.get(
		'/:id',
		async ({ params: { id } }) => {
			const product = await prisma.products.findUnique({ where: { id: id } });

			if (!product) {
				throw new NotFoundError('Product not found');
			}
			return { data: product };
		},
		{ params: ProductParamsSchema },
	)
	.get(
		'/',
		async ({ query: { skip, limit, name, categoryId, minPrice, maxPrice, sortBy, sortOrder } }) => {
			const products = await prisma.products.findMany({
				where: {
					name: name ? { contains: name, mode: 'insensitive' } : undefined,
					category_id: categoryId,
					price: {
						gte: minPrice,
						lte: maxPrice,
					},
				},
				skip: skip ?? 0,
				take: limit ?? 10,
				orderBy: sortBy ? { [sortBy]: sortOrder ?? 'asc' } : undefined,
			});
			return { data: products };
		},
		{ query: ProductQuerySchema },
	)
	.group('', (app) =>
		app
			.use(isAdmin)
			.post(
				'/',
				async ({ body, set, user, request, headers }) => {
					const currentUser = user!;
					const product = await prisma.products.create({
						data: body,
					});

					await recordLog({
						userId: currentUser.id,
						action: LogAction.PRODUCT_CREATE,
						request,
						headers,
					});

					set.status = 201;
					return { data: product };
				},
				{ body: ProductBodySchema },
			)
			.put(
				'/:id',
				async ({ params: { id }, body, user, request, headers }) => {
					const currentUser = user!;
					const product = await prisma.products.update({
						where: { id: id },
						data: body,
					});

					await recordLog({
						userId: currentUser.id,
						action: LogAction.PRODUCT_UPDATE,
						request,
						headers,
					});

					return { data: product };
				},
				{
					params: ProductParamsSchema,
					body: ProductEditSchema,
				},
			)
			.delete(
				'/:id',
				async ({ params: { id }, set, user, request, headers }) => {
					const currentUser = user!;
					await prisma.products.delete({ where: { id: id } });

					await recordLog({
						userId: currentUser.id,
						action: LogAction.PRODUCT_DELETE,
						request,
						headers,
					});

					set.status = 204;
				},
				{ params: ProductParamsSchema },
			),
	);

export default productRoute;
