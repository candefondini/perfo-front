'use client';
import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

type MetricKey =
  | 'conversions' | 'clicks' | 'impressions' | 'spend' | 'revenue'
  | 'ctr' | 'cpc' | 'cpm' | 'roas';

type Totals = {
  spend: number;
  impressions: number;
  clicks: number;
  conversions: number;
  revenue: number;
};

const METRIC_LABEL: Record<MetricKey, string> = {
  conversions: 'Resultados',
  clicks: 'Clicks',
  impressions: 'Impresiones',
  spend: 'Spend',
  revenue: 'Revenue',
  ctr: 'CTR',
  cpc: 'CPC',
  cpm: 'CPM',
  roas: 'ROAS',
};

function fmtInt(n: number) {
  return n.toLocaleString('es-AR');
}
function fmtMoney(n: number, d = 2) {
  return n.toLocaleString('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: d });
}
function fmtPct(n: number, d = 2) {
  return `${n.toFixed(d)}%`;
}
function fmtValue(metric: MetricKey, val: number | null) {
  if (val == null || Number.isNaN(val)) return '—';
  if (metric === 'spend' || metric === 'revenue') return fmtMoney(val);
  if (metric === 'ctr') return fmtPct(val);
  if (metric === 'cpc' || metric === 'cpm') return fmtMoney(val, metric === 'cpc' ? 3 : 2);
  if (metric === 'roas') return val.toFixed(2) + 'x';
  return fmtInt(val);
}

/** Calcula métricas derivadas desde totales crudos */
function calcMetric(metric: MetricKey, t: Totals): number | null {
  const { spend, impressions, clicks, conversions, revenue } = t;
  switch (metric) {
    case 'spend': return spend;
    case 'impressions': return impressions;
    case 'clicks': return clicks;
    case 'conversions': return conversions;
    case 'revenue': return revenue;
    case 'ctr': return impressions > 0 ? (clicks / impressions) * 100 : null;
    case 'cpc': return clicks > 0 ? spend / clicks : null;
    case 'cpm': return impressions > 0 ? (spend * 1000) / impressions : null;
    case 'roas': return spend > 0 ? revenue / spend : null;
  }
}

type Props = {
  accountId: string;
  from: string; // YYYY-MM-DD
  to: string;   // YYYY-MM-DD
};

export default function ObjectivesPanel({ accountId, from, to }: Props) {
  const lsKey = (k: string) => `objpanel:${accountId}:${from}:${to}:${k}`;

  // Objetivos e Indicadores personalizables
  const [obj1Metric, setObj1Metric] = useState<MetricKey>(() =>
    (localStorage.getItem(lsKey('obj1Metric')) as MetricKey) || 'conversions'
  );
  const [obj2Metric, setObj2Metric] = useState<MetricKey>(() =>
    (localStorage.getItem(lsKey('obj2Metric')) as MetricKey) || 'roas'
  );
  const [ind1Metric, setInd1Metric] = useState<MetricKey>(() =>
    (localStorage.getItem(lsKey('ind1Metric')) as MetricKey) || 'conversions'
  );
  const [ind2Metric, setInd2Metric] = useState<MetricKey>(() =>
    (localStorage.getItem(lsKey('ind2Metric')) as MetricKey) || 'roas'
  );

  // Valores numéricos reales que usamos para cálculo
  const [obj1Value, setObj1ValueRaw] = useState<number>(() =>
    Number(localStorage.getItem(lsKey('obj1Value')) || '0')
  );
  const [obj2Value, setObj2ValueRaw] = useState<number>(() =>
    Number(localStorage.getItem(lsKey('obj2Value')) || '0')
  );

  // Backspace-fix (inputs controlados como texto)
  const [obj1Text, setObj1Text] = useState<string>(() =>
    localStorage.getItem(lsKey('obj1Text')) ?? String(obj1Value)
  );
  const [obj2Text, setObj2Text] = useState<string>(() =>
    localStorage.getItem(lsKey('obj2Text')) ?? String(obj2Value)
  );

  const setObj1Value = (n: number) => setObj1ValueRaw(!isFinite(n) ? 0 : n);
  const setObj2Value = (n: number) => setObj2ValueRaw(!isFinite(n) ? 0 : n);

  const [totals, setTotals] = useState<Totals | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  // Guardar prefs
  useEffect(() => { localStorage.setItem(lsKey('obj1Metric'), obj1Metric); }, [obj1Metric, accountId, from, to]);
  useEffect(() => { localStorage.setItem(lsKey('obj2Metric'), obj2Metric); }, [obj2Metric, accountId, from, to]);
  useEffect(() => { localStorage.setItem(lsKey('ind1Metric'), ind1Metric); }, [ind1Metric, accountId, from, to]);
  useEffect(() => { localStorage.setItem(lsKey('ind2Metric'), ind2Metric); }, [ind2Metric, accountId, from, to]);
  useEffect(() => { localStorage.setItem(lsKey('obj1Value'), String(obj1Value)); }, [obj1Value, accountId, from, to]);
  useEffect(() => { localStorage.setItem(lsKey('obj2Value'), String(obj2Value)); }, [obj2Value, accountId, from, to]);
  useEffect(() => { localStorage.setItem(lsKey('obj1Text'), obj1Text); }, [obj1Text, accountId, from, to]);
  useEffect(() => { localStorage.setItem(lsKey('obj2Text'), obj2Text); }, [obj2Text, accountId, from, to]);

  // Sincronizar texto -> número
  useEffect(() => {
    const n = parseFloat(obj1Text);
    setObj1Value(isFinite(n) ? n : 0);
  }, [obj1Text]);
  useEffect(() => {
    const n = parseFloat(obj2Text);
    setObj2Value(isFinite(n) ? n : 0);
  }, [obj2Text]);

  // Traer totales del rango elegido (con fallback a results_arr)
  useEffect(() => {
    let alive = true;

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
      setErr(null);

      const { data, error } = await supabase
        .schema('perfo')
        .from('insights')
        .select('spend, impressions, clicks, conversions, revenue, results_arr, cost_per_action_type_arr, platform')
        .eq('account_id', accountId)
        .eq('level', 'campaign')
        .gte('date', from)
        .lte('date', to)
        .limit(50000);

      if (!alive) return;
      if (error) {
        setErr(error.message);
        setTotals(null);
        setLoading(false);
        return;
      }

      const sum: Totals = { spend: 0, impressions: 0, clicks: 0, conversions: 0, revenue: 0 };
      for (const r of (data || []) as any[]) {
        sum.spend       += Number(r.spend || 0);
        sum.impressions += Number(r.impressions || 0);
        sum.clicks      += Number(r.clicks || 0);

        let conv = Number(r.conversions || 0);
        let rev  = Number(r.revenue || 0);

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
      setTotals(sum);
      setLoading(false);
    })();
    return () => { alive = false; };
  }, [accountId, from, to]);

  const ind1 = useMemo(() => totals ? calcMetric(ind1Metric, totals) : null, [totals, ind1Metric]);
  const ind2 = useMemo(() => totals ? calcMetric(ind2Metric, totals) : null, [totals, ind2Metric]);
  const obj1Actual = useMemo(() => totals ? calcMetric(obj1Metric, totals) : null, [totals, obj1Metric]);
  const obj2Actual = useMemo(() => totals ? calcMetric(obj2Metric, totals) : null, [totals, obj2Metric]);

  const progressPct = (actual: number | null, target: number) => {
    if (!isFinite(target) || target === 0 || actual == null || !isFinite(actual)) return 0;
    if (target > 0) {
      const pct = (actual / target) * 100;
      return Math.max(0, Math.min(100, pct));
    } else {
      const limit = Math.abs(target);
      const pct = (limit / Math.max(actual, 1e-9)) * 100;
      return Math.max(0, Math.min(100, pct));
    }
  };

  const progress1 = useMemo(() => progressPct(obj1Actual, obj1Value), [obj1Actual, obj1Value]);
  const progress2 = useMemo(() => progressPct(obj2Actual, obj2Value), [obj2Actual, obj2Value]);

  const allMetricOptions: MetricKey[] = [
    'conversions','roas',
    'spend','revenue',
    'impressions','clicks',
    'ctr','cpc','cpm',
  ];

  return (
    <div style={{ display: 'grid', gap: 12 }}>
      {err && <div style={{ color: '#ef4444' }}>Error: {err}</div>}

      {/* Tarjetas superiores */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(2, minmax(0,1fr))',
        gap: 12
      }}>
        {/* Objetivo 1 */}
        <Card>
          <HeaderRow
            title="Objetivo 1"
            metric={obj1Metric}
            onMetricChange={(m)=>setObj1Metric(m)}
            options={allMetricOptions}
          />
          <GoalRow
            text={obj1Text}
            onTextChange={(t)=>setObj1Text(t)}
            label={METRIC_LABEL[obj1Metric]}
          />
          <Progress
            labelLeft={fmtValue(obj1Metric, obj1Actual ?? 0)}
            labelRight={`${progress1.toFixed(0)}%`}
            percent={progress1}
          />
        </Card>

        {/* Objetivo 2 */}
        <Card>
          <HeaderRow
            title="Objetivo 2"
            metric={obj2Metric}
            onMetricChange={(m)=>setObj2Metric(m)}
            options={allMetricOptions}
          />
          <GoalRow
            text={obj2Text}
            onTextChange={(t)=>setObj2Text(t)}
            label={METRIC_LABEL[obj2Metric]}
          />
          <Progress
            labelLeft={fmtValue(obj2Metric, obj2Actual ?? 0)}
            labelRight={`${progress2.toFixed(0)}%`}
            percent={progress2}
          />
        </Card>
      </div>

      {/* Indicadores */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(2, minmax(0,1fr))',
        gap: 12
      }}>
        <Card small>
          <div style={{ color:'#9ca3af', fontSize:12, marginBottom:6 }}>Indicador 1</div>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:6 }}>
            <select
              value={ind1Metric}
              onChange={(e)=>setInd1Metric(e.target.value as MetricKey)}
              style={selectStyle}
            >
              {allMetricOptions.map(m => <option key={m} value={m}>{METRIC_LABEL[m]}</option>)}
            </select>

            <div style={{ fontSize:22, fontWeight:700 }}>
              {loading || !totals ? '—' : fmtValue(ind1Metric, ind1)}
            </div>
          </div>
          <div style={{ color:'#9ca3af', fontSize:12 }}>{METRIC_LABEL[ind1Metric]} acumulado</div>
        </Card>

        <Card small>
          <div style={{ color:'#9ca3af', fontSize:12, marginBottom:6 }}>Indicador 2</div>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:6 }}>
            <select
              value={ind2Metric}
              onChange={(e)=>setInd2Metric(e.target.value as MetricKey)}
              style={selectStyle}
            >
              {allMetricOptions.map(m => <option key={m} value={m}>{METRIC_LABEL[m]}</option>)}
            </select>

            <div style={{ fontSize:22, fontWeight:700 }}>
              {loading || !totals ? '—' : fmtValue(ind2Metric, ind2)}
            </div>
          </div>
          <div style={{ color:'#9ca3af', fontSize:12 }}>{METRIC_LABEL[ind2Metric]} acumulado</div>
        </Card>
      </div>
    </div>
  );
}

