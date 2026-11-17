import { analyticsQueue, ClickJob } from './analytics.queue';
import { prisma } from '../config/prisma';
import { recordClickEvent } from '../services/analytics.service';

/**
 * Worker handler that processes a single click event job.
 * Executes database updates and event persistence asynchronously.
 */
export const processClickJob = async (job: ClickJob): Promise<void> => {
  // 1. Record raw immutable click event in PostgreSQL
  await recordClickEvent(job.linkId, job.userAgent, job.referer);

  // 2. Increment cached counter on Link record
  await prisma.link.update({
    where: { id: job.linkId },
    data: { clicksCount: { increment: 1 } },
  });
};

/**
 * Initializes the background worker consumer.
 */
export const startAnalyticsWorker = () => {
  analyticsQueue.registerWorker(processClickJob);
  console.log('👷 Background Analytics Worker started and listening for jobs');
};
