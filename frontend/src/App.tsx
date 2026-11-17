import { useEffect, useState, useCallback } from 'react';
import { api } from './api/client';
import { User, HealthData, DashboardMetrics as MetricsType, LinksResponse, LinkItem } from './types';
import Navbar from './components/Navbar';
import AuthModal from './components/AuthModal';
import CreateLinkCard from './components/CreateLinkCard';
import DashboardMetrics from './components/DashboardMetrics';
import LinksTable from './components/LinksTable';
import LinkAnalyticsModal from './components/LinkAnalyticsModal';
import { ShieldCheck, Zap, Database, Server, Sparkles } from 'lucide-react';

export function App() {
  const [user, setUser] = useState<User | null>(null);
  const [health, setHealth] = useState<HealthData | null>(null);
  const [metrics, setMetrics] = useState<MetricsType | null>(null);
  const [linksData, setLinksData] = useState<LinksResponse | null>(null);

  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [selectedAnalyticsLinkId, setSelectedAnalyticsLinkId] = useState<string | null>(null);

  const [currentPage, setCurrentPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');
  const [linksLoading, setLinksLoading] = useState(false);
  const [metricsLoading, setMetricsLoading] = useState(false);

  // 1. Check health
  const checkHealth = async () => {
    try {
      const data = await api.getHealth();
      setHealth(data);
    } catch {
      setHealth(null);
    }
  };

  // 2. Restore authenticated session
  const restoreSession = async () => {
    if (!api.getToken()) return;
    try {
      const res = await api.getMe();
      setUser(res.user);
    } catch {
      api.setToken(null);
      setUser(null);
    }
  };

  // 3. Fetch dashboard metrics
  const loadMetrics = useCallback(async () => {
    if (!user) return;
    setMetricsLoading(true);
    try {
      const data = await api.getDashboardMetrics();
      setMetrics(data);
    } catch {
      // Ignored if unauthenticated
    } finally {
      setMetricsLoading(false);
    }
  }, [user]);

  // 4. Fetch links
  const loadLinks = useCallback(async () => {
    if (!user) return;
    setLinksLoading(true);
    try {
      const data = await api.getLinks(currentPage, 10, searchQuery);
      setLinksData(data);
    } catch {
      // Ignored
    } finally {
      setLinksLoading(false);
    }
  }, [user, currentPage, searchQuery]);

  useEffect(() => {
    checkHealth();
    restoreSession();
    const interval = setInterval(checkHealth, 10000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (user) {
      loadMetrics();
      loadLinks();
    } else {
      setMetrics(null);
      setLinksData(null);
    }
  }, [user, loadMetrics, loadLinks]);

  const handleLogout = () => {
    api.setToken(null);
    setUser(null);
  };

  const handleLinkCreated = (_newLink: LinkItem) => {
    loadLinks();
    loadMetrics();
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between selection:bg-indigo-500 selection:text-white">
      {/* Top Navigation */}
      <Navbar
        user={user}
        health={health}
        onOpenAuth={() => setIsAuthModalOpen(true)}
        onLogout={handleLogout}
      />

      {/* Main Container */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-10 flex-1 w-full flex flex-col items-center">
        {/* Hero Section */}
        <div className="text-center max-w-3xl mb-8">
          <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-xs font-semibold mb-4">
            <Sparkles className="h-3.5 w-3.5 text-indigo-400" />
            <span>Production Grade SaaS Architecture</span>
          </div>

          <h1 className="text-4xl sm:text-5xl font-black tracking-tight mb-3 bg-gradient-to-b from-white via-slate-100 to-slate-400 bg-clip-text text-transparent">
            ShortX URL Shortener & Analytics
          </h1>
          <p className="text-slate-400 text-sm sm:text-base leading-relaxed max-w-2xl mx-auto">
            Decoupled redirect hot path with Redis caching, non-blocking asynchronous event queueing, and real-time visitor telemetry.
          </p>
        </div>

        {/* URL Shortening Form Card */}
        <CreateLinkCard
          isAuthenticated={Boolean(user)}
          onLinkCreated={handleLinkCreated}
          onRequireAuth={() => setIsAuthModalOpen(true)}
        />

        {/* Authenticated Dashboard View */}
        {user ? (
          <>
            <DashboardMetrics metrics={metrics} loading={metricsLoading} />
            <LinksTable
              data={linksData}
              loading={linksLoading}
              currentPage={currentPage}
              searchQuery={searchQuery}
              onPageChange={setCurrentPage}
              onSearchChange={(q) => {
                setSearchQuery(q);
                setCurrentPage(1);
              }}
              onSelectLinkForAnalytics={(id) => setSelectedAnalyticsLinkId(id)}
              onRefresh={() => {
                loadLinks();
                loadMetrics();
              }}
            />
          </>
        ) : (
          /* Unauthenticated Preview Callout */
          <div className="w-full max-w-3xl p-8 rounded-2xl bg-gradient-to-b from-slate-900/90 to-slate-900/50 border border-slate-800 text-center shadow-xl backdrop-blur-xl mb-12">
            <h3 className="text-xl font-bold text-white mb-2">Sign In to View Real-Time Analytics</h3>
            <p className="text-xs sm:text-sm text-slate-400 max-w-md mx-auto mb-6">
              Track click volume, device breakdown (Mobile/Desktop), geographic referrers, and manage your shortened URLs with ease.
            </p>
            <button
              onClick={() => setIsAuthModalOpen(true)}
              className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-indigo-500 to-violet-600 hover:from-indigo-600 hover:to-violet-700 text-white font-medium text-sm shadow-lg shadow-indigo-500/25 transition-all"
            >
              Sign In with 1-Click Demo
            </button>
          </div>
        )}
      </main>

      {/* Modals */}
      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        onSuccess={(loggedUser) => setUser(loggedUser)}
      />

      <LinkAnalyticsModal
        linkId={selectedAnalyticsLinkId}
        onClose={() => setSelectedAnalyticsLinkId(null)}
      />

      {/* Footer */}
      <footer className="border-t border-slate-800/80 bg-slate-900/40 backdrop-blur-md py-6">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-400">
          <div className="flex items-center space-x-2">
            <div className="h-6 w-6 rounded-lg bg-indigo-500/20 text-indigo-400 flex items-center justify-center font-bold text-xs">
              S
            </div>
            <span className="font-semibold text-slate-300">ShortX SaaS Monorepo</span>
            <span>•</span>
            <span>Bitly-Scale Architecture</span>
          </div>

          <div className="flex flex-wrap items-center gap-3 text-[11px] font-mono text-slate-400">
            <span className="flex items-center gap-1"><Server className="h-3 w-3 text-indigo-400" /> Express + TS</span>
            <span>•</span>
            <span className="flex items-center gap-1"><Database className="h-3 w-3 text-sky-400" /> Neon PostgreSQL</span>
            <span>•</span>
            <span className="flex items-center gap-1"><Zap className="h-3 w-3 text-amber-400" /> Redis Cache</span>
            <span>•</span>
            <span className="flex items-center gap-1"><ShieldCheck className="h-3 w-3 text-emerald-400" /> SSRF & RateLimit</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
export default App;
