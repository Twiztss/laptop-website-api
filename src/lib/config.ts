import { config } from 'dotenv';

config();

const validateExpiresIn = (value: string) => {
	const regex = /^(\d+)\s*(s|m|h|d|w|y|ms)$/;
	if (!regex.test(value)) {
		throw new Error(`Invalid JWT_EXPIRES_IN format: "${value}". Expected format like "2h", "7d", etc.`);
	}
};

const getEnv = (name: string, validate?: (val: string) => void): string => {
	const value = process.env[name];
	if (!value) {
		console.error('Available env keys:', Object.keys(process.env));
		throw new Error(`Environment variable ${name} is required but missing.`);
	}

	if (validate) {
		validate(value);
	}

	return value;
};

const parseNumber = (val: string | undefined, defaultVal: number): number => {
	if (val === undefined || val === '') return defaultVal;
	const parsed = Number(val);
	return isNaN(parsed) ? defaultVal : parsed;
};

export const CONFIG = {
	JWT_SECRET: getEnv('JWT_SECRET'),
	JWT_EXPIRES_IN: getEnv('JWT_EXPIRES_IN', validateExpiresIn),
	RATE_LIMIT: parseNumber(process.env.RATE_LIMIT, 50),
	RATE_LIMIT_DURATION: parseNumber(process.env.RATE_LIMIT_DURATION, 60000),
};
