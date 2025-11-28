'use client';
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabaseClient';

type AccountRow = {
  id: string;
  name: string | null;
  is_active: boolean | null;
  monthly_budget: number | null;
  platforms?: string[] | null;
  // agregados calculados
  spend_mtd: number;
  available: number | null;
  health_score: number | null;
};

export default function ManageHome() {
  const [rows, setRows] = useState<AccountRow[]>([]);
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);

      // 1) Traigo cuentas (si tu tabla tiene otro nombre/campos, ajustá acá)
      const { data: acc } = await supabase
        .from('accounts')
        .select('id,name,is_active,monthly_budget,platforms')
        .limit(500);

      // 2) MTD por cuenta desde insights
      const today = new Date();
      const monthStart = new Date(today.getFullYear(), today.getMonth(), 1)
        .toISOString().slice(0, 10);
      const todayStr = today.toISOString().slice(0, 10);

      const { data: ins } = await supabase
        .from('insights')
        .select('account_id, spend, impressions, clicks, conversions, date, level')
        .eq('level', 'campaign')
        .gte('date', monthStart)
        .lte('date', todayStr)
        .limit(50000);

      if (!alive) return;

      const spendByAcc = new Map<string, number>();
      const ctrByAcc: Record<string, { imp: number; clk: number; conv: number }> = {};
      for (const r of (ins || []) as any[]) {
        const id = String(r.account_id);
        spendByAcc.set(id, (spendByAcc.get(id) || 0) + Number(r.spend || 0));
        if (!ctrByAcc[id]) ctrByAcc[id] = { imp: 0, clk: 0, conv: 0 };
        ctrByAcc[id].imp += Number(r.impressions || 0);
        ctrByAcc[id].clk += Number(r.clicks || 0);
        ctrByAcc[id].conv += Number(r.conversions || 0);
      }

      const out: AccountRow[] = (acc || []).map((a: any) => {
        const spend_mtd = spendByAcc.get(a.id) || 0;
        const available = a.monthly_budget != null ? a.monthly_budget - spend_mtd : null;

        // score salud muy simple para el listado
        const agg = ctrByAcc[a.id] || { imp: 0, clk: 0, conv: 0 };
        let score: number | null = null;
        if (spend_mtd === 0 && agg.imp === 0) score = null; // sin actividad
        else if (spend_mtd > 0 && agg.conv === 0) score = 35;
        else {
          let s = 70;
          const ctr = agg.imp > 0 ? agg.clk / agg.imp : 0;
          if (ctr > 0.015) s += 10;
          if ((agg.conv || 0) > 0) s += 10;
          score = Math.max(30, Math.min(100, s));
        }

        return {
          id: a.id,
          name: a.name ?? '(sin nombre)',
          is_active: !!a.is_active,
          monthly_budget: a.monthly_budget ?? null,
          platforms: a.platforms ?? ['meta'],
          spend_mtd,
          available,
          health_score: score,
        };
      });

      setRows(out.sort((x, y) => (y.spend_mtd - x.spend_mtd)));
      setLoading(false);
    })();
    return () => { alive = false; };
  }, []);

  const totals = useMemo(() => {
    const budget = rows.reduce((s, r) => s + (r.monthly_budget || 0), 0);
    const spent = rows.reduce((s, r) => s + (r.spend_mtd || 0), 0);
    return { budget, spent, avail: budget ? budget - spent : 0 };
  }, [rows]);

  const fmt = (n: number, d = 0) =>
    n.toLocaleString('es-AR', { minimumFractionDigits: d, maximumFractionDigits: d });

  const money = (n: number | null) => n == null ? '—' :
    `$ ${n.toLocaleString('es-AR', { maximumFractionDigits: 0 })}`;

  const filtered = rows.filter(r => (r.name || '').toLowerCase().includes(q.toLowerCase()));

  return (
    <main style={{ maxWidth: 1100, margin: '0 auto', padding: 24, fontFamily: 'system-ui', color:'#111' }}>
      <header style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom: 12 }}>
        <h1 style={{ fontSize: 24, fontWeight: 800 }}>Gestión de Campañas Publicitarias</h1>
        <div style={{ display:'flex', gap: 34, fontSize: 12, color:'#444' }}>
          <div><div style={{fontSize:11}}>PRESUPUESTO TOTAL</div><div style={{fontSize:16,fontWeight:700}}>{money(totals.budget)}</div></div>
          <div><div style={{fontSize:11}}>GASTADO</div><div style={{fontSize:16,fontWeight:700}}>{money(totals.spent)}</div></div>
          <div><div style={{fontSize:11}}>DISPONIBLE</div><div style={{fontSize:16,fontWeight:700}}>{money(totals.avail)}</div></div>
        </div>
      </header>

      <div style={{ margin:'12px 0 20px' }}>
        <input
          placeholder="Buscar cliente…"
          value={q}
          onChange={(e)=>setQ(e.target.value)}
          style={{
            width: 360, padding:'10px 12px', borderRadius: 10, border:'1px solid #e5e7eb',
            background:'#fff'
          }}
        />
      </div>

      <div style={{ border:'1px solid #e5e7eb', borderRadius:12, overflow:'hidden', background:'#fff' }}>
        <div style={{ display:'grid', gridTemplateColumns:'2fr 1fr 1fr 1fr', gap:8, padding:'10px 12px', background:'#fafafa', fontSize:13, color:'#555' }}>
          <div>Nombre cliente</div>
          <div>Salud campaña</div>
          <div>Actividad</div>
          <div>Presupuesto disponible</div>
        </div>

        {loading ? (
          <div style={{ padding:14, color:'#666' }}>Cargando…</div>
        ) : filtered.length === 0 ? (
          <div style={{ padding:14, color:'#666' }}>No hay clientes para este filtro.</div>
        ) : filtered.map((r) => (
          <div key={r.id} style={{ display:'grid', gridTemplateColumns:'2fr 1fr 1fr 1fr', gap:8, padding:'12px 12px', borderTop:'1px solid #f0f0f0', alignItems:'center' }}>
            <div>
              <Link href={`/manage/${encodeURIComponent(r.id)}`} style={{ color:'#0366d6', textDecoration:'none', fontWeight:600 }}>
                {r.name}
              </Link>
              <div style={{ fontSize:12, color:'#777' }}>
                {(r.platforms || []).map(p => p==='google'?'Google Ads':'Meta Ads').join(' · ')}
              </div>
            </div>

            <div>
              <HealthBadge score={r.health_score} />
            </div>

            <div>
              <StatusPill active={!!r.is_active} />
            </div>

            <div style={{ fontWeight:700, textAlign:'right' }}>
              {money(r.available)}
            </div>
          </div>
        ))}
      </div>

      <div style={{ marginTop:14, fontSize:12, color:'#777' }}>
        Hecho con ❤️ para controlar Meta Ads y Google Ads.
      </div>
    </main>
  );
}

