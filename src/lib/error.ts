import { ErrorHandler, InternalServerError, ValidationError } from 'elysia';

export class NotFoundError extends Error {
	constructor(message: string = 'Resource not found') {
		super(message);
		this.name = 'NotFoundError';
	}
}

export class BadRequestError extends Error {
	constructor(message: string = 'Bad request') {
		super(message);
		this.name = 'BadRequestError';
	}
}

export const errorHandler: ErrorHandler<{
	NotFoundError: NotFoundError;
	BadRequestError: BadRequestError;
}> = ({ code, error, set }) => {
	// Handle Prisma errors (simplified)
	if (error && typeof error === 'object' && 'code' in error) {
		if (error.code === 'P2025') {
			set.status = 404;
			return {
				status: 404,
				code: 'NOT_FOUND',
				message: 'Resource not found',
			};
		}
		if (error.code === 'P2002') {
			set.status = 400;
			return {
				status: 400,
				code: 'BAD_REQUEST',
				message: 'Unique constraint failed. Resource already exists.',
			};
		}
	}

	switch (code) {
		case 'NOT_FOUND':
		case 'NotFoundError':
			set.status = 404;
			return {
				status: 404,
				code: 'NOT_FOUND',
				message: error.message,
			};
		case 'VALIDATION':
			set.status = 422;
			return {
				status: 422,
				code: 'VALIDATION_ERROR',
				message: 'Validation failed',
				errors: (error as ValidationError).all || [], // Casting here is often necessary as VALIDATION error types are complex
			};
		case 'BadRequestError':
			set.status = 400;
			return {
				status: 400,
				code: 'BAD_REQUEST',
				message: error.message,
			};
		default:
			set.status = 500;
			console.error('Unhandled Error:', error);
			return {
				status: 500,
				code: 'INTERNAL_SERVER_ERROR',
				message: (error as InternalServerError).message || 'An unexpected error occurred',
			};
	}
};
