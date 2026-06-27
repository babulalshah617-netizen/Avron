import { useState } from 'react';
import {
  LayoutDashboard, Users, Building2, BedDouble, Ticket,
  Bell, ClipboardList, Settings, LogOut, ChevronLeft,
  ChevronRight, X, Map, ShieldCheck, Activity,
  Pill, Scan, FlaskConical, Syringe, Package, Truck,
  HardDrive, ChevronDown, UserCircle,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useRouter } from '../../contexts/RouterContext';
import { useNotifications } from '../../contexts/NotificationContext';
import { cn, getInitials } from '../../lib/utils';
import type { AppRoute, HospitalRole } from '../../types';
import { ROLE_LABELS } from '../../types';

interface NavItem {
  id: AppRoute;
  label: string;
  icon: typeof LayoutDashboard;
  badge?: number;
  roles?: HospitalRole[];
}

interface NavGroup {
  label: string;
  phase: string;
  items: NavItem[];
}

const NAV_GROUPS: NavGroup[] = [
  {
    label: 'Overview',
    phase: '',
    items: [
      { id: 'dashboard',   label: 'Dashboard',    icon: LayoutDashboard },
      { id: 'floor-map',  label: 'Floor Map',    icon: Map },
      { id: 'notifications', label: 'Notifications', icon: Bell },
    ],
  },
  {
    label: 'Administration',
    phase: 'Phase 1',
    items: [
      { id: 'users',       label: 'Users',        icon: Users,      roles: ['super_admin','md','department_head'] },
      { id: 'departments', label: 'Departments',  icon: Building2 },
      { id: 'audit-logs', label: 'Audit Logs',   icon: ShieldCheck, roles: ['super_admin','md'] },
      { id: 'settings',   label: 'Settings',      icon: Settings,   roles: ['super_admin'] },
    ],
  },
  {
    label: 'Bed Management',
    phase: 'Phase 2',
    items: [
      { id: 'bed-management', label: 'Beds & Rooms', icon: BedDouble },
    ],
  },
  {
    label: 'Workflows',
    phase: 'Phase 3',
    items: [
      { id: 'requisitions', label: 'Requisitions', icon: ClipboardList },
      { id: 'discharge',    label: 'Discharge',    icon: Activity },
    ],
  },
  {
    label: 'Support Tickets',
    phase: 'Phase 4',
    items: [
      { id: 'tickets', label: 'Tickets', icon: Ticket },
    ],
  },
  {
    label: 'Departments',
    phase: 'Phase 5',
    items: [
      { id: 'pharmacy',  label: 'Pharmacy',   icon: Pill },
      { id: 'radiology', label: 'Radiology',  icon: Scan },
      { id: 'lab',       label: 'Laboratory', icon: FlaskConical },
      { id: 'chemo',     label: 'Chemo',      icon: Syringe },
    ],
  },
  {
    label: 'Logistics',
    phase: 'Phase 6',
    items: [
      { id: 'media',      label: 'Media Files', icon: Package },
      { id: 'deliveries', label: 'Deliveries',  icon: Truck },
    ],
  },
  {
    label: 'Asset Management',
    phase: 'Phase 8',
    items: [
      { id: 'assets', label: 'Assets & QR', icon: HardDrive },
    ],
  },
];

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
  mobileOpen: boolean;
  onMobileClose: () => void;
}

