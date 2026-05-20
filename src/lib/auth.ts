import { Elysia } from 'elysia';
import { verifyToken } from './jwt';
import { prisma } from './prisma';
import { UnauthorizedError } from './error';
import type { users } from '../generated/prisma/client';

export const authPlugin = new Elysia({ name: 'auth-plugin' })
	.derive(async ({ cookie: { auth_token } }): Promise<{ user: users | null }> => {
		const token = auth_token.value;

		if (!token || typeof token !== 'string') {
			return { user: null };
		}

		const payload = await verifyToken(token);
		if (!payload) {
			return { user: null };
		}

		const user = await prisma.users.findUnique({
			where: { id: payload.userId },
		});

		if (!user) {
			return { user: null };
		}

		return { user };
	})
	.as('global');

export const isAuthenticated = new Elysia({ name: 'is-authenticated' })
	.use(authPlugin)
	.onBeforeHandle(({ user }) => {
		if (!user) {
			throw new UnauthorizedError('Authentication required');
		}
	})
	.as('global');

export const isAdmin = new Elysia({ name: 'is-admin' })
	.use(isAuthenticated)
	.onBeforeHandle(({ user }) => {
		if (!user || user.role !== 'admin') {
			throw new UnauthorizedError('Admin role required');
		}
	})
	.as('global');
