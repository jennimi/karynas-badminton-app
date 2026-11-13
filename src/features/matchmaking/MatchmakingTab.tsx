/**
 * MatchmakingTab — Gavin's component
 *
 * This component is rendered inside SessionDetailPage under the
 * "Matchmaking" placeholder. It receives the session ID as a prop.
 *
 * Usage in SessionDetailPage:
 *   <MatchmakingTab sessionId={session.id} />
 *
 * To get participants:
 *   import { getSessionParticipants } from '../sessions/api';
 */

interface Props {
  sessionId: string;
}

export default function MatchmakingTab({ sessionId: _sessionId }: Props) {
  return (
    <div className="text-center py-8 text-sm text-gray-400">
      <p>🏸 Matchmaking module</p>
      <p className="mt-1">Gavin: implement randomization and scoring here</p>
    </div>
  );
}
