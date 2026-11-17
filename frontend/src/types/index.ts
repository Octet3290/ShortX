export interface User {
  id: string;
  email: string;
  name: string | null;
  createdAt: string;
}

export interface LinkItem {
  id: string;
  shortCode: string;
  destinationUrl: string;
  title: string | null;
  isActive: boolean;
  expiresAt: string | null;
  clicksCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface LinksResponse {
  links: LinkItem[];
  pagination: {
    page: number;
    limit: number;
    totalCount: number;
    totalPages: number;
    hasNextPage: boolean;
  };
}

export interface DailyClickPoint {
  date: string;
  clicks: number;
}

export interface DashboardMetrics {
  totalLinks: number;
  totalClicks: number;
  dailyClicks: DailyClickPoint[];
  topDevices: { device: string; count: number }[];
  topBrowsers: { browser: string; count: number }[];
  topReferrers: { referrer: string; count: number }[];
}

export interface LinkAnalytics {
  link: {
    id: string;
    shortCode: string;
    destinationUrl: string;
    title: string | null;
    createdAt: string;
    clicksCount: number;
    isActive: boolean;
  };
  totalClicks: number;
  topDevices: { device: string; count: number }[];
  topBrowsers: { browser: string; count: number }[];
  topReferrers: { referrer: string; count: number }[];
  dailyClicks: DailyClickPoint[];
}

export interface HealthData {
  status: string;
  service: string;
  database: string;
  timestamp: string;
  uptime: number;
}
