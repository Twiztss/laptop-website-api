import { t } from 'elysia';

export const ProductParamsSchema = t.Object({
	id: t.String({ format: 'uuid' }),
});

export const ProductQuerySchema = t.Object({
	skip: t.Optional(t.Numeric({ minimum: 0 })),
	limit: t.Optional(t.Numeric({ minimum: 1, maximum: 100 })),
	name: t.Optional(t.String()),
	categoryId: t.Optional(t.String({ format: 'uuid' })),
	minPrice: t.Optional(t.Numeric({ minimum: 0 })),
	maxPrice: t.Optional(t.Numeric({ minimum: 0 })),
	sortBy: t.Optional(t.String({ pattern: '^(name|price|stock|created_at)$' })),
	sortOrder: t.Optional(t.String({ pattern: '^(asc|desc)$' })),
});

export const ProductBodySchema = t.Object({
	name: t.String({ minLength: 1, maxLength: 100 }),
	description: t.Optional(t.String()),
	price: t.Number({ minimum: 0 }),
	stock: t.Integer({ minimum: 0 }),
	category_id: t.Optional(t.String({ format: 'uuid' })),
});

export const ProductEditSchema = t.Object({
	name: t.Optional(t.String({ minLength: 1, maxLength: 100 })),
	description: t.Optional(t.String()),
	price: t.Optional(t.Number({ minimum: 0 })),
	stock: t.Optional(t.Integer({ minimum: 0 })),
	category_id: t.Optional(t.String({ format: 'uuid' })),
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

export const LoginSchema = t.Object({
	email: t.String({ format: 'email' }),
	password: t.String(),
});

export const CategoryParamsSchema = t.Object({
	id: t.String({ format: 'uuid' }),
});

export const CategoryQuerySchema = t.Object({
	skip: t.Optional(t.Numeric({ minimum: 0 })),
	limit: t.Optional(t.Numeric({ minimum: 1, maximum: 100 })),
});

export const CategoryBodySchema = t.Object({
	name: t.String({ minLength: 1, maxLength: 100 }),
	description: t.Optional(t.String()),
});

export const CategoryEditSchema = t.Partial(CategoryBodySchema);

export const CategoryProductQuerySchema = t.Object({
	skip: t.Optional(t.Numeric({ minimum: 0 })),
	limit: t.Optional(t.Numeric({ minimum: 1, maximum: 100 })),
	sortBy: t.Optional(t.String({ pattern: '^(name|price|stock|created_at)$' })),
	sortOrder: t.Optional(t.String({ pattern: '^(asc|desc)$' })),
});

export const CartItemBodySchema = t.Object({
	product_id: t.String({ format: 'uuid' }),
	quantity: t.Integer({ minimum: 1 }),
});

export const CartItemUpdateSchema = t.Object({
	quantity: t.Integer({ minimum: 1 }),
});

export const CartParamsSchema = t.Object({
	id: t.String({ format: 'uuid' }),
});

export const CartItemParamsSchema = t.Object({
	itemId: t.String({ format: 'uuid' }),
});

export const BulkCartItemUpdateSchema = t.Object({
	items: t.Array(
		t.Object({
			itemId: t.String({ format: 'uuid' }),
			quantity: t.Integer({ minimum: 1 }),
		})
	),
});
