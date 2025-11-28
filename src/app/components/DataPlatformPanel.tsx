'use client';

import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

type TabId = 'all' | 'meta' | 'google';

type Props = {
  accountId: string;
  from: string; // YYYY-MM-DD
  to: string;   // YYYY-MM-DD
};

type Totals = {
  spend: number;
  revenue: number;
  conversions: number;
};

function fmtInt(n: number) {
  return n.toLocaleString('es-AR');
}

export default function DataPlatformPanel({ accountId, from, to }: Props) {
  const [tab, setTab] = useState<TabId>('all');
  const [totals, setTotals] = useState<Totals | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      setErr(null);

      // Google: aún no integrado → mostramos 0s para no confundir
      if (tab === 'google') {
        if (!alive) return;
        setTotals({ spend: 0, revenue: 0, conversions: 0 });
        setLoading(false);
        return;
      }

      let q = supabase
        .schema('perfo')
        .from('insights')
        .select('spend,revenue,conversions,platform')
        .eq('account_id', accountId)
        .eq('level', 'campaign')
        .gte('date', from)
        .lte('date', to)
        .limit(50000);

      if (tab === 'meta') q = q.eq('platform', 'meta');

      const { data, error } = await q;

      if (!alive) return;

      if (error) {
        setErr(error.message);
        setTotals(null);
        setLoading(false);
        return;
      }

      const sum = (data || []).reduce(
        (acc: Totals, r: any) => ({
          spend: acc.spend + Number(r.spend || 0),
          revenue: acc.revenue + Number(r.revenue || 0),
          conversions: acc.conversions + Number(r.conversions || 0),
        }),
        { spend: 0, revenue: 0, conversions: 0 }
      );

      setTotals(sum);
      setLoading(false);
    })();
    return () => { alive = false; };
  }, [accountId, from, to, tab]);

  const roas = useMemo(() => {
    if (!totals) return 0;
    return totals.spend > 0 ? totals.revenue / totals.spend : 0;
  }, [totals]);

  const TabBtn = ({ id, label }: { id: TabId; label: string }) => (
    <button
      onClick={() => setTab(id)}
      style={{
        padding: '8px 12px',
        borderRadius: 12,
        border: '1px solid rgba(255,255,255,0.08)',
        background: tab === id ? 'linear-gradient(145deg,#0d1528,#0a1120)' : '#0b1220',
        color: '#e5e7eb',
        boxShadow:
          tab === id
            ? 'inset 2px 2px 6px rgba(0,0,0,0.6), inset -2px -2px 6px rgba(255,255,255,0.06)'
            : '8px 8px 16px rgba(0,0,0,0.45), -6px -6px 14px rgba(255,255,255,0.05)',
        cursor: 'pointer',
      }}
    >
      {label}
    </button>
  );

  const Tile = ({ title, value }: { title: string; value: string }) => (
    <div
      style={{
        background: '#0e1625',
        borderRadius: 16,
        border: '1px solid rgba(255,255,255,0.03)',
        boxShadow: '9px 9px 18px rgba(0,0,0,0.45), -9px -9px 18px rgba(255,255,255,0.05)',
        padding: 16,
      }}
    >
      <div style={{ fontSize: 12, color: '#9ca3af', marginBottom: 6 }}>{title}</div>
      <div style={{ fontSize: 28, fontWeight: 800 }}>{value}</div>
    </div>
  );

  return (
    <div>
      {/* Tabs de plataforma */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        <TabBtn id="all" label="Todas las plataformas" />
        <TabBtn id="meta" label="Meta Ads" />
        <TabBtn id="google" label="Google Ads" />
      </div>

      {err && <div style={{ color: '#ef4444', marginBottom: 8 }}>Error: {err}</div>}

      {/* Dos tiles: Resultados reales + ROAS real */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <Tile
          title="Resultados reales"
          value={loading || !totals ? '—' : fmtInt(totals.conversions)}
        />
        <Tile
          title="ROAS real"
          value={loading || !totals ? '—' : `${roas.toFixed(2)}x`}
        />
      </div>

      {tab === 'google' && (
        <div style={{ marginTop: 10, fontSize: 12, color: '#9ca3af' }}>
          * Google Ads: todavía no integrado. Se mostrará aquí cuando esté listo.
        </div>
      )}
    </div>
  );
}
