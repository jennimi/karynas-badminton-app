import type { ReactNode } from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import { cn } from '../lib/cn';
import { Toaster } from '../ui/sonner';
import { isNavActive, navItems } from './navItems';
import { ThemeToggle } from './ThemeToggle';

function Logo() {
  return (
    <Link
      to="/"
      className="flex items-center gap-2.5 rounded-control focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
    >
      <span className="flex size-9 items-center justify-center rounded-control bg-brand text-lg shadow-soft">
        🏸
      </span>
      <span className="text-lg font-extrabold tracking-tight">Shuttle Club</span>
    </Link>
  );
}

const linkBase =
  'flex items-center gap-3 rounded-control px-3 py-2.5 text-sm font-bold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring';

/**
 * Page frame: sidebar on desktop, top bar + bottom tabs on mobile.
 * `groupSwitcher` is a slot so this shared component stays feature-agnostic.
 */
export function AppShell({ groupSwitcher }: { groupSwitcher?: ReactNode }) {
  const { pathname } = useLocation();
  const mobileItems = navItems.filter((n) => !n.comingSoon);

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-20 hidden w-64 flex-col gap-6 border-r border-border bg-card p-4 lg:flex">
        <Logo />
        {groupSwitcher}

        <nav aria-label="Main" className="flex flex-1 flex-col gap-1">
          {navItems.map((item) => {
            const { to, label, icon: Icon, comingSoon } = item;
            if (comingSoon) {
              return (
                <span
                  key={to}
                  aria-disabled="true"
                  className={cn(linkBase, 'cursor-not-allowed text-muted-foreground/60')}
                >
                  <Icon className="size-5" />
                  {label}
                  <span className="ml-auto rounded-full bg-muted px-2 py-0.5 text-[10px] font-extrabold uppercase">
                    Soon
                  </span>
                </span>
              );
            }
            const active = isNavActive(item, pathname);
            return (
              <Link
                key={to}
                to={to}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  linkBase,
                  active
                    ? 'bg-brand-soft text-brand-strong'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                )}
              >
                <Icon className="size-5" />
                {label}
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-muted-foreground">Theme</span>
          <ThemeToggle />
        </div>
      </aside>

      {/* Mobile top bar */}
      <header className="sticky top-0 z-20 flex items-center justify-between border-b border-border bg-card/90 px-4 py-3 backdrop-blur lg:hidden">
        <Logo />
        <ThemeToggle />
      </header>

      <div className="lg:pl-64">
        <main className="mx-auto max-w-5xl px-4 pb-28 pt-6 lg:px-8 lg:pb-12 lg:pt-10">
          <Outlet />
        </main>
      </div>

      {/* Mobile bottom tab bar (only items that exist today) */}
      <nav
        aria-label="Main"
        className="fixed inset-x-0 bottom-0 z-20 grid border-t border-border bg-card/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden"
        style={{ gridTemplateColumns: `repeat(${mobileItems.length}, minmax(0, 1fr))` }}
      >
        {mobileItems.map((item) => {
          const active = isNavActive(item, pathname);
          const Icon = item.icon;
          return (
            <Link
              key={item.to}
              to={item.to}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'flex flex-col items-center gap-1 py-2.5 text-[11px] font-bold transition-colors',
                active ? 'text-brand-strong' : 'text-muted-foreground'
              )}
            >
              <span
                className={cn(
                  'flex h-7 w-12 items-center justify-center rounded-full transition-colors',
                  active && 'bg-brand-soft'
                )}
              >
                <Icon className="size-5" />
              </span>
              {item.label}
            </Link>
          );
        })}
      </nav>

      <Toaster />
    </div>
  );
}
