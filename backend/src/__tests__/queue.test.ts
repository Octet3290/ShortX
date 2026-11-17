import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import app from '../app';
import { prisma } from '../config/prisma';
import { analyticsQueue } from '../jobs/analytics.queue';

describe('Asynchronous Job Queue & Workers (Milestone 6)', () => {
  let userToken: string;
  let testUserId: string;
  let linkId: string;
  let shortCode: string;

  beforeAll(async () => {
    // 1. Create a user
    const userRes = await request(app).post('/api/auth/register').send({
      email: `queue-tester-${Date.now()}@example.com`,
      password: 'Password123!',
      name: 'Queue Tester',
    });
    userToken = userRes.body.token;
    testUserId = userRes.body.user.id;

    // 2. Create a link
    const linkRes = await request(app)
      .post('/api/links')
      .set('Authorization', `Bearer ${userToken}`)
      .send({
        destinationUrl: 'https://async-worker-test.com',
        title: 'Queue Test Link',
      });
    linkId = linkRes.body.link.id;
    shortCode = linkRes.body.link.shortCode;
  });

  afterAll(async () => {
    await prisma.user.delete({
      where: { id: testUserId },
    });
  });

  it('should process click jobs asynchronously in the background', async () => {
    const initialLink = await prisma.link.findUnique({ where: { id: linkId } });
    expect(initialLink?.clicksCount).toBe(0);

    // Enqueue a job via the queue producer
    analyticsQueue.enqueue({
      linkId,
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Mobile/15E148 Safari/604.1',
      referer: 'https://twitter.com/test',
    });

    // Wait for the background worker to drain the queue
    await analyticsQueue.waitForDrain();

    // Verify click counter was incremented in PostgreSQL
    const updatedLink = await prisma.link.findUnique({ where: { id: linkId } });
    expect(updatedLink?.clicksCount).toBe(1);

    // Verify raw ClickEvent was persisted
    const event = await prisma.clickEvent.findFirst({ where: { linkId } });
    expect(event).not.toBeNull();
    expect(event?.browser).toBe('Safari');
    expect(event?.os).toBe('iOS');
    expect(event?.deviceType).toBe('Mobile');
    expect(event?.referer).toBe('twitter.com');
  });

  it('should enforce idempotency by discarding duplicate jobs', async () => {
    const linkBefore = await prisma.link.findUnique({ where: { id: linkId } });
    const currentClicks = linkBefore?.clicksCount || 0;

    // Simulate sending the exact same job twice
    const jobId = analyticsQueue.enqueue({
      linkId,
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0',
    });

    await analyticsQueue.waitForDrain();

    // The counter incremented by 1
    const linkAfterFirst = await prisma.link.findUnique({ where: { id: linkId } });
    expect(linkAfterFirst?.clicksCount).toBe(currentClicks + 1);
  });

  it('should execute non-blocking redirects and update analytics eventually', async () => {
    const linkBefore = await prisma.link.findUnique({ where: { id: linkId } });
    const beforeClicks = linkBefore?.clicksCount || 0;

    // Trigger redirect: Returns 302 Found without blocking on DB write!
    const res = await request(app).get(`/${shortCode}`);
    expect(res.status).toBe(302);
    expect(res.header.location).toBe('https://async-worker-test.com');

    // Wait for worker to drain
    await analyticsQueue.waitForDrain();

    // Verify eventual consistency: counter updated in PostgreSQL
    const linkAfter = await prisma.link.findUnique({ where: { id: linkId } });
    expect(linkAfter?.clicksCount).toBe(beforeClicks + 1);
  });
});
