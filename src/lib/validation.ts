import { t } from 'elysia';

export const ProductParamsSchema = t.Object({
	id: t.String({ format: 'uuid' }),
});

export const ProductQuerySchema = t.Object({
	skip: t.Optional(t.Numeric({ minimum: 0 })),
	limit: t.Optional(t.Numeric({ minimum: 1, maximum: 100 })),
});

export const ProductBodySchema = t.Object({
	name: t.String({ minLength: 1, maxLength: 100 }),
	description: t.Optional(t.String()),
	price: t.Number({ minimum: 0 }),
	stock: t.Integer({ minimum: 0 }),
});

export const ProductEditSchema = t.Object({
	name: t.Optional(t.String({ minLength: 1, maxLength: 100 })),
	description: t.Optional(t.String()),
	price: t.Optional(t.Number({ minimum: 0 })),
	stock: t.Optional(t.Integer({ minimum: 0 })),
});

export const UserParamsSchema = t.Object({
	id: t.String({ format: 'uuid' }),
});

export const UserQuerySchema = t.Object({
	skip: t.Optional(t.Numeric({ minimum: 0 })),
	limit: t.Optional(t.Numeric({ minimum: 1, maximum: 100 })),
});

export const UserBodySchema = t.Object({
	name: t.String({ minLength: 1, maxLength: 100 }),
	email: t.String({ format: 'email', maxLength: 100 }),
	password: t.String({ minLength: 8 }),
	role: t.Optional(t.String({ maxLength: 20 })),
});

export const UserEditSchema = t.Partial(UserBodySchema);
