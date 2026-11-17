import rateLimit from 'express-rate-limit';
import { Request, Response } from 'express';

/**
 * Standard error response format for rate limit violations.
 */
const rateLimitHandler = (req: Request, res: Response) => {
  res.status(429).json({
    error: 'TooManyRequests',
    message: 'Too many requests from this IP address. Please try again later.',
    retryAfter: res.getHeader('Retry-After'),
  });
};

/**
 * 1. Authentication Rate Limiter
 * Guards /api/auth/login and /api/auth/register against brute-force & credential stuffing.
 * 10 requests per 15 minutes in production; relaxed in test mode unless specifically tested.
 */
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  limit: process.env.NODE_ENV === 'test' ? 100 : 10,
  standardHeaders: 'draft-7', // Sends RateLimit-* headers (RFC standard)
  legacyHeaders: false,
  handler: rateLimitHandler,
  skipSuccessfulRequests: false,
});

/**
 * 2. Link Creation Rate Limiter
 * Guards POST /api/links against automated URL spamming and database flooding.
 * 30 link creations per 1 minute per IP.
 */
export const linkCreationLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  limit: process.env.NODE_ENV === 'test' ? 150 : 30,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  handler: (req: Request, res: Response) => {
    res.status(429).json({
      error: 'TooManyRequests',
      message: 'You have reached the link creation rate limit. Please wait before creating more links.',
      retryAfter: res.getHeader('Retry-After'),
    });
  },
});

/**
 * 3. General API Limiter
 * Applied globally to /api/* routes.
 * 200 requests per 15 minutes per IP.
 */
export const globalApiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  limit: process.env.NODE_ENV === 'test' ? 1000 : 200,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  handler: rateLimitHandler,
});

/**
 * 4. Dedicated Strict Limiter (for Testing & Sensitive Actions)
 * Window: 60 seconds, limit: 3 requests.
 * Used for automated verification of 429 HTTP status, Retry-After header, and headers format.
 */
export const strictSecurityLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 3,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  handler: rateLimitHandler,
});
