import { describe, it, expect } from 'bun:test';
import { Elysia } from 'elysia';
import { rateLimit } from 'elysia-rate-limit';

describe('Rate Limiting (Isolated)', () => {
    it('should return 429 after exceeding 5 requests', async () => {
        const testApp = new Elysia()
            .use(rateLimit({
                duration: 60000,
                max: 5,
            }))
            .get('/', () => 'OK');

        // Send 5 successful requests
        for (let i = 0; i < 5; i++) {
            const res = await testApp.handle(new Request('http://localhost'));
            expect(res.status).toBe(200);
        }

        // The 6th request should fail
        const res = await testApp.handle(new Request('http://localhost'));
        expect(res.status).toBe(429);
        const text = await res.text();
        expect(text).toBe('rate-limit reached');
    });
});
