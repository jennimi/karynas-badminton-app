import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Navigate, Route, Routes, useParams } from 'react-router-dom';
import DashboardPage from './features/dashboard/DashboardPage';
import DesignKitPage from './features/dashboard/DesignKitPage';
import GroupPage from './features/groups/GroupPage';
import CourtsPage from './features/courts/CourtsPage';
import ChatImportPage from './features/chat-import/ChatImportPage';
import { GroupSwitcher } from './features/groups/components/GroupSwitcher';
import { useCurrentGroup } from './features/groups/hooks';
import { AdminToggle } from './features/payments/components/AdminToggle';
import MembersPage from './features/members/MembersPage';
import MemberProfilePage from './features/members/MemberProfilePage';
import ActivityPage from './features/activity/ActivityPage';
import LeaderboardPage from './features/stats/LeaderboardPage';
import WrapPage from './features/wrap/WrapPage';
import { MeControl } from './features/members/components/MeControl';
import CreateSessionPage from './features/sessions/CreateSessionPage';
import SessionDetailPage from './features/sessions/SessionDetailPage';
import SessionsPage from './features/sessions/SessionsPage';
import TournamentDetailPage from './features/tournaments/TournamentDetailPage';
import TournamentsPage from './features/tournaments/TournamentsPage';
import { AppShell } from './shared/components/AppShell';
import { ThemeProvider } from './shared/theme/ThemeProvider';
import { RallyLoader } from './shared/components/brand/RallyLoader';
import { EmptyState } from './shared/components/EmptyState';
import { decodeSessionId } from './features/payments/shareMessage';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000, // 30 seconds
      retry: 1,
    },
  },
});

/** `/s/<code>`: the compact link people share. The code is the session id written shorter. */
function ShortSessionRedirect() {
  const { code = '' } = useParams();
  const id = decodeSessionId(code);
  return id ? (
    <Navigate to={`/sessions/${id}?tab=payments`} replace />
  ) : (
    <EmptyState emoji="🤷" title="This link doesn’t look right" description="Ask for the link to be shared again." />
  );
}

/** `/group` → the page of the group picked in the sidebar. */
function CurrentGroupRedirect() {
  const { data: group } = useCurrentGroup();
  return group ? <Navigate to={`/groups/${group.id}`} replace /> : <RallyLoader />;
}

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
            <Route element={<AppShell groupSwitcher={<GroupSwitcher />} adminControl={<AdminToggle />} profileControl={<MeControl />} />}>
              <Route path="/" element={<DashboardPage />} />
              <Route path="/group" element={<CurrentGroupRedirect />} />
              <Route path="/groups/:id" element={<GroupPage />} />
              <Route path="/sessions" element={<SessionsPage />} />
              <Route path="/sessions/new" element={<CreateSessionPage />} />
              <Route path="/sessions/:id" element={<SessionDetailPage />} />
              <Route path="/members" element={<MembersPage />} />
              <Route path="/members/:id" element={<MemberProfilePage />} />
              <Route path="/courts" element={<CourtsPage />} />
              <Route path="/activity" element={<ActivityPage />} />
              <Route path="/leaderboard" element={<LeaderboardPage />} />
              <Route path="/wrap" element={<WrapPage />} />
              <Route path="/tournaments" element={<TournamentsPage />} />
              <Route path="/tournaments/:id" element={<TournamentDetailPage />} />
              <Route path="/s/:code" element={<ShortSessionRedirect />} />
              <Route path="/chat-import" element={<ChatImportPage />} />
              {/* Developer reference for the shared components */}
              <Route path="/design-kit" element={<DesignKitPage />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </QueryClientProvider>
    </ThemeProvider>
  );
}
