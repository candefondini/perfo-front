// src/app/client/[clientId]/page.tsx
'use client';
export const dynamic = 'force-dynamic';

import { useEffect, useState, Fragment } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';

type Health = 'good' | 'warn' | 'bad' | 'na';

type ClientRow = {
  id: string;
  name: string | null;
  budget: number | null;
  meta_account_id: string | null;
  google_account_id: string | null;
  kpi1_name: string | null;
  kpi1_target: number | null;
  meta_kpi1_metric: string | null;
  google_kpi1_metric: string | null;
  kpi2_name: string | null;
  kpi2_target: number | null;
  meta_kpi2_metric: string | null;
  google_kpi2_metric: string | null;
};

type ClientInfo = {
  name: string;
  budget?: string;
};

type KpiConfig = {
  kpi1: { name: string; target: string };
  kpi2: { name: string; target: string };
};

type Totals = {
  spend: number;
  impressions: number;
  clicks: number;
  conversions: number;
};

type MetaAd = {
  id: string;
  name: string;
  spend: number;
  impressions: number;
  clicks: number;
  conversions: number;
  ctr: number | null;
  cpc: number | null;
  cpm: number | null;
};

type MetaAdset = {
  id: string;
  name: string;
  spend: number;
  impressions: number;
  clicks: number;
  conversions: number;
  ctr: number | null;
  cpc: number | null;
  cpm: number | null;
  ads: MetaAd[];
};

type MetaCampaign = {
  id: string;
  name: string;
  status: string;
  spend: number;
  impressions: number;
  clicks: number;
  conversions: number;
  ctr: number | null;
  cpc: number | null;
  cpm: number | null;
  adsets?: MetaAdset[];
};

type GoogleAd = {
  id: string;
  name: string;
  spend: number;
  impressions: number;
  clicks: number;
  conversions: number;
  ctr: number | null;
  cpc: number | null;
  cpm: number | null;
};

type GoogleCampaign = {
  id: string;
  name: string;
  status: string;
  spend: number;
  impressions: number;
  clicks: number;
  conversions: number;
  ctr: number | null;
  cpc: number | null;
  cpm: number | null;
  ads?: GoogleAd[];
};

type CampaignWithPlatform =
  | (MetaCampaign & { platform: 'Meta' })
  | (GoogleCampaign & { platform: 'Google' });

type KpiKey = 'conversions' | 'clicks' | 'impressions' | 'spend' | 'ctr' | 'cpc' | 'cpm';

type CampaignGoalConfig = {
  kpi: KpiKey;
  target: number;
};

const KPI_LABELS: Record<KpiKey, string> = {
  conversions: 'Conv.',
  clicks: 'Clicks',
  impressions: 'Impresiones',
  spend: 'Spend',
  ctr: 'CTR %',
  cpc: 'CPC',
  cpm: 'CPM',
};

const fmt = (n?: number | null, d = 0) =>
  n == null
    ? '-'
    : n.toLocaleString('es-AR', {
        minimumFractionDigits: d,
        maximumFractionDigits: d,
      });

const money = (n?: number | null, d = 2) =>
  n == null ? '-' : `$ ${fmt(n, d)}`;

function getInitialMTDRange() {
  const today = new Date();
  const first = new Date(today.getFullYear(), today.getMonth(), 1);
  const to = today.toISOString().slice(0, 10);
  const from = first.toISOString().slice(0, 10);
  return { from, to };
}

function aggregateTotals(
  list: { spend: number; impressions: number; clicks: number; conversions: number }[]
): Totals {
  return list.reduce(
    (acc, c) => {
      acc.spend += c.spend || 0;
      acc.impressions += c.impressions || 0;
      acc.clicks += c.clicks || 0;
      acc.conversions += c.conversions || 0;
      return acc;
    },
    { spend: 0, impressions: 0, clicks: 0, conversions: 0 }
  );
}

type HealthResult = { value: number | null; health: Health };

function computeKpiHealth(
  target: number | null,
  metaMetric: string | null,
  googleMetric: string | null,
  kpiName: string | null,
  metaTotals: Totals,
  googleTotals: Totals
): HealthResult {
  if (target == null || !isFinite(target)) return { value: null, health: 'na' };

  const combined: Totals = {
    spend: metaTotals.spend + googleTotals.spend,
    impressions: metaTotals.impressions + googleTotals.impressions,
    clicks: metaTotals.clicks + googleTotals.clicks,
    conversions: metaTotals.conversions + googleTotals.conversions,
  };

  const mm = metaMetric || '';
  const gm = googleMetric || '';

  const wantsCPA =
    mm === 'cpa' ||
    gm === 'cpa' ||
    mm === 'cost_per_conversion' ||
    gm === 'cost_per_conversion';
  const wantsCPM = mm === 'cpm' || gm === 'cpm';
  const wantsSpend = mm === 'cost_micros' || gm === 'cost_micros';
  const wantsImpr = mm === 'impressions' || gm === 'impressions';
  const wantsClicks = mm === 'clicks' || gm === 'clicks';
  const wantsConv = mm === 'conversions' || gm === 'conversions';

  let value: number | null = null;
  let lowerIsBetter = false;

  if (wantsCPA) {
    if (combined.conversions > 0) value = combined.spend / combined.conversions;
    lowerIsBetter = true;
  } else if (wantsCPM) {
    if (combined.impressions > 0)
      value = (combined.spend * 1000) / combined.impressions;
    lowerIsBetter = true;
  } else if (wantsSpend) {
    value = combined.spend;
    lowerIsBetter = true;
  } else if (wantsImpr) {
    value = combined.impressions;
  } else if (wantsClicks) {
    value = combined.clicks;
  } else if (wantsConv) {
    value = combined.conversions;
  } else {
    value = combined.conversions;
  }

  const name = (kpiName || '').toLowerCase();
  if (name.includes('costo') || name.includes('cpa') || name.includes('cpm')) {
    lowerIsBetter = true;
  }

  if (value == null || !isFinite(value)) return { value: null, health: 'na' };

  let health: Health = 'na';
  if (lowerIsBetter) {
    if (value <= target) health = 'good';
    else if (value <= target * 1.3) health = 'warn';
    else health = 'bad';
  } else {
    if (value >= target) health = 'good';
    else if (value >= target * 0.7) health = 'warn';
    else health = 'bad';
  }

  return { value, health };
}

// Métrica actual según KPI elegido
function getCampaignMetric(c: CampaignWithPlatform, kpi: KpiKey): number | null {
  switch (kpi) {
    case 'conversions':
      return c.conversions;
    case 'clicks':
      return c.clicks;
    case 'impressions':
      return c.impressions;
    case 'spend':
      return c.spend;
    case 'ctr':
      return c.ctr ?? null;
    case 'cpc':
      return c.cpc ?? null;
    case 'cpm':
      return c.cpm ?? null;
    default:
      return null;
  }
}

// Para % cumplido
function isLowerBetterKpi(kpi: KpiKey): boolean {
  return kpi === 'spend' || kpi === 'cpc' || kpi === 'cpm';
}

