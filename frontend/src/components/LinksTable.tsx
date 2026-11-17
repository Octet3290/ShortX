import React, { useState } from 'react';
import { LinkItem, LinksResponse } from '../types';
import { api } from '../api/client';
import {
  Search,
  Copy,
  Check,
  ExternalLink,
  BarChart2,
  Trash2,
  Power,
  ChevronLeft,
  ChevronRight,
  Link2,
} from 'lucide-react';

interface LinksTableProps {
  data: LinksResponse | null;
  loading: boolean;
  currentPage: number;
  searchQuery: string;
  onPageChange: (page: number) => void;
  onSearchChange: (search: string) => void;
  onSelectLinkForAnalytics: (linkId: string) => void;
  onRefresh: () => void;
}

export const LinksTable: React.FC<LinksTableProps> = ({
  data,
  loading,
  currentPage,
  searchQuery,
  onPageChange,
  onSearchChange,
  onSelectLinkForAnalytics,
  onRefresh,
}) => {
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  const copyShortUrl = (link: LinkItem) => {
    const fullUrl = `http://localhost:5000/${link.shortCode}`;
    navigator.clipboard.writeText(fullUrl);
    setCopiedId(link.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleToggleActive = async (link: LinkItem) => {
    setActionLoadingId(link.id);
    try {
      await api.updateLink(link.id, { isActive: !link.isActive });
      onRefresh();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to update link status');
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleDelete = async (link: LinkItem) => {
    if (!window.confirm(`Are you sure you want to delete /${link.shortCode}? This will permanently remove its analytics.`)) {
      return;
    }

    setActionLoadingId(link.id);
    try {
      await api.deleteLink(link.id);
      onRefresh();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to delete link');
    } finally {
      setActionLoadingId(null);
    }
  };

  const links = data?.links || [];
  const pagination = data?.pagination || { page: 1, totalPages: 1, totalCount: 0 };

  return (
    <div className="w-full max-w-6xl bg-slate-900/80 border border-slate-800 rounded-2xl p-6 shadow-2xl backdrop-blur-xl mb-12">
      {/* Table Header & Search */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
            <Link2 className="h-5 w-5 text-indigo-400" />
            Link Management
          </h2>
          <p className="text-xs text-slate-400">
            {pagination.totalCount} shortened URL{pagination.totalCount === 1 ? '' : 's'} managed
          </p>
        </div>

        {/* Search Filter */}
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search links by code, title, URL..."
            className="w-full pl-9 pr-4 py-2 bg-slate-800/80 border border-slate-700 rounded-xl text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-colors"
          />
        </div>
      </div>

      {/* Table Content */}
      {loading ? (
        <div className="py-20 flex flex-col items-center justify-center space-y-3">
          <div className="h-8 w-8 border-2 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin" />
          <span className="text-xs text-slate-400">Loading your shortened links...</span>
        </div>
      ) : links.length === 0 ? (
        <div className="py-16 text-center border border-dashed border-slate-800 rounded-xl">
          <div className="h-12 w-12 rounded-2xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center mx-auto mb-3">
            <Link2 className="h-6 w-6" />
          </div>
          <h3 className="text-base font-bold text-white mb-1">No Links Found</h3>
          <p className="text-xs text-slate-400 max-w-sm mx-auto mb-4">
            {searchQuery
              ? `No links matched your query "${searchQuery}". Try a different keyword.`
              : 'Shorten your first long link above to start tracking clicks and visitor analytics!'}
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400 uppercase tracking-wider text-[11px]">
                <th className="pb-3 font-semibold">Short Link & Title</th>
                <th className="pb-3 font-semibold">Destination URL</th>
                <th className="pb-3 font-semibold text-center">Clicks</th>
                <th className="pb-3 font-semibold text-center">Status</th>
                <th className="pb-3 font-semibold">Created</th>
                <th className="pb-3 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {links.map((link) => {
                const isCopied = copiedId === link.id;
                const isOperating = actionLoadingId === link.id;
                const fullShortUrl = `http://localhost:5000/${link.shortCode}`;

                return (
                  <tr key={link.id} className="hover:bg-slate-800/30 transition-colors group">
                    {/* Short Code & Title */}
                    <td className="py-4 pr-3">
                      <div className="flex flex-col">
                        <span className="font-mono font-bold text-indigo-400 flex items-center gap-1.5 text-sm">
                          /{link.shortCode}
                        </span>
                        <span className="text-slate-300 font-medium truncate max-w-[180px]">
                          {link.title || 'Untitled Link'}
                        </span>
                      </div>
                    </td>

                    {/* Destination URL */}
                    <td className="py-4 pr-3">
                      <div className="flex items-center space-x-1.5 max-w-[240px] lg:max-w-xs">
                        <span className="text-slate-400 truncate" title={link.destinationUrl}>
                          {link.destinationUrl}
                        </span>
                        <a
                          href={link.destinationUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-slate-200 transition-opacity"
                        >
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      </div>
                    </td>

                    {/* Clicks Badge */}
                    <td className="py-4 text-center px-2">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-mono font-bold bg-indigo-500/10 text-indigo-300 border border-indigo-500/20">
                        {link.clicksCount.toLocaleString()}
                      </span>
                    </td>

                    {/* Active/Inactive Status Toggle */}
                    <td className="py-4 text-center px-2">
                      <button
                        onClick={() => handleToggleActive(link)}
                        disabled={isOperating}
                        className={`inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-[11px] font-semibold border transition-all ${
                          link.isActive
                            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/20'
                            : 'bg-slate-800 text-slate-400 border-slate-700 hover:bg-slate-700'
                        }`}
                        title="Click to toggle active status"
                      >
                        <Power className="h-3 w-3" />
                        <span>{link.isActive ? 'Active' : 'Disabled'}</span>
                      </button>
                    </td>

                    {/* Created Date */}
                    <td className="py-4 text-slate-400 font-mono text-[11px]">
                      {new Date(link.createdAt).toLocaleDateString(undefined, {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    </td>

                    {/* Actions */}
                    <td className="py-4 text-right space-x-1">
                      {/* Copy Button */}
                      <button
                        onClick={() => copyShortUrl(link)}
                        className={`p-1.5 rounded-lg border transition-all ${
                          isCopied
                            ? 'bg-emerald-500 text-white border-emerald-500'
                            : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700'
                        }`}
                        title="Copy Short Link"
                      >
                        {isCopied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                      </button>

                      {/* Direct Test Link */}
                      <a
                        href={fullShortUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-block p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-colors"
                        title="Open Short Link in New Tab"
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>

                      {/* Analytics Deep-Dive Modal */}
                      <button
                        onClick={() => onSelectLinkForAnalytics(link.id)}
                        className="p-1.5 rounded-lg bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 border border-indigo-500/20 transition-colors"
                        title="View Detailed Analytics"
                      >
                        <BarChart2 className="h-3.5 w-3.5" />
                      </button>

                      {/* Delete Button */}
                      <button
                        onClick={() => handleDelete(link)}
                        disabled={isOperating}
                        className="p-1.5 rounded-lg hover:bg-rose-500/10 text-slate-400 hover:text-rose-400 border border-transparent hover:border-rose-500/20 transition-colors"
                        title="Delete Link"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination Controls */}
      {pagination.totalPages > 1 && (
        <div className="mt-6 pt-4 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
          <span>
            Showing Page <strong className="text-white">{pagination.page}</strong> of{' '}
            <strong className="text-white">{pagination.totalPages}</strong>
          </span>

          <div className="flex items-center space-x-2">
            <button
              onClick={() => onPageChange(currentPage - 1)}
              disabled={currentPage <= 1 || loading}
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-40 disabled:hover:bg-slate-800 text-slate-300 transition-colors border border-slate-700"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              onClick={() => onPageChange(currentPage + 1)}
              disabled={currentPage >= pagination.totalPages || loading}
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-40 disabled:hover:bg-slate-800 text-slate-300 transition-colors border border-slate-700"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
export default LinksTable;
