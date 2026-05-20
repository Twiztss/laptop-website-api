import { describe, it, expect, beforeAll, afterAll } from 'bun:test';
import app from '..';
import { prisma } from '../lib/prisma';
import { signToken } from '../lib/jwt';

const BASE_URL = 'http://localhost:3000/products';

describe('/products', () => {
	let testProductId: string;
	let authToken: string;
	let testUserId: string;
	let createdProductIds: string[] = [];

	beforeAll(async () => {
		// Create a test admin user
		const user = await prisma.users.create({
			data: {
				name: 'Product Admin',
				email: `prod_admin_${Date.now()}@example.com`,
				password: 'password123',
				role: 'admin',
			},
		});
		testUserId = user.id;
		authToken = await signToken({ userId: user.id });

		// Create a test product
		const product = await prisma.products.create({
			data: {
				name: 'Test Product',
				description: 'Test Description',
				price: 10.99,
				stock: 100,
			},
		});
		testProductId = product.id;
	});

	afterAll(async () => {
		// Clean up test data
		const idsToCleanup = [testProductId, ...createdProductIds].filter((id) => !!id);
		if (idsToCleanup.length > 0) {
			await prisma.products.deleteMany({
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
		const res = await app.handle(new Request(`${BASE_URL}/${testProductId}`));
		expect(res.status).toBe(200);
		const data = (await res.json()) as any;
		expect(data.data.id).toBe(testProductId);
	});

	it('GET /:id should return 404 NOT FOUND for non-existent ID', async () => {
		const fakeId = '00000000-0000-4000-a000-000000000000';
		const res = await app.handle(new Request(`${BASE_URL}/${fakeId}`));
		expect(res.status).toBe(404);
		const body = (await res.json()) as any;
		expect(body.code).toBe('NOT_FOUND');
		expect(body.message).toBe('Product not found');
	});

	it('POST / should return 201 CREATED and return the product', async () => {
		const productData = {
			name: 'New Product',
			description: 'New product Description',
			stock: 1,
			price: 1.99,
		};
		const res = await app.handle(
			new Request(`${BASE_URL}`, {
				method: 'POST',
				headers: {
					'content-type': 'application/json',
					cookie: `auth_token=${authToken}`,
				},
				body: JSON.stringify(productData),
			}),
		);
		expect(res.status).toBe(201);
		const body = (await res.json()) as any;
		expect(body.data.name).toBe(productData.name);
		expect(body.data.id).toBeDefined();

		// Track for cleanup
		createdProductIds.push(body.data.id);
	});

	it('POST / should return 422 for negative price or stock', async () => {
		const res = await app.handle(
			new Request(`${BASE_URL}`, {
				method: 'POST',
				headers: {
					'content-type': 'application/json',
					cookie: `auth_token=${authToken}`,
				},
				body: JSON.stringify({
					name: 'Bad Product',
					description: 'Description',
					stock: -1,
					price: -1.99,
				}),
			}),
		);
		expect(res.status).toBe(422);
	});

	it('GET / should return 422 for invalid pagination', async () => {
		const res = await app.handle(new Request(`${BASE_URL}?limit=200`));
		expect(res.status).toBe(422);

		const res2 = await app.handle(new Request(`${BASE_URL}?skip=-1`));
		expect(res2.status).toBe(422);
	});

	it('GET / should filter by name', async () => {
		const res = await app.handle(new Request(`${BASE_URL}?name=Test`));
		expect(res.status).toBe(200);
		const body = (await res.json()) as any;
		expect(body.data.every((p: any) => p.name.includes('Test'))).toBe(true);
	});

	it('GET / should filter by price range', async () => {
		const res = await app.handle(new Request(`${BASE_URL}?minPrice=5&maxPrice=15`));
		expect(res.status).toBe(200);
		const body = (await res.json()) as any;
		expect(body.data.every((p: any) => parseFloat(p.price) >= 5 && parseFloat(p.price) <= 15)).toBe(true);
	});

	it('GET / should support sorting', async () => {
		const res = await app.handle(new Request(`${BASE_URL}?sortBy=price&sortOrder=desc`));
		expect(res.status).toBe(200);
		const body = (await res.json()) as any;
		if (body.data.length >= 2) {
			expect(parseFloat(body.data[0].price)).toBeGreaterThanOrEqual(parseFloat(body.data[1].price));
		}
	});

	it('PUT /:id should update the product', async () => {
		const updateData = { name: 'Updated Name', price: 99.99 };
		const res = await app.handle(
			new Request(`${BASE_URL}/${testProductId}`, {
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

	it('PUT /:id should return 404 for non-existent ID', async () => {
		const fakeId = '00000000-0000-4000-a000-000000000000';
		const res = await app.handle(
			new Request(`${BASE_URL}/${fakeId}`, {
				method: 'PUT',
				headers: {
					'content-type': 'application/json',
					cookie: `auth_token=${authToken}`,
				},
				body: JSON.stringify({ name: 'Doesnt Matter' }),
			}),
		);
		expect(res.status).toBe(404);
		const body = (await res.json()) as any;
		expect(body.code).toBe('NOT_FOUND');
	});

	it('DELETE /:id should remove the product', async () => {
		// Create a temporary product to delete
		const product = await prisma.products.create({
			data: { name: 'To Delete', price: 0, stock: 0 },
		});
		const res = await app.handle(
			new Request(`${BASE_URL}/${product.id}`, {
				method: 'DELETE',
				headers: { cookie: `auth_token=${authToken}` },
			}),
		);
		expect(res.status).toBe(204);

		// Verify it's gone
		const check = await prisma.products.findUnique({ where: { id: product.id } });
		expect(check).toBeNull();
	});

	it('DELETE /:id should return 404 for non-existent ID', async () => {
		const fakeId = '00000000-0000-4000-a000-000000000000';
		const res = await app.handle(
			new Request(`${BASE_URL}/${fakeId}`, {
				method: 'DELETE',
				headers: { cookie: `auth_token=${authToken}` },
			}),
		);
		expect(res.status).toBe(404);
		const body = (await res.json()) as any;
		expect(body.code).toBe('NOT_FOUND');
	});
});
