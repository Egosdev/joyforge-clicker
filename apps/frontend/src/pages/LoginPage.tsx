import { useState } from 'react';
import { api } from '../lib/api';
import { useSession } from '../lib/session';

type Mode = 'login' | 'register';

export default function LoginPage() {
  const { refresh } = useSession();
  const [mode, setMode] = useState<Mode>('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      if (mode === 'login') {
        await api.post('/auth/login', { username, password });
      } else {
        await api.post('/auth/register', { username, password });
      }
      await refresh();
    } catch (err: any) {
      const msg = err?.response?.data?.error || 'ERROR';
      setError(msg);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="max-w-md mx-auto">
      <div className="flex gap-2 mb-4">
        <button
          className={`flex-1 px-3 py-2 rounded-md ${mode === 'login' ? 'bg-slate-900 text-white' : 'bg-slate-100'}`}
          onClick={() => setMode('login')}
        >
          Login
        </button>
        <button
          className={`flex-1 px-3 py-2 rounded-md ${mode === 'register' ? 'bg-slate-900 text-white' : 'bg-slate-100'}`}
          onClick={() => setMode('register')}
        >
          Register
        </button>
      </div>

      <form onSubmit={submit} className="space-y-3">
        <input
          className="w-full px-3 py-2 border rounded-md"
          placeholder="Username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          autoComplete="username"
        />
        <input
          className="w-full px-3 py-2 border rounded-md"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          type="password"
          autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
        />

        {error && <div className="text-red-600 text-sm">{error}</div>}

        <button
          disabled={busy}
          className="w-full px-3 py-2 rounded-md bg-emerald-600 text-white disabled:opacity-60"
        >
          {busy ? '...' : mode === 'login' ? 'Login' : 'Create account'}
        </button>
      </form>

      <p className="text-xs text-slate-500 mt-4">
        Şifre en az 8 karakter olmalı.
      </p>
    </div>
  );
}
