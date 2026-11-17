import { Request, Response } from 'express';
import { prisma } from '../config/prisma';
import { getCachedLink, setCachedLink, CachedLink } from '../cache/link.cache';
import { analyticsQueue } from '../jobs/analytics.queue';

/**
 * Handles high-speed redirection using the Redis Cache-Aside pattern.
 * Sub-millisecond lookup from RAM if cached, with graceful fallback to PostgreSQL.
 * Endpoint: GET /:shortCode
 */
export const handleRedirect = async (req: Request, res: Response) => {
  const { shortCode } = req.params;

  try {
    // 1. Check Redis Cache first (Cache-Aside pattern)
    let link: CachedLink | null = await getCachedLink(shortCode);

    // 2. Cache Miss: Query PostgreSQL and populate cache
    if (!link) {
      const dbLink = await prisma.link.findUnique({
        where: { shortCode },
      });

      if (!dbLink) {
        return res.status(404).json({
          error: 'NotFound',
          message: 'The requested short URL does not exist',
        });
      }

      link = {
        id: dbLink.id,
        destinationUrl: dbLink.destinationUrl,
        isActive: dbLink.isActive,
        expiresAt: dbLink.expiresAt ? dbLink.expiresAt.toISOString() : null,
      };

      // Populate cache for future requests (TTL: 24h)
      await setCachedLink(shortCode, link);
    }

    // 3. Case: Deactivated link
    if (!link.isActive) {
      return res.status(404).json({
        error: 'NotFound',
        message: 'This short link has been disabled by its owner',
      });
    }

    // 4. Case: Expired link
    if (link.expiresAt && new Date(link.expiresAt) < new Date()) {
      return res.status(410).json({
        error: 'Gone',
        message: 'This short link has expired and is no longer available',
      });
    }

    // 5. Non-blocking asynchronous event dispatch (Hot path: < 0.1ms!)
    analyticsQueue.enqueue({
      linkId: link.id,
      userAgent: req.headers['user-agent'],
      referer: req.headers['referer'] as string,
    });

    // 6. Set anti-browser-caching headers
    res.set({
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      Pragma: 'no-cache',
      Expires: '0',
    });

    // 7. Perform HTTP 302 Found redirect
    return res.redirect(302, link.destinationUrl);
  } catch (error) {
    console.error('Redirect error:', error);
    res.status(500).json({ error: 'InternalServerError', message: 'Failed to process redirect' });
  }
};
