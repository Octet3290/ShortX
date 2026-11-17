import http from 'k6/http';
import { check, sleep } from 'k6';

/**
 * k6 Load Test: ShortX Redirect Baseline
 * 
 * Measures throughput and latency percentiles (p50, p95, p99) for the GET /:shortCode endpoint.
 * Crucial configuration: redirects: 0 prevents the client from following the redirect to the target domain,
 * ensuring we measure ONLY ShortX's response time.
 */

export const options = {
  stages: [
    { duration: '5s', target: 20 },   // Ramp-up to 20 virtual users (VUs)
    { duration: '15s', target: 50 },  // Sustained load at 50 VUs
    { duration: '5s', target: 0 },    // Ramp-down to 0
  ],
  thresholds: {
    // 95% of redirect responses must be served within 50ms
    http_req_duration: ['p(95)<50', 'p(99)<100'],
    // Less than 1% failure rate permitted
    http_req_failed: ['rate<0.01'],
  },
};

export default function () {
  const shortCode = __ENV.SHORT_CODE || 'benchmark';
  const baseUrl = __ENV.BASE_URL || 'http://localhost:5000';
  const url = `${baseUrl}/${shortCode}`;

  const res = http.get(url, {
    redirects: 0, // CRITICAL: Measure ShortX redirect latency, not external destination latency
  });

  check(res, {
    'is status 302': (r) => r.status === 302,
    'has location header': (r) => Boolean(r.headers['Location']),
    'has no-cache header': (r) => r.headers['Cache-Control']?.includes('no-cache'),
  });

  sleep(0.02); // Small pacing delay between requests per virtual user
}
