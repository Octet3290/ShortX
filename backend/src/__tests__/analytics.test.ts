import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import app from '../app';
import { prisma } from '../config/prisma';

describe('Click Analytics & Dashboard Metrics (Milestone 5)', () => {
  let userTokenA: string;
  let userTokenB: string;
  let linkIdA: string;
  let shortCodeA: string;

  beforeAll(async () => {
    // 1. Register User A
    const resA = await request(app).post('/api/auth/register').send({
      email: `analytics-a-${Date.now()}@example.com`,
      password: 'Password123!',
      name: 'Analytics User A',
    });
    userTokenA = resA.body.token;

    // 2. Register User B
    const resB = await request(app).post('/api/auth/register').send({
      email: `analytics-b-${Date.now()}@example.com`,
      password: 'Password123!',
      name: 'Analytics User B',
    });
    userTokenB = resB.body.token;

    // 3. Create a link for User A
    const linkRes = await request(app)
      .post('/api/links')
      .set('Authorization', `Bearer ${userTokenA}`)
      .send({
        destinationUrl: 'https://news.ycombinator.com',
        title: 'Hacker News Link',
      });
    linkIdA = linkRes.body.link.id;
    shortCodeA = linkRes.body.link.shortCode;

    // 4. Emulate a Mobile iOS Safari visit via Twitter referer
    await request(app)
      .get(`/${shortCodeA}`)
      .set(
        'User-Agent',
        'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'
      )
      .set('Referer', 'https://t.co/status/123');

    // 5. Emulate a Desktop Windows Chrome visit via Google referer
    await request(app)
      .get(`/${shortCodeA}`)
      .set(
        'User-Agent',
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      )
      .set('Referer', 'https://www.google.com/search?q=hn');
  });

  afterAll(async () => {
    await prisma.user.deleteMany({
      where: { email: { contains: 'analytics-' } },
    });
  });

  it('should calculate aggregated portfolio dashboard metrics (GET /api/analytics/dashboard)', async () => {
    const res = await request(app)
      .get('/api/analytics/dashboard')
      .set('Authorization', `Bearer ${userTokenA}`);

    expect(res.status).toBe(200);
    const { metrics } = res.body;

    expect(metrics.totalLinks).toBe(1);
    expect(metrics.totalClicks).toBe(2);

    // Verify Device breakdown
    const mobileDevice = metrics.devices.find((d: any) => d.name === 'Mobile');
    const desktopDevice = metrics.devices.find((d: any) => d.name === 'Desktop');
    expect(mobileDevice?.count).toBe(1);
    expect(desktopDevice?.count).toBe(1);

    // Verify Browser breakdown
    const safariBrowser = metrics.browsers.find((b: any) => b.name === 'Safari');
    const chromeBrowser = metrics.browsers.find((b: any) => b.name === 'Chrome');
    expect(safariBrowser?.count).toBe(1);
    expect(chromeBrowser?.count).toBe(1);

    // Verify Referrers
    const twitterReferrer = metrics.referrers.find((r: any) => r.name === 't.co');
    const googleReferrer = metrics.referrers.find((r: any) => r.name === 'google.com');
    expect(twitterReferrer?.count).toBe(1);
    expect(googleReferrer?.count).toBe(1);

    // Verify timeseries
    expect(metrics.recentClicks).toBeInstanceOf(Array);
    expect(metrics.recentClicks.length).toBe(7);
  });

  it('should fetch link-specific analytics (GET /api/analytics/links/:id)', async () => {
    const res = await request(app)
      .get(`/api/analytics/links/${linkIdA}`)
      .set('Authorization', `Bearer ${userTokenA}`);

    expect(res.status).toBe(200);
    const { analytics } = res.body;

    expect(analytics.link.id).toBe(linkIdA);
    expect(analytics.devices).toHaveLength(2);
    expect(analytics.browsers).toHaveLength(2);
  });

  it('should forbid User B from accessing User A link analytics (403 Forbidden)', async () => {
    const res = await request(app)
      .get(`/api/analytics/links/${linkIdA}`)
      .set('Authorization', `Bearer ${userTokenB}`);

    expect(res.status).toBe(403);
    expect(res.body.error).toBe('Forbidden');
  });
});
