import { Elysia } from 'elysia';
import { prisma } from '../lib/prisma';
import {
	CategoryBodySchema,
	CategoryEditSchema,
	CategoryParamsSchema,
	CategoryProductQuerySchema,
	CategoryQuerySchema,
} from '../lib/validation';
import { NotFoundError } from '../lib/error';

const categoryRoute = new Elysia({ prefix: '/categories' })
	.get(
		'/',
		async ({ query: { skip, limit } }) => {
			const categories = await prisma.categories.findMany({
				skip: skip ?? 0,
				take: limit ?? 10,
			});
			return { data: categories };
		},
		{ query: CategoryQuerySchema },
	)
	.get(
		'/:id',
		async ({ params: { id } }) => {
			const category = await prisma.categories.findUnique({ where: { id } });
			if (!category) {
				throw new NotFoundError('Category not found');
			}
			return { data: category };
		},
		{ params: CategoryParamsSchema },
	)
	.post(
		'/',
		async ({ body, set }) => {
			const category = await prisma.categories.create({
				data: body,
			});
			set.status = 201;
			return { data: category };
		},
		{ body: CategoryBodySchema },
	)
	.put(
		'/:id',
		async ({ params: { id }, body }) => {
			const category = await prisma.categories.update({
				where: { id },
				data: body,
			});
			return { data: category };
		},
		{
			params: CategoryParamsSchema,
			body: CategoryEditSchema,
		},
	)
	.delete(
		'/:id',
		async ({ params: { id }, set }) => {
			await prisma.categories.delete({ where: { id } });
			set.status = 204;
		},
		{ params: CategoryParamsSchema },
	)
	.get(
		'/:id/products',
		async ({ params: { id }, query: { skip, limit, sortBy, sortOrder } }) => {
			const category = await prisma.categories.findUnique({ where: { id } });
			if (!category) {
				throw new NotFoundError('Category not found');
			}

			const products = await prisma.products.findMany({
				where: { category_id: id },
				skip: skip ?? 0,
				take: limit ?? 10,
				orderBy: sortBy ? { [sortBy]: sortOrder ?? 'asc' } : undefined,
			});

			return { data: products };
		},
		{
			params: CategoryParamsSchema,
			query: CategoryProductQuerySchema,
		},
	);

export default categoryRoute;
