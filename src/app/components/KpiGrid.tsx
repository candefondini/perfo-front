'use client';
import { useEffect, useMemo, useState, useId } from 'react';
import { supabase } from '@/lib/supabaseClient';

export type Platform = 'all' | 'meta' | 'google';

type Totals = {
  spend: number;
  impressions: number;
  clicks: number;
  conversions: number;
  revenue: number;
};

export type MetricKey =
  | 'spend' | 'impressions' | 'clicks' | 'conversions'
  | 'ctr' | 'cpc' | 'cpm' | 'roas' | 'revenue';

const LABEL: Record<MetricKey, string> = {
  spend: 'Inversión',
  impressions: 'Impresiones',
  clicks: 'Clicks',
  conversions: 'Resultados',
  ctr: 'CTR',
  cpc: 'CPC',
  cpm: 'CPM',
  roas: 'ROAS',
  revenue: 'Revenue',
};

type Props = {
  accountId: string;
  from: string;
  to: string;
  platform: Platform;
  /** orden y selección de métricas a mostrar */
  slots?: MetricKey[];
};

const cardStyle = {
  borderRadius: 16,
  padding: 16,
  background: '#0e1625',
  boxShadow: '9px 9px 18px rgba(0,0,0,0.45), -9px -9px 18px rgba(255,255,255,0.05)',
  border: '1px solid rgba(255,255,255,0.03)',
} as const;

function money(n: number, d: number = 2) {
  return n.toLocaleString('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: d });
}
function fmt(metric: MetricKey, n: number | null) {
  if (n == null || Number.isNaN(n)) return '—';
  if (metric === 'spend' || metric === 'revenue') return money(n, 2);
  if (metric === 'cpc') return money(n, 3);
  if (metric === 'cpm') return money(n, 2);
  if (metric === 'ctr') return `${n.toFixed(2)}%`;
  if (metric === 'roas') return `${n.toFixed(2)}x`;
  return n.toLocaleString('es-AR');
}

export default function KpiGrid({ accountId, from, to, platform, slots }: Props) {
  const [tot, setTot] = useState<Totals | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;

    // Normaliza results_arr -> { indicator: number }
    const parseResults = (ra: any): Record<string, number> => {
      if (!ra) return {};
      const arr = Array.isArray(ra)
        ? ra
        : typeof ra === 'string'
          ? (() => { try { const j = JSON.parse(ra); return Array.isArray(j) ? j : (j.results ?? []); } catch { return []; } })()
          : [];
      const out: Record<string, number> = {};
      for (const item of arr || []) {
        const ind = String(item?.indicator ?? item?.action_type ?? '').trim();
        const valStr = item?.values?.[0]?.value ?? item?.value ?? null;
        const val = Number(valStr ?? 0);
        if (!ind) continue;
        out[ind] = (out[ind] || 0) + (isFinite(val) ? val : 0);
      }
      return out;
    };

    (async () => {
      setLoading(true);

      let q = supabase
        .schema('perfo')
        .from('insights')
        .select('spend, impressions, clicks, conversions, revenue, platform, results_arr, cost_per_action_type_arr')
        .eq('account_id', accountId)
        .eq('level', 'campaign')
        .gte('date', from)
        .lte('date', to)
        .limit(50000);

      if (platform !== 'all') {
        // si tu tabla no tiene columna platform, comentá esta línea
        q = q.eq('platform', platform);
      }

      const { data, error } = await q;

      if (!alive) return;
      if (error) {
        setTot(null);
        setLoading(false);
        return;
      }

      const sum: Totals = { spend: 0, impressions: 0, clicks: 0, conversions: 0, revenue: 0 };

      for (const r of (data || []) as any[]) {
        sum.spend += Number(r.spend || 0);
        sum.impressions += Number(r.impressions || 0);
        sum.clicks += Number(r.clicks || 0);

        let conv = Number(r.conversions || 0);
        let rev  = Number(r.revenue || 0);

        // Fallback a results_arr si conversions/revenue vienen vacíos/0
        if ((!isFinite(conv) || conv === 0) || (!isFinite(rev) || rev === 0)) {
          const map = parseResults(r.results_arr);
          const purchaseKeys = Object.keys(map).filter(k => k.endsWith('.purchase') || k.includes('fb_pixel_purchase'));
          const purchaseValKeys = Object.keys(map).filter(k => k.endsWith('.purchase.value') || k.includes('purchase.value'));
          if ((!isFinite(conv) || conv === 0) && purchaseKeys.length) {
            conv = purchaseKeys.reduce((acc, k) => acc + (map[k] || 0), 0);
          }
          if ((!isFinite(rev) || rev === 0) && purchaseValKeys.length) {
            rev = purchaseValKeys.reduce((acc, k) => acc + (map[k] || 0), 0);
          }
        }

        sum.conversions += isFinite(conv) ? conv : 0;
        sum.revenue     += isFinite(rev)  ? rev  : 0;
      }

      setTot(sum);
      setLoading(false);
    })();

    return () => { alive = false; };
  }, [accountId, from, to, platform]);

  const derived = useMemo(() => {
    if (!tot) return null;
    const ctr = tot.impressions > 0 ? (tot.clicks / tot.impressions) * 100 : null;
    const cpc = tot.clicks > 0 ? tot.spend / tot.clicks : null;
    const cpm = tot.impressions > 0 ? (tot.spend * 1000) / tot.impressions : null;
    const roas = tot.spend > 0 ? tot.revenue / tot.spend : null;
    return { ...tot, ctr, cpc, cpm, roas };
  }, [tot]);

  // Orden por defecto
  const defaultOrder: MetricKey[] = [
    'spend', 'revenue', 'conversions', 'clicks', 'impressions', 'ctr', 'cpc', 'cpm', 'roas'
  ];

  // Prefijo único por instancia para evitar choques de keys en StrictMode
  const listId = useId();

  // Si vienen slots desde el padre, deduplicamos y avisamos si llegan repetidos
  const order: MetricKey[] = useMemo(() => {
    const base = (slots && slots.length ? slots : defaultOrder).filter(Boolean) as MetricKey[];
    const dupes = base.filter((v, i, a) => a.indexOf(v) !== i);
    if (dupes.length) {
      console.warn('[KpiGrid] KPIs duplicados recibidos:', dupes);
    }
    return [...new Set(base)] as MetricKey[];
  }, [slots]);

  return (
    <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(3,minmax(0,1fr))' }}>
      {order.map((m, idx) => (
        <div key={`${listId}-${m}-${idx}`} style={cardStyle}>
          <div style={{ color: '#9ca3af', fontSize: 12, marginBottom: 6 }}>{LABEL[m]}</div>
          <div style={{ fontSize: 22, fontWeight: 700 }}>
            {loading || !derived ? '—' : fmt(m, (derived as any)[m] ?? null)}
          </div>
        </div>
      ))}
    </div>
  );
}
