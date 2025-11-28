'use client';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

export type TotalsMTD = {
  spend: number;
  impressions: number;
  clicks: number;
  conversions: number;
  revenue: number;
};

export default function useTotalsMTD(accountId: string) {
  const [tot, setTot] = useState<TotalsMTD | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!accountId) return;
    let alive = true;
    (async () => {
      setLoading(true);
      setErr(null);

      const today = new Date();
      const monthStart = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().slice(0, 10);
      const todayStr = today.toISOString().slice(0, 10);

      const { data, error } = await supabase
        .schema('perfo')
        .from('insights')
        .select('spend, impressions, clicks, conversions, revenue')
        .eq('account_id', accountId)
        .eq('level', 'campaign')
        .gte('date', monthStart)
        .lte('date', todayStr)
        .limit(50000);

      if (!alive) return;

      if (error) {
        setErr(error.message);
        setTot(null);
        setLoading(false);
        return;
      }

      const sum = (data || []).reduce(
        (acc: TotalsMTD, r: any) => ({
          spend: acc.spend + Number(r.spend || 0),
          impressions: acc.impressions + Number(r.impressions || 0),
          clicks: acc.clicks + Number(r.clicks || 0),
          conversions: acc.conversions + Number(r.conversions || 0),
          revenue: acc.revenue + Number(r.revenue || 0),
        }),
        { spend: 0, impressions: 0, clicks: 0, conversions: 0, revenue: 0 }
      );

      setTot(sum);
      setLoading(false);
    })();
    return () => { alive = false; };
  }, [accountId]);

  return { tot, loading, err };
}
