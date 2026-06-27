import { useState } from 'react';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { useRouter } from '../../contexts/RouterContext';
import type { AppRoute } from '../../types';

const PAGE_TITLES: Record<AppRoute, string> = {
  login: 'Login', 'admin-portal': 'Administration Portal', 'forgot-password': 'Password Recovery',
  dashboard: 'Dashboard Overview', users: 'User Management', departments: 'Department Management',
  'floor-map': 'Hospital Floor Map', notifications: 'Notifications', 'audit-logs': 'Audit Logs',
  profile: 'My Profile', settings: 'System Settings',
  'bed-management': 'Bed & Room Management', requisitions: 'Requisition System',
  discharge: 'Discharge Workflow', tickets: 'Support Tickets', 'ticket-detail': 'Ticket Detail',
  pharmacy: 'Pharmacy', radiology: 'Radiology & Imaging', lab: 'Laboratory',
  chemo: 'Chemotherapy', media: 'Media Files', deliveries: 'Delivery Tracking',
  assets: 'Asset Management',
};

export function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { route } = useRouter();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50 dark:bg-slate-900">
      <Sidebar
        collapsed={collapsed}
        onToggle={() => setCollapsed(c => !c)}
        mobileOpen={mobileOpen}
        onMobileClose={() => setMobileOpen(false)}
      />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <Header
          onMobileMenuOpen={() => setMobileOpen(true)}
          pageTitle={PAGE_TITLES[route] ?? 'AVRON ERP'}
        />
        <main className="flex-1 overflow-y-auto p-4 sm:p-6">{children}</main>
      </div>
    </div>
  );
}
