import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { useSelector } from 'react-redux';
import { Workflow } from 'lucide-react';
import Login from './pages/Login'
import Home from './pages/Home'
import useFetchMe from './hooks/useFetchMe';
import CreateAgent from './pages/CreateAgent';
import Agents from './pages/Agents';
import Integrations from './pages/Integration';
import Pricing from './pages/Pricing';
import Team from './pages/Team';
import Activity from './pages/Activity';
import Automations from './pages/Automations';

// Signed-in pages; anyone else sees the login page on the same URL
const PRIVATE_ROUTES = [
  { path: "/", Page: Home },
  { path: "/team", Page: Team },
  { path: "/agents", Page: Agents },
  { path: "/agents/new", Page: CreateAgent },
  { path: "/integrations", Page: Integrations },
  { path: "/automations", Page: Automations },
  { path: "/activity", Page: Activity },
  { path: "/pricing", Page: Pricing },
];

function App() {
  useFetchMe();

  const { user, loading, error } = useSelector(
    (state) => state.auth
  );

  if (loading) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-[#f5f6fa] text-sm text-slate-500">
        <span className="grid size-12 animate-pulse place-items-center rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-lg shadow-indigo-500/25">
          <Workflow size={22} />
        </span>
        Loading your account...
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-[#f5f6fa] p-4">
        <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>
      </div>
    );
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={user ? <Navigate to="/" replace /> : <Login />} />
        {PRIVATE_ROUTES.map(({ path, Page }) => (
          <Route key={path} path={path} element={user ? <Page user={user} /> : <Login />} />
        ))}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
