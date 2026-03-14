import { useState, useMemo } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from 'recharts'
import { Activity, Star, AlertTriangle, MessageSquare } from 'lucide-react'
import { useFilteredResources } from '../hooks/useResources'
import { useTranslation } from '../hooks/useTranslation'
import FilterBar from '../components/FilterBar'
import MapView from '../components/MapView'
import RiskBadge from '../components/RiskBadge'
import { isClosedToday } from '../utils/mlScoring'
import ExportButton from '../components/ExportButton'
import ResourceReviews from '../components/ResourceReviews'
import SentimentPanel from '../components/SentimentPanel'

const COLORS = ['#ef4444', '#f59e0b', '#3b82f6', '#22c55e', '#8b5cf6']

const RADIAN = Math.PI / 180
const renderLabel = ({ cx, cy, midAngle, outerRadius, percent }) => {
  if (percent < 0.05) return null
  const radius = outerRadius + 18
  const x = cx + radius * Math.cos(-midAngle * RADIAN)
  const y = cy + radius * Math.sin(-midAngle * RADIAN)
  return (
    <text x={x} y={y} fill="#9ca3af" fontSize={11} textAnchor={x > cx ? 'start' : 'end'} dominantBaseline="central">
      {`${(percent * 100).toFixed(0)}%`}
    </text>
  )
}

const KPI_CONFIG = [
  { key: 'total', icon: Activity, accent: 'kpi-blue', color: 'text-blue-400' },
  { key: 'rating', icon: Star, accent: 'kpi-yellow', color: 'text-yellow-400' },
  { key: 'reviews', icon: MessageSquare, accent: 'kpi-green', color: 'text-green-400' },
  { key: 'risk', icon: AlertTriangle, accent: 'kpi-red', color: 'text-red-400' },
]

