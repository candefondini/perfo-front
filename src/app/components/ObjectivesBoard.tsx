// src/app/components/ObjectivesBoard.tsx
'use client';
import { useEffect, useMemo, useState } from 'react';

type MetricKey =
  | 'conversions' | 'spend' | 'revenue'
  | 'impressions' | 'clicks'
  | 'ctr' | 'cpc' | 'cpm' | 'roas';

const LABEL: Record<MetricKey, string> = {
  conversions: 'Resultados',
  spend: 'Gasto',
  revenue: 'Revenue',
  impressions: 'Alcance',
  clicks: 'Clicks',
  ctr: 'CTR',
  cpc: 'CPC',
  cpm: 'CPM',
  roas: 'ROAS',
};

type Tot = { spend:number; revenue:number; impressions:number; clicks:number; conversions:number };
function money(n: number, d = 2) {
  return n.toLocaleString('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: d });
}
function fmtValue(metric: MetricKey, v: number) {
  if (!isFinite(v)) return '—';
  if (metric === 'spend' || metric === 'revenue') return money(v, 2);
  if (metric === 'cpc') return money(v, 3);
  if (metric === 'cpm') return money(v, 2);
  if (metric === 'ctr') return `${v.toFixed(2)}%`;
  if (metric === 'roas') return `${v.toFixed(2)}x`;
  return v.toLocaleString('es-AR');
}

type ObjectiveCard = {
  id: string;
  title: string;
  note: string;
  metric: MetricKey;
  target: number;
};

type CampaignOption = { id: string; name: string | null };

export default function ObjectivesBoard({
  accountId,
  campaigns = [],
  onSaveGoal,
}: {
  accountId: string;
  campaigns?: CampaignOption[];
  onSaveGoal?: (g: { campaignId: string; metric: MetricKey; target: number; title: string; note: string }) => void;
}) {
  const storageKey = `objBoard:${accountId}`;

  // ====== Objetivos “generales” (tus cards previas) ======
  const [mounted, setMounted] = useState(false);
  const [items, setItems] = useState<ObjectiveCard[]>([]);

  useEffect(() => {
    setMounted(true);
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) {
        setItems(JSON.parse(raw));
      } else {
        const id = (typeof crypto !== 'undefined' && crypto.randomUUID)
          ? crypto.randomUUID()
          : `obj-${Date.now()}`;
        setItems([{
          id,
          title: 'Leads del mes',
          note: 'Alcanzar 300 leads calificados',
          metric: 'conversions',
          target: 300,
        }]);
      }
    } catch {
      setItems([]);
    }
  }, [storageKey]);

  useEffect(() => {
    if (!mounted) return;
    try { localStorage.setItem(storageKey, JSON.stringify(items)); } catch {}
  }, [items, storageKey, mounted]);

  const allMetrics: MetricKey[] = [
    'conversions','spend','revenue','impressions','clicks','ctr','cpc','cpm','roas'
  ];

  // ====== Nueva cajita: Objetivo por campaña ======
  const [selectedCampaign, setSelectedCampaign] = useState<string>('');
  const [metric, setMetric] = useState<MetricKey>('conversions');
  const [target, setTarget] = useState<number>(100);
  const [title, setTitle] = useState<string>('Objetivo de campaña');
  const [note, setNote] = useState<string>('');

  const canSave = selectedCampaign && Number.isFinite(target);

  const saveGoal = () => {
    if (!canSave || !onSaveGoal) return;
    onSaveGoal({ campaignId: selectedCampaign, metric, target, title, note });
    // feedback rápido
    setNote('');
  };

  // ====== estilos suaves ======
  const card = {
    borderRadius: 16,
    padding: 14,
    background: '#fff',
    border: '1px solid #e5e7eb',
    boxShadow: '0 1px 4px rgba(0,0,0,.05)',
  } as const;
  const input = {
    background:'#fff',
    border:'1px solid #e5e7eb',
    color:'#0f172a',
    borderRadius:10,
    padding:'8px 10px',
    width:'100%',
    fontSize:14,
  } as const;
  const softBtn = {
    background:'#1f2937',
    border:'1px solid #1f2937',
    color:'#fff',
    borderRadius:12,
    padding:'8px 12px',
    cursor:'pointer',
    fontSize:14,
  } as const;

  return (
    <section style={{ marginTop: 18 }}>
      {/* Asignar objetivo por campaña */}
      <div style={{ ...card, marginBottom: 12 }}>
        <div style={{ fontWeight:700, marginBottom:8, color:'#0f172a' }}>Asignar objetivo a campaña</div>
        <div style={{ display:'grid', gridTemplateColumns:'2fr 1fr 1fr', gap:10 }}>
          <div>
            <div style={{ fontSize:12, color:'#475569', marginBottom:4 }}>Campaña</div>
            <select
              value={selectedCampaign}
              onChange={(e)=>setSelectedCampaign(e.target.value)}
              style={input}
            >
              <option value="">Seleccioná…</option>
              {campaigns.map(c => (
                <option key={c.id} value={c.id}>{c.name || c.id}</option>
              ))}
            </select>
          </div>
          <div>
            <div style={{ fontSize:12, color:'#475569', marginBottom:4 }}>Métrica</div>
            <select
              value={metric}
              onChange={(e)=>setMetric(e.target.value as MetricKey)}
              style={input}
            >
              {allMetrics.map(m => <option key={m} value={m}>{LABEL[m]}</option>)}
            </select>
          </div>
          <div>
            <div style={{ fontSize:12, color:'#475569', marginBottom:4 }}>Objetivo</div>
            <input
              type="number"
              step="any"
              value={target}
              onChange={(e)=>setTarget(Number(e.target.value || 0))}
              style={input}
              placeholder="0"
            />
          </div>
        </div>

        <div style={{ display:'grid', gridTemplateColumns:'2fr 3fr auto', gap:10, marginTop:10 }}>
          <input
            style={input}
            value={title}
            onChange={(e)=>setTitle(e.target.value)}
            placeholder="Título del objetivo"
          />
          <input
            style={input}
            value={note}
            onChange={(e)=>setNote(e.target.value)}
            placeholder="Nota / contexto (opcional)"
          />
          <button onClick={saveGoal} style={{ ...softBtn, opacity: canSave ? 1 : .6 }} disabled={!canSave}>
            Guardar
          </button>
        </div>
      </div>

      {/* Tus objetivos “generales” existentes (se mantienen) */}
      {!mounted ? null : (
        <div>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom: 10 }}>
            <h3 style={{ margin: 0, color:'#0f172a' }}>OBJETIVOS DEFINIDOS</h3>
            <button
              onClick={()=>{
                const id = (typeof crypto !== 'undefined' && crypto.randomUUID)
                  ? crypto.randomUUID()
                  : `obj-${Date.now()}-${Math.random()}`;
                setItems(prev => [...prev, { id, title:'Nuevo objetivo', note:'', metric:'conversions', target:100 }]);
              }}
              style={softBtn}
            >
              + Agregar objetivo
            </button>
          </div>

          <div style={{ display:'grid', gridTemplateColumns:'repeat(3,minmax(0,1fr))', gap: 12 }}>
            {items.map((obj) => {
              return (
                <div key={obj.id} style={card}>
                  <input
                    style={input}
                    value={obj.title}
                    onChange={(e)=>setItems(prev=>prev.map(x=>x.id===obj.id?{...x,title:e.target.value}:x))}
                    placeholder="Nombre del objetivo"
                  />
                  <textarea
                    style={{ ...input, marginTop:8, minHeight:44 }}
                    value={obj.note}
                    onChange={(e)=>setItems(prev=>prev.map(x=>x.id===obj.id?{...x,note:e.target.value}:x))}
                    placeholder="Descripción…"
                  />
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap: 10, marginTop:10 }}>
                    <div>
                      <div style={{ fontSize:12, color:'#475569', marginBottom:4 }}>Métrica</div>
                      <select
                        value={obj.metric}
                        onChange={(e)=>setItems(prev=>prev.map(x=>x.id===obj.id?{...x,metric:e.target.value as MetricKey}:x))}
                        style={input}
                      >
                        {allMetrics.map(m => <option key={m} value={m}>{LABEL[m]}</option>)}
                      </select>
                    </div>
                    <div>
                      <div style={{ fontSize:12, color:'#475569', marginBottom:4 }}>Objetivo mensual</div>
                      <input
                        type="number"
                        step="any"
                        value={obj.target}
                        onChange={(e)=>setItems(prev=>prev.map(x=>x.id===obj.id?{...x,target:Number(e.target.value||0)}:x))}
                        style={input}
                        placeholder="0"
                      />
                    </div>
                  </div>

                  <div style={{ display:'flex', justifyContent:'flex-end', marginTop:10 }}>
                    <button
                      onClick={()=>setItems(prev=>prev.filter(x=>x.id!==obj.id))}
                      style={{ ...softBtn, background:'#fff', color:'#ef4444', borderColor:'#fecaca' }}
                    >
                      Eliminar
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </section>
  );
}
