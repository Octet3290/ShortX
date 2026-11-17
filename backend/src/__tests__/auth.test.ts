import { describe, it, expect, afterAll } from 'vitest';
import request from 'supertest';
import app from '../app';
import { prisma } from '../config/prisma';

describe('Authentication API (/api/auth)', () => {
  const testEmail = `test-auth-${Date.now()}@example.com`;
  const testPassword = 'Password123!';
  let authToken: string;

  afterAll(async () => {
    // Clean up test user created during tests
    await prisma.user.deleteMany({
      where: { email: { startsWith: 'test-auth-' } },
    });
  });

  it('should register a new user successfully', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({
        email: testEmail,
        password: testPassword,
        name: 'ShortX Tester',
      });

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('token');
    expect(res.body).toHaveProperty('user');
    expect(res.body.user.email).toBe(testEmail.toLowerCase());
    expect(res.body.user).not.toHaveProperty('passwordHash'); // Critical: Never leak hashes!

    authToken = res.body.token;
  });

  it('should reject registration with duplicate email (409 Conflict)', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({
        email: testEmail,
        password: testPassword,
      });

    expect(res.status).toBe(409);
    expect(res.body.error).toBe('Conflict');
  });

  it('should reject registration with invalid input (400 ValidationError)', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({
        email: 'invalid-email',
        password: '123', // Less than 6 characters
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('ValidationError');
    expect(res.body.issues).toBeInstanceOf(Array);
  });

  it('should login successfully with valid credentials', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({
        email: testEmail,
        password: testPassword,
      });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('token');
    expect(res.body.user.email).toBe(testEmail.toLowerCase());
  });

  it('should reject login with wrong password (401 Unauthorized)', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({
        email: testEmail,
        password: 'WrongPassword999!',
      });

    expect(res.status).toBe(401);
    expect(res.body.error).toBe('Unauthorized');
  });

  it('should fetch authenticated user profile (/api/auth/me)', async () => {
    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe(testEmail.toLowerCase());
  });

  it('should reject /api/auth/me without authorization header (401)', async () => {
    const res = await request(app).get('/api/auth/me');

    expect(res.status).toBe(401);
    expect(res.body.error).toBe('Unauthorized');
  });
});
