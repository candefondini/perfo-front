// src/app/account/[accountId]/page.tsx
'use client';

import Link from 'next/link';
export const dynamic = 'force-dynamic';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';

type Platform = 'all' | 'meta' | 'google';
type Level = 'campaign' | 'adset' | 'ad';
type Preset = 'today' | 'yesterday' | 'last7' | 'last30' | 'mtd' | 'custom';
type StatusFilter = 'all' | 'active' | 'paused' | 'inactive';

type Kpis = {
  account_id: string;
  month: string;
  spend: number | null;
  impressions: number | null;
  clicks: number | null;
  conversions: number | null;
  cpc: number | null;
  cpm: number | null;
  ctr: number | null;
};

type Row = {
  account_id: string;
  entity_id: string;
  name: string | null;
  status: string | null;
  spend: number | null;
  impressions: number | null;
  clicks: number | null;
  conversions: number | null;
  cpc: number | null;
  cpm: number | null;
  ctr?: number | null;
};

type MetricKey =
  | 'conversions'
  | 'spend'
  | 'revenue'
  | 'impressions'
  | 'clicks'
  | 'ctr'
  | 'cpc'
  | 'cpm'
  | 'roas';

const LABEL_BY_LEVEL: Record<Level, string> = {
  campaign: 'Campañas',
  adset: 'Conjuntos',
  ad: 'Anuncios',
};

const TABLE_BY_LEVEL: Record<Level, 'campaigns' | 'adsets' | 'ads'> = {
  campaign: 'campaigns',
  adset: 'adsets',
  ad: 'ads',
};

/* ====== Utils rango ====== */
function toISODate(d: Date) {
  return new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()))
    .toISOString()
    .slice(0, 10);
}
function todayLocal() {
  const t = new Date();
  return new Date(t.getFullYear(), t.getMonth(), t.getDate());
}
function addDays(d: Date, delta: number) {
  const x = new Date(d);
  x.setDate(x.getDate() + delta);
  return x;
}
function presetRange(preset: Preset): { from: string; to: string; label: string } {
  const t = todayLocal();
  if (preset === 'today') return { from: toISODate(t), to: toISODate(t), label: 'Hoy' };
  if (preset === 'yesterday') {
    const y = addDays(t, -1);
    return { from: toISODate(y), to: toISODate(y), label: 'Ayer' };
  }
  if (preset === 'last7') {
    const from = addDays(t, -6);
    return { from: toISODate(from), to: toISODate(t), label: 'Últimos 7 días' };
  }
  if (preset === 'last30') {
    const from = addDays(t, -29);
    return { from: toISODate(from), to: toISODate(t), label: 'Últimos 30 días' };
  }
  if (preset === 'mtd') {
    const from = new Date(t.getFullYear(), t.getMonth(), 1);
    return { from: toISODate(from), to: toISODate(t), label: 'MTD' };
  }
  const from = toISODate(addDays(t, -6));
  return { from, to: toISODate(t), label: 'Personalizado' };
}

/* ====== Semáforo / estado ====== */
function isActiveStatus(s?: string | null) {
  if (!s) return false;
  const v = s.toUpperCase().trim();
  if (['ACTIVE', 'DELIVERING', 'ENABLED', 'RUNNING'].includes(v)) return true;
  const INACTIVE_HINTS = [
    'PAUSED',
    'CAMPAIGN_PAUSED',
    'ADSET_PAUSED',
    'AD_PAUSED',
    'INACTIVE',
    'DISABLED',
    'ARCHIVED',
    'DELETED',
    'STOPPED',
  ];
  if (INACTIVE_HINTS.some((h) => v.includes(h))) return false;
  return false;
}
function isPausedStatus(s?: string | null) {
  if (!s) return false;
  const v = s.toUpperCase();
  return v.includes('PAUSED');
}
function statusBadge(s?: string | null) {
  if (!s) return { text: '—', bg: '#e5e7eb', fg: '#0f172a' };
  if (isActiveStatus(s)) return { text: 'Activa', bg: 'rgba(16,185,129,.1)', fg: '#16a34a' };
  if (isPausedStatus(s)) return { text: 'Paused', bg: 'rgba(250,204,21,.12)', fg: '#ca8a04' };
  return { text: 'Inactiva', bg: 'rgba(239,68,68,.12)', fg: '#ef4444' };
}
function healthColorByStatusAndCtr(status: string | null, ctr?: number | null) {
  if (!isActiveStatus(status)) return '#ef4444';
  const v = Number(ctr || 0);
  if (v >= 2) return '#16a34a';
  if (v >= 1) return '#ca8a04';
  return '#ef4444';
}