/* ----------------------------- UI (neumorfismo) ----------------------------- */

function Card({ children, small = false }: { children: React.ReactNode; small?: boolean }) {
  return (
    <div style={{
      borderRadius: 16,
      padding: small ? 14 : 18,
      background: '#0e1625',
      minHeight: small ? 92 : 140,
      boxShadow: '9px 9px 18px rgba(0,0,0,0.45), -9px -9px 18px rgba(255,255,255,0.05)',
      border: '1px solid rgba(255,255,255,0.03)'
    }}>
      {children}
    </div>
  );
}

function HeaderRow({
  title, metric, onMetricChange, options
}: {
  title: string;
  metric: MetricKey;
  onMetricChange: (m: MetricKey)=>void;
  options: MetricKey[];
}) {
  return (
    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom: 6 }}>
      <div style={{ color:'#9ca3af', fontSize:12 }}>{title}</div>
      <Select value={metric} onChange={(v)=>onMetricChange(v as MetricKey)}>
        {options.map(m => <option key={m} value={m}>{METRIC_LABEL[m]}</option>)}
      </Select>
    </div>
  );
}

function GoalRow({
  text, onTextChange, label
}:{
  text: string;
  onTextChange: (t:string)=>void;
  label: string;
}) {
  return (
    <div style={{ display:'flex', alignItems:'baseline', gap:10, marginTop:2 }}>
      <NumberInput
        value={text}
        onChange={(t)=>onTextChange(t)}
        placeholder="Meta…"
      />
      <span style={{ color:'#9ca3af' }}>{label}</span>
    </div>
  );
}

