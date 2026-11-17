import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../app';

describe('GET /health', () => {
  it('should return 200 OK with service status', async () => {
    const res = await request(app).get('/health');

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('status', 'ok');
    expect(res.body).toHaveProperty('service', 'shortx-backend');
    expect(res.body).toHaveProperty('database');
    expect(res.body).toHaveProperty('timestamp');
    expect(res.body).toHaveProperty('uptime');
  });

  it('should return 404 for unknown routes', async () => {
    const res = await request(app).get('/non-existent-route');

    expect(res.status).toBe(404);
    expect(res.body).toHaveProperty('error', 'NotFound');
  });
});
