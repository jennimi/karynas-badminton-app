import {
  CalendarDays,
  LayoutDashboard,
  Swords,
  Trophy,
  Users,
  type LucideIcon,
} from 'lucide-react';

export interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  /** Other path prefixes that should also highlight this item. */
  alsoActiveFor?: string[];
  /** Greyed out and not clickable until the feature ships. */
  comingSoon?: boolean;
}

/**
 * The single source of truth for app navigation (sidebar + mobile tab bar).
 * Adding a page? Add ONE entry here — don't build a separate menu.
 */
export const navItems: NavItem[] = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, alsoActiveFor: ['/groups'] },
  { to: '/sessions', label: 'Sessions', icon: CalendarDays },
  { to: '/members', label: 'Members', icon: Users },
  // Gavin: set comingSoon to false (and point `to` at your route) when ready.
  { to: '/matches', label: 'Matches', icon: Swords, comingSoon: true },
  { to: '/tournaments', label: 'Tournaments', icon: Trophy, comingSoon: true },
];

export function isNavActive(item: NavItem, pathname: string): boolean {
  const matches = (prefix: string) =>
    prefix === '/' ? pathname === '/' : pathname === prefix || pathname.startsWith(prefix + '/');
  return matches(item.to) || (item.alsoActiveFor ?? []).some(matches);
}
