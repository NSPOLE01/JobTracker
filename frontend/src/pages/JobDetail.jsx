import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { getJob, getJobEvents, deleteJobEvent } from '../api'
import StatusBadge from '../components/StatusBadge'

const STATUS_DOT = {
  applied:             { dot: 'bg-sky-400',     ring: 'ring-sky-200'     },
  in_review:           { dot: 'bg-slate-400',   ring: 'ring-slate-200'   },
  phone_screen:        { dot: 'bg-violet-400',  ring: 'ring-violet-200'  },
  interview_scheduled: { dot: 'bg-amber-400',   ring: 'ring-amber-200'   },
  offer:               { dot: 'bg-emerald-400', ring: 'ring-emerald-200' },
  rejected:            { dot: 'bg-red-400',     ring: 'ring-red-200'     },
}

function formatDate(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function CompanyAvatar({ name }) {
  const letter = name?.[0]?.toUpperCase() ?? '?'
  const colors = [
    'bg-sky-100 text-sky-700', 'bg-violet-100 text-violet-700',
    'bg-amber-100 text-amber-700', 'bg-emerald-100 text-emerald-700',
    'bg-rose-100 text-rose-700', 'bg-indigo-100 text-indigo-700',
  ]
  const color = colors[(letter.charCodeAt(0) || 0) % colors.length]
  return (
    <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-xl font-bold flex-shrink-0 ${color}`}>
      {letter}
    </div>
  )
}

export default function JobDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [job, setJob]             = useState(null)
  const [events, setEvents]       = useState([])
  const [loading, setLoading]     = useState(true)
  const [deletingId, setDeletingId] = useState(null)

  useEffect(() => {
    Promise.all([getJob(id), getJobEvents(id)])
      .then(([jobRes, eventsRes]) => {
        setJob(jobRes.data)
        setEvents(eventsRes.data)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [id])

  const handleDeleteEvent = async (eventId) => {
    setDeletingId(eventId)
    try {
      await deleteJobEvent(id, eventId)
      setEvents((prev) => prev.filter((e) => e.id !== eventId))
    } catch {}
    finally { setDeletingId(null) }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <span className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!job) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <p className="text-slate-400 text-sm">Job not found.</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Nav bar */}
      <div className="bg-white border-b border-slate-100 sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center gap-3">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
            </svg>
            Back
          </button>
          <span className="text-slate-200">·</span>
          <span className="text-sm text-slate-400 truncate">{job.company}</span>
        </div>
      </div>

      <main className="max-w-6xl mx-auto px-6 py-8 space-y-6">
        {/* Company header */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
          <div className="flex items-center gap-5">
            <CompanyAvatar name={job.company} />
            <div className="flex-1 min-w-0">
              <h1 className="text-xl font-semibold text-slate-900 leading-tight">{job.company || '—'}</h1>
              <p className="text-slate-500 text-sm mt-0.5">{job.role || 'Unknown role'}</p>
            </div>
            <div className="flex flex-col items-end gap-1.5">
              <StatusBadge status={job.status} />
              <span className="font-mono text-slate-400 text-xs">{formatDate(job.email_date)}</span>
            </div>
          </div>
        </div>

        {/* Timeline */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-8">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-10">
            Application timeline — {events.length} event{events.length !== 1 ? 's' : ''}
          </p>

          {events.length === 0 ? (
            <div className="py-12 text-center">
              <p className="text-3xl mb-3">📭</p>
              <p className="text-slate-500 text-sm">No timeline events recorded yet.</p>
              <p className="text-slate-400 text-xs mt-1">Run a scan to start recording events.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <div className="flex items-start" style={{ minWidth: `${events.length * 220}px` }}>
                {events.map((event, i) => {
                  const isFirst  = i === 0
                  const isLast   = i === events.length - 1
                  const isCurrent = i === events.length - 1
                  const { dot, ring } = STATUS_DOT[event.status] || { dot: 'bg-slate-300', ring: 'ring-slate-200' }

                  return (
                    <div key={event.id} className="flex-1 flex flex-col items-center min-w-0 group/node">
                      {/* Connector line + dot row */}
                      <div className="w-full flex items-center mb-5">
                        <div className={`flex-1 h-px ${isFirst ? 'bg-transparent' : 'bg-slate-200'}`} />
                        <div className={`w-4 h-4 rounded-full flex-shrink-0 ${dot} ring-4 ring-white shadow-sm ${isCurrent ? `ring-2 ring-offset-2 ${ring}` : ''}`} />
                        <div className={`flex-1 h-px ${isLast ? 'bg-transparent' : 'bg-slate-200'}`} />
                      </div>

                      {/* Card */}
                      <div
                        onClick={() => event.email_id && window.open(`https://mail.google.com/mail/u/0/#all/${event.email_id}`, '_blank')}
                        className={`w-44 rounded-xl border p-3.5 transition-shadow hover:shadow-md ${
                          isCurrent
                            ? 'border-indigo-100 bg-gradient-to-b from-indigo-50/60 to-white'
                            : 'border-slate-100 bg-slate-50/50'
                        } ${event.email_id ? 'cursor-pointer' : ''}`}
                      >
                        <div className="flex items-start justify-between gap-1 mb-2">
                          <StatusBadge status={event.status} />
                          <button
                            onClick={() => handleDeleteEvent(event.id)}
                            disabled={deletingId === event.id}
                            className="opacity-0 group-hover/node:opacity-100 transition-opacity flex-shrink-0 p-0.5 rounded hover:bg-red-50 text-slate-300 hover:text-red-400"
                          >
                            {deletingId === event.id
                              ? <span className="block w-3 h-3 border border-current border-t-transparent rounded-full animate-spin" />
                              : <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            }
                          </button>
                        </div>
                        <p className="font-mono text-slate-400 text-[11px] mb-2">{formatDate(event.email_date)}</p>
                        {event.snippet && (
                          <p className="text-slate-500 text-xs leading-relaxed line-clamp-4">{event.snippet}</p>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
