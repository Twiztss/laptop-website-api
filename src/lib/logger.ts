import { prisma } from './prisma';

export enum LogAction {
	AUTH_REGISTER = 'AUTH_REGISTER',
	AUTH_LOGIN = 'AUTH_LOGIN',
	USER_UPDATE = 'USER_UPDATE',
	USER_DELETE = 'USER_DELETE',
	PRODUCT_CREATE = 'PRODUCT_CREATE',
	PRODUCT_UPDATE = 'PRODUCT_UPDATE',
	PRODUCT_DELETE = 'PRODUCT_DELETE',
	CATEGORY_CREATE = 'CATEGORY_CREATE',
	CATEGORY_UPDATE = 'CATEGORY_UPDATE',
	CATEGORY_DELETE = 'CATEGORY_DELETE',
}

export async function recordLog(params: { userId?: string; action: LogAction; request?: Request; headers?: Record<string, string | undefined> }) {
	const userAgent = params.headers?.['user-agent'] || params.request?.headers.get('user-agent') || null;
	const ipAddress = params.headers?.['x-forwarded-for'] || null;

	try {
		await prisma.logs.create({
			data: {
				user_id: params.userId,
				action: params.action,
				user_agent: userAgent,
				ip_address: ipAddress,
			},
		});
	} catch (error) {
		console.error('Failed to record activity log:', error);
	}
}
