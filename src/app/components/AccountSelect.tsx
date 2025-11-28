//src/app/components/AccountSelect

'use client';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

type Acc = { id: string; account_num: string | null; name: string | null };

export default function AccountSelect({
  value,
  onChange,
}: { value?: string; onChange: (v: string) => void }) {
  const [rows, setRows] = useState<Acc[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      setErr(null);

      // ✅ con schema ya seteado en el client, NO usar 'perfo.'
      const { data, error } = await supabase
        .from('ad_accounts')
        .select('id,account_num,name')
        .order('name', { ascending: true })
        .limit(2000);

      if (!alive) return;

      if (error) {
        console.error('[AccountSelect] error:', error);
        setErr(error.message);
        setRows([]);
      } else {
        setRows((data as any) || []);
      }
      setLoading(false);
    })();
    return () => { alive = false; };
  }, []);

  return (
    <div>
      <select
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        style={{
          background:'#0b1220', border:'1px solid #374151', color:'#e5e7eb',
          padding:'8px 10px', borderRadius:8, minWidth:260
        }}
      >
        <option value="">{loading ? 'Cargando…' : 'Elegí una cuenta…'}</option>
        {rows.map(r => (
          <option key={r.id} value={r.id}>
            {r.name || r.account_num || r.id}
          </option>
        ))}
      </select>
      {(!loading && !rows.length && !err) && (
        <div style={{ color:'#9ca3af', fontSize:12, marginTop:6 }}>
          No se encontraron cuentas.
        </div>
      )}
      {err && (
        <div style={{ color:'#ef4444', fontSize:12, marginTop:6 }}>
          Error: {err}
        </div>
      )}
    </div>
  );
}
