//src/app/components/PlataformTabs

'use client';

import { useState } from 'react';
import ObjectivesPanel from './ObjectivesPanel';

type Props = {
  accountId: string;
  from: string;
  to: string;
};

type TabId = 'all' | 'meta' | 'google';

export default function PlatformTabs({ accountId, from, to }: Props) {
  const [tab, setTab] = useState<TabId>('all');

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

  // Para ahora: usamos el mismo ObjectivesPanel en todas las pestañas.
  // Cuando integremos Google, filtraremos por plataforma desde la query.
  return (
    <section style={{ marginTop: 12 }}>
      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        <TabBtn id="all" label="Todas las plataformas" />
        <TabBtn id="meta" label="Meta Ads" />
        <TabBtn id="google" label="Google Ads" />
      </div>

      {tab === 'all' && <ObjectivesPanel accountId={accountId} from={from} to={to} />}
      {tab === 'meta' && <ObjectivesPanel accountId={accountId} from={from} to={to} />}
      {tab === 'google' && (
        <div style={{ opacity: 0.85 }}>
          <ObjectivesPanel accountId={accountId} from={from} to={to} />
          <div style={{ marginTop: 10, fontSize: 12, color: '#9ca3af' }}>
            * Google Ads: próximamente. Por ahora mostrás los mismos cálculos (sin datos de Google).
          </div>
        </div>
      )}
    </section>
  );
}
