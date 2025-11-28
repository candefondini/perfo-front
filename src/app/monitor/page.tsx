//src/app/monitor/page.tsx
'use client';

import { useEffect, useMemo, useState } from 'react';
import AccountSelect from '../components/AccountSelect';
import { supabase } from '@/lib/supabaseClient';

type Row = {
  campaign_id: string;
  campaign_name: string | null;
  platform: string | null;         // 'meta' | 'google' | null
  impressions: number;
  is_active?: boolean | null;      // viene en la vista; opcional en fallback
};

function todayYMD() {
  return new Date().toISOString().slice(0, 10);
}

const card = {
  background: '#0e1625',
  borderRadius: 16,
  border: '1px solid rgba(255,255,255,0.03)',
  boxShadow: '9px 9px 18px rgba(0,0,0,0.45), -9px -9px 18px rgba(255,255,255,0.05)',
  padding: 16,
} as const;

export default function MonitorPage() {
  const [accountId, setAccountId] = useState<string>('');
  const [loading, setLoading]   = useState(false);
  const [err, setErr]           = useState<string | null>(null);
  const [rows, setRows]         = useState<Row[]>([]);

  const today = useMemo(() => todayYMD(), []);

  useEffect(() => {
    if (!accountId) return;

    let alive = true;

    (async () => {
      setLoading(true);
      setErr(null);

      // 1) Intento principal: leer la VISTA pública (agrega HOY por campaña)
      const { data, error } = await supabase
        .from('insights_today_campaign')
        .select('campaign_id, campaign_name, platform, impressions, is_active')
        .eq('account_id', accountId);

      if (!alive) return;

      if (!error && data) {
        const normalized: Row[] = (data as any[]).map(r => ({
          campaign_id: String(r.campaign_id),
          campaign_name: r.campaign_name ?? null,
          platform: r.platform ?? null,
          impressions: Number(r.impressions || 0),
          is_active: typeof r.is_active === 'boolean' ? r.is_active : null,
        }));
        setRows(normalized);
        setLoading(false);
        return;
      }

    const fb = await supabase
  .from('view_meta_insights_front')
  .select('campaign_id,campaign_name,impressions,clicks,spend,conversions:conv,revenue,ctr,cpc,cpm,date')
  .eq('account_id', accountId)
  .eq('date', today)
  .limit(500000);


      if (!alive) return;

      if (fb.error) {
        setErr(error ? error.message : fb.error.message);
        setRows([]);
        setLoading(false);
        return;
      }

      // Agrega por campaña
      const agg = new Map<string, { impressions: number; name: string | null; platform: string | null }>();
      for (const r of (fb.data || []) as any[]) {
        const id = String(r.campaign_id ?? '');
        if (!id) continue;
        const cur = agg.get(id) || { impressions: 0, name: r.campaign_name ?? null, platform: r.platform ?? null };
        cur.impressions += Number(r.impressions || 0);
        if (cur.name == null && r.campaign_name) cur.name = r.campaign_name;
        if (cur.platform == null && r.platform) cur.platform = r.platform;
        agg.set(id, cur);
      }
      const out: Row[] = Array.from(agg.entries()).map(([campaign_id, v]) => ({
        campaign_id,
        campaign_name: v.name ?? null,
        platform: v.platform ?? null,
        impressions: v.impressions,
        is_active: v.impressions > 0,
      }));

      setRows(out);
      setLoading(false);
    })();

    return () => { alive = false; };
  }, [accountId, today]);

  return (
    <main style={{ maxWidth: 1100, margin:'0 auto', padding: 24, color:'#e5e7eb', fontFamily:'system-ui' }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
        <h1 style={{ fontSize: 28, fontWeight: 800 }}>Monitoreo de campañas</h1>
        <a href="/" style={{ color:'#9ca3af', textDecoration:'none' }}>← Volver</a>
      </div>
      <p style={{ color:'#9ca3af', marginTop: 6 }}>
        Nombre, plataforma, impresiones de hoy y estado (activa/inactiva).
      </p>

      <section style={{ ...card, marginTop: 12 }}>
        <div style={{ display:'grid', gridTemplateColumns:'1fr auto', gap: 12, alignItems:'end' }}>
          <div>
            <div style={{ fontSize:12, color:'#9ca3af', marginBottom:6 }}>Cuenta</div>
            <AccountSelect value={accountId} onChange={setAccountId} />
          </div>

          <div>
            <div style={{ fontSize:12, color:'#9ca3af', marginBottom:6, textAlign:'right' }}>Hoy</div>
            <div style={{
              background:'#0b1220', border:'1px solid #1f2937', borderRadius:8,
              padding:'8px 12px', minWidth:120, textAlign:'center'
            }}>
              {today.split('-').reverse().join('/')}
            </div>
          </div>
        </div>
      </section>

      <section style={{ ...card, marginTop: 16 }}>
        {/* Header tabla */}
        <div style={{
          display:'grid',
          gridTemplateColumns:'2fr 1fr 1fr 1fr 1fr',
          gap: 8,
          padding:'8px 6px',
          borderBottom:'1px solid rgba(255,255,255,0.06)',
          color:'#9ca3af',
          fontSize:12
        }}>
          <div>Campaña</div>
          <div>Plataforma</div>
          <div>Impresiones (hoy)</div>
          <div>Estado</div>
          <div style={{ textAlign:'right' }}>Acciones</div>
        </div>

        {/* Body tabla */}
        {err && <div style={{ color:'#ef4444', padding:'10px 6px' }}>Error: {err}</div>}
        {!err && !loading && rows.length === 0 && (
          <div style={{ color:'#9ca3af', padding:'12px 6px' }}>Sin datos hoy para esta cuenta.</div>
        )}

        {!err && rows.map((r) => {
          const active = typeof r.is_active === 'boolean' ? r.is_active : (r.impressions > 0);
          const platformLabel = (r.platform || 'meta').toLowerCase() === 'google' ? 'Google' : 'Meta';
          const title = r.campaign_name || r.campaign_id;

          return (
            <div
              key={r.campaign_id}
              style={{
                display:'grid',
                gridTemplateColumns:'2fr 1fr 1fr 1fr 1fr',
                gap: 8,
                padding:'10px 6px',
                borderBottom:'1px solid rgba(255,255,255,0.04)'
              }}
            >
              <div style={{ display:'flex', flexDirection:'column' }}>
                <div style={{ fontWeight:600 }}>{title}</div>
                {r.campaign_name ? (
                  <div style={{ fontSize:12, color:'#9ca3af' }}>ID: {r.campaign_id}</div>
                ) : null}
              </div>

              <div>
                <span style={{
                  background:'#0b1220',
                  border:'1px solid rgba(255,255,255,0.08)',
                  borderRadius:999,
                  padding:'2px 8px',
                  fontSize:12
                }}>
                  {platformLabel}
                </span>
              </div>

              <div>{(r.impressions ?? 0).toLocaleString('es-AR')}</div>

              <div>
                <span style={{
                  background: active ? 'rgba(16,185,129,.12)' : 'rgba(239,68,68,.12)',
                  color: active ? '#10b981' : '#ef4444',
                  border:'1px solid rgba(255,255,255,0.06)',
                  borderRadius:8,
                  padding:'4px 8px',
                  fontSize:12,
                  fontWeight:600
                }}>
                  {active ? 'Activa' : 'Inactiva'}
                </span>
              </div>

              <div style={{ textAlign:'right' }}>
                <button
                  style={{
                    background:'#0b1220',
                    border:'1px solid rgba(255,255,255,0.08)',
                    borderRadius:8,
                    padding:'6px 10px',
                    fontSize:12,
                    cursor:'pointer'
                  }}
                  onClick={() => {
                    // TODO: reemplazar con deep-link real cuando lo tengas
                    window.open('#', '_blank');
                  }}
                >
                  Abrir en plataforma
                </button>
              </div>
            </div>
          );
        })}
      </section>
    </main>
  );
}
