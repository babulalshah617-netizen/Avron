import { RouterProvider, useRouter } from './contexts/RouterContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { NotificationProvider } from './contexts/NotificationContext';
import { DashboardLayout } from './components/layout/DashboardLayout';
import { ToastContainer } from './components/ui/Toast';
import { FullPageLoader } from './components/ui/Spinner';

import { LoginPage } from './pages/LoginPage';
import { AdminPortalPage } from './pages/AdminPortalPage';
import { ForgotPasswordPage } from './pages/ForgotPasswordPage';
import { DashboardHome } from './pages/DashboardHome';
import { UserManagementPage } from './pages/UserManagementPage';
import { DepartmentManagementPage } from './pages/DepartmentManagementPage';
import { FloorMapPage } from './pages/FloorMapPage';
import { NotificationsPage } from './pages/NotificationsPage';
import { AuditLogsPage } from './pages/AuditLogsPage';
import { ProfilePage } from './pages/ProfilePage';
import { SettingsPage } from './pages/SettingsPage';
import { StaffRegistrationPage } from './pages/StaffRegistrationPage';
import { InitializeMDPage } from './pages/InitializeMDPage';
import { BedManagementPage } from './pages/BedManagementPage';
import { RequisitionsPage } from './pages/RequisitionsPage';
import { DischargePage } from './pages/DischargePage';
import { TicketsPage } from './pages/TicketsPage';
import { PharmacyPage } from './pages/PharmacyPage';
import { RadiologyPage } from './pages/RadiologyPage';
import { LabPage } from './pages/LabPage';
import { ChemoPage } from './pages/ChemoPage';
import { MediaFilesPage } from './pages/MediaFilesPage';
import { DeliveriesPage } from './pages/DeliveriesPage';
import { AssetsPage } from './pages/AssetsPage';

const PUBLIC_ROUTES = new Set(['login', 'admin-portal', 'forgot-password', 'register', 'initialize-md']);

function AppRouter() {
  const { user, loading } = useAuth();
  const { route, navigate } = useRouter();

  if (loading) return <FullPageLoader />;

  // Redirect unauthenticated users to login
  if (!user && !PUBLIC_ROUTES.has(route)) {
    navigate('login');
    return <FullPageLoader />;
  }

  // Redirect authenticated users away from auth pages
  if (user && PUBLIC_ROUTES.has(route)) {
    navigate('dashboard');
    return <FullPageLoader />;
  }

  // Public routes
  if (route === 'login')           return <LoginPage />;
  if (route === 'admin-portal')    return <AdminPortalPage />;
  if (route === 'forgot-password') return <ForgotPasswordPage />;
  if (route === 'register')        return <StaffRegistrationPage />;
  if (route === 'initialize-md')   return <InitializeMDPage />;

  // Protected dashboard routes
  const dashboardContent = (() => {
    switch (route) {
      case 'dashboard':     return <DashboardHome />;
      case 'users':         return <UserManagementPage />;
      case 'departments':   return <DepartmentManagementPage />;
      case 'floor-map':     return <FloorMapPage />;
      case 'notifications': return <NotificationsPage />;
      case 'audit-logs':    return <AuditLogsPage />;
      case 'profile':       return <ProfilePage />;
      case 'settings':      return <SettingsPage />;
      case 'bed-management': return <BedManagementPage />;
      case 'requisitions':  return <RequisitionsPage />;
      case 'discharge':     return <DischargePage />;
      case 'tickets':       return <TicketsPage />;
      case 'pharmacy':      return <PharmacyPage />;
      case 'radiology':     return <RadiologyPage />;
      case 'lab':           return <LabPage />;
      case 'chemo':         return <ChemoPage />;
      case 'media':         return <MediaFilesPage />;
      case 'deliveries':    return <DeliveriesPage />;
      case 'assets':        return <AssetsPage />;
      default:              return <DashboardHome />;
    }
  })();

  return (
    <DashboardLayout>
      {dashboardContent}
    </DashboardLayout>
  );
}

export default function App() {
  return (
    <RouterProvider>
      <ThemeProvider>
        <AuthProvider>
          <NotificationProvider>
            <AppRouter />
            <ToastContainer />
          </NotificationProvider>
        </AuthProvider>
      </ThemeProvider>
    </RouterProvider>
  );
}
