import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { addDays, todayString } from '../../shared/utils/format';
import { getAttendance, getSessionSummaries } from '../sessions/api';
import { getGroupGames } from './api';
import { attendanceStreaks, buildBoards, computeDuos, computeStats, type Game } from './compute';
import { computeTitles } from './titles';

export type Period = 'all' | '60d' | 'month';

export const PERIODS: { value: Period; label: string }[] = [
  { value: 'all', label: 'All time' },
  { value: '60d', label: '60 days' },
  { value: 'month', label: 'This month' },
];

export function inPeriod(games: Game[], period: Period): Game[] {
  const today = todayString();
  if (period === 'all') return games;
  if (period === '60d') return games.filter((g) => g.date >= addDays(today, -60));
  return games.filter((g) => g.date.startsWith(today.slice(0, 7)));
}

/** Every finished game of the group. Refreshed whenever a match is saved. */
export function useGames(groupId: string | undefined) {
  return useQuery({
    queryKey: ['games', groupId],
    queryFn: () => getGroupGames(groupId!),
    enabled: !!groupId,
    staleTime: 30_000,
    retry: false,
  });
}

/** All-time numbers + titles for the group (what a member's page and the title hall show). */
export function useAllTimeStats(groupId: string | undefined) {
  const games = useGames(groupId);
  const sessions = useQuery({
    queryKey: ['sessions', groupId],
    queryFn: () => getSessionSummaries(groupId!),
    enabled: !!groupId,
  });
  const attendance = useQuery({
    queryKey: ['attendance', groupId],
    queryFn: () => getAttendance(groupId!),
    enabled: !!groupId,
  });

  const computed = useMemo(() => {
    const list = games.data ?? [];
    const stats = computeStats(list);
    const duos = computeDuos(list);
    const streaks = attendanceStreaks(sessions.data ?? [], attendance.data ?? [], todayString());
    return { stats, duos, titles: computeTitles(stats, duos, streaks), boards: buildBoards(stats, duos) };
  }, [games.data, sessions.data, attendance.data]);

  return { ...computed, games: games.data ?? [], isLoading: games.isLoading, error: games.error as Error | null };
}
