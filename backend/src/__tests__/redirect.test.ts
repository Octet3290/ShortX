import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import app from '../app';
import { prisma } from '../config/prisma';

describe('Redirect Service (GET /:shortCode)', () => {
  let activeCode: string;
  let inactiveCode: string;
  let expiredCode: string;
  let testUserId: string;

  beforeAll(async () => {
    // 1. Create a test user
    const user = await prisma.user.create({
      data: {
        email: `redir-test-${Date.now()}@example.com`,
        passwordHash: 'hash',
        name: 'Redirect Tester',
      },
    });
    testUserId = user.id;

    // 2. Create an active link
    activeCode = `act${Date.now().toString().slice(-4)}`;
    await prisma.link.create({
      data: {
        shortCode: activeCode,
        destinationUrl: 'https://news.ycombinator.com',
        userId: testUserId,
        isActive: true,
        clicksCount: 0,
      },
    });

    // 3. Create an inactive/disabled link
    inactiveCode = `ina${Date.now().toString().slice(-4)}`;
    await prisma.link.create({
      data: {
        shortCode: inactiveCode,
        destinationUrl: 'https://example.com/disabled',
        userId: testUserId,
        isActive: false,
      },
    });

    // 4. Create an expired link (1 day in the past)
    expiredCode = `exp${Date.now().toString().slice(-4)}`;
    const pastDate = new Date(Date.now() - 24 * 60 * 60 * 1000);
    await prisma.link.create({
      data: {
        shortCode: expiredCode,
        destinationUrl: 'https://example.com/expired',
        userId: testUserId,
        isActive: true,
        expiresAt: pastDate,
      },
    });
  });

  afterAll(async () => {
    // Clean up test user and cascading links
    await prisma.user.delete({
      where: { id: testUserId },
    });
  });

  it('should return 404 for a non-existent short code', async () => {
    const res = await request(app).get('/nonExistentCode999');

    expect(res.status).toBe(404);
    expect(res.body.error).toBe('NotFound');
  });

  it('should return 302 redirect with Location header and increment clicks for an active link', async () => {
    const res = await request(app).get(`/${activeCode}`);

    expect(res.status).toBe(302);
    expect(res.header.location).toBe('https://news.ycombinator.com');
    expect(res.header['cache-control']).toContain('no-cache');

    // Verify click count was incremented in PostgreSQL
    const updated = await prisma.link.findUnique({
      where: { shortCode: activeCode },
    });
    expect(updated?.clicksCount).toBe(1);
  });

  it('should return 404 for a deactivated link', async () => {
    const res = await request(app).get(`/${inactiveCode}`);

    expect(res.status).toBe(404);
    expect(res.body.error).toBe('NotFound');
    expect(res.body.message).toContain('disabled');
  });

  it('should return 410 Gone for an expired link', async () => {
    const res = await request(app).get(`/${expiredCode}`);

    expect(res.status).toBe(410);
    expect(res.body.error).toBe('Gone');
    expect(res.body.message).toContain('expired');
  });
});
