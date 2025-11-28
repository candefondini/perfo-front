'use client';
import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

type Platform = 'all' | 'meta' | 'google';

type Totals = { spend: number; conversions: number; revenue: number };
type Props = { accountId: string; from: string; to: string; platform: Platform };

const cardStyle = {
  borderRadius: 16,
  padding: 16,
  background: '#0e1625',
  minHeight: 92,
  boxShadow: '9px 9px 18px rgba(0,0,0,0.45), -9px -9px 18px rgba(255,255,255,0.05)',
  border: '1px solid rgba(255,255,255,0.03)',
} as const;

export default function RealPanel({ accountId, from, to, platform }: Props) {
  const [totals, setTotals] = useState<Totals | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);

      let q = supabase
        .schema('perfo')
        .from('insights')
        .select('spend, conversions, revenue, platform')
        .eq('account_id', accountId)
        .eq('level', 'campaign')
        .gte('date', from)
        .lte('date', to)
        .limit(50000);

      if (platform !== 'all') q = q.eq('platform', platform);

      const { data, error } = await q;

      if (!alive) return;

      if (error) {
        setTotals(null);
        setLoading(false);
        return;
      }

      const totals = (data || []).reduce(
        (acc: Totals, r: any) => ({
          spend: acc.spend + Number(r.spend || 0),
          conversions: acc.conversions + Number(r.conversions || 0),
          revenue: acc.revenue + Number(r.revenue || 0),
        }),
        { spend: 0, conversions: 0, revenue: 0 }
      );

      setTotals(totals);
      setLoading(false);
    })();
    return () => { alive = false; };
  }, [accountId, from, to, platform]);

  const roas = useMemo(() => {
    if (!totals) return null;
    return totals.spend > 0 ? totals.revenue / totals.spend : null;
  }, [totals]);

  return (
    <div style={{ display: 'grid', gap: 12, gridTemplateColumns: '1fr 1fr' }}>
      <div style={cardStyle}>
        <div style={{ color: '#9ca3af', fontSize: 12, marginBottom: 6 }}>Resultados reales</div>
        <div style={{ fontSize: 28, fontWeight: 800 }}>
          {loading || !totals ? '—' : totals.conversions.toLocaleString('es-AR')}
        </div>
      </div>
      <div style={cardStyle}>
        <div style={{ color: '#9ca3af', fontSize: 12, marginBottom: 6 }}>ROAS real</div>
        <div style={{ fontSize: 28, fontWeight: 800 }}>
          {loading || roas == null ? '—' : `${roas.toFixed(2)}x`}
        </div>
      </div>
    </div>
  );
}
