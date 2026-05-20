import { describe, it, expect, beforeAll, afterAll } from 'bun:test';
import app from '..';
import { prisma } from '../lib/prisma';

const AUTH_URL = 'http://localhost:3000/auth';
const USERS_URL = 'http://localhost:3000/users';

describe('Authentication', () => {
	let testUser: any;
	const userCredentials = {
		name: 'Auth Test User',
		email: `auth_test_${Date.now()}@example.com`,
		password: 'password123',
	};

	afterAll(async () => {
		if (testUser) {
			await prisma.users.delete({ where: { id: testUser.id } });
		}
		if (app.server) await app.stop();
	});

	it('POST /auth/register should register a user and set a cookie', async () => {
		const res = await app.handle(
			new Request(`${AUTH_URL}/register`, {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify(userCredentials),
			}),
		);

		expect(res.status).toBe(201);
		const body = (await res.json()) as any;
		expect(body.data.email).toBe(userCredentials.email);
		testUser = body.data;

		const setCookieHeader = res.headers.get('set-cookie');
		expect(setCookieHeader).toContain('auth_token=');
		expect(setCookieHeader).toContain('HttpOnly');
		expect(setCookieHeader).toContain('SameSite=Strict');
	});

	it('POST /auth/register should ignore role escalation and default to customer', async () => {
		// Cleanup if exists
		await prisma.users.deleteMany({ where: { email: 'malicious@test.com' } });

		const res = await app.handle(
			new Request('http://localhost:3000/auth/register', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					name: 'Malicious User',
					email: 'malicious@test.com',
					password: 'password123',
					role: 'admin',
				}),
			}),
		);

		expect(res.status).toBe(201);
		const body = await res.json();
		expect(body.data.role).toBe('customer');

		// Verify in DB
		const userInDb = await prisma.users.findUnique({ where: { email: 'malicious@test.com' } });
		expect(userInDb?.role).toBe('customer');
	});

	it('POST /auth/login should log in a user and set a cookie', async () => {
		const res = await app.handle(
			new Request(`${AUTH_URL}/login`, {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({
					email: userCredentials.email,
					password: userCredentials.password,
				}),
			}),
		);

		expect(res.status).toBe(200);
		const setCookieHeader = res.headers.get('set-cookie');
		expect(setCookieHeader).toContain('auth_token=');

		const body = (await res.json()) as any;
		testUser = body.data;
	});

	it('POST /auth/login should fail with invalid credentials', async () => {
		const res = await app.handle(
			new Request(`${AUTH_URL}/login`, {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({
					email: userCredentials.email,
					password: 'wrongpassword',
				}),
			}),
		);

		expect(res.status).toBe(401);
	});

	it('Protected route should work with valid cookie', async () => {
		// Ensure we have a fresh login and the correct ID
		const loginRes = await app.handle(
			new Request(`${AUTH_URL}/login`, {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({
					email: userCredentials.email,
					password: userCredentials.password,
				}),
			}),
		);

		const setCookieHeader = loginRes.headers.get('set-cookie');
		const cookie = setCookieHeader?.split(';')[0];
		const loginBody = await loginRes.json();
		const currentUserId = loginBody.data.id;

		const res = await app.handle(
			new Request(`${USERS_URL}/${currentUserId}`, {
				headers: {
					cookie: cookie || '',
				},
			}),
		);

		if (res.status !== 200) {
			const error = await res.json();
			console.log('Failing Request Error:', JSON.stringify(error, null, 2));
		}

		expect(res.status).toBe(200);
		const body = (await res.json()) as any;
		expect(body.data.id).toBe(currentUserId);
	});

	it('Protected route should fail without cookie', async () => {
		const res = await app.handle(new Request(`${USERS_URL}/${testUser.id}`));

		expect(res.status).toBe(401);
	});

	it('Protected route should fail for other person user detail (401)', async () => {
		// Create another user
		const otherUser = await prisma.users.create({
			data: {
				name: `Other User ${Date.now()}`,
				email: `other_${Date.now()}@example.com`,
				password: 'password123',
			},
		});

		// Login as testUser
		const loginRes = await app.handle(
			new Request(`${AUTH_URL}/login`, {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({
					email: userCredentials.email,
					password: userCredentials.password,
				}),
			}),
		);
		const setCookieHeader = loginRes.headers.get('set-cookie');
		const cookie = setCookieHeader?.split(';')[0];

		const res = await app.handle(
			new Request(`${USERS_URL}/${otherUser.id}`, {
				headers: {
					cookie: cookie || '',
				},
			}),
		);

		expect(res.status).toBe(401);

		// Cleanup
		await prisma.users.delete({ where: { id: otherUser.id } });
	});
});
