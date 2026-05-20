import * as jose from 'jose';
import { CONFIG } from './config';

const secret = new TextEncoder().encode(CONFIG.JWT_SECRET);

export async function signToken(payload: { userId: string }): Promise<string> {
	return await new jose.SignJWT(payload).setProtectedHeader({ alg: 'HS256' }).setIssuedAt().setExpirationTime(CONFIG.JWT_EXPIRES_IN).sign(secret);
}

export async function verifyToken(token: string): Promise<{ userId: string } | null> {
	try {
		const { payload } = await jose.jwtVerify(token, secret);
		return payload as { userId: string };
	} catch (error) {
		return null;
	}
}
