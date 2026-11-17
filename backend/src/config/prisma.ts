import { PrismaClient } from '@prisma/client';
import { env } from './env';

/**
 * Singleton pattern for PrismaClient.
 * In development with hot-reloading (tsx watch), this prevents creating
 * a new database connection pool on every file change.
 */
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  });

if (env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

export default prisma;
