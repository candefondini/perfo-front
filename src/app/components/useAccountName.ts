'use client';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

// Espera tabla: accounts(id TEXT, name TEXT)
export default function useAccountName(accountId: string) {
  const [name, setName] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data, error } = await supabase
          .from('accounts')
          .select('name')
          .eq('id', accountId)
          .single();
        if (!cancelled) setName(error ? null : data?.name ?? null);
      } catch {
        if (!cancelled) setName(null);
      }
    })();
    return () => { cancelled = true; };
  }, [accountId]);

  return name;
}
