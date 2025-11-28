// src/app/clients/new/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';

type MetaAccount = {
  id: string;
  account_num: string;
  name: string | null;
};

type GoogleAccount = {
  account_id: string;
  label: string; // lo que mostramos en el combo
};

const KPI_OPTIONS = [
  'Conversiones',
  'CPA (costo por adquisición)',
  'Facturación / Ingresos',
  'Leads',
  'Clicks',
  'Impresiones',
];

const META_METRICS = [
  { value: 'impressions', label: 'Impresiones' },
  { value: 'clicks', label: 'Clicks' },
  { value: 'conversions', label: 'Conversiones' },
  { value: 'cpa', label: 'CPA' },
  { value: 'cpm', label: 'CPM' },
];

const GOOGLE_METRICS = [
  { value: 'impressions', label: 'Impresiones' },
  { value: 'clicks', label: 'Clicks' },
  { value: 'conversions', label: 'Conversiones' },
  { value: 'cost_micros', label: 'Costo (micros)' },
  { value: 'cost_per_conversion', label: 'CPA (costo por conv.)' },
];

export default function NewClientPage() {
  const router = useRouter();

  const [metaAccounts, setMetaAccounts] = useState<MetaAccount[]>([]);
  const [googleAccounts, setGoogleAccounts] = useState<GoogleAccount[]>([]);

  // formulario
  const [name, setName] = useState('');
  const [budget, setBudget] = useState('');

  const [selectedMetaAccount, setSelectedMetaAccount] = useState('');
  const [selectedGoogleAccount, setSelectedGoogleAccount] = useState('');

  const [kpi1Name, setKpi1Name] = useState('');
  const [kpi1Target, setKpi1Target] = useState('');
  const [kpi2Name, setKpi2Name] = useState('');
  const [kpi2Target, setKpi2Target] = useState('');

  const [metaKpi1Metric, setMetaKpi1Metric] = useState('');
  const [metaKpi2Metric, setMetaKpi2Metric] = useState('');
  const [googleKpi1Metric, setGoogleKpi1Metric] = useState('');
  const [googleKpi2Metric, setGoogleKpi2Metric] = useState('');

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Cargar cuentas de Meta y Google desde Supabase
  useEffect(() => {
    const loadAccounts = async () => {
      try {
        setLoading(true);
        setError(null);

        /* ------------ META: ad_accounts ------------ */
        const { data: metaData, error: metaErr } = await supabase
          .from('ad_accounts')
          .select('id, account_num, name');

        if (metaErr) throw metaErr;

        setMetaAccounts(
          (metaData || []).map((row: any) => ({
            id: row.id,
            account_num: row.account_num,
            name: row.name,
          })),
        );

        /* ------------ GOOGLE: account_id + nombre "lindo" ------------ */
        let gData: any[] = [];

        // primero intentamos en schema perfo
        try {
          const { data, error } = await supabase
            .schema('perfo')
            .from('google_campaigns')
            .select('account_id, name')
            .not('name', 'is', null);

          if (error) throw error;
          gData = data || [];
        } catch (e) {
          console.warn(
            'Fallo perfo.google_campaigns, probando public.google_campaigns',
            e,
          );
          const { data } = await supabase
            .from('google_campaigns')
            .select('account_id, name')
            .not('name', 'is', null);
          gData = data || [];
        }

        // agrupamos por account_id y usamos la primera "name" como label
        const byAccount: Record<string, GoogleAccount> = {};

        gData.forEach((row: any) => {
          const accId = String(row.account_id || '').trim();
          if (!accId) return;

          if (!byAccount[accId]) {
            const label = (row.name as string) || accId;
            byAccount[accId] = {
              account_id: accId,
              label,
            };
          }
        });

        setGoogleAccounts(Object.values(byAccount));
      } catch (e: any) {
        console.error(e);
        setError(e.message || 'No se pudieron cargar las cuentas.');
      } finally {
        setLoading(false);
      }
    };

    loadAccounts();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError('El nombre del cliente es obligatorio.');
      return;
    }
    if (!selectedMetaAccount && !selectedGoogleAccount) {
      setError('Seleccioná al menos una cuenta (Meta o Google).');
      return;
    }
    // KPI 1 es obligatorio, KPI 2 es opcional
    if (!kpi1Name) {
      setError('Tenés que definir al menos el KPI 1.');
      return;
    }

    setSaving(true);

    try {
      const budgetNumber = budget ? Number(budget) : null;
      const hasKpi2 = !!kpi2Name; // si no hay nombre, no se guarda KPI2

      const { data, error: insertErr } = await supabase
        .from('clients')
        .insert({
          name: name.trim(),
          budget: budgetNumber,
          meta_account_id: selectedMetaAccount || null,
          google_account_id: selectedGoogleAccount || null,

          // KPI 1 (obligatorio)
          kpi1_name: kpi1Name,
          kpi1_target: kpi1Target ? Number(kpi1Target) : null,
          meta_kpi1_metric: metaKpi1Metric || null,
          google_kpi1_metric: googleKpi1Metric || null,

          // KPI 2 (opcional)
          kpi2_name: hasKpi2 ? kpi2Name : null,
          kpi2_target: hasKpi2 && kpi2Target ? Number(kpi2Target) : null,
          meta_kpi2_metric: hasKpi2 ? metaKpi2Metric || null : null,
          google_kpi2_metric: hasKpi2 ? googleKpi2Metric || null : null,
        })
        .select('id')
        .single();

      if (insertErr) throw insertErr;

      // Ir directo al detalle del cliente
      router.push(`/client/${data.id}`);
    } catch (e: any) {
      console.error(e);
      setError(e.message || 'No se pudo crear el cliente.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b bg-white">
        <div className="mx-auto max-w-5xl px-4 py-4">
          <h1 className="text-lg font-semibold text-slate-900">
            Crear cliente y configurar KPIs
          </h1>
          <p className="text-sm text-slate-500">
            Definí el cliente, elegí sus cuentas de Meta / Google y los KPI que
            vamos a monitorear.
          </p>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-6">
        {error && (
          <p className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        )}

        {loading ? (
          <p className="text-sm text-slate-500">Cargando cuentas…</p>
        ) : (
          <form
            onSubmit={handleSubmit}
            className="space-y-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
          >
            {/* Datos básicos */}
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  Nombre del cliente *
                </label>
                <input
                  type="text"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ej: IPC, Pinturería Sergio…"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  Presupuesto mensual ($)
                </label>
                <input
                  type="number"
                  min={0}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  value={budget}
                  onChange={(e) => setBudget(e.target.value)}
                />
              </div>
            </div>

            {/* Cuentas */}
            <div className="grid gap-4 border-t pt-4 md:grid-cols-2">
              <div>
                <h2 className="mb-2 text-sm font-semibold text-slate-800">
                  Cuenta de Meta Ads
                </h2>
                <select
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  value={selectedMetaAccount}
                  onChange={(e) => setSelectedMetaAccount(e.target.value)}
                >
                  <option value="">Sin cuenta de Meta</option>
                  {metaAccounts.map((acc) => (
                    <option key={acc.id} value={acc.account_num}>
                      {acc.name || acc.account_num} — {acc.account_num}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <h2 className="mb-2 text-sm font-semibold text-slate-800">
                  Cuenta de Google Ads
                </h2>
                <select
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  value={selectedGoogleAccount}
                  onChange={(e) => setSelectedGoogleAccount(e.target.value)}
                >
                  <option value="">Sin cuenta de Google</option>
                  {googleAccounts.map((acc) => (
                    <option key={acc.account_id} value={acc.account_id}>
                      {acc.label} — {acc.account_id}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* KPI 1 */}
            <div className="border-t pt-4">
              <h2 className="mb-2 text-sm font-semibold text-slate-800">
                KPI 1
              </h2>

              <div className="grid gap-4 md:grid-cols-3">
                <div>
                  <label className="mb-1 block text-sm text-slate-700">
                    Nombre
                  </label>
                  <select
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                    value={kpi1Name}
                    onChange={(e) => setKpi1Name(e.target.value)}
                  >
                    <option value="">Seleccioná un KPI…</option>
                    {KPI_OPTIONS.map((opt) => (
                      <option key={opt} value={opt}>
                        {opt}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-1 block text-sm text-slate-700">
                    Objetivo mensual
                  </label>
                  <input
                    type="number"
                    min={0}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                    value={kpi1Target}
                    onChange={(e) => setKpi1Target(e.target.value)}
                    placeholder="Ej: 1500"
                  />
                </div>

                <div className="space-y-2 text-xs">
                  <div>
                    <span className="font-medium text-slate-700">
                      Métrica Meta
                    </span>
                    <select
                      className="mt-1 w-full rounded-lg border border-slate-300 px-2 py-1"
                      value={metaKpi1Metric}
                      onChange={(e) => setMetaKpi1Metric(e.target.value)}
                    >
                      <option value="">Sin asignar</option>
                      {META_METRICS.map((m) => (
                        <option key={m.value} value={m.value}>
                          {m.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <span className="font-medium text-slate-700">
                      Métrica Google
                    </span>
                    <select
                      className="mt-1 w-full rounded-lg border border-slate-300 px-2 py-1"
                      value={googleKpi1Metric}
                      onChange={(e) => setGoogleKpi1Metric(e.target.value)}
                    >
                      <option value="">Sin asignar</option>
                      {GOOGLE_METRICS.map((m) => (
                        <option key={m.value} value={m.value}>
                          {m.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            </div>

            {/* KPI 2 (opcional) */}
            <div className="border-t pt-4">
              <h2 className="mb-2 text-sm font-semibold text-slate-800">
                KPI 2 (opcional)
              </h2>

              <div className="grid gap-4 md:grid-cols-3">
                <div>
                  <label className="mb-1 block text-sm text-slate-700">
                    Nombre
                  </label>
                  <select
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                    value={kpi2Name}
                    onChange={(e) => setKpi2Name(e.target.value)}
                  >
                    <option value="">Sin KPI 2</option>
                    {KPI_OPTIONS.map((opt) => (
                      <option key={opt} value={opt}>
                        {opt}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-1 block text-sm text-slate-700">
                    Objetivo mensual
                  </label>
                  <input
                    type="number"
                    min={0}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                    value={kpi2Target}
                    onChange={(e) => setKpi2Target(e.target.value)}
                    placeholder="Ej: 1700"
                    disabled={!kpi2Name}
                  />
                </div>

                <div className="space-y-2 text-xs">
                  <div>
                    <span className="font-medium text-slate-700">
                      Métrica Meta
                    </span>
                    <select
                      className="mt-1 w-full rounded-lg border border-slate-300 px-2 py-1"
                      value={metaKpi2Metric}
                      onChange={(e) => setMetaKpi2Metric(e.target.value)}
                      disabled={!kpi2Name}
                    >
                      <option value="">Sin asignar</option>
                      {META_METRICS.map((m) => (
                        <option key={m.value} value={m.value}>
                          {m.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <span className="font-medium text-slate-700">
                      Métrica Google
                    </span>
                    <select
                      className="mt-1 w-full rounded-lg border border-slate-300 px-2 py-1"
                      value={googleKpi2Metric}
                      onChange={(e) => setGoogleKpi2Metric(e.target.value)}
                      disabled={!kpi2Name}
                    >
                      <option value="">Sin asignar</option>
                      {GOOGLE_METRICS.map((m) => (
                        <option key={m.value} value={m.value}>
                          {m.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            </div>

            {/* Botón */}
            <div className="flex justify-end pt-4">
              <button
                type="submit"
                disabled={saving}
                className="rounded-full bg-emerald-600 px-6 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:bg-slate-300"
              >
                {saving ? 'Creando…' : 'Crear cliente y ver dashboard'}
              </button>
            </div>
          </form>
        )}
      </main>
    </div>
  );
}
