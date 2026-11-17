import {
  User,
  LinkItem,
  LinksResponse,
  DashboardMetrics,
  LinkAnalytics,
  HealthData,
} from '../types';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000';

class ApiClient {
  private token: string | null = null;

  constructor() {
    this.token = localStorage.getItem('shortx_token');
  }

  public setToken(token: string | null) {
    this.token = token;
    if (token) {
      localStorage.setItem('shortx_token', token);
    } else {
      localStorage.removeItem('shortx_token');
    }
  }

  public getToken(): string | null {
    return this.token;
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string> || {}),
    };

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    const res = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      headers,
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      const message =
        data.message ||
        (data.issues ? data.issues.map((i: { message: string }) => i.message).join(', ') : 'An error occurred');
      throw new Error(message);
    }

    return data as T;
  }

  // Health
  public async getHealth(): Promise<HealthData> {
    const res = await fetch(`${API_BASE}/health`);
    if (!res.ok) throw new Error('Health check failed');
    return res.json();
  }

  // Auth
  public async register(payload: { email: string; password: string; name?: string }): Promise<{ token: string; user: User }> {
    return this.request<{ token: string; user: User }>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  public async login(payload: { email: string; password: string }): Promise<{ token: string; user: User }> {
    return this.request<{ token: string; user: User }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  public async getMe(): Promise<{ user: User }> {
    return this.request<{ user: User }>('/api/auth/me');
  }

  // Links
  public async createLink(payload: {
    destinationUrl: string;
    title?: string;
    customAlias?: string;
    expiresAt?: string;
  }): Promise<{ message: string; link: LinkItem; shortUrl: string }> {
    return this.request<{ message: string; link: LinkItem; shortUrl: string }>('/api/links', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  public async getLinks(page = 1, limit = 10, search = ''): Promise<LinksResponse> {
    const params = new URLSearchParams({
      page: page.toString(),
      limit: limit.toString(),
    });
    if (search.trim()) {
      params.set('search', search.trim());
    }
    return this.request<LinksResponse>(`/api/links?${params.toString()}`);
  }

  public async updateLink(
    id: string,
    payload: { destinationUrl?: string; title?: string; isActive?: boolean }
  ): Promise<{ message: string; link: LinkItem }> {
    return this.request<{ message: string; link: LinkItem }>(`/api/links/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
  }

  public async deleteLink(id: string): Promise<{ message: string }> {
    return this.request<{ message: string }>(`/api/links/${id}`, {
      method: 'DELETE',
    });
  }

  // Analytics
  public async getDashboardMetrics(): Promise<DashboardMetrics> {
    const res = await this.request<{ metrics: any }>('/api/analytics/dashboard');
    const m = res.metrics || res || {};
    return {
      totalLinks: m.totalLinks || 0,
      totalClicks: m.totalClicks || 0,
      dailyClicks: (m.recentClicks || m.dailyClicks || []).map((c: any) => ({
        date: c.date,
        clicks: c.clicks ?? c.count ?? 0,
      })),
      topDevices: (m.devices || m.topDevices || []).map((d: any) => ({
        device: d.device || d.name || 'Other',
        count: d.count || 0,
      })),
      topBrowsers: (m.browsers || m.topBrowsers || []).map((b: any) => ({
        browser: b.browser || b.name || 'Other',
        count: b.count || 0,
      })),
      topReferrers: (m.referrers || m.topReferrers || []).map((r: any) => ({
        referrer: r.referrer || r.name || 'Direct',
        count: r.count || 0,
      })),
    };
  }

  public async getLinkAnalytics(linkId: string): Promise<LinkAnalytics> {
    const res = await this.request<{ analytics: any }>(`/api/analytics/links/${linkId}`);
    const a = res.analytics || res || {};
    return {
      link: a.link,
      totalClicks: a.link?.clicksCount || 0,
      dailyClicks: (a.recentClicks || a.dailyClicks || []).map((c: any) => ({
        date: c.date,
        clicks: c.clicks ?? c.count ?? 0,
      })),
      topDevices: (a.devices || a.topDevices || []).map((d: any) => ({
        device: d.device || d.name || 'Other',
        count: d.count || 0,
      })),
      topBrowsers: (a.browsers || a.topBrowsers || []).map((b: any) => ({
        browser: b.browser || b.name || 'Other',
        count: b.count || 0,
      })),
      topReferrers: (a.referrers || a.topReferrers || []).map((r: any) => ({
        referrer: r.referrer || r.name || 'Direct',
        count: r.count || 0,
      })),
    };
  }
}

export const api = new ApiClient();
export default api;
