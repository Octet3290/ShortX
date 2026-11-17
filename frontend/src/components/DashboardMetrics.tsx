import React from 'react';
import { DashboardMetrics as MetricsType } from '../types';
import { MousePointerClick, Link2, Monitor, Smartphone, Globe, Compass, BarChart3 } from 'lucide-react';

interface DashboardMetricsProps {
  metrics: MetricsType | null;
  loading: boolean;
}

export const DashboardMetrics: React.FC<DashboardMetricsProps> = ({ metrics, loading }) => {
  if (loading) {
    return (
      <div className="w-full max-w-6xl grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-28 rounded-2xl bg-slate-900/60 border border-slate-800 animate-pulse" />
        ))}
      </div>
    );
  }

  if (!metrics) return null;

  const dailyClicks = metrics.dailyClicks || [];
  const topDevices = metrics.topDevices || [];
  const topBrowsers = metrics.topBrowsers || [];
  const topReferrers = metrics.topReferrers || [];

  // Calculate highest click day for chart scaling
  const maxDayClicks = Math.max(...(dailyClicks.map((d) => d.clicks) || [1]), 1);

  return (
    <div className="w-full max-w-6xl space-y-6 mb-10">
      {/* Top Level Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* Total Clicks Card */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 backdrop-blur-xl relative overflow-hidden shadow-xl">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Total Clicks</span>
            <div className="h-8 w-8 rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 flex items-center justify-center">
              <MousePointerClick className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-3xl font-black text-white font-mono tracking-tight">
              {metrics.totalClicks.toLocaleString()}
            </span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1 flex items-center gap-1">
            <span className="text-emerald-400 font-semibold">Live</span> telemetry from Redis & Postgres
          </p>
        </div>

        {/* Total Links Card */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 backdrop-blur-xl relative overflow-hidden shadow-xl">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Active Links</span>
            <div className="h-8 w-8 rounded-lg bg-violet-500/10 text-violet-400 border border-violet-500/20 flex items-center justify-center">
              <Link2 className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-3xl font-black text-white font-mono tracking-tight">
              {metrics.totalLinks.toLocaleString()}
            </span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1">Shortened URLs in your portfolio</p>
        </div>

        {/* 7-Day Velocity Chart Card */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 backdrop-blur-xl shadow-xl sm:col-span-2 lg:col-span-1">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <BarChart3 className="h-3.5 w-3.5 text-indigo-400" />
              7-Day Activity Trend
            </span>
            <span className="text-[11px] text-slate-400 font-mono">
              {dailyClicks.reduce((sum, d) => sum + d.clicks, 0)} total
            </span>
          </div>

          {/* Mini CSS Bar Chart */}
          <div className="h-16 flex items-end gap-2 pt-2">
            {dailyClicks.map((d, idx) => {
              const heightPct = Math.max(12, Math.round((d.clicks / maxDayClicks) * 100));
              const dayLabel = new Date(d.date).toLocaleDateString(undefined, { weekday: 'narrow' });
              return (
                <div key={idx} className="flex-1 flex flex-col items-center gap-1 group relative">
                  {/* Tooltip */}
                  <div className="absolute -top-7 hidden group-hover:flex px-1.5 py-0.5 rounded bg-slate-800 text-[10px] text-white font-mono shadow border border-slate-700 whitespace-nowrap z-20">
                    {d.clicks} clicks ({d.date.slice(5)})
                  </div>
                  <div
                    style={{ height: `${heightPct}%` }}
                    className="w-full bg-gradient-to-t from-indigo-600 to-indigo-400 rounded-t-sm transition-all group-hover:from-indigo-500 group-hover:to-violet-400"
                  />
                  <span className="text-[10px] text-slate-400">{dayLabel}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Breakdown Grid: Devices, Browsers, Referrers */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Devices */}
        <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-5 backdrop-blur-xl">
          <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2 mb-4">
            <Monitor className="h-4 w-4 text-indigo-400" />
            Device Breakdown
          </h3>
          {topDevices.length === 0 ? (
            <p className="text-xs text-slate-400 italic">No device data yet</p>
          ) : (
            <div className="space-y-3">
              {topDevices.map((item, idx) => {
                const total = topDevices.reduce((sum, d) => sum + d.count, 0) || 1;
                const pct = Math.round((item.count / total) * 100);
                return (
                  <div key={idx} className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-300 flex items-center gap-1.5 capitalize">
                        {item.device.toLowerCase() === 'mobile' ? (
                          <Smartphone className="h-3 w-3 text-slate-400" />
                        ) : (
                          <Monitor className="h-3 w-3 text-slate-400" />
                        )}
                        {item.device}
                      </span>
                      <span className="text-slate-400 font-mono text-[11px]">{item.count} ({pct}%)</span>
                    </div>
                    <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
                      <div style={{ width: `${pct}%` }} className="h-full bg-indigo-500 rounded-full" />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Browsers */}
        <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-5 backdrop-blur-xl">
          <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2 mb-4">
            <Globe className="h-4 w-4 text-violet-400" />
            Top Browsers
          </h3>
          {topBrowsers.length === 0 ? (
            <p className="text-xs text-slate-400 italic">No browser data yet</p>
          ) : (
            <div className="space-y-3">
              {topBrowsers.map((item, idx) => {
                const total = topBrowsers.reduce((sum, b) => sum + b.count, 0) || 1;
                const pct = Math.round((item.count / total) * 100);
                return (
                  <div key={idx} className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-300 capitalize">{item.browser}</span>
                      <span className="text-slate-400 font-mono text-[11px]">{item.count} ({pct}%)</span>
                    </div>
                    <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
                      <div style={{ width: `${pct}%` }} className="h-full bg-violet-500 rounded-full" />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Referrers */}
        <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-5 backdrop-blur-xl">
          <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2 mb-4">
            <Compass className="h-4 w-4 text-emerald-400" />
            Top Referrers
          </h3>
          {topReferrers.length === 0 ? (
            <p className="text-xs text-slate-400 italic">No referrer data yet</p>
          ) : (
            <div className="space-y-2.5">
              {topReferrers.slice(0, 5).map((item, idx) => (
                <div key={idx} className="flex items-center justify-between text-xs py-1 border-b border-slate-800/60 last:border-0">
                  <span className="text-slate-300 truncate max-w-[170px]" title={item.referrer}>
                    {item.referrer}
                  </span>
                  <span className="text-emerald-400 font-mono font-semibold text-[11px] px-2 py-0.5 rounded bg-emerald-500/10">
                    {item.count}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
export default DashboardMetrics;
