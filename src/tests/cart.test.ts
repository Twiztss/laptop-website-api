import { describe, it, expect, beforeAll, afterAll } from 'bun:test';
import app from '..';
import { prisma } from '../lib/prisma';
import { signToken } from '../lib/jwt';

const BASE_URL = 'http://localhost:3000/carts';

describe('/carts', () => {
	let adminToken: string;
	let userToken: string;
	let adminUserId: string;
	let regularUserId: string;
	let testCategoryId: string;
	let testProductId1: string;
	let testProductId2: string;
	let testCartId: string;

	beforeAll(async () => {
		// 1. Create a test admin user
		const admin = await prisma.users.create({
			data: {
				name: `Cart Admin ${Date.now()}`,
				email: `cart_admin_${Date.now()}@example.com`,
				password: 'password123',
				role: 'admin',
			},
		});
		adminUserId = admin.id;
		adminToken = await signToken({ userId: admin.id });

		// 2. Create a test regular user
		const user = await prisma.users.create({
			data: {
				name: `Cart User ${Date.now()}`,
				email: `cart_user_${Date.now()}@example.com`,
				password: 'password123',
				role: 'customer',
			},
		});
		regularUserId = user.id;
		userToken = await signToken({ userId: user.id });

		// 3. Create a category
		const category = await prisma.categories.create({
			data: {
				name: `Cart Test Category ${Date.now()}`,
				description: 'Test Category',
			},
		});
		testCategoryId = category.id;

		// 4. Create products
		const p1 = await prisma.products.create({
			data: {
				name: 'Test Product 1',
				price: 15.5,
				stock: 100,
				category_id: testCategoryId,
			},
		});
		testProductId1 = p1.id;

		const p2 = await prisma.products.create({
			data: {
				name: 'Test Product 2',
				price: 25.0,
				stock: 50,
				category_id: testCategoryId,
			},
		});
		testProductId2 = p2.id;
	});

	afterAll(async () => {
		// Clean up
		const productIds = [testProductId1, testProductId2].filter(Boolean);
		if (productIds.length > 0) {
			await prisma.cart_items.deleteMany({
				where: { product_id: { in: productIds } },
			});
			await prisma.products.deleteMany({
				where: { id: { in: productIds } },
			});
		}

		const userIds = [adminUserId, regularUserId].filter(Boolean);
		if (userIds.length > 0) {
			await prisma.carts.deleteMany({
				where: { user_id: { in: userIds } },
			});
			await prisma.users.deleteMany({
				where: { id: { in: userIds } },
			});
		}

		if (testCategoryId) {
			await prisma.categories.deleteMany({
				where: { id: testCategoryId },
			});
		}
		
		if (app.server) await app.stop();
	});

	describe('Customer Routes (/my)', () => {
		it('GET /my should require authentication', async () => {
			const res = await app.handle(new Request(`${BASE_URL}/my`));
			expect(res.status).toBe(401);
		});

		it('GET /my should return an empty cart for a new user', async () => {
			const res = await app.handle(
				new Request(`${BASE_URL}/my`, {
					headers: { cookie: `auth_token=${userToken}` },
				})
			);
			expect(res.status).toBe(200);
			const body = (await res.json()) as any;
			expect(body.data.user_id).toBe(regularUserId);
			expect(body.data.cart_items).toHaveLength(0);
			expect(body.data.total_items).toBe(0);
			expect(body.data.total_price).toBe(0);
			testCartId = body.data.id;
		});

		let testCartItemId: string;

		it('POST /my/items should add an item to the cart', async () => {
			const res = await app.handle(
				new Request(`${BASE_URL}/my/items`, {
					method: 'POST',
					headers: {
						'content-type': 'application/json',
						cookie: `auth_token=${userToken}`,
					},
					body: JSON.stringify({ product_id: testProductId1, quantity: 2 }),
				})
			);
			expect(res.status).toBe(201);
			const body = (await res.json()) as any;
			expect(body.data.product_id).toBe(testProductId1);
			expect(body.data.quantity).toBe(2);
			testCartItemId = body.data.id;
		});

		it('GET /my should now reflect the added item and correct totals', async () => {
			const res = await app.handle(
				new Request(`${BASE_URL}/my`, {
					headers: { cookie: `auth_token=${userToken}` },
				})
			);
			expect(res.status).toBe(200);
			const body = (await res.json()) as any;
			expect(body.data.cart_items).toHaveLength(1);
			expect(body.data.total_items).toBe(2);
			expect(body.data.total_price).toBe(31); // 2 * 15.5
		});

		it('PUT /my/items/:itemId should update item quantity', async () => {
			const res = await app.handle(
				new Request(`${BASE_URL}/my/items/${testCartItemId}`, {
					method: 'PUT',
					headers: {
						'content-type': 'application/json',
						cookie: `auth_token=${userToken}`,
					},
					body: JSON.stringify({ quantity: 5 }),
				})
			);
			expect(res.status).toBe(200);
			const body = (await res.json()) as any;
			expect(body.data.quantity).toBe(5);
		});

		it('POST /my/items should add quantity to existing item if product already in cart', async () => {
			const res = await app.handle(
				new Request(`${BASE_URL}/my/items`, {
					method: 'POST',
					headers: {
						'content-type': 'application/json',
						cookie: `auth_token=${userToken}`,
					},
					body: JSON.stringify({ product_id: testProductId1, quantity: 1 }),
				})
			);
			expect(res.status).toBe(201);
			const body = (await res.json()) as any;
			expect(body.data.quantity).toBe(6); // 5 + 1
		});

		it('DELETE /my/items/:itemId should remove the item from the cart', async () => {
			const res = await app.handle(
				new Request(`${BASE_URL}/my/items/${testCartItemId}`, {
					method: 'DELETE',
					headers: { cookie: `auth_token=${userToken}` },
				})
			);
			expect(res.status).toBe(204);
			
			// Verify it's gone
			const getRes = await app.handle(
				new Request(`${BASE_URL}/my`, {
					headers: { cookie: `auth_token=${userToken}` },
				})
			);
			const body = (await getRes.json()) as any;
			expect(body.data.cart_items).toHaveLength(0);
		});

		it('POST /my/items should cap quantity at stock and warn', async () => {
			const res = await app.handle(
				new Request(`${BASE_URL}/my/items`, {
					method: 'POST',
					headers: {
						'content-type': 'application/json',
						cookie: `auth_token=${userToken}`,
					},
					body: JSON.stringify({ product_id: testProductId1, quantity: 999 }), // Test product 1 stock is 100
				})
			);
			expect(res.status).toBe(201);
			const body = (await res.json()) as any;
			expect(body.data.quantity).toBe(100);
			expect(body.warning).toBeDefined();
			expect(body.warning).toContain('capped at available stock (100)');
			testCartItemId = body.data.id;
		});

		it('PUT /my/items should perform bulk update', async () => {
			// First, add a second item to the cart
			const addRes = await app.handle(
				new Request(`${BASE_URL}/my/items`, {
					method: 'POST',
					headers: {
						'content-type': 'application/json',
						cookie: `auth_token=${userToken}`,
					},
					body: JSON.stringify({ product_id: testProductId2, quantity: 1 }),
				})
			);
			const addBody = (await addRes.json()) as any;
			const testCartItemId2 = addBody.data.id;

			const res = await app.handle(
				new Request(`${BASE_URL}/my/items`, {
					method: 'PUT',
					headers: {
						'content-type': 'application/json',
						cookie: `auth_token=${userToken}`,
					},
					body: JSON.stringify({
						items: [
							{ itemId: testCartItemId, quantity: 50 },
							{ itemId: testCartItemId2, quantity: 999 } // Test product 2 stock is 50
						]
					}),
				})
			);
			expect(res.status).toBe(200);
			const body = (await res.json()) as any;
			expect(body.data.length).toBe(2);
			
			const updatedItem1 = body.data.find((i: any) => i.id === testCartItemId);
			const updatedItem2 = body.data.find((i: any) => i.id === testCartItemId2);

			expect(updatedItem1.quantity).toBe(50);
			expect(updatedItem2.quantity).toBe(50); // Capped at stock
			expect(body.warning).toBeDefined();
			expect(body.warning).toContain('capped at available stock');
		});

		it('DELETE /my/items should clear the entire cart', async () => {
			const res = await app.handle(
				new Request(`${BASE_URL}/my/items`, {
					method: 'DELETE',
					headers: { cookie: `auth_token=${userToken}` },
				})
			);
			expect(res.status).toBe(204);

			// Verify it's empty
			const getRes = await app.handle(
				new Request(`${BASE_URL}/my`, {
					headers: { cookie: `auth_token=${userToken}` },
				})
			);
			const body = (await getRes.json()) as any;
			expect(body.data.cart_items).toHaveLength(0);
		});
	});

	describe('Admin Routes', () => {
		it('GET / should require admin authentication', async () => {
			// Try with regular user
			let res = await app.handle(
				new Request(`${BASE_URL}`, {
					headers: { cookie: `auth_token=${userToken}` },
				})
			);
			expect(res.status).toBe(401); // UnauthorizedError

			// Try with admin
			res = await app.handle(
				new Request(`${BASE_URL}`, {
					headers: { cookie: `auth_token=${adminToken}` },
				})
			);
			expect(res.status).toBe(200);
			const body = (await res.json()) as any;
			expect(Array.isArray(body.data)).toBe(true);
		});

		it('GET /:id should fetch a specific cart with its details', async () => {
			const res = await app.handle(
				new Request(`${BASE_URL}/${testCartId}`, {
					headers: { cookie: `auth_token=${adminToken}` },
				})
			);
			expect(res.status).toBe(200);
			const body = (await res.json()) as any;
			expect(body.data.id).toBe(testCartId);
			expect(body.data.user_id).toBe(regularUserId);
			expect(body.data.users).toBeDefined();
		});

		it('DELETE /:id should delete a specific cart', async () => {
			const res = await app.handle(
				new Request(`${BASE_URL}/${testCartId}`, {
					method: 'DELETE',
					headers: { cookie: `auth_token=${adminToken}` },
				})
			);
			expect(res.status).toBe(204);

			// Verify it's gone
			const check = await prisma.carts.findUnique({ where: { id: testCartId } });
			expect(check).toBeNull();
		});
	});
});
