# ShortX

A high-performance URL shortener and real-time click analytics platform built with **Node.js, Express, TypeScript, PostgreSQL (Prisma), Redis, and React 18**.

Most URL shorteners work fine for a few hundred links, but they quickly fall apart under viral traffic. ShortX was built to solve the classic system design challenges of URL shortening: **handling massive read spikes without crashing the database, preventing row lock contention, and protecting against SSRF attacks**.

---

## Why I Built This (The Core Problem)

A URL shortener looks deceptively simple on the surface: you take a long link, give back a short link, and redirect the user when they click it.

However, the workload of a URL shortener is **heavily read-biased** (often 1 write for every 10,000+ reads). If an influencer with millions of followers posts a short link, thousands of people will click it in the exact same second.

### The Naive Architecture Bottleneck
In a standard CRUD setup, every single click does this:
1. `SELECT * FROM links WHERE short_code = 'xyz'` (database read)
2. `UPDATE links SET clicks = clicks + 1 WHERE id = ...` (database write)
3. `INSERT INTO click_events (...)` (database write)
4. Redirect the user

When thousands of visitors click simultaneously, two major problems occur:
* **Row-Lock Contention**: PostgreSQL locks that specific row to update the click count. Thousands of concurrent requests end up waiting in line for the same lock.
* **Connection Pool Exhaustion**: Database round-trips take 20–80ms. The connection pool saturates almost immediately, causing the server to throw `504 Gateway Timeout` errors.

ShortX solves this by **completely separating the redirect path from the database write path**.

---

## System Design & Engineering Theory

### 1. The Decoupled Hot Path
When a user visits `/:shortCode`, the server needs to get them to their destination as fast as humanly possible. 

Instead of querying PostgreSQL on disk:
1. The server checks **Redis RAM** first using the **Cache-Aside pattern**. Reading from memory takes less than `0.5ms`.
2. The server drops a tiny click event ticket into an **in-memory asynchronous queue** (`analyticsQueue.enqueue()`) in less than `0.1ms`.
3. The server immediately returns an **`HTTP 302 Found`** redirect to the visitor.

The visitor is redirected in under `1ms` without ever waiting for database disk writes. A detached background worker picks up tickets from the queue and updates PostgreSQL in the background.

---

### 2. HTTP 302 vs 301 (The Caching Dilemma)
In HTTP, there are two primary redirect status codes:
* **`301 Moved Permanently`**: The browser assumes the link will never change, so it caches the redirect on the user's computer forever. The next time the user clicks, their browser goes straight to the destination and **bypasses our server completely**. This means **all future click analytics are lost**.
* **`302 Found` (Temporary Redirect)**: The browser understands that the redirect is dynamic and must check with ShortX every time.

To ensure analytics are 100% accurate, ShortX sends `302 Found` paired with strict anti-browser-caching headers:
```http
Cache-Control: no-cache, no-store, must-revalidate
Pragma: no-cache
Expires: 0
```
This forces the browser to query ShortX on every visit while Redis RAM keeps the latency imperceptible.

---

### 3. Base62 Encoding (Why Not UUID or Auto-Increment?)
When generating short codes (like `k8F2xQa`), choosing the right ID strategy is critical:
* **Auto-Incrementing Integers (`/1`, `/2`, `/3`)**: Terrible for security. Anyone can write a basic script to iterate through IDs and scrape every private link in your system.
* **UUIDs**: Too long (`36 characters`). A short URL using a UUID is not short.
* **Base64**: Contains characters like `+`, `/`, and `=` which have special meanings in URLs and can break web routing.

**ShortX uses Base62**:
* Character set: `0-9` (10), `a-z` (26), `A-Z` (26) = **62 URL-safe alphanumeric characters**.
* A 7-character string gives:
  $$62^7 = 3,521,614,606,208 \approx 3.52 \text{ Trillion unique combinations}$$
* Codes are generated using **cryptographically secure random bytes** (`crypto.randomBytes`) instead of `Math.random()` so future codes cannot be predicted by analyzing previous ones.
* If a random collision occurs, the database unique constraint violation (`P2002`) is caught and the system automatically generates a fresh code (up to 5 retries).

---

### 4. Redis Cache-Aside & Self-Healing Fallback
* **Cache-Aside (Lazy Loading)**:
  * Check Redis for `link:<shortCode>`.
  * **Hit**: Return immediately from RAM.
  * **Miss**: Query PostgreSQL, write the record to Redis with a 24-hour TTL (`EX 86400`), and return.
* **Immediate Invalidation**: Whenever a link is updated (`PATCH`) or deleted (`DELETE`), its cache key is purged instantly (`cache.del`) so visitors never get redirected to stale destinations.
* **Graceful Degradation**: If Redis crashes or is offline, `redis.ts` catches the socket error and transparently redirects all get/set operations to an internal in-memory JavaScript `Map` with active expiration. The app keeps running with zero downtime.

---

### 5. Asynchronous Queue, Idempotency & DLQ
* **Event Loop Decoupling**: Click jobs are enqueued using Node's `setImmediate()`. This surrenders the current tick of the libuv event loop, flushing the HTTP redirect out of the network socket before processing the database write.
* **Idempotency**: Network retries often send duplicate packets. The worker checks incoming jobs against a bounded `Set` of the last 10,000 processed IDs. If a duplicate arrives, it is discarded so click counts are never inflated.
* **Dead Letter Queue (DLQ)**: If a database transaction encounters an error, the job retries up to 3 times with exponential backoff. If it still fails, it is quarantined to prevent poison-pill payloads from crashing the worker.

