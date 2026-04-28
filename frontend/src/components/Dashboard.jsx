import { useState, useEffect, useCallback, useRef } from 'react'
import { getJobs, getStats } from '../api'
import { useWebSocket } from '../hooks/useWebSocket'
import Header from './Header'
import StatsCard from './StatsCard'
import JobsTable from './JobsTable'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer,
} from 'recharts'

const STAT_CARDS = [
  { key: 'total',      label: 'Total Applied', icon: '📋', color: 'blue',   filter: 'all'        },
  { key: 'interviews', label: 'Interviews',     icon: '🗣',  color: 'purple', filter: 'interviews' },
  { key: 'offers',     label: 'Offers',         icon: '🎉', color: 'green',  filter: 'offer'      },
  { key: 'rejections', label: 'Rejections',     icon: '📉', color: 'red',    filter: 'rejected'   },
]

function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-slate-900 rounded-xl px-3 py-2 text-xs shadow-xl">
      <p className="text-slate-400 mb-0.5">{label}</p>
      <p className="text-white font-mono font-semibold">{payload[0].value} apps</p>
    </div>
  )
}

function EmptyState() {
  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm py-16 px-8 text-center">
      <div className="text-5xl mb-4">📬</div>
      <h3 className="font-semibold text-slate-800 mb-2 text-base">No applications yet</h3>
      <p className="text-slate-400 text-sm max-w-xs mx-auto leading-relaxed">
        Hit <strong className="text-slate-600">Scan Now</strong> to search your Gmail for job applications.
        JobTracker will detect and extract all the relevant details automatically.
      </p>
    </div>
  )
}

export default function Dashboard({ email }) {
  const [jobs, setJobs]             = useState([])
  const [stats, setStats]           = useState({ total: 0, interviews: 0, offers: 0, rejections: 0, by_week: [] })
  const [loading, setLoading]       = useState(true)
  const [lastScanned, setLastScanned] = useState(null)
  const [activeFilter, setActiveFilter] = useState('all')
  const [toast, setToast]               = useState(null)
  const toastTimer                       = useRef(null)
  const tableRef                         = useRef(null)

  const wsUrl = (import.meta.env.VITE_API_URL || 'http://localhost:8000')
    .replace(/^http/, 'ws') + '/ws'

  const handleWsMessage = useCallback((msg) => {
    if (msg.type !== 'scan_complete') return
    fetchAll()
    if (msg.new_jobs > 0) {
      clearTimeout(toastTimer.current)
      setToast(`${msg.new_jobs} new application${msg.new_jobs !== 1 ? 's' : ''} found`)
      toastTimer.current = setTimeout(() => setToast(null), 4000)
    }
  }, [fetchAll])

  useWebSocket(wsUrl, handleWsMessage)

  const fetchAll = useCallback(async () => {
    try {
      const [j, s] = await Promise.all([getJobs(), getStats()])
      setJobs(j.data)
      setStats(s.data)
      setLastScanned(new Date().toISOString())
    } catch (err) {
      console.error('Fetch failed', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchAll()
  }, [fetchAll])

  const handleCardClick = (filter) => {
    setActiveFilter(filter)
    tableRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const handleDelete = (id) => {
    setJobs((prev) => prev.filter((j) => j.id !== id))
    setStats((prev) => ({ ...prev, total: Math.max(0, prev.total - 1) }))
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Toast notification */}
      <div className={`fixed top-4 left-1/2 -translate-x-1/2 z-50 transition-all duration-300 ${toast ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-2 pointer-events-none'}`}>
        <div className="flex items-center gap-2.5 bg-slate-900 text-white text-xs font-medium px-4 py-2.5 rounded-xl shadow-xl">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          {toast}
        </div>
      </div>

      <Header email={email} lastScanned={lastScanned} onScanComplete={fetchAll} />

      <main className="max-w-6xl mx-auto px-5 py-7 space-y-6">
        {loading ? (
          <div className="flex items-center justify-center py-28">
            <span className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <>
            {/* Stats row */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {STAT_CARDS.map((c, i) => (
                <StatsCard
                  key={c.key}
                  label={c.label}
                  value={stats[c.key] ?? 0}
                  icon={c.icon}
                  color={c.color}
                  delay={i * 70}
                  onClick={() => handleCardClick(c.filter)}
                  active={activeFilter === c.filter}
                />
              ))}
            </div>

            {/* Chart — only when we have data */}
            {stats.by_week?.length > 1 && (
              <div
                className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 opacity-0 animate-fade-up"
                style={{ animationDelay: '280ms', animationFillMode: 'forwards' }}
              >
                <div className="flex items-center justify-between mb-5">
                  <div>
                    <h2 className="font-semibold text-slate-800 text-sm">Activity</h2>
                    <p className="text-slate-400 text-xs mt-0.5">Applications per week</p>
                  </div>
                </div>
                <ResponsiveContainer width="100%" height={200}>
                  <AreaChart data={stats.by_week} margin={{ top: 2, right: 2, bottom: 0, left: -24 }}>
                    <defs>
                      <linearGradient id="grad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%"   stopColor="#6366f1" stopOpacity={0.18} />
                        <stop offset="100%" stopColor="#6366f1" stopOpacity={0}    />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                    <XAxis
                      dataKey="week"
                      tick={{ fontSize: 10, fill: '#94a3b8', fontFamily: 'Plus Jakarta Sans' }}
                      axisLine={false} tickLine={false}
                    />
                    <YAxis
                      tick={{ fontSize: 10, fill: '#94a3b8', fontFamily: 'JetBrains Mono' }}
                      axisLine={false} tickLine={false} allowDecimals={false}
                    />
                    <Tooltip content={<ChartTooltip />} cursor={{ stroke: '#e2e8f0', strokeWidth: 1 }} />
                    <Area
                      type="monotone" dataKey="count"
                      stroke="#6366f1" strokeWidth={2}
                      fill="url(#grad)"
                      dot={false}
                      activeDot={{ r: 4, fill: '#6366f1', stroke: '#fff', strokeWidth: 2 }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Jobs table or empty state */}
            <div
              ref={tableRef}
              className="opacity-0 animate-fade-up"
              style={{ animationDelay: '350ms', animationFillMode: 'forwards' }}
            >
              {jobs.length === 0
                ? <EmptyState />
                : <JobsTable
                    jobs={jobs}
                    onDelete={handleDelete}
                    filter={activeFilter}
                    onFilterChange={setActiveFilter}
                  />
              }
            </div>
          </>
        )}
      </main>
    </div>
  )
}
