import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import app from '../app';
import { prisma } from '../config/prisma';

describe('Link Management Lifecycle (Milestone 3)', () => {
  let userTokenA: string;
  let userTokenB: string;
  let linkId: string;
  let shortCode: string;

  beforeAll(async () => {
    // 1. Create User A
    const resA = await request(app).post('/api/auth/register').send({
      email: `mgr-a-${Date.now()}@example.com`,
      password: 'Password123!',
      name: 'Manager A',
    });
    userTokenA = resA.body.token;

    // 2. Create User B
    const resB = await request(app).post('/api/auth/register').send({
      email: `mgr-b-${Date.now()}@example.com`,
      password: 'Password123!',
      name: 'Manager B',
    });
    userTokenB = resB.body.token;

    // 3. Create 5 links for User A to test pagination & search
    for (let i = 1; i <= 5; i++) {
      const res = await request(app)
        .post('/api/links')
        .set('Authorization', `Bearer ${userTokenA}`)
        .send({
          destinationUrl: `https://example${i}.com`,
          title: i === 3 ? 'Target Special Link' : `Link Number ${i}`,
        });

      if (i === 1) {
        linkId = res.body.link.id;
        shortCode = res.body.link.shortCode;
      }
    }
  });

  afterAll(async () => {
    await prisma.user.deleteMany({
      where: { email: { contains: 'mgr-' } },
    });
  });

  it('should support pagination (page=1, limit=2)', async () => {
    const res = await request(app)
      .get('/api/links?page=1&limit=2')
      .set('Authorization', `Bearer ${userTokenA}`);

    expect(res.status).toBe(200);
    expect(res.body.links).toHaveLength(2);
    expect(res.body.pagination).toEqual({
      page: 1,
      limit: 2,
      totalCount: 5,
      totalPages: 3,
      hasNextPage: true,
      hasPrevPage: false,
    });
  });

  it('should support search filtering (?search=Special)', async () => {
    const res = await request(app)
      .get('/api/links?search=Special')
      .set('Authorization', `Bearer ${userTokenA}`);

    expect(res.status).toBe(200);
    expect(res.body.links).toHaveLength(1);
    expect(res.body.links[0].title).toBe('Target Special Link');
  });

  it('should update link destination URL and title (PATCH /api/links/:id)', async () => {
    const res = await request(app)
      .patch(`/api/links/${linkId}`)
      .set('Authorization', `Bearer ${userTokenA}`)
      .send({
        destinationUrl: 'https://updated-destination.com',
        title: 'Updated Title',
      });

    expect(res.status).toBe(200);
    expect(res.body.link.destinationUrl).toBe('https://updated-destination.com');
    expect(res.body.link.title).toBe('Updated Title');
  });

  it('should deactivate link and verify redirect returns 404', async () => {
    // 1. Deactivate
    const res = await request(app)
      .patch(`/api/links/${linkId}`)
      .set('Authorization', `Bearer ${userTokenA}`)
      .send({ isActive: false });

    expect(res.status).toBe(200);
    expect(res.body.link.isActive).toBe(false);

    // 2. Verify redirect endpoint reflects deactivation
    const redirRes = await request(app).get(`/${shortCode}`);
    expect(redirRes.status).toBe(404);
  });

  it('should reactivate link and verify redirect works', async () => {
    // 1. Reactivate
    const res = await request(app)
      .patch(`/api/links/${linkId}`)
      .set('Authorization', `Bearer ${userTokenA}`)
      .send({ isActive: true });

    expect(res.status).toBe(200);
    expect(res.body.link.isActive).toBe(true);

    // 2. Verify redirect succeeds
    const redirRes = await request(app).get(`/${shortCode}`);
    expect(redirRes.status).toBe(302);
    expect(redirRes.header.location).toBe('https://updated-destination.com');
  });

  it('should reject unauthorized edits by User B (403 Forbidden)', async () => {
    const res = await request(app)
      .patch(`/api/links/${linkId}`)
      .set('Authorization', `Bearer ${userTokenB}`)
      .send({ title: 'Hacked Title' });

    expect(res.status).toBe(403);
    expect(res.body.error).toBe('Forbidden');
  });

  it('should reject unauthorized deletion by User B (403 Forbidden)', async () => {
    const res = await request(app)
      .delete(`/api/links/${linkId}`)
      .set('Authorization', `Bearer ${userTokenB}`);

    expect(res.status).toBe(403);
    expect(res.body.error).toBe('Forbidden');
  });

  it('should delete link successfully by owner (DELETE /api/links/:id)', async () => {
    const res = await request(app)
      .delete(`/api/links/${linkId}`)
      .set('Authorization', `Bearer ${userTokenA}`);

    expect(res.status).toBe(200);
    expect(res.body.message).toBe('Link deleted successfully');

    // Verify subsequent lookup returns 404
    const getRes = await request(app)
      .get(`/api/links/${linkId}`)
      .set('Authorization', `Bearer ${userTokenA}`);
    expect(getRes.status).toBe(404);
  });
});
