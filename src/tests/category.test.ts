import { describe, it, expect, beforeAll, afterAll } from 'bun:test';
import app from '..';
import { prisma } from '../lib/prisma';
import { signToken } from '../lib/jwt';

const BASE_URL = 'http://localhost:3000/categories';

describe('/categories', () => {
	let testCategoryId: string;
	let authToken: string;
	let testUserId: string;
	let createdCategoryIds: string[] = [];
	let testProductIds: string[] = [];

	beforeAll(async () => {
		// Create a test admin user
		const user = await prisma.users.create({
			data: {
				name: 'Category Admin',
				email: `cat_admin_${Date.now()}@example.com`,
				password: 'password123',
				role: 'admin',
			},
		});
		testUserId = user.id;
		authToken = await signToken({ userId: user.id });

		// Create a test category
		const category = await prisma.categories.create({
			data: {
				name: `Test Category ${Date.now()}`,
				description: 'Test Description',
			},
		});
		testCategoryId = category.id;

		// Create some products for this category to test filtering
		const p1 = await prisma.products.create({
			data: {
				name: 'Product A',
				price: 10,
				stock: 5,
				category_id: testCategoryId,
			},
		});
		const p2 = await prisma.products.create({
			data: {
				name: 'Product B',
				price: 20,
				stock: 10,
				category_id: testCategoryId,
			},
		});
		testProductIds.push(p1.id, p2.id);
	});

	afterAll(async () => {
		// Clean up test products first due to FK
		if (testProductIds.length > 0) {
			await prisma.products.deleteMany({
				where: { id: { in: testProductIds } },
			});
		}

		// Clean up test categories
		const idsToCleanup = [testCategoryId, ...createdCategoryIds].filter((id) => !!id);
		if (idsToCleanup.length > 0) {
			await prisma.categories.deleteMany({
				where: {
					id: {
						in: idsToCleanup,
					},
				},
			});
		}
		if (testUserId) {
			await prisma.users.delete({ where: { id: testUserId } });
		}
		if (app.server) await app.stop();
	});

	it('GET / should return 200 OK', async () => {
		const res = await app.handle(new Request(BASE_URL));
		const body = (await res.json()) as any;
		expect(res.status).toBe(200);
		expect(body.data.length).toBeGreaterThanOrEqual(1);
	});

	it('GET /:id should return 200 OK', async () => {
		const res = await app.handle(new Request(`${BASE_URL}/${testCategoryId}`));
		expect(res.status).toBe(200);
		const data = (await res.json()) as any;
		expect(data.data.id).toBe(testCategoryId);
	});

	it('POST / should return 201 CREATED', async () => {
		const categoryData = {
			name: `New Category ${Date.now()}`,
			description: 'New Description',
		};
		const res = await app.handle(
			new Request(`${BASE_URL}`, {
				method: 'POST',
				headers: {
					'content-type': 'application/json',
					cookie: `auth_token=${authToken}`,
				},
				body: JSON.stringify(categoryData),
			}),
		);
		expect(res.status).toBe(201);
		const body = (await res.json()) as any;
		expect(body.data.name).toBe(categoryData.name);
		createdCategoryIds.push(body.data.id);
	});

	it('PUT /:id should update the category', async () => {
		const updateData = { name: 'Updated Category' };
		const res = await app.handle(
			new Request(`${BASE_URL}/${testCategoryId}`, {
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
	});

	it('DELETE /:id should remove the category', async () => {
		const category = await prisma.categories.create({
			data: { name: `To Delete ${Date.now()}` },
		});
		const res = await app.handle(
			new Request(`${BASE_URL}/${category.id}`, {
				method: 'DELETE',
				headers: { cookie: `auth_token=${authToken}` },
			}),
		);
		expect(res.status).toBe(204);
		const check = await prisma.categories.findUnique({ where: { id: category.id } });
		expect(check).toBeNull();
	});

	it('GET /:id/products should return products in category', async () => {
		const res = await app.handle(new Request(`${BASE_URL}/${testCategoryId}/products`));
		expect(res.status).toBe(200);
		const body = (await res.json()) as any;
		expect(body.data.length).toBe(2);
	});

	it('GET /:id/products should support sorting (price desc)', async () => {
		const res = await app.handle(new Request(`${BASE_URL}/${testCategoryId}/products?sortBy=price&sortOrder=desc`));
		expect(res.status).toBe(200);
		const body = (await res.json()) as any;
		expect(body.data[0].name).toBe('Product B'); // 20 > 10
		expect(body.data[1].name).toBe('Product A');
	});

	it('GET /:id/products should support pagination', async () => {
		const res = await app.handle(new Request(`${BASE_URL}/${testCategoryId}/products?limit=1`));
		expect(res.status).toBe(200);
		const body = (await res.json()) as any;
		expect(body.data.length).toBe(1);
	});
});
