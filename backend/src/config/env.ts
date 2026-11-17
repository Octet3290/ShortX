import dotenv from 'dotenv';
import { z } from 'zod';

// Load variables from .env file into process.env
dotenv.config();

// Define the schema for environment variables using Zod
const envSchema = z.object({
  PORT: z.string().default('5000').transform((val) => parseInt(val, 10)),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  CLIENT_URL: z.string().default('http://localhost:3000'),
  DATABASE_URL: z.string().optional(),
  REDIS_URL: z.string().optional(),
  JWT_SECRET: z.string().default('super-secret-shortx-jwt-key-2026'),
  JWT_EXPIRES_IN: z.string().default('7d'),
});

// Parse and validate process.env against our schema
const parsedEnv = envSchema.safeParse(process.env);

if (!parsedEnv.success) {
  console.error('❌ Invalid environment variables configuration:');
  console.error(parsedEnv.error.format());
  process.exit(1); // Fail-fast: Stop the server immediately if config is broken
}

export const env = parsedEnv.data;
