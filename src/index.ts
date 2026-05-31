import { Elysia } from 'elysia';
import { rateLimit } from 'elysia-rate-limit';
import { CONFIG } from './lib/config'; // Ensure config is loaded early
import productRoute from './routes/product.route';
import userRoute from './routes/user.route';
import categoryRoute from './routes/category.route';
import authRoute from './routes/auth.route';
import cartRoute from './routes/cart.route';
import orderRoute from './routes/order.route';
import { BadRequestError, errorHandler, NotFoundError, UnauthorizedError } from './lib/error';
import { authPlugin } from './lib/auth';

const app = new Elysia()
	.use(rateLimit({
		duration: CONFIG.RATE_LIMIT_DURATION,
		max: CONFIG.RATE_LIMIT,
		generator: (request: Request): string => {
			// Priority: Vercel headers (proxies)
			const forwardedFor = request.headers.get('x-forwarded-for') || request.headers.get('x-vercel-forwarded-for');
			if (forwardedFor) {
				return forwardedFor.split(',')[0].trim();
			}

			return '127.0.0.1';
		},
	}))
	.error({
		NotFoundError,
		BadRequestError,
		UnauthorizedError,
	})
	.onError(errorHandler)
	.onBeforeHandle(({ set }) => {
		set.headers['X-Content-Type-Options'] = 'nosniff';
		set.headers['X-Frame-Options'] = 'DENY';
		set.headers['X-XSS-Protection'] = '1; mode=block';
		set.headers['Referrer-Policy'] = 'strict-origin-when-cross-origin';
	})
	.use(authPlugin)
	.use(authRoute)
	.use(productRoute)
	.use(userRoute)
	.use(categoryRoute)
	.use(cartRoute)
	.use(orderRoute)
	.get('/', () => 'Hello Elysia');

if (process.env.VERCEL !== '1') {
	const port = Number(process.env.PORT) || 3000;
	app.listen(port);
	console.log(`🦊 Elysia is running at ${app.server?.hostname}:${app.server?.port}`);
}

export default app;
