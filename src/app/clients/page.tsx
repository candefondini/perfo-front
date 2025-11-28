'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabaseClient';
import MonitorAuthGate from '../components/MonitorAuthGate';

type ClientRow = {
  id: string;
  name: string;
  budget: number | null;
};

export default function ClientsPage() {
  return (
    <MonitorAuthGate>
      <ClientsPageInner />
    </MonitorAuthGate>
  );
}

function ClientsPageInner() {
  const [clients, setClients] = useState<ClientRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 🔹 Cargar clientes desde Supabase
  useEffect(() => {
    const loadClients = async () => {
      try {
        setLoading(true);
        setError(null);

        const { data, error } = await supabase
          .from('clients')
          .select('id, name, budget')
          .order('name', { ascending: true });

        if (error) throw error;

        setClients(data || []);
      } catch (err: any) {
        console.error(err);
        setError(err.message || 'Error al cargar clientes.');
      } finally {
        setLoading(false);
      }
    };

    loadClients();
  }, []);

  // 🔹 Eliminar cliente
  const handleDelete = async (clientId: string) => {
    const confirmed = window.confirm('¿Seguro que querés eliminar este cliente?');
    if (!confirmed) return;

    try {
      const { error } = await supabase
        .from('clients')
        .delete()
        .eq('id', clientId);

      if (error) throw error;

      setClients((prev) => prev.filter((c) => c.id !== clientId));
    } catch (err: any) {
      alert('Error eliminando cliente: ' + err.message);
    }
  };

  return (
    <main className="page-wrap">
      {/* HEADER */}
      <div className="section-header" style={{ marginBottom: 16 }}>
        <div>
          <h1 className="section-title">Clientes</h1>
          <p style={{ fontSize: 13, color: '#64748b' }}>
            Acá ves todos los clientes dados de alta y podés entrar a su dashboard o eliminarlos.
          </p>
        </div>

        <Link href="/clients/new" className="neo-button">
          + Crear cliente
        </Link>
      </div>

      {/* LISTA */}
      <section className="neo-card">
        {error && <p className="text-sm text-red-600 mb-3">{error}</p>}

        {loading ? (
          <p className="text-sm text-slate-500">Cargando clientes…</p>
        ) : clients.length === 0 ? (
          <p className="text-sm text-slate-500">
            Todavía no hay clientes. Creá uno desde "Crear cliente".
          </p>
        ) : (
          <div className="space-y-2">
            {clients.map((client) => (
              <div
                key={client.id}
                className="neo-card"
                style={{
                  padding: 12,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <div>
                  <div
                    style={{
                      fontSize: 14,
                      fontWeight: 600,
                      color: '#0f172a',
                    }}
                  >
                    {client.name}
                  </div>

                  <div
                    style={{
                      fontSize: 11,
                      color: '#64748b',
                      marginTop: 2,
                    }}
                  >
                    ID: {client.id}
                    {client.budget !== null && (
                      <>
                        {' · Presupuesto: '}
                        {client.budget.toLocaleString('es-AR', {
                          style: 'currency',
                          currency: 'ARS',
                          maximumFractionDigits: 0,
                        })}
                      </>
                    )}
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 8 }}>
                  <Link
                    href={`/client/${client.id}`}
                    className="neo-button"
                    style={{ fontSize: 12, paddingInline: 14, paddingBlock: 6 }}
                  >
                    Ver detalle
                  </Link>

                  <button
                    type="button"
                    onClick={() => handleDelete(client.id)}
                    className="neo-button"
                    style={{
                      fontSize: 12,
                      paddingInline: 14,
                      paddingBlock: 6,
                      background: '#fee2e2',
                      color: '#b91c1c',
                      borderColor: '#fecaca',
                    }}
                  >
                    Eliminar
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
