import React, { useEffect, useState } from 'react';
import { api } from '../api/client';
import { LinkAnalytics } from '../types';
import { X, ExternalLink, MousePointerClick, Monitor, Globe, Compass, BarChart2 } from 'lucide-react';

interface LinkAnalyticsModalProps {
  linkId: string | null;
  onClose: () => void;
}

export const LinkAnalyticsModal: React.FC<LinkAnalyticsModalProps> = ({ linkId, onClose }) => {
  const [data, setData] = useState<LinkAnalytics | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!linkId) return;
    const fetchAnalytics = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await api.getLinkAnalytics(linkId);
        setData(res);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load analytics');
      } finally {
        setLoading(false);
      }
    };
    fetchAnalytics();
  }, [linkId]);

  if (!linkId) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-6 sm:p-8 overflow-hidden max-h-[90vh] flex flex-col">
        {/* Glow */}
        <div className="absolute top-0 right-0 w-40 h-40 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-200 rounded-lg hover:bg-slate-800 transition-colors"
        >
          <X className="h-5 w-5" />
        </button>

        {/* Header */}
        <div className="flex items-center space-x-3 mb-6">
          <div className="h-10 w-10 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 flex items-center justify-center">
            <BarChart2 className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white tracking-tight">Link Telemetry & Analytics</h2>
            <p className="text-xs text-slate-400">Deep-dive performance metrics for shortened URL</p>
          </div>
        </div>

        {loading ? (
          <div className="py-16 flex flex-col items-center justify-center space-y-3">
            <div className="h-8 w-8 border-2 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin" />
            <span className="text-xs text-slate-400 font-mono">Aggregating click events...</span>
          </div>
        ) : error ? (
          <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs">
            {error}
          </div>
        ) : data ? (
          <div className="overflow-y-auto space-y-6 pr-1">
            {/* Link details strip */}
            <div className="p-4 rounded-xl bg-slate-800/60 border border-slate-700/60 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
              <div className="flex flex-col">
                <span className="text-xs font-mono font-bold text-indigo-400 flex items-center gap-1.5">
                  /{data.link.shortCode}
                  <span className={`h-2 w-2 rounded-full ${data.link.isActive ? 'bg-emerald-400' : 'bg-slate-500'}`} />
                </span>
                <span className="text-xs text-slate-300 truncate max-w-sm mt-0.5" title={data.link.destinationUrl}>
                  {data.link.destinationUrl}
                </span>
              </div>
              <div className="flex items-center space-x-3">
                <div className="flex items-center space-x-1.5 bg-indigo-500/10 border border-indigo-500/20 px-3 py-1 rounded-lg">
                  <MousePointerClick className="h-4 w-4 text-indigo-400" />
                  <span className="text-sm font-bold text-white font-mono">{data.totalClicks} clicks</span>
                </div>
                <a
                  href={`http://localhost:5000/${data.link.shortCode}`}
                  target="_blank"
                  rel="noreferrer"
                  className="p-1.5 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-lg transition-colors"
                  title="Test Link"
                >
                  <ExternalLink className="h-4 w-4" />
                </a>
              </div>
            </div>

            {/* Breakdown sections */}
            {(() => {
              const topDevices = data.topDevices || [];
              const topBrowsers = data.topBrowsers || [];
              const topReferrers = data.topReferrers || [];
              return (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Devices */}
                  <div className="p-4 rounded-xl bg-slate-800/40 border border-slate-700/60">
                    <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2 mb-3">
                      <Monitor className="h-3.5 w-3.5 text-indigo-400" />
                      Devices
                    </h4>
                    {topDevices.length === 0 ? (
                      <p className="text-xs text-slate-500 italic">No click events recorded</p>
                    ) : (
                      <div className="space-y-2">
                        {topDevices.map((d, idx) => (
                          <div key={idx} className="flex justify-between text-xs py-1 border-b border-slate-700/40 last:border-0">
                            <span className="text-slate-300 capitalize">{d.device}</span>
                            <span className="text-slate-400 font-mono">{d.count} clicks</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Browsers */}
                  <div className="p-4 rounded-xl bg-slate-800/40 border border-slate-700/60">
                    <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2 mb-3">
                      <Globe className="h-3.5 w-3.5 text-violet-400" />
                      Browsers
                    </h4>
                    {topBrowsers.length === 0 ? (
                      <p className="text-xs text-slate-500 italic">No click events recorded</p>
                    ) : (
                      <div className="space-y-2">
                        {topBrowsers.map((b, idx) => (
                          <div key={idx} className="flex justify-between text-xs py-1 border-b border-slate-700/40 last:border-0">
                            <span className="text-slate-300 capitalize">{b.browser}</span>
                            <span className="text-slate-400 font-mono">{b.count} clicks</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Referrers */}
                  <div className="p-4 rounded-xl bg-slate-800/40 border border-slate-700/60 sm:col-span-2">
                    <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2 mb-3">
                      <Compass className="h-3.5 w-3.5 text-emerald-400" />
                      Referrers
                    </h4>
                    {topReferrers.length === 0 ? (
                      <p className="text-xs text-slate-500 italic">No click events recorded</p>
                    ) : (
                      <div className="space-y-2">
                        {topReferrers.map((r, idx) => (
                          <div key={idx} className="flex justify-between text-xs py-1 border-b border-slate-700/40 last:border-0">
                            <span className="text-slate-300 truncate max-w-xs">{r.referrer}</span>
                            <span className="text-emerald-400 font-mono font-semibold">{r.count}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })()}
          </div>
        ) : null}
      </div>
    </div>
  );
};
export default LinkAnalyticsModal;
