import { useQuery } from '@tanstack/react-query';
import { getOrCreateDefaultGroup } from './api';

/**
 * The group the app currently works in. Today there is a single group;
 * when multi-group switching arrives, change it here and every page follows.
 */
export function useCurrentGroup() {
  return useQuery({
    queryKey: ['defaultGroup'],
    queryFn: getOrCreateDefaultGroup,
  });
}
