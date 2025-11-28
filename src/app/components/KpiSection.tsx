//src/app/components/KpiSection.tsx
'use client';
import { useEffect, useMemo, useState } from 'react';
import KpiGrid, { MetricKey, Platform } from './KpiGrid';

type Props = { accountId: string; from: string; to: string };

const METRIC_LABEL: Record<MetricKey, string> = {
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

export default function KpiSection({ accountId, from, to }: Props) {
  const [platform, setPlatform] = useState<Platform>('all');

  // 8 slots personalizables
  const lsKey = (i:number) => `kpiSlots:${accountId}:${from}:${to}:${platform}:slot${i}`;
  const defaultSlots: MetricKey[] = ['spend','revenue','conversions','clicks','impressions','ctr','cpc','cpm'];

  const [slots, setSlots] = useState<MetricKey[]>(() => {
    // intenta leer 8; si no, usa default
    const initial: MetricKey[] = [];
    for (let i = 0; i < 8; i++) {
      const v = (localStorage.getItem(lsKey(i)) as MetricKey) || defaultSlots[i];
      initial.push(v);
    }
    return initial;
  });

  // Persistencia
  useEffect(() => {
    slots.forEach((m, i) => localStorage.setItem(lsKey(i), m));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slots, accountId, from, to, platform]);

  // helpers UI
  const allOptions: MetricKey[] = ['spend','revenue','conversions','clicks','impressions','ctr','cpc','cpm','roas'];

  const Tab = ({ id, label }: { id: Platform; label: string }) => (
    <button
      onClick={() => setPlatform(id)}
      style={{
        padding: '8px 12px',
        borderRadius: 12,
        border: '1px solid rgba(255,255,255,0.08)',
        background: platform === id ? 'linear-gradient(145deg,#0d1528,#0a1120)' : '#0b1220',
        color: '#e5e7eb',
        boxShadow:
          platform === id
            ? 'inset 2px 2px 6px rgba(0,0,0,0.6), inset -2px -2px 6px rgba(255,255,255,0.06)'
            : '8px 8px 16px rgba(0,0,0,0.45), -6px -6px 14px rgba(255,255,255,0.05)',
        cursor: 'pointer',
      }}
    >
      {label}
    </button>
  );

  return (
    <div style={{ display: 'grid', gap: 14 }}>
      {/* Tabs por plataforma */}
      <div style={{ display: 'flex', gap: 8 }}>
        <Tab id="all" label="Todas las plataformas" />
        <Tab id="meta" label="Meta Ads" />
        <Tab id="google" label="Google Ads" />
      </div>

      {/* Selectores de KPIs (8) */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4,minmax(0,1fr))',
          gap: 8,
          background: '#0e1625',
          borderRadius: 12,
          border: '1px solid rgba(255,255,255,0.05)',
          padding: 12,
          boxShadow: 'inset 3px 3px 6px rgba(0,0,0,.45), inset -3px -3px 6px rgba(255,255,255,.04)',
        }}
      >
        {slots.map((m, i) => (
          <select
            key={i}
            value={m}
            onChange={(e) => {
              const next = [...slots];
              next[i] = e.target.value as MetricKey;
              setSlots(next);
            }}
            style={{
              background:'#0c1422',
              border:'1px solid rgba(255,255,255,0.06)',
              color:'#e5e7eb',
              padding:'7px 10px',
              borderRadius:10,
            }}
          >
            {allOptions.map(opt => (
              <option key={opt} value={opt}>{METRIC_LABEL[opt]}</option>
            ))}
          </select>
        ))}
      </div>

      {/* Grid de KPIs en el orden elegido */}
      <KpiGrid accountId={accountId} from={from} to={to} platform={platform} slots={slots} />

      {platform === 'google' && (
        <div style={{ fontSize: 12, color: '#9ca3af' }}>
          * Google Ads: placeholder hasta integrar la fuente.
        </div>
      )}
    </div>
  );
}
