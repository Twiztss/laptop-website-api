import { describe, it, expect, beforeAll, afterAll } from 'bun:test';
import app from '..';
import { prisma } from '../lib/prisma';

const BASE_URL = 'http://localhost:3000/users';

describe('/users', () => {
	let testUserId: string;
	let createdUserIds: string[] = [];

	beforeAll(async () => {
		// Create a test user
		const user = await prisma.users.create({
			data: {
				name: 'Test User',
				email: 'test@example.com',
				password: 'password123',
			},
		});
		testUserId = user.id;
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
		const res = await app.handle(new Request(BASE_URL));
		const body = (await res.json()) as any;
		expect(res.status).toBe(200);
		expect(body.data.length).toBeGreaterThanOrEqual(1);
		if (body.data.length > 0) {
			expect(body.data[0].password).toBeUndefined();
		}
	});

	it('GET /:id should return 200 OK', async () => {
		const res = await app.handle(new Request(`${BASE_URL}/${testUserId}`));
		expect(res.status).toBe(200);
		const data = (await res.json()) as any;
		expect(data.data.id).toBe(testUserId);
		expect(data.data.password).toBeUndefined();
	});

	it('GET /:id should return 404 NOT FOUND for non-existent ID', async () => {
		const fakeId = '00000000-0000-4000-a000-000000000000';
		const res = await app.handle(new Request(`${BASE_URL}/${fakeId}`));
		expect(res.status).toBe(404);
		const body = (await res.json()) as any;
		expect(body.code).toBe('NOT_FOUND');
	});

	it('POST / should return 201 CREATED and return the user', async () => {
		const userData = {
			name: 'New User',
			email: 'new@example.com',
			password: 'password123',
		};
		const res = await app.handle(
			new Request(`${BASE_URL}`, {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
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
				headers: { 'content-type': 'application/json' },
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
			email: 'test@example.com', // Already exists from beforeAll
			password: 'password123',
		};
		const res = await app.handle(
			new Request(`${BASE_URL}`, {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify(userData),
			}),
		);
		expect(res.status).toBe(400);
		const body = (await res.json()) as any;
		expect(body.code).toBe('BAD_REQUEST');
	});

	it('PUT /:id should update the user', async () => {
		const updateData = { name: 'Updated Name', password: 'newpassword123' };
		const res = await app.handle(
			new Request(`${BASE_URL}/${testUserId}`, {
				method: 'PUT',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify(updateData),
			}),
		);
		expect(res.status).toBe(200);
		const body = (await res.json()) as any;
		expect(body.data.name).toBe(updateData.name);
		expect(body.data.password).toBeUndefined();
	});

	it('DELETE /:id should remove the user', async () => {
		const user = await prisma.users.create({
			data: { name: 'To Delete', email: 'delete@example.com', password: 'password123' },
		});
		const res = await app.handle(
			new Request(`${BASE_URL}/${user.id}`, {
				method: 'DELETE',
			}),
		);
		expect(res.status).toBe(204);

		const check = await prisma.users.findUnique({ where: { id: user.id } });
		expect(check).toBeNull();
	});
});
