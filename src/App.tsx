import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import DashboardPage from './features/dashboard/DashboardPage';
import DesignKitPage from './features/dashboard/DesignKitPage';
import GroupPage from './features/groups/GroupPage';
import { GroupSwitcher } from './features/groups/components/GroupSwitcher';
import MembersPage from './features/members/MembersPage';
import CreateSessionPage from './features/sessions/CreateSessionPage';
import SessionDetailPage from './features/sessions/SessionDetailPage';
import SessionsPage from './features/sessions/SessionsPage';
import { AppShell } from './shared/components/AppShell';
import { ThemeProvider } from './shared/theme/ThemeProvider';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000, // 30 seconds
      retry: 1,
    },
  },
});

/**
 * Routes. Adding a page? Add the <Route> here and ONE entry in
 * src/shared/components/navItems.ts. Gavin: your matchmaking/tournament
 * routes go inside the AppShell route below.
 */
export default function App() {
  return (
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <Routes>
            <Route element={<AppShell groupSwitcher={<GroupSwitcher />} />}>
              <Route path="/" element={<DashboardPage />} />
              <Route path="/groups/:id" element={<GroupPage />} />
              <Route path="/sessions" element={<SessionsPage />} />
              <Route path="/sessions/new" element={<CreateSessionPage />} />
              <Route path="/sessions/:id" element={<SessionDetailPage />} />
              <Route path="/members" element={<MembersPage />} />
              {/* Developer reference for the shared components */}
              <Route path="/design-kit" element={<DesignKitPage />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </QueryClientProvider>
    </ThemeProvider>
  );
}
