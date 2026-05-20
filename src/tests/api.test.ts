import { describe, it, expect, beforeAll, afterAll } from 'bun:test';
import app from '..';

const BASE_URL = 'http://localhost:3000';

describe('API test', () => {
	beforeAll(async () => {
		app;
	});

	afterAll(async () => {
		if (app.server) await app.stop();
	});

	it('GET / should return 200 OK', async () => {
		const res = await app.handle(new Request(BASE_URL));
		expect(res.status).toBe(200);
		expect(await res.text()).toBe('Hello Elysia');
	});

	it('GET /invalid-route shoud return 404 NOT FOUND', async () => {
		const res = await app.handle(new Request(`${BASE_URL}/invalid-route`));
		expect(res.status).toBe(404);
		const body = (await res.json()) as any;
		expect(body.code).toBe('NOT_FOUND');
	});
});
