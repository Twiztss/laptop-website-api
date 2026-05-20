import { Elysia } from 'elysia';
import { prisma } from '../lib/prisma';
import { BadRequestError, UnauthorizedError } from '../lib/error';
import { UserBodySchema, LoginSchema } from '../lib/validation';
import { signToken } from '../lib/jwt';
import { LogAction, recordLog } from '../lib/logger';

const COOKIE_OPTIONS = {
	httpOnly: true,
	secure: process.env.NODE_ENV === 'production',
	sameSite: 'strict' as const,
	path: '/',
	maxAge: 7 * 24 * 60 * 60, // 7 days
};

const authRoute = new Elysia({ prefix: '/auth' })
	.post(
		'/register',
		async ({ body, set, cookie: { auth_token }, request, headers }) => {
			const { role, password, ...userData } = body;
			const hashedPassword = await Bun.password.hash(password);

			const user = await prisma.users.create({
				data: {
					...userData,
					password: hashedPassword,
					role: 'customer', // Strictly enforce customer role on registration
				},
			});

			const token = await signToken({ userId: user.id });

			auth_token.set({
				...COOKIE_OPTIONS,
				value: token,
			});

			await recordLog({
				userId: user.id,
				action: LogAction.AUTH_REGISTER,
				request,
				headers,
			});

			set.status = 201;
			return {
				data: {
					id: user.id,
					name: user.name,
					email: user.email,
					role: user.role,
				},
			};
		},
		{ body: UserBodySchema },
	)
	.post(
		'/login',
		async ({ body, cookie: { auth_token }, request, headers }) => {
			const user = await prisma.users.findUnique({
				where: { email: body.email },
			});

			if (!user || !(await Bun.password.verify(body.password, user.password))) {
				throw new UnauthorizedError('Invalid email or password');
			}

			const token = await signToken({ userId: user.id });

			auth_token.set({
				...COOKIE_OPTIONS,
				value: token,
			});

			await recordLog({
				userId: user.id,
				action: LogAction.AUTH_LOGIN,
				request,
				headers,
			});

			return {
				data: {
					id: user.id,
					name: user.name,
					email: user.email,
					role: user.role,
				},
			};
		},
		{ body: LoginSchema },
	)
	.post('/logout', ({ cookie: { auth_token } }) => {
		auth_token.remove();
		return { message: 'Logged out successfully' };
	});

export default authRoute;