function StatusPill({ active }: { active: boolean }) {
  const bg = active ? 'rgba(16,185,129,.12)' : 'rgba(239,68,68,.12)';
  const dot = active ? '#10b981' : '#ef4444';
  const label = active ? 'Activa' : 'Inactiva';
  return (
    <div style={{ display:'inline-flex', alignItems:'center', gap:8, background:bg, border:'1px solid #e5e7eb', padding:'4px 10px', borderRadius:999 }}>
      <span style={{ width:10, height:10, borderRadius:999, background:dot }} />
      <span style={{ fontSize:12 }}>{label}</span>
    </div>
  );
}

function HealthBadge({ score }: { score: number | null }) {
  if (score == null) {
    return <span style={{ fontSize:12, color:'#888' }}>—</span>;
  }
  const color = score >= 80 ? '#10b981' : score >= 50 ? '#f59e0b' : '#ef4444';
  const bg = score >= 80 ? 'rgba(16,185,129,.12)' : score >= 50 ? 'rgba(250,204,21,.12)' : 'rgba(239,68,68,.12)';
  return (
    <div style={{ display:'inline-flex', alignItems:'center', gap:8, background:bg, border:'1px solid #e5e7eb', padding:'4px 10px', borderRadius:999 }}>
      <span style={{ width:10, height:10, borderRadius:999, background:color }} />
      <span style={{ fontSize:12, color:'#111', fontWeight:700 }}>{score}/100</span>
    </div>
  );
}
