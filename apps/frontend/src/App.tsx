import { Routes, Route, Navigate } from 'react-router-dom';
import Navbar from './components/Navbar';
import { SessionProvider, useSession } from './lib/session';
import LoginPage from './pages/LoginPage';
import ClickerPage from './pages/ClickerPage';
import GuildPage from './pages/GuildPage';
import LeaderboardPage from './pages/LeaderboardPage';

function RequireAuth({ children }: { children: JSX.Element }) {
  const { me, loading } = useSession();
  if (loading) return <div className="p-4">Loading...</div>;
  if (!me) return <Navigate to="/login" replace />;
  return children;
}

export default function App() {
  return (
    <SessionProvider>
      <Navbar />
      <div className="max-w-4xl mx-auto px-4 py-4">
        <Routes>
          <Route path="/" element={<Navigate to="/clicker" replace />} />
          <Route path="/login" element={<LoginPage />} />
          <Route
            path="/clicker"
            element={
              <RequireAuth>
                <ClickerPage />
              </RequireAuth>
            }
          />
          <Route
            path="/guild"
            element={
              <RequireAuth>
                <GuildPage />
              </RequireAuth>
            }
          />
          <Route path="/leaderboard" element={<LeaderboardPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
    </SessionProvider>
  );
}
