import http from 'k6/http';
import { check, sleep } from 'k6';

/**
 * k6 Load Test: ShortX Concurrent Link Creation
 * 
 * Measures write throughput and database collision handling under high concurrent link creation.
 */

export const options = {
  stages: [
    { duration: '5s', target: 10 },   // Warmup to 10 VUs
    { duration: '15s', target: 30 },  // Sustained write load at 30 VUs
    { duration: '5s', target: 0 },    // Ramp-down
  ],
  thresholds: {
    // 95% of write requests must complete within 200ms
    http_req_duration: ['p(95)<200', 'p(99)<400'],
    http_req_failed: ['rate<0.01'],
  },
};

export default function () {
  const token = __ENV.AUTH_TOKEN || '';
  const baseUrl = __ENV.BASE_URL || 'http://localhost:5000';
  const url = `${baseUrl}/api/links`;

  const payload = JSON.stringify({
    destinationUrl: `https://example.com/products/item-${__VU}-${__ITER}`,
    title: `Concurrent Test Link VU${__VU}-IT${__ITER}`,
  });

  const params = {
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
  };

  const res = http.post(url, payload, params);

  check(res, {
    'is status 201': (r) => r.status === 201,
    'has shortUrl': (r) => {
      try {
        const body = JSON.parse(r.body);
        return Boolean(body.data?.shortUrl);
      } catch {
        return false;
      }
    },
  });

  sleep(0.05);
}
