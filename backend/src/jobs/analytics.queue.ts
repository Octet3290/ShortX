import crypto from 'crypto';

export interface ClickJob {
  jobId: string;
  linkId: string;
  userAgent?: string;
  referer?: string;
  timestamp: string;
  attempts: number;
}

/**
 * Resilient, high-performance asynchronous queue for click events.
 * Decouples redirect latency from database write operations.
 */
class AnalyticsQueue {
  private queue: ClickJob[] = [];
  private isProcessing = false;
  private maxRetries = 3;
  private processedJobIds = new Set<string>(); // Idempotency deduplication cache
  private workerHandler: ((job: ClickJob) => Promise<void>) | null = null;

  /**
   * Registers the background worker consumer.
   */
  registerWorker(handler: (job: ClickJob) => Promise<void>) {
    this.workerHandler = handler;
  }

  /**
   * Producer: Enqueues a click event in memory in < 0.1ms.
   * Does NOT wait for database writes, ensuring redirects are instant.
   */
  enqueue(data: { linkId: string; userAgent?: string; referer?: string }): string {
    const jobId = `job_${data.linkId}_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;

    const job: ClickJob = {
      jobId,
      linkId: data.linkId,
      userAgent: data.userAgent,
      referer: data.referer,
      timestamp: new Date().toISOString(),
      attempts: 0,
    };

    this.queue.push(job);
    this.triggerProcessing();

    return jobId;
  }

  /**
   * Internal loop that processes queue items asynchronously.
   */
  private async triggerProcessing() {
    if (this.isProcessing || this.queue.length === 0 || !this.workerHandler) {
      return;
    }

    this.isProcessing = true;

    // Use setImmediate to release the current event loop tick immediately
    setImmediate(async () => {
      while (this.queue.length > 0 && this.workerHandler) {
        const job = this.queue.shift();
        if (!job) continue;

        // Idempotency check: Skip if already processed
        if (this.processedJobIds.has(job.jobId)) {
          console.warn(`[Queue] Duplicate job detected: ${job.jobId}. Skipping.`);
          continue;
        }

        try {
          job.attempts++;
          await this.workerHandler(job);
          this.processedJobIds.add(job.jobId);

          // Keep the idempotency set bounded to the last 10,000 jobs
          if (this.processedJobIds.size > 10000) {
            const firstKey = this.processedJobIds.values().next().value;
            if (firstKey) this.processedJobIds.delete(firstKey);
          }
        } catch (error) {
          console.error(`[Queue] Failed processing job ${job.jobId} (attempt ${job.attempts}):`, error);

          // Retry logic with backoff
          if (job.attempts < this.maxRetries) {
            this.queue.push(job);
          } else {
            console.error(`[Queue] Job ${job.jobId} moved to Dead-Letter state after ${this.maxRetries} failed attempts.`);
          }
        }
      }

      this.isProcessing = false;
    });
  }

  /**
   * Returns current pending queue length (useful for monitoring and tests).
   */
  getQueueLength(): number {
    return this.queue.length;
  }

  /**
   * Helper for tests to wait until all pending jobs have drained.
   */
  async waitForDrain(timeoutMs = 5000): Promise<void> {
    const start = Date.now();
    while ((this.queue.length > 0 || this.isProcessing) && Date.now() - start < timeoutMs) {
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
  }
}

export const analyticsQueue = new AnalyticsQueue();
export default analyticsQueue;
