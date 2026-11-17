import { Request, Response } from 'express';
import { Prisma } from '@prisma/client';
import { prisma } from '../config/prisma';
import { generateShortCode } from '../utils/base62';
import { createLinkSchema, updateLinkSchema, linkQuerySchema } from '../validation/link.validation';
import { invalidateCachedLink } from '../cache/link.cache';

const MAX_COLLISION_RETRIES = 5;

/**
 * Creates a new shortened URL with collision avoidance retry.
 */
export const createLink = async (req: Request, res: Response) => {
  const parseResult = createLinkSchema.safeParse(req.body);

  if (!parseResult.success) {
    return res.status(400).json({
      error: 'ValidationError',
      issues: parseResult.error.errors.map((e) => ({
        field: e.path.join('.'),
        message: e.message,
      })),
    });
  }

  const { destinationUrl, title, customAlias, expiresAt } = parseResult.data;
  const userId = req.user!.userId;

  try {
    // 1. If user specified a custom alias
    if (customAlias) {
      const existing = await prisma.link.findUnique({
        where: { shortCode: customAlias },
      });

      if (existing) {
        return res.status(409).json({
          error: 'Conflict',
          message: 'This custom alias is already in use. Please choose another.',
        });
      }

      const link = await prisma.link.create({
        data: {
          destinationUrl,
          shortCode: customAlias,
          title: title || null,
          expiresAt: expiresAt ? new Date(expiresAt) : null,
          userId,
        },
      });

      return res.status(201).json({
        message: 'Link created successfully',
        link,
        shortUrl: `${req.protocol}://${req.get('host')}/${link.shortCode}`,
      });
    }

    // 2. Otherwise generate random Base62 code with collision retry loop
    let attempts = 0;
    while (attempts < MAX_COLLISION_RETRIES) {
      attempts++;
      const shortCode = generateShortCode(7);

      try {
        const link = await prisma.link.create({
          data: {
            destinationUrl,
            shortCode,
            title: title || null,
            expiresAt: expiresAt ? new Date(expiresAt) : null,
            userId,
          },
        });

        return res.status(201).json({
          message: 'Link created successfully',
          link,
          shortUrl: `${req.protocol}://${req.get('host')}/${link.shortCode}`,
        });
      } catch (err) {
        // P2002 is Prisma's error code for Unique Constraint Violation
        if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
          console.warn(`Collision detected for code ${shortCode}. Retrying (attempt ${attempts}/${MAX_COLLISION_RETRIES})...`);
          continue;
        }
        throw err;
      }
    }

    return res.status(500).json({
      error: 'InternalServerError',
      message: 'Failed to generate a unique short code after multiple attempts. Please try again.',
    });
  } catch (error) {
    console.error('CreateLink error:', error);
    res.status(500).json({ error: 'InternalServerError', message: 'Failed to create short link' });
  }
};

/**
 * Returns paginated links owned by the user, with optional search filtering.
 */
export const getUserLinks = async (req: Request, res: Response) => {
  const queryResult = linkQuerySchema.safeParse(req.query);

  if (!queryResult.success) {
    return res.status(400).json({
      error: 'ValidationError',
      issues: queryResult.error.errors.map((e) => ({
        field: e.path.join('.'),
        message: e.message,
      })),
    });
  }

  const { page, limit, search } = queryResult.data;
  const userId = req.user!.userId;

  try {
    const where: Prisma.LinkWhereInput = {
      userId,
    };

    if (search) {
      where.OR = [
        { shortCode: { contains: search, mode: 'insensitive' } },
        { destinationUrl: { contains: search, mode: 'insensitive' } },
        { title: { contains: search, mode: 'insensitive' } },
      ];
    }

    // Run count and query in parallel using Promise.all for high performance
    const [totalCount, links] = await Promise.all([
      prisma.link.count({ where }),
      prisma.link.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true,
          shortCode: true,
          destinationUrl: true,
          title: true,
          isActive: true,
          expiresAt: true,
          clicksCount: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
    ]);

    const totalPages = Math.ceil(totalCount / limit);

    res.status(200).json({
      links,
      pagination: {
        page,
        limit,
        totalCount,
        totalPages,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      },
    });
  } catch (error) {
    console.error('GetUserLinks error:', error);
    res.status(500).json({ error: 'InternalServerError', message: 'Failed to fetch links' });
  }
};

/**
 * Returns details of a specific link owned by the user.
 */
export const getLinkById = async (req: Request, res: Response) => {
  const { id } = req.params;

  try {
    const link = await prisma.link.findUnique({
      where: { id },
    });

    if (!link) {
      return res.status(404).json({ error: 'NotFound', message: 'Link not found' });
    }

    // Strict Authorization check
    if (link.userId !== req.user!.userId) {
      return res.status(403).json({ error: 'Forbidden', message: 'You do not have permission to view this link' });
    }

    res.status(200).json({ link });
  } catch (error) {
    console.error('GetLinkById error:', error);
    res.status(500).json({ error: 'InternalServerError', message: 'Failed to fetch link details' });
  }
};

/**
 * Updates an existing link (destinationUrl, title, isActive, expiresAt).
 */
export const updateLink = async (req: Request, res: Response) => {
  const { id } = req.params;
  const parseResult = updateLinkSchema.safeParse(req.body);

  if (!parseResult.success) {
    return res.status(400).json({
      error: 'ValidationError',
      issues: parseResult.error.errors.map((e) => ({
        field: e.path.join('.'),
        message: e.message,
      })),
    });
  }

  const { destinationUrl, title, isActive, expiresAt } = parseResult.data;

  try {
    const existing = await prisma.link.findUnique({
      where: { id },
    });

    if (!existing) {
      return res.status(404).json({ error: 'NotFound', message: 'Link not found' });
    }

    // Ownership check
    if (existing.userId !== req.user!.userId) {
      return res.status(403).json({ error: 'Forbidden', message: 'You do not have permission to update this link' });
    }

    const updated = await prisma.link.update({
      where: { id },
      data: {
        ...(destinationUrl !== undefined && { destinationUrl }),
        ...(title !== undefined && { title }),
        ...(isActive !== undefined && { isActive }),
        ...(expiresAt !== undefined && { expiresAt: expiresAt ? new Date(expiresAt) : null }),
      },
    });

    // Invalidate cache immediately to prevent stale destination lookups
    await invalidateCachedLink(existing.shortCode);

    res.status(200).json({
      message: 'Link updated successfully',
      link: updated,
    });
  } catch (error) {
    console.error('UpdateLink error:', error);
    res.status(500).json({ error: 'InternalServerError', message: 'Failed to update link' });
  }
};

/**
 * Deletes a link and cascades deletion to associated click events.
 */
export const deleteLink = async (req: Request, res: Response) => {
  const { id } = req.params;

  try {
    const existing = await prisma.link.findUnique({
      where: { id },
    });

    if (!existing) {
      return res.status(404).json({ error: 'NotFound', message: 'Link not found' });
    }

    // Ownership check
    if (existing.userId !== req.user!.userId) {
      return res.status(403).json({ error: 'Forbidden', message: 'You do not have permission to delete this link' });
    }

    await prisma.link.delete({
      where: { id },
    });

    // Invalidate cache immediately
    await invalidateCachedLink(existing.shortCode);

    res.status(200).json({ message: 'Link deleted successfully' });
  } catch (error) {
    console.error('DeleteLink error:', error);
    res.status(500).json({ error: 'InternalServerError', message: 'Failed to delete link' });
  }
};
