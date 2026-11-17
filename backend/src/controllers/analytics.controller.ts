import { Request, Response } from 'express';
import { getDashboardMetrics, getLinkMetrics } from '../services/analytics.service';

/**
 * Returns portfolio-wide analytics metrics for the authenticated user.
 * Endpoint: GET /api/analytics/dashboard
 */
export const getDashboard = async (req: Request, res: Response) => {
  try {
    const metrics = await getDashboardMetrics(req.user!.userId);
    res.status(200).json({ metrics });
  } catch (error) {
    console.error('GetDashboard analytics error:', error);
    res.status(500).json({ error: 'InternalServerError', message: 'Failed to calculate analytics' });
  }
};

/**
 * Returns analytics for a specific link owned by the user.
 * Endpoint: GET /api/analytics/links/:id
 */
export const getLinkAnalytics = async (req: Request, res: Response) => {
  const { id } = req.params;

  try {
    const data = await getLinkMetrics(id, req.user!.userId);

    if (!data) {
      return res.status(404).json({ error: 'NotFound', message: 'Link not found' });
    }

    res.status(200).json({ analytics: data });
  } catch (error: any) {
    if (error.message === 'FORBIDDEN') {
      return res.status(403).json({ error: 'Forbidden', message: 'You do not have permission to view these analytics' });
    }
    console.error('GetLinkAnalytics error:', error);
    res.status(500).json({ error: 'InternalServerError', message: 'Failed to fetch link analytics' });
  }
};
