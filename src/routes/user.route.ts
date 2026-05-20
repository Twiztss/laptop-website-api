import { Elysia } from 'elysia';
import { prisma } from '../lib/prisma';
import { BadRequestError, NotFoundError, UnauthorizedError } from '../lib/error';
import { UserBodySchema, UserEditSchema, UserParamsSchema, UserQuerySchema } from '../lib/validation';
import { authPlugin, isAdmin, isAuthenticated } from '../lib/auth';
import { LogAction, recordLog } from '../lib/logger';

const userSelect = {
	id: true,
	name: true,
	email: true,
	role: true,
	created_at: true,
};

const userRoute = new Elysia({ prefix: '/users' })
	.group('', (app) =>
		app
			.use(isAuthenticated)
			.get(
				'/:id',
				async ({ params: { id }, user }) => {
					const currentUser = user!;
					// isOwner or Admin check
					if (currentUser.id !== id && currentUser.role !== 'admin') {
						throw new UnauthorizedError('You do not have permission to perform this action');
					}

					const userData = await prisma.users.findUnique({
						where: { id },
						select: userSelect,
					});
					if (!userData) {
						throw new NotFoundError('User not found');
					}
					return { data: userData };
				},
				{
					params: UserParamsSchema,
				},
			)
			.put(
				'/:id',
				async ({ params: { id }, body, user, request, headers }) => {
					const currentUser = user!;
					// isOwner or Admin check
					if (currentUser.id !== id && currentUser.role !== 'admin') {
						throw new UnauthorizedError('You do not have permission to perform this action');
					}

					const { role, password, ...rest } = body;
					const updateData: Record<string, any> = { ...rest };

					if (password) {
						updateData.password = await Bun.password.hash(password);
					}

					if (currentUser.role === 'admin' && role) {
						updateData.role = role;
					}

					const updatedUser = await prisma.users.update({
						where: { id },
						data: updateData,
						select: userSelect,
					});

					await recordLog({
						userId: currentUser.id,
						action: LogAction.USER_UPDATE,
						request,
						headers,
					});

					return { data: updatedUser };
				},
				{
					params: UserParamsSchema,
					body: UserEditSchema,
				},
			)
			.delete(
				'/:id',
				async ({ params: { id }, set, user, request, headers }) => {
					const currentUser = user!;
					// isOwner or Admin check
					if (currentUser.id !== id && currentUser.role !== 'admin') {
						throw new UnauthorizedError('You do not have permission to perform this action');
					}

					await prisma.users.delete({ where: { id } });

					await recordLog({
						userId: currentUser.id,
						action: LogAction.USER_DELETE,
						request,
						headers,
					});

					set.status = 204;
				},
				{
					params: UserParamsSchema,
				},
			),
	)
	.group('', (app) =>
		app
			.use(isAdmin)
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
				{
					query: UserQuerySchema,
				},
			)
			.post(
				'/',
				async ({ body, set, user, request, headers }) => {
					const currentUser = user!;
					const hashedPassword = await Bun.password.hash(body.password);
					const createdUser = await prisma.users.create({
						data: {
							...body,
							password: hashedPassword,
						},
						select: userSelect,
					});

					await recordLog({
						userId: currentUser.id,
						action: LogAction.USER_UPDATE,
						request,
						headers,
					});

					set.status = 201;
					return { data: createdUser };
				},
				{
					body: UserBodySchema,
				},
			),
	);

export default userRoute;