function Progress({
  percent, labelLeft, labelRight
}:{
  percent: number;
  labelLeft: string;
  labelRight: string;
}) {
  return (
    <div style={{ marginTop: 12 }}>
      <div style={{ color:'#9ca3af', fontSize:12, marginBottom:6 }}>Progreso hacia la meta</div>
      <div style={progressTrackStyle}>
        <div style={{ ...progressBarStyle, width: `${percent}%` }} />
      </div>
      <div style={{ display:'flex', justifyContent:'space-between', marginTop:8, color:'#9ca3af', fontSize:12 }}>
        <span>{labelLeft}</span>
        <span>{labelRight}</span>
      </div>
    </div>
  );
}

/* ------------------------------ Atoms styled ------------------------------- */

function Select({
  value, onChange, children
}:{
  value: string;
  onChange: (v:string)=>void;
  children: React.ReactNode;
}) {
  return (
    <select
      value={value}
      onChange={(e)=>onChange(e.target.value)}
      style={selectStyle}
    >
      {children}
    </select>
  );
}

function NumberInput({
  value, onChange, placeholder
}:{
  value: string;                 // string para permitir vacío
  onChange: (t:string)=>void;    // devolvemos string
  placeholder?: string;
}) {
  return (
    <input
      type="number"
      step="any"
      value={value}
      onChange={(e)=>onChange(e.target.value)}
      placeholder={placeholder}
      style={numInputStyle}
    />
  );
}