/* ====== Formats ====== */
const fmt = (n?: number | null, d = 0) =>
  n == null ? '-' : n.toLocaleString('es-AR', { minimumFractionDigits: d, maximumFractionDigits: d });
const money = (n?: number | null, d = 2) => (n == null ? '-' : `$ ${fmt(n, d)}`);
const LABEL_METRIC: Record<MetricKey, string> = {
  conversions: 'Resultados',
  spend: 'Gasto',
  revenue: 'Revenue',
  impressions: 'Impr.',
  clicks: 'Clicks',
  ctr: 'CTR',
  cpc: 'CPC',
  cpm: 'CPM',
  roas: 'ROAS',
};
function formatMetric(metric: MetricKey, v: number) {
  if (!isFinite(v)) return '—';
  if (metric === 'spend' || metric === 'revenue') return money(v, 2);
  if (metric === 'cpc') return money(v, 3);
  if (metric === 'cpm') return money(v, 2);
  if (metric === 'ctr') return `${v.toFixed(2)}%`;
  if (metric === 'roas') return `${v.toFixed(2)}x`;
  return v.toLocaleString('es-AR');
}

export default function AccountPage() {
  const params = useParams<{ accountId: string }>();
  const accountId = decodeURIComponent(String(params?.accountId ?? ''));
  const router = useRouter();

  const [platform, setPlatform] = useState<Platform>('all');
  const [level, setLevel] = useState<Level>('campaign');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');

  const [accountName, setAccountName] = useState<string | null>(null);
  const [kpis, setKpis] = useState<Kpis | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  /* ===== Objetivos por campaña (localStorage) ===== */
  type Obj = { metric: MetricKey; target: number; note?: string };
  const storageKey = `objCampaign:${accountId}`;
  const [objMap, setObjMap] = useState<Record<string, Obj>>({});
  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      setObjMap(raw ? JSON.parse(raw) : {});
    } catch {
      setObjMap({});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accountId]);
  const saveObjMap = (next: Record<string, Obj>) => {
    setObjMap(next);
    try {
      localStorage.setItem(storageKey, JSON.stringify(next));
    } catch {}
  };

  /* Fecha */
  const [preset, setPreset] = useState<Preset>('mtd');
  const initial = presetRange('mtd');
  const [fromStr, setFromStr] = useState<string>(initial.from);
  const [toStr, setToStr] = useState<string>(initial.to);
  const currentLabel =
    preset !== 'custom' ? presetRange(preset).label : fromStr === toStr ? fromStr : `${fromStr} → ${toStr}`;

  /* Nombre de cuenta */
  useEffect(() => {
    if (!accountId) return;
    let alive = true;
    (async () => {
      const { data, error } = await supabase
        .schema('perfo')
        .from('ad_accounts')
        .select('name')
        .eq('id', accountId)
        .single();
      if (!alive) return;
      setAccountName(error ? null : data?.name ?? null);
    })();
    return () => {
      alive = false;
    };
  }, [accountId]);

  /* Datos */
  useEffect(() => {
    if (!accountId) return;
    let alive = true;

      (async () => {
    if (!accountId) return;

    // si el preset NO es custom, sincronizamos from/to con el preset
    if (preset !== 'custom') {
      const r = presetRange(preset);
      if (r.from !== fromStr) setFromStr(r.from);
      if (r.to !== toStr) setToStr(r.to);
    }

    setLoading(true);
    setError(null);

    /* ==========================
       🔹 CASO GOOGLE ADS
       ========================== */
        if (platform === 'google') {
      // por ahora solo tenemos campañas de Google
      if (level !== 'campaign') {
        if (!alive) return;
        setRows([]);
        setKpis(null);
        setError('Por ahora solo tenemos datos de campañas para Google Ads.');
        setLoading(false);
        return;
      }

      // 🔹 traducimos el id de la URL (act_xxx) al id de Google (solo número)
      const googleAccountId = accountId.startsWith('act_')
        ? accountId.replace('act_', '')
        : accountId;

      // traemos campañas de la vista diaria
      const { data, error: gErr } = await supabase
        .schema('perfo')
        .from('view_google_campaigns_daily')
        .select(
          'account_id, campaign_id, name, status, date, spend, impressions, clicks, conversions'
        )
        .eq('account_id', googleAccountId)   
        .gte('date', fromStr)
        .lte('date', toStr)
        .limit(50000);


      if (gErr) {
        console.error('googleErr account:', gErr.message);
        if (!alive) return;
        setError(gErr.message);
        setRows([]);
        setKpis(null);
        setLoading(false);
        return;
      }

      if (!data || data.length === 0) {
        if (!alive) return;
        setRows([]);
        setKpis(null);
        setLoading(false);
        return;
      }

      type GAgg = {
        account_id: string;
        entity_id: string;
        name: string | null;
        status: string | null;
        spend: number;
        impressions: number;
        clicks: number;
        conversions: number;
      };

      const byCampaign = new Map<string, GAgg>();

      for (const r of data as any[]) {
        const id = String(r.campaign_id ?? '');
        if (!id) continue;

        const cur: GAgg =
          byCampaign.get(id) || {
            account_id: r.account_id,
            entity_id: id,
            name: r.name ?? null,
            status: r.status ?? null,
            spend: 0,
            impressions: 0,
            clicks: 0,
            conversions: 0,
          };

        cur.spend += Number(r.spend || 0);
        cur.impressions += Number(r.impressions || 0);
        cur.clicks += Number(r.clicks || 0);
        cur.conversions += Number(r.conversions || 0);

        if (!cur.name && r.name) cur.name = r.name;
        if (!cur.status && r.status) cur.status = r.status;

        byCampaign.set(id, cur);
      }

      const tableRows: Row[] = Array.from(byCampaign.values())
        .map((a) => {
          const cpc = a.clicks > 0 ? a.spend / a.clicks : null;
          const cpm = a.impressions > 0 ? (a.spend * 1000) / a.impressions : null;
          const ctr = a.impressions > 0 ? (a.clicks / a.impressions) * 100 : null;

          return {
            account_id: a.account_id,
            entity_id: a.entity_id,
            name: a.name,
            status: a.status,
            spend: a.spend,
            impressions: a.impressions,
            clicks: a.clicks,
            conversions: a.conversions,
            cpc,
            cpm,
            ctr,
          };
        })
        .sort((x, y) => (y.spend || 0) - (x.spend || 0));

      const totalSpend = tableRows.reduce((s, r) => s + (r.spend || 0), 0);
      const totalImp = tableRows.reduce((s, r) => s + (r.impressions || 0), 0);
      const totalClk = tableRows.reduce((s, r) => s + (r.clicks || 0), 0);
      const totalConv = tableRows.reduce((s, r) => s + (r.conversions || 0), 0);
      const ctr = totalImp > 0 ? (totalClk / totalImp) * 100 : null;
      const cpc = totalClk > 0 ? totalSpend / totalClk : null;
      const cpm = totalImp > 0 ? (totalSpend * 1000) / totalImp : null;

      if (!alive) return;
      setRows(tableRows);
      setKpis({
        account_id: accountId,
        month: fromStr.slice(0, 7),
        spend: totalSpend,
        impressions: totalImp,
        clicks: totalClk,
        conversions: totalConv,
        cpc,
        cpm,
        ctr,
      });
      setLoading(false);
      return; // 👈 importante, no seguir al bloque Meta
    }

    /* ==========================
       🔹 CASO META (lo que ya tenías)
       ========================== */

    const viewName =
      level === 'adset'
        ? 'view_meta_insights_front_adsets'
        : level === 'ad'
        ? 'view_meta_insights_front_ads'
        : 'view_meta_insights_front';

    const { data: ins, error: insErr } = await supabase
      .schema('perfo')
      .from(viewName)
      .select(
        'account_id, entity_id, entity_name, date, spend, impressions, clicks, conv, revenue, ctr, cpc, cpm'
      )
      .eq('account_id', accountId)
      .gte('date', fromStr)
      .lte('date', toStr)
      .limit(20000);

    if (insErr) {
      console.error('insErr account:', insErr.message);
      if (!alive) return;
      setError(insErr.message);
      setRows([]);
      setKpis(null);
      setLoading(false);
      return;
    }

    if (!ins || ins.length === 0) {
      if (!alive) return;
      setRows([]);
      setKpis(null);
      setLoading(false);
      return;
    }

    // ...👇 dejá igual todo el bloque de agregación META que ya tenías
    type Agg = {
      account_id: string;
      entity_id: string;
      name: string | null;
      spend: number;
      impressions: number;
      clicks: number;
      conversions: number;
    };

    const byEntity = new Map<string, Agg>();

    for (const r of ins as any[]) {
      const id = String(r.entity_id ?? '');
      if (!id) continue;

      const cur: Agg =
        byEntity.get(id) ||
        {
          account_id: r.account_id,
          entity_id: id,
          name: r.entity_name ?? null,
          spend: 0,
          impressions: 0,
          clicks: 0,
          conversions: 0,
        };

      cur.spend += Number(r.spend || 0);
      cur.impressions += Number(r.impressions || 0);
      cur.clicks += Number(r.clicks || 0);
      cur.conversions += Number(r.conv || 0);

      if (!cur.name && r.entity_name) cur.name = r.entity_name;

      byEntity.set(id, cur);
    }

    const entityIds = Array.from(byEntity.keys());
    const meta: Record<string, { name: string | null; status: string | null }> = {};
    if (entityIds.length) {
      const table = TABLE_BY_LEVEL[level];
      const { data: metas } = await supabase
        .schema('perfo')
        .from(table)
        .select('id, name, status')
        .in('id', entityIds)
        .limit(20000);
      for (const m of (metas as any[]) || []) {
        meta[m.id] = { name: m.name ?? null, status: (m.status as string) ?? null };
      }
    }

    const tableRows: Row[] = Array.from(byEntity.values())
      .map((a) => {
        const cpc = a.clicks > 0 ? a.spend / a.clicks : null;
        const cpm = a.impressions > 0 ? (a.spend * 1000) / a.impressions : null;
        const ctr = a.impressions > 0 ? (a.clicks / a.impressions) * 100 : null;

        const m = meta[a.entity_id] || { name: null, status: null };

        return {
          account_id: a.account_id,
          entity_id: a.entity_id,
          name: m.name ?? a.name ?? null,
          status: m.status,
          spend: a.spend,
          impressions: a.impressions,
          clicks: a.clicks,
          conversions: a.conversions,
          cpc,
          cpm,
          ctr,
        };
      })
      .sort((x, y) => (y.spend || 0) - (x.spend || 0));

    const totalSpend = tableRows.reduce((s, r) => s + (r.spend || 0), 0);
    const totalImp = tableRows.reduce((s, r) => s + (r.impressions || 0), 0);
    const totalClk = tableRows.reduce((s, r) => s + (r.clicks || 0), 0);
    const totalConv = tableRows.reduce((s, r) => s + (r.conversions || 0), 0);
    const ctr = totalImp > 0 ? (totalClk / totalImp) * 100 : null;
    const cpc = totalClk > 0 ? totalSpend / totalClk : null;
    const cpm = totalImp > 0 ? (totalSpend * 1000) / totalImp : null;

    if (!alive) return;
    setRows(tableRows);
    setKpis({
      account_id: accountId,
      month: fromStr.slice(0, 7),
      spend: totalSpend,
      impressions: totalImp,
      clicks: totalClk,
      conversions: totalConv,
      cpc,
      cpm,
      ctr,
    });
    setLoading(false);
  })();


    return () => {
      alive = false;
    };
  }, [accountId, level, platform, preset, fromStr, toStr]);

  const totals = useMemo(() => {
    if (!rows.length) return null;
    const sum = <K extends keyof Row>(key: K) =>
      rows.reduce((acc, r) => acc + (Number(r[key] ?? 0) || 0), 0);
    const spend = sum('spend');
    const impressions = sum('impressions');
    const clicks = sum('clicks');
    const conversions = sum('conversions');
    const cpc = clicks > 0 ? spend / clicks : null;
    const cpm = impressions > 0 ? (spend * 1000) / impressions : null;
    return { spend, impressions, clicks, conversions, cpc, cpm };
  }, [rows]);

  /* pills reutilizables */
  const Pill = ({
    active,
    onClick,
    children,
  }: {
    active: boolean;
    onClick: () => void;
    children: React.ReactNode;
  }) => <button onClick={onClick} className={active ? 'pill pill--active' : 'pill'}>{children}</button>;

  /* ===== helpers objetivos/progreso por fila ===== */
  const allMetrics: MetricKey[] = [
    'conversions',
    'spend',
    'revenue',
    'impressions',
    'clicks',
    'ctr',
    'cpc',
    'cpm',
    'roas',
  ];
  function valueForMetric(r: Row, metric: MetricKey) {
    const m = metric;
    if (m === 'revenue' || m === 'roas') return 0; // aún no tenemos revenue/roas a nivel fila
    return (r as any)[m] ?? 0;
  }

  /* ====== Filtros ====== */
  const filteredRows = useMemo(() => {
    if (statusFilter === 'all') return rows;
    return rows.filter((r) => {
      if (statusFilter === 'active') return isActiveStatus(r.status);
      if (statusFilter === 'paused') return isPausedStatus(r.status);
      return !isActiveStatus(r.status) && !isPausedStatus(r.status);
    });
  }, [rows, statusFilter]);

  return (
    <main className="page-wrap">
      {/* Header */}
      <div className="section-header">
        <div>
          <div className="section-title">{accountName || 'Cuenta'}</div>
          <div className="section-sub">
            Rango: <span className="badge-range">{currentLabel}</span>
          </div>
        </div>

        <div className="header-right">
          <div className="group group--inline">
            <span className="group-label">Fecha</span>
            <select value={preset} onChange={(e) => setPreset(e.target.value as Preset)} className="neo-select select--sm">
              <option value="today">Hoy</option>
              <option value="yesterday">Ayer</option>
              <option value="last7">Últimos 7 días</option>
              <option value="last30">Últimos 30 días</option>
              <option value="mtd">MTD</option>
              <option value="custom">Personalizado…</option>
            </select>
            {preset === 'custom' && (
              <>
                <input
                  type="date"
                  className="neo-input date--sm"
                  value={fromStr}
                  onChange={(e) => setFromStr(e.target.value)}
                />
                <span style={{ color: '#64748b', fontSize: 12 }}>→</span>
                <input type="date" className="neo-input date--sm" value={toStr} onChange={(e) => setToStr(e.target.value)} />
              </>
            )}
          </div>

          <button onClick={() => router.push('/')} className="btn">
            <svg className="btn-icon" viewBox="0 0 24 24" fill="none">
              <path d="M15 18l-6-6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Volver
          </button>
        </div>
      </div>

      {/* Plataforma / Nivel / Filtro estado */}
      <div className="container">
        <div className="group" style={{ marginBottom: 8 }}>
          <span className="group-label">Plataforma</span>
          <Pill active={platform === 'all'} onClick={() => setPlatform('all')}>Todas</Pill>
          <Pill active={platform === 'meta'} onClick={() => setPlatform('meta')}>Meta Ads</Pill>
          <Pill active={platform === 'google'} onClick={() => setPlatform('google')}>Google Ads</Pill>
        </div>

        <div className="group" style={{ marginBottom: 8 }}>
          <span className="group-label">Nivel</span>
          <Pill active={level === 'campaign'} onClick={() => setLevel('campaign')}>Campañas</Pill>
          <Pill active={level === 'adset'} onClick={() => setLevel('adset')}>Conjuntos</Pill>
          <Pill active={level === 'ad'} onClick={() => setLevel('ad')}>Anuncios</Pill>
        </div>

        <div className="group" style={{ marginBottom: 16 }}>
          <span className="group-label">Estado</span>
          <select className="neo-select" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}>
            <option value="all">Todas</option>
            <option value="active">Activas</option>
            <option value="paused">Pausadas</option>
            <option value="inactive">Inactivas</option>
          </select>
        </div>
      </div>

            {error && (
        <p className="container" style={{ color: '#ef4444', marginBottom: 12 }}>
          Error: {error}
        </p>
      )}

      {/* Tabla (Meta + Google) */}
      <section className="container" style={{ marginTop: 16 }}>
        <h2 style={{ fontSize: 18, marginBottom: 8 }}>{LABEL_BY_LEVEL[level]}</h2>

        {loading ? (
          <p style={{ color: '#64748b' }}>Cargando…</p>
        ) : filteredRows.length === 0 ? (
          <p style={{ color: '#64748b' }}>No hay datos en el rango.</p>
        ) : (
          <div className="neo-card" style={{ overflowX: 'auto' }}>
            <table className="table">
              <thead>
                <tr>
                  <th>Salud</th>
                  <th>Nombre</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'right' }}>Spend</th>
                  <th style={{ textAlign: 'right' }}>Impr.</th>
                  <th style={{ textAlign: 'right' }}>Clicks</th>
                  <th style={{ textAlign: 'right' }}>Conv.</th>
                  <th style={{ textAlign: 'right' }}>CTR</th>
                  <th style={{ textAlign: 'right' }}>CPC</th>
                  <th style={{ textAlign: 'right' }}>CPM</th>
                  <th>Objetivo</th>
                  <th>Progreso</th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.map((r) => {
                  const badge = statusBadge(r.status ?? null);
                  const obj = objMap[r.entity_id];
                  let objetivoTxt = '—';
                  let progresoTxt = '—';
                  if (obj) {
                    const actual = Number(valueForMetric(r, obj.metric) || 0);
                    const target = Number(obj.target || 0);
                    objetivoTxt = `${LABEL_METRIC[obj.metric]}: ${formatMetric(obj.metric, target)}`;
                    const pct = target > 0 ? Math.min(100, (actual / target) * 100) : 0;
                    const faltan = Math.max(0, target - actual);
                    progresoTxt = `${pct.toFixed(0)}% — faltan ${formatMetric(obj.metric, faltan)}`;
                  }

                  return (
                    <tr key={r.entity_id}>
                      <td>
                        <span
                          className="dot"
                          style={{
                            width: 10,
                            height: 10,
                            background: healthColorByStatusAndCtr(r.status ?? null, r.ctr),
                          }}
                        />
                      </td>
                      <td>
                        {level === 'campaign' ? (
                          <span style={{ color: '#0f172a' }}>
                            {r.name || r.entity_id}
                          </span>
                        ) : (
                          r.name || r.entity_id
                        )}
                      </td>
                      <td>
                        <span
                          className={`badge ${
                            isActiveStatus(r.status)
                              ? 'badge--ok'
                              : isPausedStatus(r.status)
                              ? 'badge--warn'
                              : 'badge--bad'
                          }`}
                          style={{ background: badge.bg, color: badge.fg }}
                        >
                          {badge.text}
                        </span>
                      </td>
                      <td style={{ textAlign: 'right' }}>{money(r.spend)}</td>
                      <td style={{ textAlign: 'right' }}>{fmt(r.impressions)}</td>
                      <td style={{ textAlign: 'right' }}>{fmt(r.clicks)}</td>
                      <td style={{ textAlign: 'right' }}>{fmt(r.conversions)}</td>
                      <td style={{ textAlign: 'right' }}>
                        {r.ctr == null ? '-' : `${fmt(r.ctr, 2)}%`}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        {r.cpc == null ? '-' : `$ ${fmt(r.cpc, 3)}`}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        {r.cpm == null ? '-' : `$ ${fmt(r.cpm, 2)}`}
                      </td>
                      <td>{objetivoTxt}</td>
                      <td>{progresoTxt}</td>
                    </tr>
                  );
                })}
              </tbody>

              {totals && (
                <tfoot>
                  <tr>
                    <td>—</td>
                    <td>
                      <b>Totales</b>
                    </td>
                    <td>—</td>
                    <td style={{ textAlign: 'right' }}>
                      <b>{money(totals.spend)}</b>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <b>{fmt(totals.impressions)}</b>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <b>{fmt(totals.clicks)}</b>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <b>{fmt(totals.conversions)}</b>
                    </td>
                    <td style={{ textAlign: 'right' }}>—</td>
                    <td style={{ textAlign: 'right' }}>
                      <b>{totals.cpc == null ? '-' : `$ ${fmt(totals.cpc, 3)}`}</b>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <b>{totals.cpm == null ? '-' : `$ ${fmt(totals.cpm, 2)}`}</b>
                    </td>
                    <td colSpan={2}>—</td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        )}
      </section>

      {/* Asignar objetivo a campaña (usa localStorage) */}
      <section className="container" style={{ marginTop: 16 }}>
        <div className="neo-card">
          <div style={{ fontWeight: 600, marginBottom: 8 }}>Asignar objetivo a campaña</div>
          <AssignObjective
            rows={rows}
            objMap={objMap}
            onSave={(id, obj) => {
              const next = { ...objMap, [id]: obj };
              saveObjMap(next);
            }}
          />
        </div>
      </section>

    </main>
  );
}


