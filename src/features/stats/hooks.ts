import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { todayString } from '../../shared/utils/format';
import { getAttendance, getSessionSummaries } from '../sessions/api';
import { getGroupGames } from './api';
import { SEASON_MIN_GAMES, attendanceStreaks, buildBoards, computeDuos, computeStats, seasonChampions, seasonOf, type Game } from './compute';
import { computeTitles } from './titles';

/** 'all' = all time, otherwise a season: a month written YYYY-MM (ratings start again every month). */
export type Period = string;

export const inPeriod = (games: Game[], period: Period): Game[] => (period === 'all' ? games : games.filter((g) => seasonOf(g.date) === period));

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
    // this month's season: ratings that started again at 1000 on the 1st
    const season = seasonOf(todayString());
    const seasonGames = inPeriod(list, season);
    const seasonStats = computeStats(seasonGames);
    const seasonBoards = buildBoards(seasonStats, computeDuos(seasonGames), SEASON_MIN_GAMES);
    return {
      stats, duos, titles: computeTitles(stats, duos, streaks), boards: buildBoards(stats, duos),
      season, seasonStats, seasonBoards, champions: seasonChampions(list),
    };
  }, [games.data, sessions.data, attendance.data]);

  return { ...computed, games: games.data ?? [], isLoading: games.isLoading, error: games.error as Error | null };
}
