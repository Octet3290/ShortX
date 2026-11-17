import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import app from '../app';
import { prisma } from '../config/prisma';
import { getCachedLink, invalidateCachedLink } from '../cache/link.cache';
import { cache } from '../cache/redis';

describe('Redis In-Memory Caching (Milestone 4)', () => {
  let userToken: string;
  let testUserId: string;
  let linkId: string;
  let shortCode: string;

  beforeAll(async () => {
    // 1. Register test user
    const userRes = await request(app).post('/api/auth/register').send({
      email: `cache-tester-${Date.now()}@example.com`,
      password: 'Password123!',
      name: 'Cache Tester',
    });
    userToken = userRes.body.token;
    testUserId = userRes.body.user.id;

    // 2. Create a test link
    const linkRes = await request(app)
      .post('/api/links')
      .set('Authorization', `Bearer ${userToken}`)
      .send({
        destinationUrl: 'https://initial-site.com',
        title: 'Cache Test Link',
      });

    linkId = linkRes.body.link.id;
    shortCode = linkRes.body.link.shortCode;
  });

  afterAll(async () => {
    await invalidateCachedLink(shortCode);
    await cache.flushAll();
    await prisma.user.delete({
      where: { id: testUserId },
    });
  });

  it('should experience a Cache Miss on first redirect and populate the cache', async () => {
    // Ensure cache is empty before first request
    await invalidateCachedLink(shortCode);
    const beforeCache = await getCachedLink(shortCode);
    expect(beforeCache).toBeNull();

    // Perform first redirect (Cache Miss -> DB Read -> Cache Write)
    const res = await request(app).get(`/${shortCode}`);
    expect(res.status).toBe(302);
    expect(res.header.location).toBe('https://initial-site.com');

    // Verify cache is now populated!
    const afterCache = await getCachedLink(shortCode);
    expect(afterCache).not.toBeNull();
    expect(afterCache?.destinationUrl).toBe('https://initial-site.com');
    expect(afterCache?.isActive).toBe(true);
  });

  it('should serve subsequent requests as a Cache Hit from memory', async () => {
    // The key is already cached from previous test
    const cached = await getCachedLink(shortCode);
    expect(cached).not.toBeNull();

    const res = await request(app).get(`/${shortCode}`);
    expect(res.status).toBe(302);
    expect(res.header.location).toBe('https://initial-site.com');
  });

  it('should invalidate cache when the link destination is updated', async () => {
    // 1. Update destination to a new URL
    const updateRes = await request(app)
      .patch(`/api/links/${linkId}`)
      .set('Authorization', `Bearer ${userToken}`)
      .send({ destinationUrl: 'https://updated-fresh-site.com' });

    expect(updateRes.status).toBe(200);

    // 2. Verify old cache entry was invalidated (deleted) immediately
    const intermediateCache = await getCachedLink(shortCode);
    expect(intermediateCache).toBeNull();

    // 3. Next redirect must fetch fresh destination and redirect to updated URL
    const res = await request(app).get(`/${shortCode}`);
    expect(res.status).toBe(302);
    expect(res.header.location).toBe('https://updated-fresh-site.com');

    // 4. Verify cache is repopulated with the updated URL
    const repopulatedCache = await getCachedLink(shortCode);
    expect(repopulatedCache?.destinationUrl).toBe('https://updated-fresh-site.com');
  });

  it('should invalidate cache when the link is deleted', async () => {
    // 1. Delete link
    const delRes = await request(app)
      .delete(`/api/links/${linkId}`)
      .set('Authorization', `Bearer ${userToken}`);

    expect(delRes.status).toBe(200);

    // 2. Verify cache is wiped
    const cached = await getCachedLink(shortCode);
    expect(cached).toBeNull();

    // 3. Subsequent redirect returns 404
    const res = await request(app).get(`/${shortCode}`);
    expect(res.status).toBe(404);
  });
});