/* ---------- Subcomponente: asignación de objetivos ---------- */
function AssignObjective({
  rows,
  objMap,
  onSave,
}: {
  rows: Row[];
  objMap: Record<string, { metric: MetricKey; target: number; note?: string }>;
  onSave: (entityId: string, obj: { metric: MetricKey; target: number; note?: string }) => void;
}) {
  const [campaignId, setCampaignId] = useState<string>('');
  const [metric, setMetric] = useState<MetricKey>('conversions');
  const [target, setTarget] = useState<number>(100);
  const [note, setNote] = useState<string>('');

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 1fr auto', gap: 10 }}>
      <select className="neo-select" value={campaignId} onChange={(e) => setCampaignId(e.target.value)}>
        <option value="">Seleccioná…</option>
        {rows.map((r) => (
          <option key={r.entity_id} value={r.entity_id}>
            {r.name || r.entity_id}
          </option>
        ))}
      </select>

      <select className="neo-select" value={metric} onChange={(e) => setMetric(e.target.value as MetricKey)}>
        <option value="conversions">Resultados</option>
        <option value="clicks">Clicks</option>
        <option value="impressions">Impresiones</option>
        <option value="spend">Gasto</option>
        <option value="cpc">CPC</option>
        <option value="cpm">CPM</option>
        <option value="ctr">CTR</option>
      </select>

      <input
        className="neo-input"
        type="number"
        step="any"
        value={target}
        onChange={(e) => setTarget(Number(e.target.value || 0))}
        placeholder="Objetivo"
      />

      <button
        className="btn"
        onClick={() => {
          if (!campaignId) return;
          onSave(campaignId, { metric, target, note });
          setCampaignId('');
          setNote('');
        }}
      >
        Guardar
      </button>

      <textarea
        className="neo-input"
        style={{ gridColumn: '1 / -1', height: 40 }}
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="Nota / contexto (opcional)"
      />
    </div>
  );
}
