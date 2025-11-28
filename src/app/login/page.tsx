// src/app/login/page.tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

const USERNAME = 'polenta';
const PASSWORD = 'perfo123'; // cambiá esto si querés

export default function LoginPage() {
  const router = useRouter();
  const [user, setUser] = useState('');
  const [pass, setPass] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (user === USERNAME && pass === PASSWORD) {
      const oneWeek = 60 * 60 * 24 * 7;
      document.cookie = `monitor_auth=ok; path=/; max-age=${oneWeek}`;

      // 👉 Después de loguear, siempre mandamos a /clients
      router.push('/clients');
    } else {
      setError('Usuario o contraseña incorrectos');
    }
  };

  return (
    <main className="min-h-screen flex items-center justify-center bg-slate-950">
      <div className="neo-card" style={{ maxWidth: 360, width: '100%' }}>
        <h1 className="text-lg font-semibold mb-2">Login Perfo</h1>
        <p className="text-xs text-slate-500 mb-4">
          Acceso solo para equipo Polenta.
        </p>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="text-xs text-slate-500 block mb-1">
              Usuario
            </label>
            <input
              type="text"
              value={user}
              onChange={(e) => setUser(e.target.value)}
              className="w-full rounded-md border border-slate-300 px-2 py-1 text-sm"
              autoComplete="username"
            />
          </div>

          <div>
            <label className="text-xs text-slate-500 block mb-1">
              Contraseña
            </label>
            <input
              type="password"
              value={pass}
              onChange={(e) => setPass(e.target.value)}
              className="w-full rounded-md border border-slate-300 px-2 py-1 text-sm"
              autoComplete="current-password"
            />
          </div>

          {error && (
            <p className="text-xs text-red-600 mt-1">{error}</p>
          )}

          <button
            type="submit"
            className="w-full mt-2 rounded-full bg-emerald-600 text-white text-sm py-2 font-medium hover:bg-emerald-700"
          >
            Entrar
          </button>
        </form>
      </div>
    </main>
  );
}
