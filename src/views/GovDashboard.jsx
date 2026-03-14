import { useState, useMemo } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { MapPin, Shield, AlertTriangle, Eye } from 'lucide-react'
import { useFilteredResources } from '../hooks/useResources'
import { useTranslation } from '../hooks/useTranslation'
import { clusterResources, computeBarrierIndex, isClosedToday } from '../utils/mlScoring'
import FilterBar from '../components/FilterBar'
import MapView from '../components/MapView'
import ExportButton from '../components/ExportButton'

const CLUSTER_COLORS = ['#22c55e', '#3b82f6', '#f59e0b', '#ef4444']
const CLUSTER_LABELS_KEY = ['wellServed', 'moderateAccess', 'strained', 'foodDesert']

const KPI_CONFIG = [
  { icon: MapPin, accent: 'kpi-blue', color: 'text-blue-400' },
  { icon: AlertTriangle, accent: 'kpi-red', color: 'text-red-400' },
  { icon: Shield, accent: 'kpi-orange', color: 'text-orange-400' },
  { icon: Eye, accent: 'kpi-yellow', color: 'text-yellow-400' },
]

export default function GovDashboard() {
  const [filters, setFilters] = useState({})
  const { data, all, isLoading, progress } = useFilteredResources(filters)
  const { t, lang } = useTranslation()
  const clusterMap = useMemo(() => clusterResources(data), [data])

  const flyerCoords = useMemo(() => {
    const r = data.find(x => x.latitude && x.longitude)
    if (!r) return null
    return { lat: r.latitude, lng: r.longitude, locationName: r.city ?? 'Region' }
  }, [data])

  const clusterDist = useMemo(() => {
    const counts = [0, 0, 0, 0]
    Object.values(clusterMap).forEach(v => counts[v.cluster]++)
    return counts.map((count, i) => ({
      label: t(CLUSTER_LABELS_KEY[i]),
      count,
      color: CLUSTER_COLORS[i],
    }))
  }, [clusterMap, lang])

  const barrierByState = useMemo(() => {
    const m = {}
    data.forEach(r => {
      if (!r.state) return
      if (!m[r.state]) m[r.state] = { sum: 0, count: 0 }
      m[r.state].sum += computeBarrierIndex(r)
      m[r.state].count++
    })
    return Object.entries(m)
      .map(([state, v]) => ({ state, barrier: parseFloat((v.sum / v.count).toFixed(2)) }))
      .sort((a, b) => b.barrier - a.barrier)
      .slice(0, 12)
  }, [data])

  const capacityData = useMemo(() => {
    const atCapacity = data.filter(r =>
      !r.occurrences?.some(o => !o.skippedAt) || isClosedToday(r)
    ).length
    const total = data.length || 1
    return [
      { name: 'At Capacity', value: atCapacity, pct: ((atCapacity / total) * 100).toFixed(1) },
      { name: 'Available', value: total - atCapacity, pct: (((total - atCapacity) / total) * 100).toFixed(1) },
    ]
  }, [data])

  const lowConfidenceByState = useMemo(() => {
    const m = {}
    data.forEach(r => {
      if (!r.state || (r.confidence ?? 1) >= 0.5) return
      m[r.state] = (m[r.state] ?? 0) + 1
    })
    return Object.entries(m)
      .map(([state, count]) => ({ state, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10)
  }, [data])

  const kpis = [
    { label: 'Total Resources', value: data.length.toLocaleString(), ...KPI_CONFIG[0] },
    { label: `${t('foodDesert')} Zones`, value: clusterDist[3]?.count ?? 0, ...KPI_CONFIG[1] },
    { label: 'At Capacity', value: `${capacityData[0]?.pct ?? 0}%`, ...KPI_CONFIG[2] },
    { label: 'Low Confidence', value: data.filter(r => (r.confidence ?? 1) < 0.5).length, ...KPI_CONFIG[3] },
  ]

  if (isLoading) return (
    <div className="flex flex-col items-center justify-center h-64 gap-4 animate-fade-in">
      <div className="w-72 h-2 bg-gray-800 rounded-full overflow-hidden">
        <div className="h-full bg-gradient-to-r from-yellow-400 to-yellow-500 transition-all duration-300 rounded-full shimmer" style={{ width: `${progress}%` }} />
      </div>
      <p className="text-gray-400 text-sm">{t('loading')} {progress}%</p>
    </div>
  )

  return (
    <div id="gov-dashboard" className="p-6 space-y-6 max-w-7xl mx-auto animate-fade-in">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white">🏛️ {t('government')}</h1>
          <p className="text-gray-500 text-sm mt-1">{t('govHeadline')}</p>
        </div>
        <ExportButton data={data} dashboardId="gov-dashboard" showFlyer flyerCoords={flyerCoords} />
      </div>

      <FilterBar filters={filters} onChange={setFilters} allData={all} />

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {kpis.map((kpi, i) => {
          const Icon = kpi.icon
          return (
            <div key={kpi.label} className={`glass-card rounded-xl p-4 ${kpi.accent} animate-fade-in-up stagger-${i + 1}`}>
              <div className="flex items-center justify-between mb-2">
                <Icon size={16} className={`${kpi.color} opacity-60`} />
              </div>
              <div className={`text-2xl font-bold ${kpi.color}`}>{kpi.value}</div>
              <div className="text-xs text-gray-500 mt-1 font-medium">{kpi.label}</div>
            </div>
          )
        })}
      </div>

      {/* Cluster Distribution */}
      <div className="chart-card">
        <h3 className="text-sm font-semibold text-gray-300 mb-1">Food Desert {t('cluster')} Distribution</h3>
        <p className="text-xs text-gray-600 mb-4">Resources clustered by location, rating, and access barriers</p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {clusterDist.map((c, i) => (
            <div
              key={i}
              className="rounded-xl p-4 text-center transition-all duration-200 hover:scale-[1.03]"
              style={{ border: `1px solid ${c.color}33`, background: `${c.color}0a` }}
            >
              <div className="text-2xl font-bold" style={{ color: c.color }}>{c.count}</div>
              <div className="text-xs text-gray-400 mt-1 font-medium">{c.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="chart-card">
          <h3 className="text-sm font-semibold text-gray-300 mb-1">{t('barrierIndex')} by State</h3>
          <p className="text-xs text-gray-600 mb-3">Higher = more barriers (0–1 scale)</p>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={barrierByState}>
              <XAxis dataKey="state" tick={{ fill: '#6b7280', fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis domain={[0, 1]} tick={{ fill: '#6b7280', fontSize: 10 }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ background: 'rgba(17,24,39,0.95)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12 }} />
              <Bar dataKey="barrier" radius={[6, 6, 0, 0]}>
                {barrierByState.map((entry, i) => (
                  <Cell key={i} fill={entry.barrier > 0.6 ? '#ef4444' : entry.barrier > 0.3 ? '#f59e0b' : '#22c55e'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="chart-card">
          <h3 className="text-sm font-semibold text-gray-300 mb-1">States with Most Unverified Resources</h3>
          <p className="text-xs text-gray-600 mb-3">Low confidence (&lt;0.5) resources by state</p>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={lowConfidenceByState}>
              <XAxis dataKey="state" tick={{ fill: '#6b7280', fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: '#6b7280', fontSize: 10 }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ background: 'rgba(17,24,39,0.95)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12 }} />
              <Bar dataKey="count" fill="#8b5cf6" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Map with cluster colors */}
      <div className="chart-card">
        <h3 className="text-sm font-semibold text-gray-300 mb-1">🗺️ {t('mapTitle')} — Food Desert Zones</h3>
        <div className="flex gap-4 mb-3 flex-wrap">
          {CLUSTER_LABELS_KEY.map((k, i) => (
            <span key={k} className="text-xs flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ background: CLUSTER_COLORS[i] }} />
              <span className="text-gray-400">{t(k)}</span>
            </span>
          ))}
        </div>
        <MapView resources={data} clusterMap={clusterMap} height="380px" />
      </div>

      {/* Resource detail table */}
      <div className="glass-card rounded-xl overflow-hidden">
        <div className="p-4 border-b border-gray-800/50 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-300">High-Priority Resources</h3>
          <span className="text-xs text-gray-600 font-medium">{t('riskScore')} ≥ 60</span>
        </div>
        <div className="overflow-auto max-h-64">
          <table className="w-full text-sm">
            <thead className="bg-gray-800/40 sticky top-0">
              <tr>
                {[t('name'), t('city'), t('state'), t('riskScore'), t('barrierIndex'), t('confidence'), t('cluster')].map(h => (
                  <th key={h} className="px-3 py-2.5 text-left text-xs text-gray-500 font-semibold uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data
                .filter(r => (r.riskScore ?? 0) >= 60)
                .sort((a, b) => (b.riskScore ?? 0) - (a.riskScore ?? 0))
                .slice(0, 50)
                .map(r => (
                  <tr key={r.id} className="table-row border-t border-gray-800/30">
                    <td className="px-3 py-2.5 text-white truncate max-w-[160px] font-medium">{r.name ?? '—'}</td>
                    <td className="px-3 py-2.5 text-gray-400">{r.city ?? '—'}</td>
                    <td className="px-3 py-2.5 text-gray-400">{r.state ?? '—'}</td>
                    <td className="px-3 py-2.5 text-red-400 font-bold">{r.riskScore}</td>
                    <td className="px-3 py-2.5 text-orange-400">{computeBarrierIndex(r).toFixed(2)}</td>
                    <td className="px-3 py-2.5 text-gray-400">{r.confidence != null ? `${(r.confidence * 100).toFixed(0)}%` : '—'}</td>
                    <td className="px-3 py-2.5 text-xs font-medium" style={{ color: clusterMap[r.id]?.color ?? '#6b7280' }}>
                      {clusterMap[r.id]?.label ?? '—'}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
