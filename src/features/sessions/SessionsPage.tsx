import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { getOrCreateDefaultGroup } from '../groups/api';
import { getSessions } from './api';

export default function SessionsPage() {
  const { data: group } = useQuery({
    queryKey: ['defaultGroup'],
    queryFn: getOrCreateDefaultGroup,
  });

  const { data: sessions = [], isLoading } = useQuery({
    queryKey: ['sessions', group?.id],
    queryFn: () => getSessions(group!.id),
    enabled: !!group,
  });

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString('en-GB', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  const formatTime = (time: string | null) => {
    if (!time) return '';
    const [h, m] = time.split(':');
    const hour = parseInt(h);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const h12 = hour % 12 || 12;
    return `${h12}:${m} ${ampm}`;
  };

  if (isLoading) {
    return <p className="text-sm text-gray-400 text-center py-12">Loading...</p>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-gray-900">Sessions</h2>
        <Link
          to="/sessions/new"
          className="px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary-hover transition-colors"
        >
          + New Session
        </Link>
      </div>

      {sessions.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-gray-400 text-sm">No sessions yet.</p>
          <Link
            to="/sessions/new"
            className="text-primary text-sm hover:underline mt-2 inline-block"
          >
            Create your first session
          </Link>
        </div>
      ) : (
        <div className="space-y-2">
          {sessions.map((session) => (
            <Link
              key={session.id}
              to={`/sessions/${session.id}`}
              className="block p-4 bg-white rounded-lg border border-gray-200 hover:border-primary/30 hover:shadow-sm transition-all"
            >
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-medium text-gray-900">
                    {session.title || formatDate(session.date)}
                  </p>
                  {session.title && (
                    <p className="text-sm text-gray-500 mt-0.5">
                      {formatDate(session.date)}
                    </p>
                  )}
                  <div className="flex gap-3 mt-1">
                    {session.start_time && (
                      <span className="text-xs text-gray-400">
                        🕐 {formatTime(session.start_time)}
                        {session.end_time && ` – ${formatTime(session.end_time)}`}
                      </span>
                    )}
                    {session.location && (
                      <span className="text-xs text-gray-400">
                        📍 {session.location}
                      </span>
                    )}
                  </div>
                </div>
                <span className="text-gray-300 text-sm">→</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
