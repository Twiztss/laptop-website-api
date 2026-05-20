import { Elysia } from 'elysia';
import productRoute from './routes/product.route';
import userRoute from './routes/user.route';
import { BadRequestError, errorHandler, NotFoundError } from './lib/error';

const app = new Elysia()
	.error({
		NotFoundError,
		BadRequestError,
	})

	.onError(errorHandler)
	.use(productRoute)
	.use(userRoute)
	.get('/', () => 'Hello Elysia')
	.listen(3000);

console.log(`🦊 Elysia is running at ${app.server?.hostname}:${app.server?.port}`);

export default app;
