import { z } from 'zod';
import { isSafeDestinationUrl } from '../utils/urlValidator';

const safeUrlSchema = z
  .string()
  .url('Please provide a valid URL')
  .superRefine((url, ctx) => {
    const check = isSafeDestinationUrl(url);
    if (!check.isValid) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: check.reason || 'URL violates security policy',
      });
    }
  });

export const createLinkSchema = z.object({
  destinationUrl: safeUrlSchema,
  title: z.string().max(100, 'Title cannot exceed 100 characters').optional(),
  customAlias: z
    .string()
    .min(3, 'Custom alias must be at least 3 characters')
    .max(30, 'Custom alias cannot exceed 30 characters')
    .regex(/^[a-zA-Z0-9_-]+$/, 'Custom alias can only contain letters, numbers, hyphens, and underscores')
    .optional(),
  expiresAt: z
    .string()
    .datetime({ message: 'Invalid ISO datetime string' })
    .refine((dateStr) => new Date(dateStr) > new Date(), 'Expiration date must be in the future')
    .optional(),
});

export const updateLinkSchema = z.object({
  destinationUrl: safeUrlSchema.optional(),
  title: z.string().max(100, 'Title cannot exceed 100 characters').optional().nullable(),
  isActive: z.boolean().optional(),
  expiresAt: z
    .string()
    .datetime({ message: 'Invalid ISO datetime string' })
    .refine((dateStr) => new Date(dateStr) > new Date(), 'Expiration date must be in the future')
    .optional()
    .nullable(),
});

export const linkQuerySchema = z.object({
  page: z
    .string()
    .optional()
    .default('1')
    .transform((val) => Math.max(1, parseInt(val, 10) || 1)),
  limit: z
    .string()
    .optional()
    .default('10')
    .transform((val) => Math.min(100, Math.max(1, parseInt(val, 10) || 10))),
  search: z.string().optional(),
});

export type CreateLinkInput = z.infer<typeof createLinkSchema>;
export type UpdateLinkInput = z.infer<typeof updateLinkSchema>;
export type LinkQueryInput = z.infer<typeof linkQuerySchema>;
