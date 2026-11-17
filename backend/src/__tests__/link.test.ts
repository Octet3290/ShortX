import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import app from '../app';
import { prisma } from '../config/prisma';

describe('Links Management API (/api/links)', () => {
  let userTokenA: string;
  let userTokenB: string;
  let createdLinkId: string;
  const customAlias = `custom-${Date.now()}`;

  beforeAll(async () => {
    // Register User A
    const resA = await request(app).post('/api/auth/register').send({
      email: `user-a-${Date.now()}@example.com`,
      password: 'Password123!',
      name: 'User A',
    });
    userTokenA = resA.body.token;

    // Register User B
    const resB = await request(app).post('/api/auth/register').send({
      email: `user-b-${Date.now()}@example.com`,
      password: 'Password123!',
      name: 'User B',
    });
    userTokenB = resB.body.token;
  });

  afterAll(async () => {
    // Clean up test records
    await prisma.user.deleteMany({
      where: { email: { contains: 'user-' } },
    });
  });

  it('should reject link creation without authentication (401)', async () => {
    const res = await request(app)
      .post('/api/links')
      .send({ destinationUrl: 'https://example.com' });

    expect(res.status).toBe(401);
  });

  it('should reject invalid or malicious URL schemes (400)', async () => {
    const res = await request(app)
      .post('/api/links')
      .set('Authorization', `Bearer ${userTokenA}`)
      .send({ destinationUrl: 'javascript:alert(1)' });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('ValidationError');
  });

  it('should create a shortened URL with random Base62 short code (201)', async () => {
    const res = await request(app)
      .post('/api/links')
      .set('Authorization', `Bearer ${userTokenA}`)
      .send({
        destinationUrl: 'https://github.com/features/actions',
        title: 'GitHub Actions Documentation',
      });

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('link');
    expect(res.body.link.shortCode).toHaveLength(7);
    expect(res.body).toHaveProperty('shortUrl');
    expect(res.body.shortUrl).toContain(res.body.link.shortCode);

    createdLinkId = res.body.link.id;
  });

  it('should create a short URL with a custom alias (201)', async () => {
    const res = await request(app)
      .post('/api/links')
      .set('Authorization', `Bearer ${userTokenA}`)
      .send({
        destinationUrl: 'https://news.ycombinator.com',
        customAlias: customAlias,
      });

    expect(res.status).toBe(201);
    expect(res.body.link.shortCode).toBe(customAlias);
  });

  it('should reject duplicate custom alias with 409 Conflict', async () => {
    const res = await request(app)
      .post('/api/links')
      .set('Authorization', `Bearer ${userTokenB}`)
      .send({
        destinationUrl: 'https://other-site.com',
        customAlias: customAlias,
      });

    expect(res.status).toBe(409);
    expect(res.body.error).toBe('Conflict');
  });

  it('should list all links belonging to the user', async () => {
    const res = await request(app)
      .get('/api/links')
      .set('Authorization', `Bearer ${userTokenA}`);

    expect(res.status).toBe(200);
    expect(res.body.links).toBeInstanceOf(Array);
    expect(res.body.links.length).toBeGreaterThanOrEqual(2);
  });

  it('should get link details by ID', async () => {
    const res = await request(app)
      .get(`/api/links/${createdLinkId}`)
      .set('Authorization', `Bearer ${userTokenA}`);

    expect(res.status).toBe(200);
    expect(res.body.link.id).toBe(createdLinkId);
  });

  it('should enforce authorization: User B cannot access User A link (403)', async () => {
    const res = await request(app)
      .get(`/api/links/${createdLinkId}`)
      .set('Authorization', `Bearer ${userTokenB}`);

    expect(res.status).toBe(403);
    expect(res.body.error).toBe('Forbidden');
  });
});
