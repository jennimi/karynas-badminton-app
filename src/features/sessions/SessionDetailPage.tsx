import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getOrCreateDefaultGroup } from '../groups/api';
import { getMembers, addMember } from '../members/api';
import { getSession, updateSession, deleteSession } from './api';
import SessionForm from './components/SessionForm';

export default function SessionDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [isEditing, setIsEditing] = useState(false);

  const { data: group } = useQuery({
    queryKey: ['defaultGroup'],
    queryFn: getOrCreateDefaultGroup,
  });

  const { data: session, isLoading } = useQuery({
    queryKey: ['session', id],
    queryFn: () => getSession(id!),
    enabled: !!id,
  });

  const { data: members = [] } = useQuery({
    queryKey: ['members', group?.id],
    queryFn: () => getMembers(group!.id),
    enabled: !!group,
  });

  const updateMutation = useMutation({
    mutationFn: (data: {
      title: string;
      date: string;
      start_time: string;
      end_time: string;
      location: string;
      notes: string;
      participant_member_ids: string[];
    }) => updateSession(id!, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['session', id] });
      queryClient.invalidateQueries({ queryKey: ['sessions'] });
      setIsEditing(false);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => deleteSession(id!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sessions'] });
      navigate('/');
    },
  });

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString('en-GB', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
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

  if (isLoading || !session) {
    return <p className="text-sm text-gray-400 text-center py-12">Loading...</p>;
  }

  if (isEditing) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsEditing(false)}
            className="text-gray-400 hover:text-gray-600 text-sm"
          >
            ← Cancel
          </button>
          <h2 className="text-xl font-bold text-gray-900">Edit Session</h2>
        </div>

        <SessionForm
          members={members}
          initialData={{
            ...session,
            participantIds: session.participants.map((p) => p.member_id),
          }}
          onSubmit={async (data) => {
            await updateMutation.mutateAsync(data);
          }}
          onCreateMember={async (name) => {
            const member = await addMember(group!.id, name);
            queryClient.invalidateQueries({ queryKey: ['members'] });
            return member;
          }}
          submitLabel="Save Changes"
          isLoading={updateMutation.isPending}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate('/')}
          className="text-gray-400 hover:text-gray-600 text-sm"
        >
          ← Sessions
        </button>
      </div>

      {/* Session info */}
      <div className="bg-white rounded-lg border border-gray-200 p-5 space-y-3">
        <div className="flex items-start justify-between">
          <h2 className="text-xl font-bold text-gray-900">
            {session.title || formatDate(session.date)}
          </h2>
          <div className="flex gap-2">
            <button
              onClick={() => setIsEditing(true)}
              className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Edit
            </button>
            <button
              onClick={() => {
                if (window.confirm('Delete this session?')) {
                  deleteMutation.mutate();
                }
              }}
              className="px-3 py-1.5 text-sm text-danger border border-red-200 rounded-lg hover:bg-red-50 transition-colors"
            >
              Delete
            </button>
          </div>
        </div>

        {session.title && (
          <p className="text-sm text-gray-500">{formatDate(session.date)}</p>
        )}

        <div className="flex flex-wrap gap-4 text-sm text-gray-500">
          {session.start_time && (
            <span>
              🕐 {formatTime(session.start_time)}
              {session.end_time && ` – ${formatTime(session.end_time)}`}
            </span>
          )}
          {session.location && <span>📍 {session.location}</span>}
        </div>

        {session.notes && (
          <p className="text-sm text-gray-600 bg-gray-50 rounded-lg p-3">
            {session.notes}
          </p>
        )}
      </div>

      {/* Participants */}
      <div className="bg-white rounded-lg border border-gray-200 p-5">
        <h3 className="font-medium text-gray-900 mb-3">
          Participants ({session.participants.length})
        </h3>
        {session.participants.length === 0 ? (
          <p className="text-sm text-gray-400">No participants added yet.</p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {session.participants
              .sort((a, b) => a.member.name.localeCompare(b.member.name))
              .map((p) => (
                <span
                  key={p.id}
                  className="text-sm text-gray-700 bg-gray-50 rounded-lg px-3 py-2"
                >
                  {p.member.name}
                </span>
              ))}
          </div>
        )}
      </div>

      {/* Matchmaking placeholder — Gavin's module goes here */}
      <div className="bg-white rounded-lg border border-dashed border-gray-300 p-5 text-center">
        <p className="text-sm text-gray-400">
          🏸 Matchmaking tab will go here (Gavin's module)
        </p>
      </div>
    </div>
  );
}
