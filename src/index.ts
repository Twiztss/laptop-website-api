import { Elysia } from 'elysia';
import './lib/config'; // Ensure config is loaded early
import productRoute from './routes/product.route';
import userRoute from './routes/user.route';
import categoryRoute from './routes/category.route';
import authRoute from './routes/auth.route';
import { BadRequestError, errorHandler, NotFoundError, UnauthorizedError } from './lib/error';
import { authPlugin } from './lib/auth';

const app = new Elysia()
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
	.get('/', () => 'Hello Elysia')
	.listen(3000);

console.log(`🦊 Elysia is running at ${app.server?.hostname}:${app.server?.port}`);

export default app;
