import autocannon from 'autocannon';
import http from 'http';
import { AddressInfo } from 'net';
import app from '../src/app';
import { prisma } from '../src/config/prisma';
import { hashPassword } from '../src/utils/password';
import { cache } from '../src/cache/redis';

interface BenchmarkSummary {
  name: string;
  rps: number;
  p50: number;
  p90: number;
  p99: number;
  totalRequests: number;
  errors: number;
  non2xx: number;
}

async function runBenchmark() {
  console.log('\n======================================================');
  console.log('⚡ ShortX URL Shortener — Performance & Load Benchmark');
  console.log('======================================================\n');

  // 1. Boot up ephemeral HTTP server
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
  const port = (server.address() as AddressInfo).port;
  const baseUrl = `http://127.0.0.1:${port}`;
  console.log(`🌐 Ephemeral benchmark server running at ${baseUrl}`);

  // 2. Seed benchmark test data in PostgreSQL
  console.log('🌱 Seeding benchmark user and short link...');
  const user = await prisma.user.upsert({
    where: { email: 'loadtest@shortx.io' },
    update: {},
    create: {
      email: 'loadtest@shortx.io',
      name: 'Load Tester',
      passwordHash: await hashPassword('BenchmarkPass123!'),
    },
  });

  const benchmarkCode = 'bench-hot';
  const targetUrl = 'https://engineering.google.com/articles/high-throughput-systems';

  await prisma.link.upsert({
    where: { shortCode: benchmarkCode },
    update: { destinationUrl: targetUrl, isActive: true },
    create: {
      shortCode: benchmarkCode,
      destinationUrl: targetUrl,
      title: 'Benchmark Hot Link',
      isActive: true,
      userId: user.id,
    },
  });

  // 3. Warm up the cache for the hot path
  console.log('🔥 Warming up Redis cache for hot redirect path...');
  await new Promise<void>((resolve, reject) => {
    http.get(`${baseUrl}/${benchmarkCode}`, (res) => {
      res.resume();
      res.on('end', () => resolve());
    }).on('error', reject);
  });

  const summaries: BenchmarkSummary[] = [];

  // ==========================================
  // BENCHMARK 1: Hot Redirect Path (Cache-Hit + Queue)
  // ==========================================
  console.log('\n🚀 [1/3] Benchmarking Hot Redirect Path (GET /:shortCode) [50 concurrent connections, 5s]...');
  const hotResult = await autocannon({
    url: `${baseUrl}/${benchmarkCode}`,
    connections: 50,
    duration: 5,
    pipelining: 1,
    method: 'GET',
  });

  summaries.push({
    name: 'Hot Redirect (Cache + Async Queue)',
    rps: Math.round(hotResult.requests.average),
    p50: hotResult.latency.p50,
    p90: hotResult.latency.p90,
    p99: hotResult.latency.p99,
    totalRequests: hotResult.requests.total,
    errors: hotResult.errors,
    non2xx: hotResult.non2xx, // 302 responses count as non2xx in autocannon, which is expected for redirects!
  });

  // ==========================================
  // BENCHMARK 2: Baseline System Overhead (GET /health)
  // ==========================================
  console.log('🚀 [2/3] Benchmarking Baseline Overhead (GET /health) [50 concurrent connections, 5s]...');
  const healthResult = await autocannon({
    url: `${baseUrl}/health`,
    connections: 50,
    duration: 5,
    pipelining: 1,
    method: 'GET',
  });

  summaries.push({
    name: 'Baseline Health Endpoint',
    rps: Math.round(healthResult.requests.average),
    p50: healthResult.latency.p50,
    p90: healthResult.latency.p90,
    p99: healthResult.latency.p99,
    totalRequests: healthResult.requests.total,
    errors: healthResult.errors,
    non2xx: healthResult.non2xx,
  });

  // ==========================================
  // BENCHMARK 3: Cache Miss Fallback (Simulated Missing Codes)
  // ==========================================
  console.log('🚀 [3/3] Benchmarking Cache-Miss 404 Resolution (GET /missing-code) [20 connections, 3s]...');
  const missResult = await autocannon({
    url: `${baseUrl}/non-existent-code`,
    connections: 20,
    duration: 3,
    pipelining: 1,
    method: 'GET',
  });

  summaries.push({
    name: 'Cache Miss / 404 Resolution',
    rps: Math.round(missResult.requests.average),
    p50: missResult.latency.p50,
    p90: missResult.latency.p90,
    p99: missResult.latency.p99,
    totalRequests: missResult.requests.total,
    errors: missResult.errors,
    non2xx: missResult.non2xx,
  });

  // 4. Print Summary Comparison Table
  console.log('\n======================================================');
  console.log('📊 BENCHMARK PERFORMANCE RESULTS SUMMARY');
  console.log('======================================================\n');
  console.table(
    summaries.map((s) => ({
      'Scenario': s.name,
      'Throughput (RPS)': `${s.rps.toLocaleString()} req/s`,
      'p50 Latency': `${s.p50} ms`,
      'p90 Latency': `${s.p90} ms`,
      'p99 Latency': `${s.p99} ms`,
      'Total Requests': s.totalRequests.toLocaleString(),
      'Network Errors': s.errors,
    }))
  );

  console.log('\n💡 Engineering Insight:');
  console.log(`- Hot Redirect throughput achieved: ~${summaries[0].rps} requests/second.`);
  console.log(`- Hot Redirect p50 latency: ${summaries[0].p50}ms (Decoupled from PostgreSQL synchronous writes!).`);
  console.log(`- Total requests served during run: ${summaries.reduce((acc, s) => acc + s.totalRequests, 0).toLocaleString()} requests.`);

  // 5. Clean teardown
  await new Promise<void>((resolve) => server.close(() => resolve()));
  await prisma.$disconnect();
  cache.disconnect();
  console.log('\n✅ Benchmark completed and connections closed cleanly.\n');
  process.exit(0);
}

runBenchmark().catch(async (err) => {
  console.error('❌ Benchmark error:', err);
  await prisma.$disconnect();
  cache.disconnect();
  process.exit(1);
});
