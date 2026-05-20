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

export class UnauthorizedError extends Error {
	constructor(message: string = 'Unauthorized') {
		super(message);
		this.name = 'UnauthorizedError';
	}
}

export const errorHandler: ErrorHandler<{
	NotFoundError: NotFoundError;
	BadRequestError: BadRequestError;
	UnauthorizedError: UnauthorizedError;
}> = ({ code, error, set }) => {
	// Standardized error response structure
	const errorResponse = (status: number, errorCode: string, message: string, errors?: any) => {
		set.status = status;
		return {
			status,
			code: errorCode,
			message,
			...(errors && { errors }),
		};
	};

	// Handle Prisma errors
	if (error && typeof error === 'object' && 'code' in error) {
		const prismaError = error as { code: string; meta?: any; message: string };
		switch (prismaError.code) {
			case 'P2025': // Record not found
				return errorResponse(404, 'NOT_FOUND', 'Resource not found');
			case 'P2002': // Unique constraint failed
				const target = prismaError.meta?.target || 'Resource';
				return errorResponse(409, 'CONFLICT', `${target} already exists`);
			case 'P2003': // Foreign key constraint failed
				return errorResponse(400, 'BAD_REQUEST', 'Foreign key constraint failed');
		}
	}

	switch (code) {
		case 'NOT_FOUND':
		case 'NotFoundError':
			return errorResponse(404, 'NOT_FOUND', error.message || 'Resource not found');
		case 'VALIDATION':
			const validationError = error as ValidationError;
			return errorResponse(422, 'VALIDATION_ERROR', 'Validation failed', validationError.all || []);
		case 'BadRequestError':
			return errorResponse(400, 'BAD_REQUEST', error.message || 'Bad request');
		case 'UnauthorizedError':
			return errorResponse(401, 'UNAUTHORIZED', error.message || 'Unauthorized');
		case 'PARSE':
			return errorResponse(400, 'PARSE_ERROR', 'Invalid request body');
		case 'INVALID_COOKIE_SIGNATURE':
			return errorResponse(401, 'UNAUTHORIZED', 'Invalid session');
		default:
			console.error('Unhandled Error:', error);
			return errorResponse(500, 'INTERNAL_SERVER_ERROR', 'An unexpected error occurred');
	}
};
