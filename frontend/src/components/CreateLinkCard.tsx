import React, { useState } from 'react';
import { api } from '../api/client';
import { LinkItem } from '../types';
import { Link2, Sparkles, Copy, Check, ChevronDown, ChevronUp, ExternalLink, Calendar, Tag } from 'lucide-react';

interface CreateLinkCardProps {
  isAuthenticated: boolean;
  onLinkCreated: (link: LinkItem) => void;
  onRequireAuth: () => void;
}

export const CreateLinkCard: React.FC<CreateLinkCardProps> = ({
  isAuthenticated,
  onLinkCreated,
  onRequireAuth,
}) => {
  const [destinationUrl, setDestinationUrl] = useState('');
  const [title, setTitle] = useState('');
  const [customAlias, setCustomAlias] = useState('');
  const [expiresAt, setExpiresAt] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdResult, setCreatedResult] = useState<{ shortUrl: string; link: LinkItem } | null>(null);
  const [copied, setCopied] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAuthenticated) {
      onRequireAuth();
      return;
    }

    setError(null);
    setCreatedResult(null);
    setLoading(true);

    try {
      const payload: {
        destinationUrl: string;
        title?: string;
        customAlias?: string;
        expiresAt?: string;
      } = {
        destinationUrl: destinationUrl.trim(),
      };

      if (title.trim()) payload.title = title.trim();
      if (customAlias.trim()) payload.customAlias = customAlias.trim();
      if (expiresAt) payload.expiresAt = new Date(expiresAt).toISOString();

      const res = await api.createLink(payload);
      setCreatedResult({ shortUrl: res.shortUrl, link: res.link });
      onLinkCreated(res.link);

      // Reset form
      setDestinationUrl('');
      setTitle('');
      setCustomAlias('');
      setExpiresAt('');
      setShowAdvanced(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create short link');
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = () => {
    if (!createdResult) return;
    navigator.clipboard.writeText(createdResult.shortUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="w-full max-w-3xl bg-slate-900/80 border border-slate-800 rounded-2xl p-6 sm:p-8 shadow-2xl backdrop-blur-xl relative overflow-hidden transition-all mb-8">
      <div className="absolute top-0 right-0 w-48 h-48 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="flex items-center space-x-3 mb-6">
        <div className="h-10 w-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center">
          <Link2 className="h-5 w-5" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight">Shorten a Long Link</h2>
          <p className="text-xs text-slate-400">High-speed URL shortening with real-time analytics & custom aliases</p>
        </div>
      </div>

      {error && (
        <div className="mb-5 p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs flex items-start space-x-2">
          <span className="font-semibold">Error:</span>
          <span>{error}</span>
        </div>
      )}

      {/* URL Input Form */}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <div className="relative flex items-center">
            <input
              type="url"
              required
              value={destinationUrl}
              onChange={(e) => setDestinationUrl(e.target.value)}
              placeholder="Paste long URL here (e.g. https://github.com/nodejs/node)..."
              className="w-full pl-4 pr-32 py-3.5 bg-slate-800/90 border border-slate-700 rounded-xl text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors"
            />
            <button
              type="submit"
              disabled={loading}
              className="absolute right-2 top-2 bottom-2 px-5 rounded-lg bg-gradient-to-r from-indigo-500 to-violet-600 hover:from-indigo-600 hover:to-violet-700 text-white font-medium text-xs sm:text-sm shadow-md shadow-indigo-500/20 transition-all flex items-center space-x-2 disabled:opacity-50"
            >
              {loading ? (
                <div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <span>Shorten</span>
                  <Sparkles className="h-4 w-4" />
                </>
              )}
            </button>
          </div>
        </div>

        {/* Collapsible Advanced Options Toggle */}
        <div className="pt-1">
          <button
            type="button"
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="inline-flex items-center space-x-1.5 text-xs text-indigo-400 hover:text-indigo-300 font-medium transition-colors"
          >
            <span>{showAdvanced ? 'Hide Custom Options' : 'Custom Alias, Title & Expiration'}</span>
            {showAdvanced ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          </button>
        </div>

        {/* Advanced Fields Container */}
        {showAdvanced && (
          <div className="p-4 rounded-xl bg-slate-800/50 border border-slate-700/60 grid grid-cols-1 sm:grid-cols-3 gap-3 animate-fade-in">
            <div>
              <label className="block text-[11px] font-medium text-slate-300 mb-1 flex items-center gap-1">
                <Tag className="h-3 w-3 text-indigo-400" />
                Custom Alias
              </label>
              <input
                type="text"
                value={customAlias}
                onChange={(e) => setCustomAlias(e.target.value)}
                placeholder="my-cool-link"
                className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-colors"
              />
            </div>

            <div>
              <label className="block text-[11px] font-medium text-slate-300 mb-1">Link Title</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Product Launch 2026"
                className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-colors"
              />
            </div>

            <div>
              <label className="block text-[11px] font-medium text-slate-300 mb-1 flex items-center gap-1">
                <Calendar className="h-3 w-3 text-indigo-400" />
                Expiration Date
              </label>
              <input
                type="datetime-local"
                value={expiresAt}
                onChange={(e) => setExpiresAt(e.target.value)}
                className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-xs text-slate-100 focus:outline-none focus:border-indigo-500 transition-colors"
              />
            </div>
          </div>
        )}
      </form>

      {/* Result Card when Link is created */}
      {createdResult && (
        <div className="mt-6 p-4 rounded-xl bg-gradient-to-r from-emerald-500/10 via-slate-800/80 to-slate-800/80 border border-emerald-500/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 animate-fade-in">
          <div className="flex flex-col">
            <span className="text-[11px] font-semibold text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
              <Check className="h-3.5 w-3.5" />
              Link Shortened Successfully!
            </span>
            <span className="text-base font-bold text-white font-mono mt-0.5 select-all">
              {createdResult.shortUrl}
            </span>
            <span className="text-xs text-slate-400 truncate max-w-sm sm:max-w-md mt-0.5">
              Target: {createdResult.link.destinationUrl}
            </span>
          </div>

          <div className="flex items-center space-x-2 w-full sm:w-auto">
            <button
              onClick={copyToClipboard}
              className={`flex-1 sm:flex-initial inline-flex items-center justify-center space-x-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold transition-all ${
                copied
                  ? 'bg-emerald-500 text-white shadow-md shadow-emerald-500/20'
                  : 'bg-slate-700 hover:bg-slate-600 text-slate-200'
              }`}
            >
              {copied ? (
                <>
                  <Check className="h-3.5 w-3.5" />
                  <span>Copied!</span>
                </>
              ) : (
                <>
                  <Copy className="h-3.5 w-3.5" />
                  <span>Copy Link</span>
                </>
              )}
            </button>

            <a
              href={createdResult.shortUrl}
              target="_blank"
              rel="noreferrer"
              className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg border border-slate-700 transition-colors"
              title="Test Redirect"
            >
              <ExternalLink className="h-4 w-4" />
            </a>
          </div>
        </div>
      )}
    </div>
  );
};
export default CreateLinkCard;