export default function ClientPage() {
  const params = useParams<{ clientId: string }>();
  const clientId = String(params.clientId);

  const [clientRow, setClientRow] = useState<ClientRow | null>(null);
  const [errorClient, setErrorClient] = useState<string | null>(null);

  const [clientInfo, setClientInfo] = useState<ClientInfo | null>(null);
  const [kpis, setKpis] = useState<KpiConfig | null>(null);
  const [health1, setHealth1] = useState<Health>('na');
  const [health2, setHealth2] = useState<Health>('na');

  const [metaCampaigns, setMetaCampaigns] = useState<MetaCampaign[]>([]);
  const [googleCampaigns, setGoogleCampaigns] = useState<GoogleCampaign[]>([]);
  const [viewMode, setViewMode] = useState<'all' | 'meta' | 'google'>('all');
  const [loadingCampaigns, setLoadingCampaigns] = useState(true);
  const [errorCampaigns, setErrorCampaigns] = useState<string | null>(null);

  const [expandedCampaignIds, setExpandedCampaignIds] = useState<string[]>([]);
  const [expandedAdsetIds, setExpandedAdsetIds] = useState<string[]>([]);

  // Objetivos por campaña (se guardan en localStorage)
  const [campaignGoals, setCampaignGoals] = useState<
    Record<string, CampaignGoalConfig>
  >({});

  // UI de creación/edición de objetivos
  const [selectedCampaignKey, setSelectedCampaignKey] = useState<string>('');
  const [selectedKpi, setSelectedKpi] = useState<KpiKey>('conversions');
  const [inputTarget, setInputTarget] = useState<string>('');

  const initialRange = getInitialMTDRange();
  const [dateFrom, setDateFrom] = useState<string>(initialRange.from);
  const [dateTo, setDateTo] = useState<string>(initialRange.to);

  // Cargar objetivos desde localStorage
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const raw = window.localStorage.getItem('campaignGoals_v2');
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        setCampaignGoals(parsed);
      }
    } catch (e) {
      console.warn('No se pudieron leer campaignGoals_v2 de localStorage:', e);
    }
  }, []);

  const saveCampaignGoals = (next: Record<string, CampaignGoalConfig>) => {
    setCampaignGoals(next);
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem('campaignGoals_v2', JSON.stringify(next));
    } catch (e) {
      console.warn('No se pudieron guardar campaignGoals_v2:', e);
    }
  };

  const handleSaveGoal = () => {
    const key = selectedCampaignKey;
    if (!key) return;
    const num = Number(inputTarget);
    if (!isFinite(num) || num <= 0) return;

    const next = {
      ...campaignGoals,
      [key]: { kpi: selectedKpi, target: num },
    };
    saveCampaignGoals(next);
  };

  // 1) Cargar cliente
  useEffect(() => {
    const loadClient = async () => {
      try {
        setErrorClient(null);
        let data: any = null;

        try {
          const { data: perfoData, error: perfoError } = await supabase
            .schema('perfo')
            .from('clients')
            .select(
              [
                'id',
                'name',
                'budget',
                'meta_account_id',
                'google_account_id',
                'kpi1_name',
                'kpi1_target',
                'meta_kpi1_metric',
                'google_kpi1_metric',
                'kpi2_name',
                'kpi2_target',
                'meta_kpi2_metric',
                'google_kpi2_metric',
              ].join(', ')
            )
            .eq('id', clientId)
            .single();

          if (perfoError) throw perfoError;
          if (perfoData) data = perfoData;
        } catch (e) {
          console.warn('No encontré en perfo.clients, probando public.clients', e);
          const { data: pubData, error: pubError } = await supabase
            .from('clients')
            .select(
              [
                'id',
                'name',
                'budget',
                'meta_account_id',
                'google_account_id',
                'kpi1_name',
                'kpi1_target',
                'meta_kpi1_metric',
                'google_kpi1_metric',
                'kpi2_name',
                'kpi2_target',
                'meta_kpi2_metric',
                'google_kpi2_metric',
              ].join(', ')
            )
            .eq('id', clientId)
            .single();

          if (pubError) throw pubError;
          data = pubData;
        }

        if (!data) {
          setErrorClient('No se encontró al cliente.');
          return;
        }

        const row = data as ClientRow;
        setClientRow(row);

        setClientInfo({
          name: row.name ?? 'Cliente sin nombre',
          budget: row.budget != null ? String(row.budget) : '',
        });

        setKpis({
          kpi1: {
            name: row.kpi1_name ?? 'KPI 1',
            target: row.kpi1_target != null ? String(row.kpi1_target) : '',
          },
          kpi2: {
            name: row.kpi2_name ?? 'KPI 2',
            target: row.kpi2_target != null ? String(row.kpi2_target) : '',
          },
        });

        setHealth1('na');
        setHealth2('na');
      } catch (err: any) {
        console.error('Error cargando cliente:', err);
        setErrorClient(err?.message || 'Error cargando cliente.');
      }
    };

    loadClient();
  }, [clientId]);

  // 2) Campañas + adsets + ads
  useEffect(() => {
    const loadCampaigns = async () => {
      try {
        setLoadingCampaigns(true);
        setErrorCampaigns(null);

        if (!clientRow) {
          setMetaCampaigns([]);
          setGoogleCampaigns([]);
          setLoadingCampaigns(false);
          return;
        }

        const metaRaw = clientRow.meta_account_id?.trim() || null;
        const googleAccountId = clientRow.google_account_id?.trim() || null;

        let metaAccountId = metaRaw;
        if (metaAccountId && !metaAccountId.startsWith('act_')) {
          metaAccountId = `act_${metaAccountId}`;
        }

        let metaList: MetaCampaign[] = [];

        // -------- META: campañas --------
        if (metaAccountId) {
          let rawMeta: any[] = [];

          try {
            const { data, error } = await supabase
              .schema('perfo')
              .from('view_meta_insights_front')
              .select(
                'account_id, level, entity_id, entity_name, spend, impressions, clicks, conv, date'
              )
              .eq('account_id', metaAccountId)
              .eq('level', 'campaign')
              .gte('date', dateFrom)
              .lte('date', dateTo)
              .limit(500000);

            if (error) throw error;
            rawMeta = data || [];
          } catch (e) {
            console.warn(
              'Fallo perfo.view_meta_insights_front (campaign), probando public:',
              e
            );
            const { data } = await supabase
              .from('view_meta_insights_front')
              .select(
                'account_id, level, entity_id, entity_name, spend, impressions, clicks, conv, date'
              )
              .eq('account_id', metaAccountId)
              .eq('level', 'campaign')
              .gte('date', dateFrom)
              .lte('date', dateTo)
              .limit(500000);

            rawMeta = data || [];
          }

          const byCampaign = new Map<
            string,
            {
              name: string;
              spend: number;
              impressions: number;
              clicks: number;
              conversions: number;
            }
          >();

          for (const row of rawMeta) {
            const cid = String(row.entity_id);
            if (!cid) continue;

            const prev =
              byCampaign.get(cid) || {
                name: row.entity_name ?? 'Campaña sin nombre',
                spend: 0,
                impressions: 0,
                clicks: 0,
                conversions: 0,
              };

            prev.spend += Number(row.spend ?? 0);
            prev.impressions += Number(row.impressions ?? 0);
            prev.clicks += Number(row.clicks ?? 0);
            prev.conversions += Number(row.conv ?? 0);

            byCampaign.set(cid, prev);
          }

          const campaignIds = Array.from(byCampaign.keys());
          let statusByCampaignId = new Map<string, string>();

          if (campaignIds.length > 0) {
            try {
              let campRows: any[] = [];

              try {
                const { data, error } = await supabase
                  .schema('perfo')
                  .from('campaigns')
                  .select('id, status')
                  .in('id', campaignIds)
                  .limit(5000);

                if (error) throw error;
                campRows = data || [];
              } catch (e) {
                console.warn('Fallo perfo.campaigns, probando public:', e);
                const { data } = await supabase
                  .from('campaigns')
                  .select('id, status')
                  .in('id', campaignIds)
                  .limit(5000);

                campRows = data || [];
              }

              for (const row of campRows) {
                const cid = String(row.id);
                if (!cid) continue;
                statusByCampaignId.set(cid, row.status ?? '—');
              }
            } catch (e) {
              console.warn('No pude traer status desde campaigns:', e);
            }
          }

          const prettyStatus = (raw?: string) => {
            if (!raw) return '—';
            const s = raw.toUpperCase();
            if (s.includes('ACTIVE') || s.includes('DELIVERING')) return 'Activa';
            if (s.includes('PAUS')) return 'Pausada';
            if (s.includes('DISABLE') || s.includes('INACTIVE')) return 'Inactiva';
            return raw;
          };

          metaList = Array.from(byCampaign.entries()).map(([cid, v]) => {
            const rawStatus = statusByCampaignId.get(cid) || '';
            const spend = v.spend;
            const impressions = v.impressions;
            const clicks = v.clicks;
            const conversions = v.conversions;

            const ctr = impressions > 0 ? (clicks / impressions) * 100 : null;
            const cpc = clicks > 0 ? spend / clicks : null;
            const cpm = impressions > 0 ? (spend * 1000) / impressions : null;

            return {
              id: cid,
              name: v.name,
              status: prettyStatus(rawStatus),
              spend,
              impressions,
              clicks,
              conversions,
              ctr,
              cpc,
              cpm,
            };
          });

          // -------- META: adsets & ads (desde tabla insights) --------
          let rawAdsets: any[] = [];
          let rawAds: any[] = [];

          try {
            const { data, error } = await supabase
              .schema('perfo')
              .from('insights')
              .select('level, entity_id, date, impressions, clicks, spend, conversions, raw')
              .eq('account_id', metaAccountId)
              .eq('level', 'adset')
              .gte('date', dateFrom)
              .lte('date', dateTo)
              .limit(500000);

            if (error) throw error;
            rawAdsets = data || [];
          } catch (e) {
            console.warn('Fallo perfo.insights (adset), probando public:', e);
            const { data } = await supabase
              .from('insights')
              .select('level, entity_id, date, impressions, clicks, spend, conversions, raw')
              .eq('account_id', metaAccountId)
              .eq('level', 'adset')
              .gte('date', dateFrom)
              .lte('date', dateTo)
              .limit(500000);

            rawAdsets = data || [];
          }

          try {
            const { data, error } = await supabase
              .schema('perfo')
              .from('insights')
              .select('level, entity_id, date, impressions, clicks, spend, conversions, raw')
              .eq('account_id', metaAccountId)
              .eq('level', 'ad')
              .gte('date', dateFrom)
              .lte('date', dateTo)
              .limit(500000);

            if (error) throw error;
            rawAds = data || [];
          } catch (e) {
            console.warn('Fallo perfo.insights (ad), probando public:', e);
            const { data } = await supabase
              .from('insights')
              .select('level, entity_id, date, impressions, clicks, spend, conversions, raw')
              .eq('account_id', metaAccountId)
              .eq('level', 'ad')
              .gte('date', dateFrom)
              .lte('date', dateTo)
              .limit(500000);

            rawAds = data || [];
          }

          // Mapear adsets por campaña
          const adsetsByCampaign = new Map<
            string,
            Map<
              string,
              {
                spend: number;
                impressions: number;
                clicks: number;
                conversions: number;
              }
            >
          >();

          const adsetIds: Set<string> = new Set();

          for (const row of rawAdsets) {
            const raw = row.raw || {};
            const adsetId = String(row.entity_id);
            const campaignId = String(raw.campaign_id || '');
            if (!adsetId || !campaignId) continue;

            adsetIds.add(adsetId);

            const byAdset =
              adsetsByCampaign.get(campaignId) ||
              new Map<
                string,
                {
                  spend: number;
                  impressions: number;
                  clicks: number;
                  conversions: number;
                }
              >();

            const prev =
              byAdset.get(adsetId) || {
                spend: 0,
                impressions: 0,
                clicks: 0,
                conversions: 0,
              };

            prev.spend += Number(row.spend ?? 0);
            prev.impressions += Number(row.impressions ?? 0);
            prev.clicks += Number(row.clicks ?? 0);
            prev.conversions += Number(row.conversions ?? 0);

            byAdset.set(adsetId, prev);
            adsetsByCampaign.set(campaignId, byAdset);
          }

          // Mapear ads por adset
          const adsByAdset = new Map<
            string,
            Map<
              string,
              {
                spend: number;
                impressions: number;
                clicks: number;
                conversions: number;
              }
            >
          >();

          const adIds: Set<string> = new Set();

          for (const row of rawAds) {
            const raw = row.raw || {};
            const adId = String(row.entity_id);
            const adsetId = String(raw.adset_id || '');
            if (!adId || !adsetId) continue;

            adIds.add(adId);

            const byAd =
              adsByAdset.get(adsetId) ||
              new Map<
                string,
                {
                  spend: number;
                  impressions: number;
                  clicks: number;
                  conversions: number;
                }
              >();

            const prev =
              byAd.get(adId) || {
                spend: 0,
                impressions: 0,
                clicks: 0,
                conversions: 0,
              };

            prev.spend += Number(row.spend ?? 0);
            prev.impressions += Number(row.impressions ?? 0);
            prev.clicks += Number(row.clicks ?? 0);
            prev.conversions += Number(row.conversions ?? 0);

            byAd.set(adId, prev);
            adsByAdset.set(adsetId, byAd);
          }

          // NOMBRES de adsets
          const adsetNames = new Map<string, string>();
          if (adsetIds.size > 0) {
            const ids = Array.from(adsetIds);
            try {
              let rows: any[] = [];
              try {
                const { data, error } = await supabase
                  .schema('perfo')
                  .from('adsets')
                  .select('id, name')
                  .in('id', ids)
                  .limit(20000);
                if (error) throw error;
                rows = data || [];
              } catch (e) {
                console.warn('Fallo perfo.adsets, probando public:', e);
                const { data } = await supabase
                  .from('adsets')
                  .select('id, name')
                  .in('id', ids)
                  .limit(20000);
                rows = data || [];
              }

              for (const row of rows) {
                const id = String(row.id);
                if (!id) continue;
                adsetNames.set(id, row.name || '');
              }
            } catch (e) {
              console.warn('No pude traer nombres de adsets:', e);
            }
          }

          // NOMBRES de ads
          const adNames = new Map<string, string>();
          if (adIds.size > 0) {
            const ids = Array.from(adIds);
            try {
              let rows: any[] = [];
              try {
                const { data, error } = await supabase
                  .schema('perfo')
                  .from('ads')
                  .select('id, name')
                  .in('id', ids)
                  .limit(20000);
                if (error) throw error;
                rows = data || [];
              } catch (e) {
                console.warn('Fallo perfo.ads, probando public:', e);
                const { data } = await supabase
                  .from('ads')
                  .select('id, name')
                  .in('id', ids)
                  .limit(20000);
                rows = data || [];
              }

              for (const row of rows) {
                const id = String(row.id);
                if (!id) continue;
                adNames.set(id, row.name || '');
              }
            } catch (e) {
              console.warn('No pude traer nombres de ads:', e);
            }
          }

          // Construir estructura anidada adsets + ads dentro de cada campaña
          const metaWithChildren: MetaCampaign[] = metaList.map((camp) => {
            const byAdset = adsetsByCampaign.get(camp.id) || new Map();
            const adsets: MetaAdset[] = Array.from(byAdset.entries()).map(
              ([adsetId, v]) => {
                const adsMap = adsByAdset.get(adsetId) || new Map();
                const ads: MetaAd[] = Array.from(adsMap.entries()).map(
                  ([adId, av]) => {
                    const fallbackName = `Ad ${adId.slice(-6)}`;
                    const name = adNames.get(adId) || fallbackName;
                    const ctr =
                      av.impressions > 0
                        ? (av.clicks / av.impressions) * 100
                        : null;
                    const cpc =
                      av.clicks > 0 ? av.spend / av.clicks : null;
                    const cpm =
                      av.impressions > 0
                        ? (av.spend * 1000) / av.impressions
                        : null;

                    return {
                      id: adId,
                      name,
                      spend: av.spend,
                      impressions: av.impressions,
                      clicks: av.clicks,
                      conversions: av.conversions,
                      ctr,
                      cpc,
                      cpm,
                    };
                  }
                );

                const fallbackName = `Conjunto ${adsetId.slice(-6)}`;
                const name = adsetNames.get(adsetId) || fallbackName;
                const ctr =
                  v.impressions > 0 ? (v.clicks / v.impressions) * 100 : null;
                const cpc = v.clicks > 0 ? v.spend / v.clicks : null;
                const cpm =
                  v.impressions > 0
                    ? (v.spend * 1000) / v.impressions
                    : null;

                return {
                  id: adsetId,
                  name,
                  spend: v.spend,
                  impressions: v.impressions,
                  clicks: v.clicks,
                  conversions: v.conversions,
                  ctr,
                  cpc,
                  cpm,
                  ads,
                };
              }
            );

            return { ...camp, adsets };
          });

          metaList = metaWithChildren;
        }

        // -------- GOOGLE: campañas + anuncios (usando las tablas que ya te funcionaban) --------
        let googleList: GoogleCampaign[] = [];

        if (googleAccountId) {
          let rawGoogle: any[] = [];

          // 1) Campañas desde view_google_insights_front (igual que el código que andaba bien)
          try {
            const { data, error } = await supabase
              .schema('perfo')
              .from('view_google_insights_front')
              .select(
                'account_id, campaign_id, campaign_name, status, spend, impressions, clicks, conv, date'
              )
              .eq('account_id', googleAccountId)
              .gte('date', dateFrom)
              .lte('date', dateTo)
              .limit(500000);

            if (error) throw error;
            rawGoogle = data || [];
          } catch (e) {
            console.warn(
              'Fallo perfo.view_google_insights_front, probando public:',
              e
            );
            const { data } = await supabase
              .from('view_google_insights_front')
              .select(
                'account_id, campaign_id, campaign_name, status, spend, impressions, clicks, conv, date'
              )
              .eq('account_id', googleAccountId)
              .gte('date', dateFrom)
              .lte('date', dateTo)
              .limit(500000);

            rawGoogle = data || [];
          }

          const byCampaign = new Map<
            string,
            {
              name: string;
              spend: number;
              impressions: number;
              clicks: number;
              conversions: number;
              status: string;
            }
          >();

          for (const row of rawGoogle) {
            const cid = String(row.campaign_id);
            if (!cid) continue;

            const prev =
              byCampaign.get(cid) || {
                name: row.campaign_name ?? 'Campaña sin nombre',
                spend: 0,
                impressions: 0,
                clicks: 0,
                conversions: 0,
                status: row.status ?? '—',
              };

            prev.spend += Number(row.spend ?? 0);
            prev.impressions += Number(row.impressions ?? 0);
            prev.clicks += Number(row.clicks ?? 0);
            prev.conversions += Number(row.conv ?? 0);
            prev.status = row.status ?? prev.status;
            prev.name = row.campaign_name ?? prev.name;

            byCampaign.set(cid, prev);
          }

          // Base de campañas (sin ads todavía)
          const baseCampaigns = Array.from(byCampaign.entries()).map(([cid, v]) => {
            const ctr =
              v.impressions > 0 ? (v.clicks / v.impressions) * 100 : null;
            const cpc = v.clicks > 0 ? v.spend / v.clicks : null;
            const cpm =
              v.impressions > 0 ? (v.spend * 1000) / v.impressions : null;

            return {
              id: cid,
              name: v.name,
              status: v.status,
              spend: v.spend,
              impressions: v.impressions,
              clicks: v.clicks,
              conversions: v.conversions,
              ctr,
              cpc,
              cpm,
            };
          });

          // 2) Anuncios por campaña desde google_ads (mismo código que antes, pero adaptado a ads[])
          let adsByCampaign: Record<string, GoogleAd[]> = {};

          if (baseCampaigns.length > 0) {
            const googleCampaignIds = baseCampaigns.map((c) => c.id);
            let adsRows: any[] = [];

            try {
              const { data, error } = await supabase
                .schema('perfo')
                .from('google_ads')
                .select(
                  'campaign_id, campaign_name, ad_id, ad_name, status, impressions, clicks, spend, conversions, date'
                )
                .eq('account_id', googleAccountId)
                .gte('date', dateFrom)
                .lte('date', dateTo)
                .in('campaign_id', googleCampaignIds)
                .limit(500000);
              if (error) throw error;
              adsRows = data || [];
            } catch (e) {
              console.warn('Fallo perfo.google_ads, probando public.google_ads', e);
              const { data } = await supabase
                .from('google_ads')
                .select(
                  'campaign_id, campaign_name, ad_id, ad_name, status, impressions, clicks, spend, conversions, date'
                )
                .eq('account_id', googleAccountId)
                .gte('date', dateFrom)
                .lte('date', dateTo)
                .in('campaign_id', googleCampaignIds)
                .limit(500000);
              adsRows = data || [];
            }

            const byAd = new Map<
              string,
              {
                campaignId: string;
                campaignName: string;
                name: string;
                status: string;
                spend: number;
                impressions: number;
                clicks: number;
                conversions: number;
              }
            >();

            for (const row of adsRows) {
              const id = String(row.ad_id);
              if (!id) continue;

              const campaignId = String(row.campaign_id);
              const campaignName = row.campaign_name ?? '';

              const prev =
                byAd.get(id) || {
                  campaignId,
                  campaignName,
                  name:
                    row.ad_name ||
                    (campaignName
                      ? `[${campaignName}] ${id}`
                      : `Ad ${id}`),
                  status: row.status || '—',
                  spend: 0,
                  impressions: 0,
                  clicks: 0,
                  conversions: 0,
                };

              prev.spend += Number(row.spend ?? 0);
              prev.impressions += Number(row.impressions ?? 0);
              prev.clicks += Number(row.clicks ?? 0);
              prev.conversions += Number(row.conversions ?? 0);
              prev.status = row.status || prev.status;
              if (row.ad_name) prev.name = row.ad_name;

              byAd.set(id, prev);
            }

            const gAdsMap: Record<string, GoogleAd[]> = {};
            for (const [id, v] of byAd.entries()) {
              const ctr =
                v.impressions > 0 ? (v.clicks / v.impressions) * 100 : null;
              const cpc = v.clicks > 0 ? v.spend / v.clicks : null;
              const cpm =
                v.impressions > 0 ? (v.spend * 1000) / v.impressions : null;

              const arr = gAdsMap[v.campaignId] || [];
              arr.push({
                id,
                name: v.name,
                spend: v.spend,
                impressions: v.impressions,
                clicks: v.clicks,
                conversions: v.conversions,
                ctr,
                cpc,
                cpm,
              });
              gAdsMap[v.campaignId] = arr;
            }

            adsByCampaign = gAdsMap;
          }

          // 3) Campañas finales con ads[] ya cargados
          googleList = baseCampaigns.map((c) => ({
            ...c,
            ads: adsByCampaign[c.id] || [],
          }));
        }

        setMetaCampaigns(metaList);
        setGoogleCampaigns(googleList);

        // KPI health global
        const metaTotals = aggregateTotals(metaList);
        const googleTotals = aggregateTotals(googleList);

        const k1 = computeKpiHealth(
          clientRow.kpi1_target,
          clientRow.meta_kpi1_metric,
          clientRow.google_kpi1_metric,
          clientRow.kpi1_name,
          metaTotals,
          googleTotals
        );
        const k2 = computeKpiHealth(
          clientRow.kpi2_target,
          clientRow.meta_kpi2_metric,
          clientRow.google_kpi2_metric,
          clientRow.kpi2_name,
          metaTotals,
          googleTotals
        );

        setHealth1(k1.health);
        setHealth2(k2.health);
      } catch (err: any) {
        console.error('Error cargando campañas del cliente:', err);
        setErrorCampaigns(err.message || 'No se pudieron cargar las campañas.');
        setMetaCampaigns([]);
        setGoogleCampaigns([]);
      } finally {
        setLoadingCampaigns(false);
      }
    };

    loadCampaigns();
  }, [clientRow, dateFrom, dateTo]);

  const renderDots = (h: Health) => (
    <div
      className="traffic-dots"
      style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}
    >
      <span className={`dot ${h === 'bad' ? 'dot--bad' : ''}`} />
      <span className={`dot ${h === 'warn' ? 'dot--warn' : ''}`} />
      <span className={`dot ${h === 'good' ? 'dot--ok' : ''}`} />
    </div>
  );

  const budgetNumber =
    clientInfo?.budget && !isNaN(Number(clientInfo.budget))
      ? Number(clientInfo.budget)
      : null;

  const combined: CampaignWithPlatform[] = [
    ...metaCampaigns.map((c) => ({ ...c, platform: 'Meta' as const })),
    ...googleCampaigns.map((c) => ({ ...c, platform: 'Google' as const })),
  ];

  const visibleCampaigns =
    viewMode === 'all'
      ? combined
      : viewMode === 'meta'
      ? combined.filter((c) => c.platform === 'Meta')
      : combined.filter((c) => c.platform === 'Google');

  const totalsVisible = aggregateTotals(visibleCampaigns);
  const totalsVisibleDerived = {
    ctr:
      totalsVisible.impressions > 0
        ? (totalsVisible.clicks / totalsVisible.impressions) * 100
        : null,
    cpc:
      totalsVisible.clicks > 0
        ? totalsVisible.spend / totalsVisible.clicks
        : null,
    cpm:
      totalsVisible.impressions > 0
        ? (totalsVisible.spend * 1000) / totalsVisible.impressions
        : null,
  };

  const resetToMTD = () => {
    const r = getInitialMTDRange();
    setDateFrom(r.from);
    setDateTo(r.to);
  };

  const toggleCampaign = (id: string) => {
    setExpandedCampaignIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const toggleAdset = (id: string) => {
    setExpandedAdsetIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  return (
    <main className="page-wrap">
      {/* HEADER CLIENTE */}
      <div className="section-header" style={{ marginBottom: 16 }}>
        <div>
          <Link
            href="/clients"
            className="neo-button"
            style={{ fontSize: 12, marginBottom: 8 }}
          >
            ← Volver a clientes
          </Link>
          <h1 className="section-title" style={{ marginTop: 8 }}>
            {clientInfo?.name || 'Cliente'}
          </h1>
          <p style={{ fontSize: 13, color: '#64748b' }}>
            Vista detallada del cliente. Acá ves sus KPIs y todas sus campañas
            de Meta y Google.
          </p>
          {errorClient && (
            <p
              className="mt-2 rounded-md bg-red-50 px-3 py-2 text-xs text-red-700"
              style={{ maxWidth: 420 }}
            >
              {errorClient}
            </p>
          )}
        </div>

        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 6,
            alignItems: 'flex-end',
            fontSize: 13,
            color: '#475569',
          }}
        >
          <div>
            <strong>ID:</strong> {clientId}
          </div>
          <div>
            <strong>Presupuesto mensual:</strong>{' '}
            {budgetNumber != null
              ? budgetNumber.toLocaleString('es-AR', {
                  style: 'currency',
                  currency: 'ARS',
                  maximumFractionDigits: 0,
                })
              : '—'}
          </div>
        </div>
      </div>

      {/* TARJETAS KPI */}
      <section
        className="neo-card"
        style={{
          marginBottom: 20,
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: 16,
        }}
      >
        <div>
          <div
            style={{
              fontSize: 13,
              fontWeight: 600,
              color: '#0f172a',
              marginBottom: 4,
            }}
          >
            {kpis?.kpi1?.name || 'KPI 1'}
          </div>
          <div style={{ fontSize: 12, color: '#64748b', marginBottom: 6 }}>
            Objetivo:{' '}
            {kpis?.kpi1?.target ? kpis.kpi1.target : 'Sin objetivo definido'}
          </div>
          <div>{renderDots(health1)}</div>
        </div>

        <div>
          <div
            style={{
              fontSize: 13,
              fontWeight: 600,
              color: '#0f172a',
              marginBottom: 4,
            }}
          >
            {kpis?.kpi2?.name || 'KPI 2'}
          </div>
          <div style={{ fontSize: 12, color: '#64748b', marginBottom: 6 }}>
            Objetivo:{' '}
            {kpis?.kpi2?.target ? kpis.kpi2.target : 'Sin objetivo definido'}
          </div>
          <div>{renderDots(health2)}</div>
        </div>
      </section>

      {/* CAMPAÑAS */}
      <section className="neo-card" style={{ padding: 16 }}>
        {/* filtros */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            gap: 12,
            marginBottom: 12,
            alignItems: 'center',
            flexWrap: 'wrap',
          }}
        >
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <span style={{ fontSize: 12, color: '#64748b' }}>Ver:</span>

            <button
              type="button"
              onClick={() => setViewMode('all')}
              className={`px-3 py-1 text-xs rounded-full border ${
                viewMode === 'all'
                  ? 'bg-emerald-600 text-white border-emerald-600'
                  : 'bg-white text-slate-700 border-slate-300'
              }`}
            >
              Todas
            </button>

            <button
              type="button"
              onClick={() => setViewMode('meta')}
              className={`px-3 py-1 text-xs rounded-full border ${
                viewMode === 'meta'
                  ? 'bg-emerald-600 text-white border-emerald-600'
                  : 'bg-white text-slate-700 border-slate-300'
              }`}
            >
              Solo Meta
            </button>

            <button
              type="button"
              onClick={() => setViewMode('google')}
              className={`px-3 py-1 text-xs rounded-full border ${
                viewMode === 'google'
                  ? 'bg-emerald-600 text-white border-emerald-600'
                  : 'bg-white text-slate-700 border-slate-300'
              }`}
            >
              Solo Google
            </button>
          </div>

          <div
            style={{
              display: 'flex',
              gap: 8,
              alignItems: 'center',
              fontSize: 12,
            }}
          >
            <span style={{ color: '#64748b' }}>Rango:</span>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => {
                const v = e.target.value;
                setDateFrom(v);
                if (v && dateTo && v > dateTo) setDateTo(v);
              }}
              className="rounded-md border border-slate-300 px-2 py-1 text-xs"
            />
            <span style={{ color: '#64748b' }}>a</span>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => {
                const v = e.target.value;
                setDateTo(v);
                if (v && dateFrom && v < dateFrom) setDateFrom(v);
              }}
              className="rounded-md border border-slate-300 px-2 py-1 text-xs"
            />
            <button
              type="button"
              onClick={resetToMTD}
              className="px-3 py-1 text-xs rounded-full border bg-white text-slate-700 border-slate-300"
            >
              MTD
            </button>
          </div>
        </div>

        {errorCampaigns && (
          <p
            className="mb-2 rounded-md bg-red-50 px-3 py-2 text-xs text-red-700"
            style={{ marginTop: 4 }}
          >
            {errorCampaigns}
          </p>
        )}

        {loadingCampaigns ? (
          <p className="text-sm text-slate-500">Cargando campañas…</p>
        ) : visibleCampaigns.length === 0 ? (
          <p className="text-sm text-slate-500">
            No hay campañas cargadas para este cliente.
          </p>
        ) : (
          <div className="neo-card" style={{ overflowX: 'auto', padding: 0 }}>
            <table className="table">
              <thead>
                <tr>
                  <th></th>
                  <th>Plataforma</th>
                  <th>Nombre</th>
                  <th>Estado</th>
                  <th style={{ textAlign: 'right' }}>Spend</th>
                  <th style={{ textAlign: 'right' }}>Impr.</th>
                  <th style={{ textAlign: 'right' }}>Clicks</th>
                  <th style={{ textAlign: 'right' }}>Conv.</th>
                  <th style={{ textAlign: 'right' }}>CTR</th>
                  <th style={{ textAlign: 'right' }}>CPC</th>
                  <th style={{ textAlign: 'right' }}>CPM</th>
                  <th style={{ textAlign: 'right' }}>Objetivo</th>
                  <th style={{ textAlign: 'right' }}>% cumplido</th>
                </tr>
              </thead>
              <tbody>
                {visibleCampaigns.map((c) => {
                  const isMeta = c.platform === 'Meta';
                  const metaCamp = isMeta
                    ? (c as MetaCampaign & { platform: 'Meta' })
                    : null;
                  const googleCamp = !isMeta
                    ? (c as GoogleCampaign & { platform: 'Google' })
                    : null;

                  const hasChildren = isMeta
                    ? !!metaCamp?.adsets && metaCamp.adsets.length > 0
                    : !!googleCamp?.ads && googleCamp.ads.length > 0;

                  const isExpanded = expandedCampaignIds.includes(c.id);

                  const goalKey = `${c.platform}:${c.id}`;
const goal = campaignGoals[goalKey];

let objetivoTexto = '—';
let pctTexto = '—';

if (goal && isFinite(goal.target) && goal.target > 0) {
  const current = getCampaignMetric(c, goal.kpi);

  if (current != null && isFinite(current)) {
    const lower = isLowerBetterKpi(goal.kpi);
    let progressPct: number;

    if (lower) {
      // Para KPIs de costo: si ya estás por debajo del objetivo, se considera 100%
      if (current <= goal.target) {
        progressPct = 100;
      } else {
        progressPct = (goal.target / current) * 100;
      }
    } else {
      // Para KPIs "más es mejor"
      progressPct = (current / goal.target) * 100;
    }

    if (progressPct < 0) progressPct = 0;
    if (progressPct > 100) progressPct = 100;

    objetivoTexto = `${fmt(
      goal.target,
      goal.kpi === 'ctr' || goal.kpi === 'cpc' || goal.kpi === 'cpm' ? 2 : 0
    )} ${KPI_LABELS[goal.kpi]}`;

    const remaining = 100 - progressPct;
    if (remaining <= 0) {
      pctTexto = 'Objetivo cumplido';
    } else {
      pctTexto = `Falta ${fmt(remaining, 0)}%`;
    }
  } else {
    objetivoTexto = `${fmt(goal.target)} ${KPI_LABELS[goal.kpi]}`;
    pctTexto = 'Sin datos aún';
  }
}

                  return (
                    <Fragment key={`${c.platform}-${c.id}`}>
                      {/* fila principal de campaña */}
                      <tr>
                        <td>
                          {hasChildren && (
                            <button
                              type="button"
                              onClick={() => toggleCampaign(c.id)}
                              className="text-xs text-slate-500 hover:text-slate-700"
                            >
                              {isExpanded ? '▾' : '▸'}
                            </button>
                          )}
                        </td>
                        <td>{c.platform}</td>
                        <td>{c.name}</td>
                        <td>{c.status}</td>
                        <td style={{ textAlign: 'right' }}>{money(c.spend)}</td>
                        <td style={{ textAlign: 'right' }}>{fmt(c.impressions)}</td>
                        <td style={{ textAlign: 'right' }}>{fmt(c.clicks)}</td>
                        <td style={{ textAlign: 'right' }}>{fmt(c.conversions)}</td>
                        <td style={{ textAlign: 'right' }}>
                          {c.ctr == null ? '-' : `${fmt(c.ctr, 2)}%`}
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          {c.cpc == null ? '-' : money(c.cpc, 3)}
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          {c.cpm == null ? '-' : money(c.cpm, 2)}
                        </td>
                        <td style={{ textAlign: 'right' }}>{objetivoTexto}</td>
                        <td style={{ textAlign: 'right' }}>{pctTexto}</td>
                      </tr>

                      {/* fila extra, debajo, con detalle (Meta o Google) */}
                      {isExpanded && hasChildren && (
                        <tr>
                          <td colSpan={13} style={{ padding: 0, border: 'none' }}>
                            <div
                              style={{
                                marginTop: 8,
                                marginBottom: 8,
                                marginLeft: 24,
                                marginRight: 8,
                                borderRadius: 12,
                                background: '#f8fafc',
                                padding: 12,
                              }}
                            >
                              {/* META: adsets + ads */}
                              {isMeta &&
                                metaCamp?.adsets &&
                                metaCamp.adsets.length > 0 && (
                                  <div>
                                    <div
                                      style={{
                                        fontSize: 12,
                                        fontWeight: 600,
                                        color: '#64748b',
                                        marginBottom: 6,
                                      }}
                                    >
                                      Conjuntos de anuncios (Meta)
                                    </div>

                                    <table
                                      className="table"
                                      style={{
                                        fontSize: 11,
                                        background: 'white',
                                        borderRadius: 8,
                                        overflow: 'hidden',
                                      }}
                                    >
                                      <thead>
                                        <tr>
                                          <th></th>
                                          <th>Conjunto</th>
                                          <th style={{ textAlign: 'right' }}>Spend</th>
                                          <th style={{ textAlign: 'right' }}>
                                            Impr.
                                          </th>
                                          <th style={{ textAlign: 'right' }}>
                                            Clicks
                                          </th>
                                          <th style={{ textAlign: 'right' }}>
                                            Conv.
                                          </th>
                                          <th style={{ textAlign: 'right' }}>CTR</th>
                                          <th style={{ textAlign: 'right' }}>CPC</th>
                                          <th style={{ textAlign: 'right' }}>CPM</th>
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {metaCamp.adsets.map((as) => {
                                          const asExpanded =
                                            expandedAdsetIds.includes(as.id);
                                          return (
                                            <Fragment key={`adset-${as.id}`}>
                                              <tr>
                                                <td>
                                                  {as.ads.length > 0 && (
                                                    <button
                                                      type="button"
                                                      onClick={() =>
                                                        toggleAdset(as.id)
                                                      }
                                                      className="text-xs text-slate-500 hover:text-slate-700"
                                                    >
                                                      {asExpanded ? '▾' : '▸'}
                                                    </button>
                                                  )}
                                                </td>
                                                <td>
                                                  {as.name}{' '}
                                                  <span className="text-[10px] text-slate-400">
                                                    ({as.id})
                                                  </span>
                                                </td>
                                                <td style={{ textAlign: 'right' }}>
                                                  {money(as.spend)}
                                                </td>
                                                <td style={{ textAlign: 'right' }}>
                                                  {fmt(as.impressions)}
                                                </td>
                                                <td style={{ textAlign: 'right' }}>
                                                  {fmt(as.clicks)}
                                                </td>
                                                <td style={{ textAlign: 'right' }}>
                                                  {fmt(as.conversions)}
                                                </td>
                                                <td style={{ textAlign: 'right' }}>
                                                  {as.ctr == null
                                                    ? '-'
                                                    : `${fmt(as.ctr, 2)}%`}
                                                </td>
                                                <td style={{ textAlign: 'right' }}>
                                                  {as.cpc == null
                                                    ? '-'
                                                    : money(as.cpc, 3)}
                                                </td>
                                                <td style={{ textAlign: 'right' }}>
                                                  {as.cpm == null
                                                    ? '-'
                                                    : money(as.cpm, 2)}
                                                </td>
                                              </tr>

                                              {asExpanded && as.ads.length > 0 && (
                                                <tr>
                                                  <td colSpan={9} style={{ padding: 0 }}>
                                                    <div
                                                      style={{
                                                        margin: 8,
                                                        borderRadius: 8,
                                                        background: '#f1f5f9',
                                                        padding: 8,
                                                      }}
                                                    >
                                                      <table
                                                        className="table"
                                                        style={{
                                                          fontSize: 11,
                                                          background: 'white',
                                                          borderRadius: 6,
                                                          overflow: 'hidden',
                                                        }}
                                                      >
                                                        <thead>
                                                          <tr>
                                                            <th>Ad</th>
                                                            <th
                                                              style={{
                                                                textAlign: 'right',
                                                              }}
                                                            >
                                                              Spend
                                                            </th>
                                                            <th
                                                              style={{
                                                                textAlign: 'right',
                                                              }}
                                                            >
                                                              Impr.
                                                            </th>
                                                            <th
                                                              style={{
                                                                textAlign: 'right',
                                                              }}
                                                            >
                                                              Clicks
                                                            </th>
                                                            <th
                                                              style={{
                                                                textAlign: 'right',
                                                              }}
                                                            >
                                                              Conv.
                                                            </th>
                                                            <th
                                                              style={{
                                                                textAlign: 'right',
                                                              }}
                                                            >
                                                              CTR
                                                            </th>
                                                            <th
                                                              style={{
                                                                textAlign: 'right',
                                                              }}
                                                            >
                                                              CPC
                                                            </th>
                                                            <th
                                                              style={{
                                                                textAlign: 'right',
                                                              }}
                                                            >
                                                              CPM
                                                            </th>
                                                          </tr>
                                                        </thead>
                                                        <tbody>
                                                          {as.ads.map((ad) => (
                                                            <tr key={`ad-${ad.id}`}>
                                                              <td>
                                                                {ad.name}{' '}
                                                                <span className="text-[10px] text-slate-400">
                                                                  ({ad.id})
                                                                </span>
                                                              </td>
                                                              <td
                                                                style={{
                                                                  textAlign: 'right',
                                                                }}
                                                              >
                                                                {money(ad.spend)}
                                                              </td>
                                                              <td
                                                                style={{
                                                                  textAlign: 'right',
                                                                }}
                                                              >
                                                                {fmt(ad.impressions)}
                                                              </td>
                                                              <td
                                                                style={{
                                                                  textAlign: 'right',
                                                                }}
                                                              >
                                                                {fmt(ad.clicks)}
                                                              </td>
                                                              <td
                                                                style={{
                                                                  textAlign: 'right',
                                                                }}
                                                              >
                                                                {fmt(ad.conversions)}
                                                              </td>
                                                              <td
                                                                style={{
                                                                  textAlign: 'right',
                                                                }}
                                                              >
                                                                {ad.ctr == null
                                                                  ? '-'
                                                                  : `${fmt(ad.ctr, 2)}%`}
                                                              </td>
                                                              <td
                                                                style={{
                                                                  textAlign: 'right',
                                                                }}
                                                              >
                                                                {ad.cpc == null
                                                                  ? '-'
                                                                  : money(
                                                                      ad.cpc,
                                                                      3
                                                                    )}
                                                              </td>
                                                              <td
                                                                style={{
                                                                  textAlign: 'right',
                                                                }}
                                                              >
                                                                {ad.cpm == null
                                                                  ? '-'
                                                                  : money(
                                                                      ad.cpm,
                                                                      2
                                                                    )}
                                                              </td>
                                                            </tr>
                                                          ))}
                                                        </tbody>
                                                      </table>
                                                    </div>
                                                  </td>
                                                </tr>
                                              )}
                                            </Fragment>
                                          );
                                        })}
                                      </tbody>
                                    </table>
                                  </div>
                                )}

                              {/* GOOGLE: anuncios (sin adset) */}
                              {!isMeta &&
                                googleCamp?.ads &&
                                googleCamp.ads.length > 0 && (
                                  <div>
                                    <div
                                      style={{
                                        fontSize: 12,
                                        fontWeight: 600,
                                        color: '#64748b',
                                        marginBottom: 6,
                                      }}
                                    >
                                      Anuncios (Google)
                                    </div>

                                    <table
                                      className="table"
                                      style={{
                                        fontSize: 11,
                                        background: 'white',
                                        borderRadius: 8,
                                        overflow: 'hidden',
                                      }}
                                    >
                                      <thead>
                                        <tr>
                                          <th>Ad</th>
                                          <th style={{ textAlign: 'right' }}>Spend</th>
                                          <th style={{ textAlign: 'right' }}>Impr.</th>
                                          <th style={{ textAlign: 'right' }}>
                                            Clicks
                                          </th>
                                          <th style={{ textAlign: 'right' }}>
                                            Conv.
                                          </th>
                                          <th style={{ textAlign: 'right' }}>CTR</th>
                                          <th style={{ textAlign: 'right' }}>CPC</th>
                                          <th style={{ textAlign: 'right' }}>CPM</th>
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {googleCamp.ads.map((ad) => (
                                          <tr key={`g-ad-${ad.id}`}>
                                            <td>
                                              {ad.name}{' '}
                                              <span className="text-[10px] text-slate-400">
                                                ({ad.id})
                                              </span>
                                            </td>
                                            <td style={{ textAlign: 'right' }}>
                                              {money(ad.spend)}
                                            </td>
                                            <td style={{ textAlign: 'right' }}>
                                              {fmt(ad.impressions)}
                                            </td>
                                            <td style={{ textAlign: 'right' }}>
                                              {fmt(ad.clicks)}
                                            </td>
                                            <td style={{ textAlign: 'right' }}>
                                              {fmt(ad.conversions)}
                                            </td>
                                            <td style={{ textAlign: 'right' }}>
                                              {ad.ctr == null
                                                ? '-'
                                                : `${fmt(ad.ctr, 2)}%`}
                                            </td>
                                            <td style={{ textAlign: 'right' }}>
                                              {ad.cpc == null
                                                ? '-'
                                                : money(ad.cpc, 3)}
                                            </td>
                                            <td style={{ textAlign: 'right' }}>
                                              {ad.cpm == null
                                                ? '-'
                                                : money(ad.cpm, 2)}
                                            </td>
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  </div>
                                )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>

              {viewMode !== 'all' && (
                <tfoot>
                  <tr>
                    <td colSpan={4} style={{ fontWeight: 600 }}>
                      Totales ({viewMode === 'meta' ? 'Meta' : 'Google'})
                    </td>
                    <td style={{ textAlign: 'right', fontWeight: 600 }}>
                      {money(totalsVisible.spend)}
                    </td>
                    <td style={{ textAlign: 'right', fontWeight: 600 }}>
                      {fmt(totalsVisible.impressions)}
                    </td>
                    <td style={{ textAlign: 'right', fontWeight: 600 }}>
                      {fmt(totalsVisible.clicks)}
                    </td>
                    <td style={{ textAlign: 'right', fontWeight: 600 }}>
                      {fmt(totalsVisible.conversions)}
                    </td>
                    <td style={{ textAlign: 'right', fontWeight: 600 }}>
                      {totalsVisibleDerived.ctr == null
                        ? '-'
                        : `${fmt(totalsVisibleDerived.ctr, 2)}%`}
                    </td>
                    <td style={{ textAlign: 'right', fontWeight: 600 }}>
                      {totalsVisibleDerived.cpc == null
                        ? '-'
                        : money(totalsVisibleDerived.cpc, 3)}
                    </td>
                    <td style={{ textAlign: 'right', fontWeight: 600 }}>
                      {totalsVisibleDerived.cpm == null
                        ? '-'
                        : money(totalsVisibleDerived.cpm, 2)}
                    </td>
                    <td style={{ textAlign: 'right', fontWeight: 600 }}>—</td>
                    <td style={{ textAlign: 'right', fontWeight: 600 }}>—</td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        )}
      </section>

      {/* OBJETIVOS POR CAMPAÑA (abajo, con combo) */}
      <section
        className="neo-card"
        style={{
          marginTop: 16,
          padding: 16,
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
        }}
      >
        <div>
          <h2
            style={{
              fontSize: 14,
              fontWeight: 600,
              color: '#0f172a',
              marginBottom: 4,
            }}
          >
            Objetivos por campaña
          </h2>
          <p style={{ fontSize: 12, color: '#64748b', maxWidth: 520 }}>
            Elegí una campaña, un KPI y un objetivo numérico. El objetivo se
            guarda en tu navegador y se muestra en la tabla como columnas
            &quot;Objetivo&quot; y &quot;% cumplido&quot;.
          </p>
        </div>

        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 12,
            alignItems: 'flex-end',
          }}
        >
          {/* combo campaña */}
          <label
            style={{
              fontSize: 11,
              color: '#64748b',
              display: 'flex',
              flexDirection: 'column',
              gap: 4,
              minWidth: 220,
            }}
          >
            Campaña
            <select
              value={selectedCampaignKey}
              onChange={(e) => setSelectedCampaignKey(e.target.value)}
              className="rounded-md border border-slate-300 px-2 py-1 text-xs"
            >
              <option value="">Seleccioná una campaña…</option>
              {combined.map((c) => {
                const key = `${c.platform}:${c.id}`;
                return (
                  <option key={key} value={key}>
                    {c.platform} · {c.name}
                  </option>
                );
              })}
            </select>
          </label>

          {/* combo KPI */}
          <label
            style={{
              fontSize: 11,
              color: '#64748b',
              display: 'flex',
              flexDirection: 'column',
              gap: 4,
              minWidth: 160,
            }}
          >
            KPI
            <select
              value={selectedKpi}
              onChange={(e) => setSelectedKpi(e.target.value as KpiKey)}
              className="rounded-md border border-slate-300 px-2 py-1 text-xs"
            >
              <option value="conversions">Conversiones</option>
              <option value="clicks">Clicks</option>
              <option value="impressions">Impresiones</option>
              <option value="spend">Spend</option>
              <option value="ctr">CTR %</option>
              <option value="cpc">CPC</option>
              <option value="cpm">CPM</option>
            </select>
          </label>

          {/* objetivo */}
          <label
            style={{
              fontSize: 11,
              color: '#64748b',
              display: 'flex',
              flexDirection: 'column',
              gap: 4,
              width: 120,
            }}
          >
            Objetivo
            <input
              type="number"
              min={0}
              step="any"
              value={inputTarget}
              onChange={(e) => setInputTarget(e.target.value)}
              className="rounded-md border border-slate-300 px-2 py-1 text-xs"
              placeholder="Ej: 20"
            />
          </label>

          <button
            type="button"
            onClick={handleSaveGoal}
            className="px-3 py-2 text-xs rounded-full border bg-emerald-600 text-white border-emerald-600"
          >
            Guardar objetivo
          </button>
        </div>

        
      </section>
    </main>
  );
}

