// src/app/login/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

const USERNAME = 'polenta';
const PASSWORD = 'perfo123'; // cambiá esto si querés

export default function LoginPage() {
  const router = useRouter();

  const [user, setUser] = useState('');
  const [pass, setPass] = useState('');
  const [error, setError] = useState('');
  const [fromPath, setFromPath] = useState('/clients'); // destino por defecto

  // 👉 Leemos el ?from=... usando la API del navegador
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const params = new URLSearchParams(window.location.search);
    const from = params.get('from');

    if (from && from.startsWith('/')) {
      setFromPath(from);
    }
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (user === USERNAME && pass === PASSWORD) {
      const oneWeek = 60 * 60 * 24 * 7;

      // Cookie (opcional)
      document.cookie = `monitor_auth=ok; path=/; max-age=${oneWeek}`;

      // 🔑 Coincidir con MonitorAuthGate (usa localStorage)
      if (typeof window !== 'undefined') {
        window.localStorage.setItem('monitor_auth', 'ok');
      }

      // Redirigimos a lo que venía en ?from= o, si no, /clients
      router.push(fromPath);
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