export function Sidebar({ collapsed, onToggle, mobileOpen, onMobileClose }: SidebarProps) {
  const { profile, signOut, hasRole } = useAuth();
  const { navigate, route } = useRouter();
  const { unreadCount } = useNotifications();
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());

  const toggleGroup = (label: string) => {
    setCollapsedGroups(prev => {
      const next = new Set(prev);
      if (next.has(label)) next.delete(label);
      else next.add(label);
      return next;
    });
  };

  const handleNav = (id: AppRoute) => {
    navigate(id);
    onMobileClose();
  };

  const visibleGroups = NAV_GROUPS.map(group => ({
    ...group,
    items: group.items.filter(item => !item.roles || hasRole(...item.roles)),
  })).filter(g => g.items.length > 0);

  const SidebarContent = (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className={cn(
        'flex items-center border-b border-white/10 flex-shrink-0',
        collapsed ? 'p-3.5 justify-center' : 'px-4 py-3.5 gap-3',
      )}>
        <img src="/assets/images/image copy copy.png" alt="Avron" className="h-8 w-auto flex-shrink-0" />
        {!collapsed && (
          <div className="min-w-0">
            <p className="text-white font-bold text-sm leading-tight tracking-tight">AVRON HOSPITALS</p>
            <p className="text-brand-blue-400 text-[9px] font-semibold tracking-[0.15em]">ERP SYSTEM</p>
          </div>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-0.5">
        {visibleGroups.map(group => (
          <div key={group.label}>
            {/* Group header */}
            {!collapsed ? (
              <button
                onClick={() => toggleGroup(group.label)}
                className="flex items-center justify-between w-full px-2 py-1.5 mb-0.5 group"
              >
                <div className="flex items-center gap-1.5">
                  <span className="text-[9px] font-bold tracking-[0.15em] text-slate-600 uppercase">
                    {group.label}
                  </span>
                  {group.phase && (
                    <span className="text-[8px] text-slate-700 border border-slate-700 rounded px-1 py-px">
                      {group.phase}
                    </span>
                  )}
                </div>
                <ChevronDown
                  size={12}
                  className={cn(
                    'text-slate-700 transition-transform',
                    collapsedGroups.has(group.label) && '-rotate-90',
                  )}
                />
              </button>
            ) : (
              <div className="border-t border-white/5 my-2" />
            )}

            {/* Nav items */}
            {!collapsedGroups.has(group.label) && (
              <div className="space-y-0.5">
                {group.items.map(item => {
                  const Icon = item.icon;
                  const isActive = route === item.id;
                  const badge = item.id === 'notifications' ? unreadCount : undefined;
                  return (
                    <button
                      key={item.id}
                      onClick={() => handleNav(item.id)}
                      className={cn(
                        'flex items-center gap-2.5 w-full rounded-lg px-2.5 py-2 text-sm font-medium transition-all duration-150',
                        isActive
                          ? 'bg-brand-blue-600 text-white shadow-lg shadow-brand-blue-900/30'
                          : 'text-slate-400 hover:text-white hover:bg-white/10',
                        collapsed && 'justify-center px-2',
                      )}
                      title={collapsed ? item.label : undefined}
                    >
                      <div className="relative flex-shrink-0">
                        <Icon size={16} />
                        {badge != null && badge > 0 && (
                          <span className="absolute -top-1.5 -right-1.5 h-3.5 min-w-3.5 px-0.5
                                           bg-brand-red-500 text-white text-[9px] font-bold
                                           rounded-full flex items-center justify-center">
                            {badge > 9 ? '9+' : badge}
                          </span>
                        )}
                      </div>
                      {!collapsed && <span className="truncate">{item.label}</span>}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        ))}
      </nav>

      {/* Bottom */}
      <div className="border-t border-white/10 p-2 space-y-1 flex-shrink-0">
        <button
          onClick={() => handleNav('profile')}
          className={cn(
            'flex items-center gap-2.5 w-full rounded-lg p-2 hover:bg-white/10 transition-colors',
            collapsed && 'justify-center',
          )}
        >
          <div className="h-7 w-7 rounded-lg bg-brand-blue-600 flex-shrink-0
                          flex items-center justify-center text-white text-xs font-bold">
            {profile ? getInitials(profile.full_name || profile.email || 'U') : 'U'}
          </div>
          {!collapsed && (
            <div className="flex-1 min-w-0 text-left">
              <p className="text-xs font-semibold text-white truncate">{profile?.full_name || 'User'}</p>
              <p className="text-[10px] text-slate-500 truncate">{profile ? ROLE_LABELS[profile.role] : ''}</p>
            </div>
          )}
          {!collapsed && <UserCircle size={14} className="text-slate-600 flex-shrink-0" />}
        </button>

        <button
          onClick={signOut}
          className={cn(
            'flex items-center gap-2.5 w-full rounded-lg px-2.5 py-2 text-xs text-slate-600',
            'hover:text-brand-red-400 hover:bg-white/5 transition-colors',
            collapsed && 'justify-center',
          )}
          title={collapsed ? 'Sign Out' : undefined}
        >
          <LogOut size={14} />
          {!collapsed && <span>Sign Out</span>}
        </button>

        <button
          onClick={onToggle}
          className={cn(
            'hidden lg:flex items-center gap-2 w-full rounded-lg px-2.5 py-1.5',
            'text-[10px] text-slate-700 hover:text-slate-400 transition-colors',
            collapsed && 'justify-center',
          )}
        >
          {collapsed ? <ChevronRight size={12} /> : <><ChevronLeft size={12} /><span>Collapse</span></>}
        </button>
      </div>
    </div>
  );

  return (
    <>
      <aside className={cn(
        'hidden lg:flex flex-col bg-sidebar h-screen sticky top-0 flex-shrink-0',
        'transition-all duration-300 border-r border-white/5',
        collapsed ? 'w-14' : 'w-56',
      )}>
        {SidebarContent}
      </aside>

      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-40 flex">
          <div className="absolute inset-0 bg-black/60" onClick={onMobileClose} />
          <aside className="relative z-50 w-60 bg-sidebar flex flex-col h-full animate-slide-in-left">
            <button onClick={onMobileClose} className="absolute top-3 right-3 p-1.5 text-slate-400 hover:text-white">
              <X size={18} />
            </button>
            {SidebarContent}
          </aside>
        </div>
      )}
    </>
  );
}
