import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import app from '../app';
import { prisma } from '../config/prisma';
import { signToken } from '../utils/jwt';
import { hashPassword } from '../utils/password';

describe('Security, SSRF & Rate Limiting (Milestone 8)', () => {
  let authToken: string;
  let testUserId: string;

  beforeAll(async () => {
    const email = `sec-${Date.now()}@shortx.io`;
    const user = await prisma.user.create({
      data: {
        email,
        name: 'Security Tester',
        passwordHash: await hashPassword('SecurePass123!'),
      },
    });
    testUserId = user.id;
    authToken = signToken({ userId: user.id, email: user.email });
  });

  afterAll(async () => {
    if (testUserId) {
      await prisma.user.delete({ where: { id: testUserId } }).catch(() => {});
    }
  });

  describe('SSRF Protection (Server-Side Request Forgery Prevention)', () => {
    const maliciousUrls = [
      { url: 'http://localhost:3000', label: 'Localhost port 3000' },
      { url: 'http://127.0.0.1:8080/admin', label: 'IPv4 Loopback 127.0.0.1' },
      { url: 'http://127.0.1.5', label: 'Arbitrary 127.x.x.x loopback' },
      { url: 'http://169.254.169.254/latest/meta-data', label: 'AWS/Cloud Metadata Endpoint' },
      { url: 'http://metadata.google.internal/computeMetadata/v1/', label: 'GCP Metadata Hostname' },
      { url: 'http://192.168.1.1/router-login', label: 'RFC 1918 Private Subnet (192.168.x.x)' },
      { url: 'http://10.0.0.5/internal-api', label: 'RFC 1918 Private Subnet (10.x.x.x)' },
      { url: 'http://172.20.0.1:5432', label: 'RFC 1918 Private Subnet (172.16-31.x.x)' },
      { url: 'http://0x7f000001/evil', label: 'Obfuscated Hex IP (evaluates to 127.0.0.1)' },
      { url: 'http://2130706433', label: 'Obfuscated Decimal IP (evaluates to 127.0.0.1)' },
      { url: 'javascript:alert(document.cookie)', label: 'JavaScript URI Scheme' },
      { url: 'data:text/html,<script>alert(1)</script>', label: 'Data URI Scheme' },
      { url: 'file:///etc/passwd', label: 'File URI Scheme' },
    ];

    maliciousUrls.forEach(({ url, label }) => {
      it(`should reject malicious URL: ${label}`, async () => {
        const res = await request(app)
          .post('/api/links')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            destinationUrl: url,
            title: `Malicious Test: ${label}`,
          });

        expect(res.status).toBe(400);
        expect(res.body.error).toBe('ValidationError');
        const issueMessages = JSON.stringify(res.body.issues);
        expect(
          issueMessages.includes('SSRF Protection') ||
          issueMessages.includes('Only http: and https: are permitted') ||
          issueMessages.includes('Please provide a valid URL')
        ).toBe(true);
      });
    });

    it('should allow legitimate public URLs', async () => {
      const legitimateUrl = 'https://github.com/nodejs/node/releases';

      const res = await request(app)
        .post('/api/links')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          destinationUrl: legitimateUrl,
          title: 'Legitimate Node.js Link',
        });

      expect(res.status).toBe(201);
      expect(res.body.link.destinationUrl).toBe(legitimateUrl);
    });
  });

  describe('Rate Limiting (HTTP 429 & Retry-After Headers)', () => {
    it('should throttle requests when limit is exceeded and return HTTP 429', async () => {
      // strictSecurityLimiter allows 3 requests per 60s
      const req1 = await request(app).get('/api/security/test-limit');
      expect(req1.status).toBe(200);

      const req2 = await request(app).get('/api/security/test-limit');
      expect(req2.status).toBe(200);

      const req3 = await request(app).get('/api/security/test-limit');
      expect(req3.status).toBe(200);

      // 4th request must be throttled
      const req4 = await request(app).get('/api/security/test-limit');
      expect(req4.status).toBe(429);
      expect(req4.body.error).toBe('TooManyRequests');
      expect(req4.headers['retry-after']).toBeDefined();
    });
  });
});