/* --------------------------------- Styles ---------------------------------- */

const selectStyle: React.CSSProperties = {
  background:'#0c1422',
  border: '1px solid rgba(255,255,255,0.06)',
  color:'#e5e7eb',
  padding:'7px 10px',
  borderRadius:12,
  boxShadow: 'inset 2px 2px 4px rgba(0,0,0,0.45), inset -2px -2px 4px rgba(255,255,255,0.04)',
};

const numInputStyle: React.CSSProperties = {
  background:'#0c1422',
  border:'1px solid rgba(255,255,255,0.06)',
  color:'#e5e7eb',
  borderRadius:12,
  padding:'8px 10px',
  width:160,
  fontSize:18,
  fontWeight:700,
  boxShadow: 'inset 3px 3px 6px rgba(0,0,0,0.5), inset -3px -3px 6px rgba(255,255,255,0.05)',
};

const progressTrackStyle: React.CSSProperties = {
  height: 14,
  borderRadius: 10,
  background: '#0b1320',
  border: '1px solid rgba(255,255,255,0.06)',
  overflow:'hidden',
  boxShadow: 'inset 6px 6px 12px rgba(0,0,0,0.6), inset -6px -6px 12px rgba(255,255,255,0.03)',
};

const progressBarStyle: React.CSSProperties = {
  height: '100%',
  background: 'linear-gradient(90deg, #71a7ff, #5a8df2)',
  boxShadow: '0 0 10px rgba(113,167,255,0.45)',
  transition: 'width .25s ease',
  borderRadius: 10,
};
