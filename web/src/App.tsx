import { Link, Route, Routes, useLocation } from 'react-router-dom';
import Dashboard from './pages/Dashboard';
import Alerts from './pages/Alerts';
import Customer from './pages/Customer';
import Evals from './pages/Evals';

export default function App() {
  const loc = useLocation();
  const nav = [
    { to: '/dashboard', label: 'Dashboard' },
    { to: '/alerts', label: 'Alerts' },
    { to: '/evals', label: 'Evals' },
  ];
  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b px-4 py-3 flex items-center justify-between">
        <h1 className="font-semibold">Sentinel Support</h1>
        <nav className="flex gap-4 text-sm">
          {nav.map(n => (
            <Link key={n.to} className={"hover:underline " + (loc.pathname.startsWith(n.to) ? 'font-semibold' : '')} to={n.to}>{n.label}</Link>
          ))}
        </nav>
      </header>
      <main className="flex-1 p-4">
        <Routes>
          <Route path="/" element={<Dashboard/>} />
          <Route path="/dashboard" element={<Dashboard/>} />
          <Route path="/alerts" element={<Alerts/>} />
          <Route path="/customer/:id" element={<Customer/>} />
          <Route path="/evals" element={<Evals/>} />
        </Routes>
      </main>
    </div>
  );
}
