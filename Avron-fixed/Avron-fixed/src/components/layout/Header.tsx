import { useState, useRef, useEffect } from 'react';
import {
  Menu, Sun, Moon, Bell, Search, ChevronDown, CheckCheck, X,
  User, Settings, LogOut,
} from 'lucide-react';
import { useTheme } from '../../contexts/ThemeContext';
import { useAuth } from '../../contexts/AuthContext';
import { useNotifications } from '../../contexts/NotificationContext';
import { useRouter } from '../../contexts/RouterContext';
import { cn, formatDate, getInitials } from '../../lib/utils';
import { ROLE_LABELS } from '../../types';

interface HeaderProps {
  onMobileMenuOpen: () => void;
  pageTitle: string;
}

const notifTypeIcon: Record<string, string> = {
  info: '📋', success: '✅', warning: '⚠️', error: '🔴', critical: '🚨',
};

export function Header({ onMobileMenuOpen, pageTitle }: HeaderProps) {
  const { toggleTheme, isDark } = useTheme();
  const { profile, signOut } = useAuth();
  const { notifications, unreadCount, markAsRead, markAllAsRead } = useNotifications();
  const { navigate } = useRouter();

  const [notifOpen, setNotifOpen]   = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const notifRef   = useRef<HTMLDivElement>(null);
  const profileRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) setNotifOpen(false);
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) setProfileOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const recent5 = notifications.slice(0, 5);

  return (
    <header className="h-14 flex items-center gap-3 px-4 bg-white dark:bg-slate-800
                       border-b border-slate-100 dark:border-slate-700 sticky top-0 z-30
                       shadow-sm">
      {/* Mobile menu button */}
      <button
        onClick={onMobileMenuOpen}
        className="lg:hidden p-2 rounded-lg text-slate-500 hover:bg-slate-100
                   dark:text-slate-400 dark:hover:bg-slate-700 transition-colors"
      >
        <Menu size={20} />
      </button>

      {/* Page title */}
      <h1 className="text-sm font-semibold text-slate-700 dark:text-slate-200 hidden sm:block">
        {pageTitle}
      </h1>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Search bar */}
      <div className="hidden md:flex items-center gap-2 bg-slate-100 dark:bg-slate-700/50
                      border border-slate-200 dark:border-slate-600 rounded-lg
                      px-3 py-2 w-56 xl:w-72">
        <Search size={14} className="text-slate-400 flex-shrink-0" />
        <input
          type="text"
          placeholder="Search patients, staff..."
          className="bg-transparent text-sm text-slate-700 dark:text-slate-300
                     placeholder-slate-400 outline-none flex-1 min-w-0"
        />
      </div>

      {/* Theme toggle */}
      <button
        onClick={toggleTheme}
        className="p-2 rounded-lg text-slate-500 hover:bg-slate-100
                   dark:text-slate-400 dark:hover:bg-slate-700 transition-colors"
        title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      >
        {isDark ? <Sun size={18} /> : <Moon size={18} />}
      </button>

      {/* Notifications */}
      <div className="relative" ref={notifRef}>
        <button
          onClick={() => { setNotifOpen(o => !o); setProfileOpen(false); }}
          className="relative p-2 rounded-lg text-slate-500 hover:bg-slate-100
                     dark:text-slate-400 dark:hover:bg-slate-700 transition-colors"
        >
          <Bell size={18} />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 h-4 min-w-4 px-1
                             bg-brand-red-500 text-white text-[10px] font-bold
                             rounded-full flex items-center justify-center">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </button>

        {notifOpen && (
          <div className="absolute right-0 top-full mt-2 w-80 bg-white dark:bg-slate-800
                          border border-slate-200 dark:border-slate-700 rounded-xl shadow-card-lg
                          animate-slide-up z-50 overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b
                            border-slate-100 dark:border-slate-700">
              <span className="text-sm font-semibold text-slate-900 dark:text-white">
                Notifications
                {unreadCount > 0 && (
                  <span className="ml-1.5 text-xs text-brand-blue-500">({unreadCount} new)</span>
                )}
              </span>
              {unreadCount > 0 && (
                <button
                  onClick={() => markAllAsRead()}
                  className="flex items-center gap-1 text-xs text-brand-blue-600
                             dark:text-brand-blue-400 hover:underline"
                >
                  <CheckCheck size={12} /> Mark all read
                </button>
              )}
            </div>

            <div className="max-h-72 overflow-y-auto">
              {recent5.length === 0 ? (
                <div className="p-6 text-center text-sm text-slate-400">
                  No notifications yet
                </div>
              ) : (
                recent5.map(n => (
                  <div
                    key={n.id}
                    onClick={() => markAsRead(n.id)}
                    className={cn(
                      'flex items-start gap-3 px-4 py-3 border-b border-slate-50 dark:border-slate-700/50',
                      'hover:bg-slate-50 dark:hover:bg-slate-700/30 cursor-pointer transition-colors',
                      !n.is_read && 'bg-brand-blue-50/50 dark:bg-brand-blue-900/10',
                    )}
                  >
                    <span className="text-lg leading-none mt-0.5 flex-shrink-0">
                      {notifTypeIcon[n.type] ?? '📌'}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className={cn(
                        'text-sm truncate',
                        n.is_read ? 'text-slate-600 dark:text-slate-400' : 'text-slate-900 dark:text-white font-medium',
                      )}>
                        {n.title}
                      </p>
                      <p className="text-xs text-slate-500 truncate">{n.message}</p>
                      <p className="text-[10px] text-slate-400 mt-0.5">{formatDate(n.created_at)}</p>
                    </div>
                    {!n.is_read && (
                      <div className="h-2 w-2 rounded-full bg-brand-blue-500 flex-shrink-0 mt-1.5" />
                    )}
                  </div>
                ))
              )}
            </div>

            <div className="px-4 py-2.5 border-t border-slate-100 dark:border-slate-700">
              <button
                onClick={() => { setNotifOpen(false); navigate('notifications'); }}
                className="w-full text-center text-xs text-brand-blue-600 dark:text-brand-blue-400
                           hover:underline font-medium"
              >
                View all notifications
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Profile menu */}
      <div className="relative" ref={profileRef}>
        <button
          onClick={() => { setProfileOpen(o => !o); setNotifOpen(false); }}
          className="flex items-center gap-2 rounded-lg px-2 py-1.5
                     hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
        >
          <div className="h-7 w-7 rounded-lg bg-brand-blue-600 flex items-center justify-center
                          text-white text-xs font-bold flex-shrink-0">
            {profile ? getInitials(profile.full_name || profile.email || 'U') : 'U'}
          </div>
          <div className="hidden sm:block text-left">
            <p className="text-xs font-semibold text-slate-800 dark:text-slate-200 leading-tight truncate max-w-[100px]">
              {profile?.full_name || 'User'}
            </p>
            <p className="text-[10px] text-slate-500 leading-tight truncate max-w-[100px]">
              {profile ? ROLE_LABELS[profile.role] : ''}
            </p>
          </div>
          <ChevronDown size={14} className="text-slate-400 hidden sm:block" />
        </button>

        {profileOpen && (
          <div className="absolute right-0 top-full mt-2 w-48 bg-white dark:bg-slate-800
                          border border-slate-200 dark:border-slate-700 rounded-xl shadow-card-lg
                          animate-slide-up z-50 overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-700">
              <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                {profile?.full_name || 'User'}
              </p>
              <p className="text-xs text-slate-500 truncate">{profile?.email}</p>
            </div>
            <div className="py-1">
              {[
                { icon: User, label: 'My Profile', action: () => { setProfileOpen(false); navigate('profile'); } },
                { icon: Settings, label: 'Settings', action: () => { setProfileOpen(false); navigate('settings'); } },
              ].map(({ icon: Icon, label, action }) => (
                <button
                  key={label}
                  onClick={action}
                  className="flex items-center gap-3 w-full px-4 py-2 text-sm
                             text-slate-700 dark:text-slate-300 hover:bg-slate-50
                             dark:hover:bg-slate-700 transition-colors"
                >
                  <Icon size={15} />
                  {label}
                </button>
              ))}
              <div className="border-t border-slate-100 dark:border-slate-700 my-1" />
              <button
                onClick={signOut}
                className="flex items-center gap-3 w-full px-4 py-2 text-sm
                           text-brand-red-600 dark:text-brand-red-400 hover:bg-brand-red-50
                           dark:hover:bg-brand-red-900/20 transition-colors"
              >
                <LogOut size={15} /> Sign Out
              </button>
            </div>
          </div>
        )}
      </div>
    </header>
  );
}