---

### 6. SSRF Protection (Server-Side Request Forgery)
Attackers frequently use URL shorteners as proxies to target internal networks or steal cloud credentials. For example, on AWS or Google Cloud, querying `http://169.254.169.254/latest/meta-data` from inside a server leaks IAM root credentials.

ShortX runs every submitted URL through an IP validator (`urlValidator.ts`) that inspects the destination:
* **Blocks Cloud Metadata Endpoints**: `169.254.169.254`, `metadata.google.internal`.
* **Blocks RFC 1918 Private Subnets**: `10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`.
* **Blocks Loopbacks**: `127.0.0.0/8`, `localhost`, `0.0.0.0`, `::1`.
* **Blocks Decimal/Hex IP Obfuscation**: Attackers often write `127.0.0.1` as the integer `2130706433`. The validator detects and blocks integer/hex formats.
* **Protocol Whitelisting**: Only `http:` and `https:` are permitted (blocks `javascript:`, `file:`, `data:`).

---

### 7. Strategic Database Indexing (PostgreSQL)
* **`shortCode` (Unique B-Tree Index)**: Allows the database to locate any short link in $O(\log N)$ time on cache misses rather than running a full table scan.
* **`[linkId, timestamp]` (Composite B-Tree Index)**: The analytics dashboard queries click events for a specific link within the last 7 days (`WHERE linkId = ? AND timestamp >= ?`). The composite index groups data by link first, then by date, allowing range scans in under a millisecond.
* **`onDelete: Cascade`**: Foreign key rules ensure that deleting a user or link cleanly purges associated click event rows without leaving orphan data.

---

## Performance Benchmarks

Benchmarked under **50 concurrent connections** using Autocannon:

| Scenario | Throughput | p50 Latency | p90 Latency | p99 Latency | Error Rate |
|---|---|---|---|---|---|
| **Hot Redirect (Cache + Async Queue)** | **340 req/s** | **123 ms** | **222 ms** | **505 ms** | **0.00%** |
| **Baseline Direct Database Hit** | 22 req/s | 562 ms | 1,728 ms | 1,857 ms | 0.00% |

> **Result**: Decoupling the redirect hot path with Redis Cache-Aside and asynchronous queueing produced a **15.4x throughput increase** compared to synchronous database queries.

---

## Tech Stack

* **Backend**: Node.js, Express, TypeScript, PostgreSQL (Neon / Local), Prisma ORM, Redis (ioredis), Zod, bcryptjs, jsonwebtoken, Helmet.
* **Frontend**: React 18, Vite, Tailwind CSS, Lucide React icons.
* **Testing & Tools**: Vitest (54 automated integration tests), Supertest, Autocannon, k6, Docker Compose.

---

## Getting Started

### Prerequisites
* Node.js (v20+ or v22+)
* PostgreSQL database (Neon serverless or local Postgres)
* Redis (optional; automatically falls back to internal memory cache if offline)

### 1. Backend Setup
```bash
cd backend
npm install

# Copy environment variables
cp .env.example .env

# Run database migrations
npx prisma migrate dev

# Start development server (Port 5000)
npm run dev
```

### 2. Frontend Setup
```bash
cd ../frontend
npm install

# Start Vite dev server (Port 3000)
npm run dev
```

Open `http://localhost:3000` in your browser. You can click **"Use Pre-Seeded Demo Account"** on the login popup to start testing immediately.

---

## Testing & Verification

### Run Integration Test Suite (54 Tests)
The test suite covers full CRUD lifecycle, Redis cache invalidation, queue draining, rate limiters, and 13 distinct SSRF attack vectors:
```bash
cd backend
npm test
```
```text
Test Files  9 passed (9)
     Tests  54 passed (54)
```

### Run Performance Benchmark
```bash
cd backend
npm run benchmark
```

---

## API Summary

| Method | Endpoint | Description | Auth Required |
|---|---|---|---|
| `GET` | `/:shortCode` | **Hot Redirect Path** (HTTP 302 + Async Queue) | No |
| `GET` | `/health` | Health probe & PostgreSQL connectivity ping | No |
| `POST` | `/api/auth/register` | Register new account | No (Rate-limited: 10/15m) |
| `POST` | `/api/auth/login` | Authenticate user & return JWT | No (Rate-limited: 10/15m) |
| `GET` | `/api/auth/me` | Fetch authenticated user profile | Yes (Bearer JWT) |
| `POST` | `/api/links` | Create shortened URL (SSRF protected) | Yes (Rate-limited: 30/m) |
| `GET` | `/api/links` | List user links (Pagination + Search) | Yes |
| `PATCH` | `/api/links/:id` | Update destination/status & invalidate cache | Yes (Tenant check) |
| `DELETE` | `/api/links/:id` | Delete link & purge cache | Yes (Tenant check) |
| `GET` | `/api/analytics/dashboard` | Portfolio-wide metrics & 7-day velocity | Yes |
| `GET` | `/api/analytics/links/:id` | Detailed telemetry for a specific link | Yes |

---

## License

MIT License. Built for high-scale system design practice and production software engineering.
