import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import Layout from './shared/components/Layout';
import MembersPage from './features/members/MembersPage';
import SessionsPage from './features/sessions/SessionsPage';
import CreateSessionPage from './features/sessions/CreateSessionPage';
import SessionDetailPage from './features/sessions/SessionDetailPage';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000, // 30 seconds
      retry: 1,
    },
  },
});

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route element={<Layout />}>
            <Route path="/" element={<SessionsPage />} />
            <Route path="/sessions/new" element={<CreateSessionPage />} />
            <Route path="/sessions/:id" element={<SessionDetailPage />} />
            <Route path="/members" element={<MembersPage />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
