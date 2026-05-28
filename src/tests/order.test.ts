import { describe, it, expect, beforeAll, afterAll } from 'bun:test';
import app from '..';
import { prisma } from '../lib/prisma';
import { signToken } from '../lib/jwt';
import { OrderStatus } from '../lib/constants';

const ORDERS_URL = 'http://localhost:3000/orders';
const CARTS_URL = 'http://localhost:3000/carts';

describe('/orders', () => {
	let adminToken: string;
	let userToken: string;
	let adminUserId: string;
	let regularUserId: string;
	let testCategoryId: string;
	let testProductId: string;
	let testOrderId: string;

	beforeAll(async () => {
		// 1. Create a test admin user
		const admin = await prisma.users.create({
			data: {
				name: `Order Admin ${Date.now()}`,
				email: `order_admin_${Date.now()}@example.com`,
				password: 'password123',
				role: 'admin',
			},
		});
		adminUserId = admin.id;
		adminToken = await signToken({ userId: admin.id });

		// 2. Create a test regular user
		const user = await prisma.users.create({
			data: {
				name: `Order User ${Date.now()}`,
				email: `order_user_${Date.now()}@example.com`,
				password: 'password123',
				role: 'customer',
			},
		});
		regularUserId = user.id;
		userToken = await signToken({ userId: user.id });

		// 3. Create a category
		const category = await prisma.categories.create({
			data: {
				name: `Order Test Category ${Date.now()}`,
				description: 'Test Category',
			},
		});
		testCategoryId = category.id;

		// 4. Create a product
		const product = await prisma.products.create({
			data: {
				name: 'Order Test Product',
				price: 10.0,
				stock: 100,
				category_id: testCategoryId,
			},
		});
		testProductId = product.id;
	});

	afterAll(async () => {
		// Clean up
		await prisma.order_items.deleteMany({
			where: { product_id: testProductId },
		});
		await prisma.orders.deleteMany({
			where: { user_id: { in: [adminUserId, regularUserId] } },
		});
		await prisma.cart_items.deleteMany({
			where: { product_id: testProductId },
		});
		await prisma.products.deleteMany({
			where: { id: testProductId },
		});
		await prisma.carts.deleteMany({
			where: { user_id: { in: [adminUserId, regularUserId] } },
		});
		await prisma.users.deleteMany({
			where: { id: { in: [adminUserId, regularUserId] } },
		});
		await prisma.categories.deleteMany({
			where: { id: testCategoryId },
		});
		
		if (app.server) await app.stop();
	});

	describe('Order Creation flow', () => {
		it('POST /my should fail if cart is empty', async () => {
			const res = await app.handle(
				new Request(`${ORDERS_URL}/my`, {
					method: 'POST',
					headers: { cookie: `auth_token=${userToken}` },
				})
			);
			expect(res.status).toBe(400);
			const body = await res.json() as any;
			expect(body.message).toBe('Cart is empty');
		});

		it('POST /my should create order from cart and deduct stock', async () => {
			// 1. Add item to cart first
			await app.handle(
				new Request(`${CARTS_URL}/my/items`, {
					method: 'POST',
					headers: {
						'content-type': 'application/json',
						cookie: `auth_token=${userToken}`,
					},
					body: JSON.stringify({ product_id: testProductId, quantity: 5 }),
				})
			);

			// 2. Create order
			const res = await app.handle(
				new Request(`${ORDERS_URL}/my`, {
					method: 'POST',
					headers: { cookie: `auth_token=${userToken}` },
				})
			);

			expect(res.status).toBe(201);
			const body = await res.json() as any;
			expect(body.data.user_id).toBe(regularUserId);
			expect(Number(body.data.total)).toBe(50);
			expect(body.data.status).toBe(OrderStatus.PENDING);
			testOrderId = body.data.id;

			// 3. Verify stock is deducted (100 - 5 = 95)
			const updatedProduct = await prisma.products.findUnique({
				where: { id: testProductId },
			});
			expect(updatedProduct?.stock).toBe(95);

			// 4. Verify cart is cleared
			const cartRes = await app.handle(
				new Request(`${CARTS_URL}/my`, {
					headers: { cookie: `auth_token=${userToken}` },
				})
			);
			const cartBody = await cartRes.json() as any;
			expect(cartBody.data.cart_items).toHaveLength(0);
		});
	});

	describe('User Management Routes (/my)', () => {
		it('GET /my should return user orders', async () => {
			const res = await app.handle(
				new Request(`${ORDERS_URL}/my`, {
					headers: { cookie: `auth_token=${userToken}` },
				})
			);
			expect(res.status).toBe(200);
			const body = await res.json() as any;
			expect(body.data).toHaveLength(1);
			expect(body.data[0].id).toBe(testOrderId);
		});

		it('GET /my/:id should return specific order', async () => {
			const res = await app.handle(
				new Request(`${ORDERS_URL}/my/${testOrderId}`, {
					headers: { cookie: `auth_token=${userToken}` },
				})
			);
			expect(res.status).toBe(200);
			const body = await res.json() as any;
			expect(body.data.id).toBe(testOrderId);
			expect(body.data.order_items).toHaveLength(1);
		});

		it('PUT /my/:id/cancel should cancel order and restore stock', async () => {
			const res = await app.handle(
				new Request(`${ORDERS_URL}/my/${testOrderId}/cancel`, {
					method: 'PUT',
					headers: { cookie: `auth_token=${userToken}` },
				})
			);

			expect(res.status).toBe(200);
			const body = await res.json() as any;
			expect(body.data.status).toBe(OrderStatus.CANCELLED);

			// Verify stock is restored (95 + 5 = 100)
			const restoredProduct = await prisma.products.findUnique({
				where: { id: testProductId },
			});
			expect(restoredProduct?.stock).toBe(100);
		});
	});

	describe('Admin Routes', () => {
		it('GET / should return all orders for admin', async () => {
			const res = await app.handle(
				new Request(`${ORDERS_URL}`, {
					headers: { cookie: `auth_token=${adminToken}` },
				})
			);
			expect(res.status).toBe(200);
			const body = await res.json() as any;
			expect(Array.isArray(body.data)).toBe(true);
			expect(body.data.length).toBeGreaterThanOrEqual(1);
		});

		it('PUT /:id should update order status', async () => {
			const res = await app.handle(
				new Request(`${ORDERS_URL}/${testOrderId}`, {
					method: 'PUT',
					headers: {
						'content-type': 'application/json',
						cookie: `auth_token=${adminToken}`,
					},
					body: JSON.stringify({ status: OrderStatus.COMPLETED }),
				})
			);
			expect(res.status).toBe(200);
			const body = await res.json() as any;
			expect(body.data.status).toBe(OrderStatus.COMPLETED);
		});

		it('DELETE /:id should delete order', async () => {
			const res = await app.handle(
				new Request(`${ORDERS_URL}/${testOrderId}`, {
					method: 'DELETE',
					headers: { cookie: `auth_token=${adminToken}` },
				})
			);
			expect(res.status).toBe(204);

			// Verify deleted
			const check = await prisma.orders.findUnique({ where: { id: testOrderId } });
			expect(check).toBeNull();
		});
	});
});
