import { describe, it, expect, beforeAll, afterAll } from 'bun:test';
import app from '..';
import { prisma } from '../lib/prisma';
import { signToken } from '../lib/jwt';

const BASE_URL = 'http://localhost:3000/users';

describe('/users', () => {
	let testUserId: string;
	let authToken: string;
	let createdUserIds: string[] = [];

	beforeAll(async () => {
		// Create a test admin user
		const user = await prisma.users.create({
			data: {
				name: 'Test Admin',
				email: `admin_${Date.now()}@example.com`,
				password: 'password123',
				role: 'admin',
			},
		});
		testUserId = user.id;
		authToken = await signToken({ userId: user.id });
	});

	afterAll(async () => {
		// Clean up test data
		const idsToCleanup = [testUserId, ...createdUserIds].filter((id) => !!id);
		if (idsToCleanup.length > 0) {
			await prisma.users.deleteMany({
				where: {
					id: {
						in: idsToCleanup,
					},
				},
			});
		}
		if (app.server) await app.stop();
	});

	it('GET / should return 200 OK', async () => {
		const res = await app.handle(
			new Request(BASE_URL, {
				headers: { cookie: `auth_token=${authToken}` },
			}),
		);
		const body = (await res.json()) as any;
		expect(res.status).toBe(200);
		expect(body.data.length).toBeGreaterThanOrEqual(1);
		if (body.data.length > 0) {
			expect(body.data[0].password).toBeUndefined();
		}
	});

	it('GET /:id should return 200 OK', async () => {
		const res = await app.handle(
			new Request(`${BASE_URL}/${testUserId}`, {
				headers: { cookie: `auth_token=${authToken}` },
			}),
		);
		expect(res.status).toBe(200);
		const data = (await res.json()) as any;
		expect(data.data.id).toBe(testUserId);
		expect(data.data.password).toBeUndefined();
	});

	it('GET /:id should return 404 NOT FOUND for non-existent ID', async () => {
		const fakeId = '00000000-0000-4000-a000-000000000000';
		const res = await app.handle(
			new Request(`${BASE_URL}/${fakeId}`, {
				headers: { cookie: `auth_token=${authToken}` },
			}),
		);
		expect(res.status).toBe(404);
		const body = (await res.json()) as any;
		expect(body.code).toBe('NOT_FOUND');
	});

	it('POST / should return 201 CREATED and return the user', async () => {
		const userData = {
			name: 'New User',
			email: `new_${Date.now()}@example.com`,
			password: 'password123',
		};
		const res = await app.handle(
			new Request(`${BASE_URL}`, {
				method: 'POST',
				headers: {
					'content-type': 'application/json',
					cookie: `auth_token=${authToken}`,
				},
				body: JSON.stringify(userData),
			}),
		);
		expect(res.status).toBe(201);
		const body = (await res.json()) as any;
		expect(body.data.name).toBe(userData.name);
		expect(body.data.email).toBe(userData.email);
		expect(body.data.id).toBeDefined();
		expect(body.data.password).toBeUndefined();

		// Track for cleanup
		createdUserIds.push(body.data.id);
	});

	it('POST / should return 422 for invalid email', async () => {
		const res = await app.handle(
			new Request(`${BASE_URL}`, {
				method: 'POST',
				headers: {
					'content-type': 'application/json',
					cookie: `auth_token=${authToken}`,
				},
				body: JSON.stringify({
					name: 'Bad User',
					email: 'not-an-email',
					password: 'password123',
				}),
			}),
		);
		expect(res.status).toBe(422);
	});

	it('POST / should return 400 for duplicate email', async () => {
		const userData = {
			name: 'Duplicate User',
			email: 'test@example.com', // Already exists from somewhere or we can use another known one
			password: 'password123',
		};
		// First create it
		await prisma.users.upsert({
			where: { email: userData.email },
			update: {},
			create: userData,
		});

		const res = await app.handle(
			new Request(`${BASE_URL}`, {
				method: 'POST',
				headers: {
					'content-type': 'application/json',
					cookie: `auth_token=${authToken}`,
				},
				body: JSON.stringify(userData),
			}),
		);
		expect(res.status).toBe(409);
		const body = (await res.json()) as any;
		expect(body.code).toBe('CONFLICT');
	});

	it('PUT /:id should update the user', async () => {
		const updateData = { name: 'Updated Name', password: 'newpassword123' };
		const res = await app.handle(
			new Request(`${BASE_URL}/${testUserId}`, {
				method: 'PUT',
				headers: {
					'content-type': 'application/json',
					cookie: `auth_token=${authToken}`,
				},
				body: JSON.stringify(updateData),
			}),
		);
		expect(res.status).toBe(200);
		const body = (await res.json()) as any;
		expect(body.data.name).toBe(updateData.name);
		expect(body.data.password).toBeUndefined();
	});

	it('PUT /:id should not allow non-admin to escalate role', async () => {
		const user = await prisma.users.create({
			data: {
				name: 'Normal User',
				email: `normal_${Date.now()}@example.com`,
				password: 'password123',
				role: 'customer',
			},
		});
		createdUserIds.push(user.id);
		const normalToken = await signToken({ userId: user.id });

		const res = await app.handle(
			new Request(`${BASE_URL}/${user.id}`, {
				method: 'PUT',
				headers: {
					'content-type': 'application/json',
					cookie: `auth_token=${normalToken}`,
				},
				body: JSON.stringify({
					role: 'admin',
				}),
			}),
		);

		expect(res.status).toBe(200);
		const body = (await res.json()) as any;
		expect(body.data.role).not.toBe('admin');
		expect(body.data.role).toBe('customer');

		// Verify in DB
		const userInDb = await prisma.users.findUnique({ where: { id: user.id } });
		expect(userInDb?.role).toBe('customer');
	});

	it('DELETE /:id should remove the user', async () => {
		const user = await prisma.users.create({
			data: {
				name: `To Delete ${Date.now()}`,
				email: `delete_${Date.now()}@example.com`,
				password: 'password123',
			},
		});
		const res = await app.handle(
			new Request(`${BASE_URL}/${user.id}`, {
				method: 'DELETE',
				headers: { cookie: `auth_token=${authToken}` },
			}),
		);
		expect(res.status).toBe(204);

		const check = await prisma.users.findUnique({ where: { id: user.id } });
		expect(check).toBeNull();
	});
});
