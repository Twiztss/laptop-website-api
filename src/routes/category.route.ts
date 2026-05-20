import { Elysia } from 'elysia';
import { prisma } from '../lib/prisma';
import { CategoryBodySchema, CategoryEditSchema, CategoryParamsSchema, CategoryProductQuerySchema, CategoryQuerySchema } from '../lib/validation';
import { NotFoundError } from '../lib/error';
import { authPlugin, isAdmin } from '../lib/auth';
import { LogAction, recordLog } from '../lib/logger';

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
	)
	.group('', (app) =>
		app
			.use(isAdmin)
			.post(
				'/',
				async ({ body, set, user, request, headers }) => {
					const currentUser = user!;
					const category = await prisma.categories.create({
						data: body,
					});

					await recordLog({
						userId: currentUser.id,
						action: LogAction.CATEGORY_CREATE,
						request,
						headers,
					});

					set.status = 201;
					return { data: category };
				},
				{ body: CategoryBodySchema },
			)
			.put(
				'/:id',
				async ({ params: { id }, body, user, request, headers }) => {
					const currentUser = user!;
					const category = await prisma.categories.update({
						where: { id },
						data: body,
					});

					await recordLog({
						userId: currentUser.id,
						action: LogAction.CATEGORY_UPDATE,
						request,
						headers,
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
				async ({ params: { id }, set, user, request, headers }) => {
					const currentUser = user!;
					await prisma.categories.delete({ where: { id } });

					await recordLog({
						userId: currentUser.id,
						action: LogAction.CATEGORY_DELETE,
						request,
						headers,
					});

					set.status = 204;
				},
				{ params: CategoryParamsSchema },
			),
	);

export default categoryRoute;
