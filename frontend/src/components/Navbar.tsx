import React from 'react';
import { User, HealthData } from '../types';
import { LogOut, LogIn, Link2, Zap } from 'lucide-react';

interface NavbarProps {
  user: User | null;
  health: HealthData | null;
  onOpenAuth: () => void;
  onLogout: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({ user, health, onOpenAuth, onLogout }) => {
  return (
    <header className="border-b border-slate-800/80 bg-slate-900/60 backdrop-blur-xl sticky top-0 z-40 transition-colors">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
        {/* Brand */}
        <div className="flex items-center space-x-3">
          <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-indigo-500 via-indigo-600 to-violet-500 flex items-center justify-center shadow-lg shadow-indigo-500/25 text-white">
            <Link2 className="h-5 w-5" />
          </div>
          <div className="flex flex-col">
            <span className="font-black text-xl tracking-tight bg-gradient-to-r from-white via-slate-100 to-slate-400 bg-clip-text text-transparent">
              Short<span className="text-indigo-400">X</span>
            </span>
            <span className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">
              URL Shortener & Analytics
            </span>
          </div>
        </div>

        {/* System Health Pill & User Section */}
        <div className="flex items-center space-x-3 sm:space-x-4">
          {/* Health status pill */}
          <div className="hidden sm:flex items-center space-x-2 px-3 py-1.5 rounded-full bg-slate-800/60 border border-slate-700/60 text-xs">
            <div className={`h-2 w-2 rounded-full ${health?.status === 'ok' ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`} />
            <span className="text-slate-300 font-medium">
              {health?.status === 'ok' ? 'System Operational' : 'Connecting...'}
            </span>
            <span className="text-slate-500">|</span>
            <span className="text-slate-400 flex items-center gap-1 font-mono text-[11px]">
              <Zap className="h-3 w-3 text-indigo-400" />
              Redis + Neon
            </span>
          </div>

          {/* User actions */}
          {user ? (
            <div className="flex items-center space-x-3">
              <div className="flex items-center space-x-2 px-3 py-1.5 rounded-xl bg-slate-800/80 border border-slate-700/80">
                <div className="h-7 w-7 rounded-lg bg-gradient-to-tr from-indigo-600 to-violet-600 flex items-center justify-center text-xs font-bold text-white uppercase">
                  {user.name ? user.name.charAt(0) : user.email.charAt(0)}
                </div>
                <div className="hidden md:flex flex-col text-left">
                  <span className="text-xs font-semibold text-slate-200">{user.name || 'User'}</span>
                  <span className="text-[10px] text-slate-400 font-mono truncate max-w-[120px]">{user.email}</span>
                </div>
              </div>

              <button
                onClick={onLogout}
                className="p-2 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-xl transition-colors border border-transparent hover:border-rose-500/20"
                title="Sign Out"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <button
              onClick={onOpenAuth}
              className="inline-flex items-center space-x-2 px-4 py-2 rounded-xl bg-gradient-to-r from-indigo-500 to-violet-600 hover:from-indigo-600 hover:to-violet-700 text-white font-medium text-xs sm:text-sm shadow-md shadow-indigo-500/20 transition-all hover:shadow-indigo-500/30"
            >
              <LogIn className="h-4 w-4" />
              <span>Sign In / Register</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
export default Navbar;
