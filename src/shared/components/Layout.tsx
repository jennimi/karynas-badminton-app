import { NavLink, Outlet } from 'react-router-dom';

const navItems = [
  { to: '/', label: '🏸 Sessions', end: true },
  { to: '/members', label: '👥 Members' },
];

export default function Layout() {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between">
          <h1 className="text-lg font-bold">🏸 Badminton Manager</h1>
          <nav className="flex gap-1">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/'}
                className={({ isActive }) =>
                  `px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-primary text-white'
                      : 'text-gray-600 hover:bg-gray-100'
                  }`
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-3xl mx-auto px-4 py-6">
        <Outlet />
      </main>
    </div>
  );
}
