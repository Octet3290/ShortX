import { Request, Response } from 'express';
import { prisma } from '../config/prisma';

/**
 * Handles the health-check endpoint.
 * Returns operational status, database connectivity, server time, and uptime.
 */
export const getHealth = async (req: Request, res: Response) => {
  let dbStatus = 'disconnected';

  try {
    // Quick, lightweight query to check if PostgreSQL connection is live
    await prisma.$queryRaw`SELECT 1`;
    dbStatus = 'connected';
  } catch {
    // Graceful degradation: The API stays alive even if the database is temporarily unreachable
    dbStatus = 'unreachable';
  }

  res.status(200).json({
    status: 'ok',
    service: 'shortx-backend',
    database: dbStatus,
    timestamp: new Date().toISOString(),
    uptime: Math.floor(process.uptime()),
  });
};
