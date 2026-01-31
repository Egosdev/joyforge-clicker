import { Link, NavLink } from 'react-router-dom';
import { useSession } from '../lib/session';
import { api } from '../lib/api';

export default function Navbar() {
  const { me, refresh } = useSession();

  const logout = async () => {
    await api.post('/auth/logout');
    await refresh();
  };

  const navClass = ({ isActive }: { isActive: boolean }) =>
    `px-3 py-2 rounded-md text-sm ${isActive ? 'bg-slate-200' : 'hover:bg-slate-100'}`;

  return (
    <div className="w-full border-b bg-white">
      <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
        <Link to="/" className="font-semibold">
          Joyforge Clicker
        </Link>
        <div className="flex items-center gap-2">
          <NavLink to="/clicker" className={navClass}>
            Clicker
          </NavLink>
          <NavLink to="/guild" className={navClass}>
            Guild
          </NavLink>
          <NavLink to="/leaderboard" className={navClass}>
            Leaderboard
          </NavLink>
        </div>
        <div className="flex items-center gap-2">
          {me ? (
            <>
              <span className="text-sm text-slate-600 hidden sm:inline">{me.user.username}</span>
              <button onClick={logout} className="px-3 py-2 rounded-md text-sm bg-slate-900 text-white">
                Logout
              </button>
            </>
          ) : (
            <NavLink to="/login" className={navClass}>
              Login
            </NavLink>
          )}
        </div>
      </div>
    </div>
  );
}