export default function FoodBankDashboard() {
  const [filters, setFilters] = useState({})
  const [selectedResource, setSelectedResource] = useState(null)
  const { data, all, isLoading, progress } = useFilteredResources(filters)
  const { t, lang } = useTranslation()

  const flyerCoords = useMemo(() => {
    const r = data.find(x => x.latitude && x.longitude)
    if (!r) return null
    return { lat: r.latitude, lng: r.longitude, locationName: r.city ?? 'Food Resources' }
  }, [data])

  const ratingDist = useMemo(() => {
    const bins = { '1': 0, '2': 0, '3': 0, '4': 0, '5': 0 }
    data.forEach(r => {
      if (r.ratingAverage) {
        const k = String(Math.round(r.ratingAverage))
        if (bins[k] !== undefined) bins[k]++
      }
    })
    return Object.entries(bins).map(([k, v]) => ({ stars: `${'★'.repeat(Number(k))}`, count: v }))
  }, [data])

  const riskDist = useMemo(() => {
    const bins = { 'Low Risk': 0, 'Medium Risk': 0, 'High Risk': 0 }
    data.forEach(r => {
      const s = r.riskScore ?? 0
      if (s >= 60) bins['High Risk']++
      else if (s >= 30) bins['Medium Risk']++
      else bins['Low Risk']++
    })
    return Object.entries(bins).map(([name, value]) => ({ name, value }))
  }, [data])

  const typeDist = useMemo(() => {
    const m = {}
    data.forEach(r => {
      const k = lang === 'es'
        ? (r.resourceType?.name_es ?? r.resourceType?.name ?? 'Unknown')
        : (r.resourceType?.name ?? 'Unknown')
      m[k] = (m[k] ?? 0) + 1
    })
    return Object.entries(m).map(([name, value]) => ({ name, value }))
  }, [data, lang])

  const avgRating = data.filter(r => r.ratingAverage).length
    ? (data.reduce((s, r) => s + (r.ratingAverage ?? 0), 0) / data.filter(r => r.ratingAverage).length).toFixed(2)
    : '—'

  const kpis = [
    { label: 'Total Resources', value: data.length, ...KPI_CONFIG[0] },
    { label: t('ratingAverage'), value: avgRating, ...KPI_CONFIG[1] },
    { label: t('totalReviews'), value: data.reduce((s, r) => s + (r._count?.reviews ?? 0), 0).toLocaleString(), ...KPI_CONFIG[2] },
    { label: 'High Risk', value: data.filter(r => (r.riskScore ?? 0) >= 60).length, ...KPI_CONFIG[3] },
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
    <div id="foodbank-dashboard" className="p-6 space-y-6 max-w-7xl mx-auto animate-fade-in">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">🏦 {t('foodbank')}</h1>
          <p className="text-gray-500 text-sm mt-1">{t('foodbankHeadline')}</p>
        </div>
        <ExportButton data={data} dashboardId="foodbank-dashboard" showFlyer flyerCoords={flyerCoords} />
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

      {/* Charts */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="chart-card">
          <h3 className="text-sm font-semibold text-gray-300 mb-3">Rating Distribution</h3>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={ratingDist}>
              <XAxis dataKey="stars" tick={{ fill: '#6b7280', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: '#6b7280', fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ background: 'rgba(17,24,39,0.95)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12 }} />
              <Bar dataKey="count" fill="#facc15" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="chart-card">
          <h3 className="text-sm font-semibold text-gray-300 mb-3">{t('risk')} Distribution</h3>
          <ResponsiveContainer width="100%" height={180}>
            <PieChart>
              <Pie data={riskDist} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={55} label={renderLabel} labelLine={false}>
                {riskDist.map((_, i) => <Cell key={i} fill={['#22c55e', '#f59e0b', '#ef4444'][i]} />)}
              </Pie>
              <Legend wrapperStyle={{ fontSize: 11, color: '#6b7280' }} />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="chart-card">
          <h3 className="text-sm font-semibold text-gray-300 mb-3">{t('type')} Breakdown</h3>
          <ResponsiveContainer width="100%" height={180}>
            <PieChart>
              <Pie data={typeDist} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={55} label={renderLabel} labelLine={false}>
                {typeDist.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Pie>
              <Legend wrapperStyle={{ fontSize: 11, color: '#6b7280' }} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Map */}
      <div className="chart-card">
        <h3 className="text-sm font-semibold text-gray-300 mb-3">🗺️ {t('mapTitle')}</h3>
        <MapView resources={data} height="350px" />
      </div>

      {/* Resource Table + Reviews Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 glass-card rounded-xl overflow-hidden">
          <div className="p-4 border-b border-gray-800/50">
            <h3 className="text-sm font-semibold text-gray-300">Resources — click a row to view reviews</h3>
          </div>
          <div className="overflow-auto max-h-80">
            <table className="w-full text-sm">
              <thead className="bg-gray-800/40 sticky top-0">
                <tr>
                  {[t('name'), t('city'), t('type'), t('rating'), t('risk')].map(h => (
                    <th key={h} className="px-3 py-2.5 text-left text-xs text-gray-500 font-semibold uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.slice(0, 100).map(r => (
                  <tr
                    key={r.id}
                    onClick={() => setSelectedResource(r)}
                    className={`table-row border-t border-gray-800/30 cursor-pointer ${
                      selectedResource?.id === r.id ? 'table-row-selected' : ''
                    }`}
                  >
                    <td className="px-3 py-2.5 text-white truncate max-w-[160px] font-medium">{r.name ?? '—'}</td>
                    <td className="px-3 py-2.5 text-gray-400">{r.city ?? '—'}</td>
                    <td className="px-3 py-2.5 text-gray-500 text-xs">
                      {lang === 'es' ? (r.resourceType?.name_es ?? r.resourceType?.name) : r.resourceType?.name}
                    </td>
                    <td className="px-3 py-2.5 text-yellow-400">{r.ratingAverage ? `⭐ ${r.ratingAverage.toFixed(1)}` : '—'}</td>
                    <td className="px-3 py-2.5"><RiskBadge score={r.riskScore} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Reviews side panel */}
        <div className="glass-card rounded-xl p-4 overflow-auto max-h-[420px]">
          {selectedResource ? (
            <>
              <div className="mb-3">
                <p className="font-semibold text-white text-sm truncate">{selectedResource.name}</p>
                <p className="text-xs text-gray-500">{selectedResource.city}, {selectedResource.state}</p>
                {selectedResource.openByAppointment && (
                  <span className="text-xs bg-blue-500/20 text-blue-400 px-2 py-0.5 rounded-full mt-1.5 inline-block">
                    📅 {t('openByAppointment')}
                  </span>
                )}
                {isClosedToday(selectedResource) && (
                  <span className="text-xs bg-red-500/20 text-red-400 px-2 py-0.5 rounded-full mt-1.5 inline-block">
                    🔒 Closed Today
                  </span>
                )}
              </div>
              <ResourceReviews resource={selectedResource} />
              <SentimentPanel resource={selectedResource} />
            </>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-gray-600 text-sm gap-2">
              <MessageSquare size={24} className="opacity-40" />
              Select a resource to view reviews
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
