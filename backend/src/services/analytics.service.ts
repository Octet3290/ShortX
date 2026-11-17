import { prisma } from '../config/prisma';
import { parseUserAgent } from '../utils/useragent';

export interface DashboardMetrics {
  totalLinks: number;
  totalClicks: number;
  topLinks: Array<{
    id: string;
    shortCode: string;
    destinationUrl: string;
    title: string | null;
    clicksCount: number;
  }>;
  devices: Array<{ name: string; count: number }>;
  browsers: Array<{ name: string; count: number }>;
  referrers: Array<{ name: string; count: number }>;
  recentClicks: Array<{ date: string; count: number }>;
}

/**
 * Persists an immutable ClickEvent record asynchronously.
 * Wrapped in safe error handling so analytics failures never impact redirects.
 */
export const recordClickEvent = async (
  linkId: string,
  userAgentHeader?: string,
  rawReferer?: string
): Promise<void> => {
  try {
    const { browser, os, deviceType } = parseUserAgent(userAgentHeader);

    // Extract clean domain from Referer (e.g., 'https://t.co/xyz' -> 't.co')
    let referer = 'Direct';
    if (rawReferer) {
      try {
        const url = new URL(rawReferer);
        referer = url.hostname.replace(/^www\./, '');
      } catch {
        referer = 'Direct';
      }
    }

    await prisma.clickEvent.create({
      data: {
        linkId,
        browser,
        os,
        deviceType,
        referer,
      },
    });
  } catch (error) {
    // Non-fatal logging: Click event recording should not take down user redirects
    console.error('Failed to record click event:', error);
  }
};

/**
 * Calculates aggregated analytics for a user's entire link portfolio.
 */
export const getDashboardMetrics = async (userId: string): Promise<DashboardMetrics> => {
  // 1. Total links count
  const totalLinks = await prisma.link.count({
    where: { userId },
  });

  // 2. Total clicks sum across all links
  const totalClicksAggregate = await prisma.link.aggregate({
    where: { userId },
    _sum: { clicksCount: true },
  });
  const totalClicks = totalClicksAggregate._sum.clicksCount || 0;

  // 3. Top 5 performing links
  const topLinks = await prisma.link.findMany({
    where: { userId },
    orderBy: { clicksCount: 'desc' },
    take: 5,
    select: {
      id: true,
      shortCode: true,
      destinationUrl: true,
      title: true,
      clicksCount: true,
    },
  });

  // 4. Device, Browser, and Referrer breakdowns executed concurrently
  const [deviceGroups, browserGroups, referrerGroups] = await Promise.all([
    prisma.clickEvent.groupBy({
      by: ['deviceType'],
      where: { link: { userId } },
      _count: { _all: true },
    }),
    prisma.clickEvent.groupBy({
      by: ['browser'],
      where: { link: { userId } },
      _count: { _all: true },
    }),
    prisma.clickEvent.groupBy({
      by: ['referer'],
      where: { link: { userId } },
      _count: { _all: true },
    }),
  ]);

  const devices = deviceGroups
    .map((g) => ({ name: g.deviceType || 'Other', count: g._count._all }))
    .sort((a, b) => b.count - a.count);

  const browsers = browserGroups
    .map((g) => ({ name: g.browser || 'Other', count: g._count._all }))
    .sort((a, b) => b.count - a.count);

  const referrers = referrerGroups
    .map((g) => ({ name: g.referer || 'Direct', count: g._count._all }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 6);

  // 5. Recent Clicks (Last 7 days daily counts)
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const recentEvents = await prisma.clickEvent.findMany({
    where: {
      link: { userId },
      timestamp: { gte: sevenDaysAgo },
    },
    select: { timestamp: true },
    orderBy: { timestamp: 'asc' },
  });

  // Group by YYYY-MM-DD
  const dateMap = new Map<string, number>();
  for (let i = 6; i >= 0; i--) {
    const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
    const dateStr = d.toISOString().split('T')[0];
    dateMap.set(dateStr, 0);
  }

  for (const event of recentEvents) {
    const dateStr = event.timestamp.toISOString().split('T')[0];
    if (dateMap.has(dateStr)) {
      dateMap.set(dateStr, (dateMap.get(dateStr) || 0) + 1);
    }
  }

  const recentClicks = Array.from(dateMap.entries()).map(([date, count]) => ({
    date,
    count,
  }));

  return {
    totalLinks,
    totalClicks,
    topLinks,
    devices,
    browsers,
    referrers,
    recentClicks,
  };
};

/**
 * Calculates analytics for a single specific link.
 */
export const getLinkMetrics = async (linkId: string, userId: string) => {
  const link = await prisma.link.findUnique({
    where: { id: linkId },
  });

  if (!link) return null;
  if (link.userId !== userId) throw new Error('FORBIDDEN');

  const [deviceGroups, browserGroups, referrerGroups] = await Promise.all([
    prisma.clickEvent.groupBy({
      by: ['deviceType'],
      where: { linkId },
      _count: { _all: true },
    }),
    prisma.clickEvent.groupBy({
      by: ['browser'],
      where: { linkId },
      _count: { _all: true },
    }),
    prisma.clickEvent.groupBy({
      by: ['referer'],
      where: { linkId },
      _count: { _all: true },
    }),
  ]);

  return {
    link,
    devices: deviceGroups
      .map((g) => ({ name: g.deviceType || 'Other', count: g._count._all }))
      .sort((a, b) => b.count - a.count),
    browsers: browserGroups
      .map((g) => ({ name: g.browser || 'Other', count: g._count._all }))
      .sort((a, b) => b.count - a.count),
    referrers: referrerGroups
      .map((g) => ({ name: g.referer || 'Direct', count: g._count._all }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 6),
  };
};
