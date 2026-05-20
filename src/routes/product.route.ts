import { Elysia } from 'elysia';
import { prisma } from '../lib/prisma';
import { ProductBodySchema, ProductEditSchema, ProductParamsSchema, ProductQuerySchema } from '../lib/validation';
import { NotFoundError } from '../lib/error';

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
	.put(
		'/:id',
		async ({ params: { id }, body }) => {
			const product = await prisma.products.update({
				where: { id: id },
				data: body,
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
		async ({ params: { id }, set }) => {
			await prisma.products.delete({ where: { id: id } });
			set.status = 204;
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
	.post(
		'/',
		async ({ body, set }) => {
			const product = await prisma.products.create({
				data: body,
			});

			set.status = 201;
			return { data: product };
		},
		{ body: ProductBodySchema },
	);

export default productRoute;
