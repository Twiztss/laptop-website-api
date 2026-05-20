import Elysia from 'elysia';
import { prisma } from '../lib/prisma';
import { BadRequestError, NotFoundError } from '../lib/error';
import { UserBodySchema, UserEditSchema, UserParamsSchema, UserQuerySchema } from '../lib/validation';

const userSelect = {
	id: true,
	name: true,
	email: true,
	role: true,
	created_at: true,
};

const userRoute = new Elysia({ prefix: '/users' })
	.get(
		'/',
		async ({ query: { skip, limit } }) => {
			const users = await prisma.users.findMany({
				skip: skip ?? 0,
				take: limit ?? 10,
				select: userSelect,
			});
			return { data: users };
		},
		{ query: UserQuerySchema },
	)
	.get(
		'/:id',
		async ({ params: { id } }) => {
			const user = await prisma.users.findUnique({
				where: { id },
				select: userSelect,
			});
			if (!user) {
				throw new NotFoundError('User not found');
			}
			return { data: user };
		},
		{ params: UserParamsSchema },
	)
	.post(
		'/',
		async ({ body, set }) => {
			const hashedPassword = await Bun.password.hash(body.password);
			const user = await prisma.users.create({
				data: {
					...body,
					password: hashedPassword,
				},
				select: userSelect,
			});

			set.status = 201;
			return { data: user };
		},
		{ body: UserBodySchema },
	)
	.put(
		'/:id',
		async ({ params: { id }, body }) => {
			const updateData = { ...body };
			if (updateData.password) {
				updateData.password = await Bun.password.hash(updateData.password);
			}

			const user = await prisma.users.update({
				where: { id },
				data: updateData,
				select: userSelect,
			});
			return { data: user };
		},
		{
			params: UserParamsSchema,
			body: UserEditSchema,
		},
	)
	.delete(
		'/:id',
		async ({ params: { id }, set }) => {
			await prisma.users.delete({ where: { id } });
			set.status = 204;
		},
		{ params: UserParamsSchema },
	);

export default userRoute;
