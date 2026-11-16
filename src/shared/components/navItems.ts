import {
  CalendarDays,
  Home,
  LayoutDashboard,
  MapPinned,
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

/** Across all groups — shown above the group picker. */
export const mainNavItems: NavItem[] = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard },
];

/** Pages for the group chosen in the picker — shown below it. */
export const groupNavItems: NavItem[] = [
  // `/group` redirects to the current group's page
  { to: '/group', label: 'Overview', icon: Home, alsoActiveFor: ['/groups'] },
  { to: '/sessions', label: 'Sessions', icon: CalendarDays },
  { to: '/members', label: 'Members', icon: Users },
  { to: '/courts', label: 'Courts', icon: MapPinned },
  // Gavin: set comingSoon to false (and point `to` at your route) when ready.
  { to: '/matches', label: 'Matches', icon: Swords, comingSoon: true },
  { to: '/tournaments', label: 'Tournaments', icon: Trophy },
];

export const navItems: NavItem[] = [...mainNavItems, ...groupNavItems];

export function isNavActive(item: NavItem, pathname: string): boolean {
  const matches = (prefix: string) =>
    prefix === '/' ? pathname === '/' : pathname === prefix || pathname.startsWith(prefix + '/');
  return matches(item.to) || (item.alsoActiveFor ?? []).some(matches);
}
