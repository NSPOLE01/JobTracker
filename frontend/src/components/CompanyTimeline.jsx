import { useEffect, useState } from 'react'
import { getJobEvents, deleteJobEvent } from '../api'
import StatusBadge, { STATUS_CONFIG } from './StatusBadge'

const STATUS_DOT = {
  applied:             'bg-sky-400',
  in_review:           'bg-slate-400',
  phone_screen:        'bg-violet-400',
  interview_scheduled: 'bg-amber-400',
  offer:               'bg-emerald-400',
  rejected:            'bg-red-400',
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
    <div className={`w-11 h-11 rounded-xl flex items-center justify-center text-base font-bold flex-shrink-0 ${color}`}>
      {letter}
    </div>
  )
}

export default function CompanyTimeline({ job, onClose }) {
  const [events, setEvents]       = useState([])
  const [loading, setLoading]     = useState(true)
  const [deletingId, setDeletingId] = useState(null)

  useEffect(() => {
    getJobEvents(job.id)
      .then(r => setEvents(r.data))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [job.id])

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  const handleDeleteEvent = async (eventId) => {
    setDeletingId(eventId)
    try {
      await deleteJobEvent(job.id, eventId)
      setEvents((prev) => prev.filter((e) => e.id !== eventId))
    } catch {}
    finally { setDeletingId(null) }
  }

  return (
    <>
      <div
        className="fixed inset-0 bg-slate-900/25 backdrop-blur-[2px] z-40"
        onClick={onClose}
      />
      <div className="fixed right-0 top-0 h-full w-full max-w-[420px] bg-white shadow-2xl z-50 flex flex-col animate-slide-in-right">

        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-100 flex items-start gap-3.5">
          <CompanyAvatar name={job.company} />
          <div className="flex-1 min-w-0">
            <h2 className="font-semibold text-slate-900 text-base leading-tight truncate">
              {job.company || '—'}
            </h2>
            <p className="text-slate-500 text-sm truncate mt-0.5">
              {job.role || 'Unknown role'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="mt-0.5 p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Current status pill */}
        <div className="px-6 py-3 bg-slate-50 border-b border-slate-100 flex items-center gap-2.5">
          <span className="text-xs text-slate-400 font-medium">Current status</span>
          <StatusBadge status={job.status} />
          {job.email_date && (
            <span className="ml-auto font-mono text-slate-400 text-xs">{formatDate(job.email_date)}</span>
          )}
        </div>

        {/* Timeline body */}
        <div className="flex-1 overflow-y-auto px-6 py-6">
          {loading ? (
            <div className="flex justify-center py-16">
              <span className="w-6 h-6 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : events.length === 0 ? (
            <div className="text-center py-16">
              <p className="text-2xl mb-3">📭</p>
              <p className="text-slate-500 text-sm font-medium">No timeline events yet</p>
              <p className="text-slate-400 text-xs mt-1 leading-relaxed max-w-[240px] mx-auto">
                Events are recorded on new scans going forward. Run a reset-and-seed to backfill.
              </p>
            </div>
          ) : (
            <>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-5">
                Activity — {events.length} event{events.length !== 1 ? 's' : ''}
              </p>
              <ol>
                {events.map((event, i) => {
                  const isLast = i === events.length - 1
                  const dot = STATUS_DOT[event.status] || 'bg-slate-300'
                  return (
                    <li key={event.id} className="relative flex gap-4">
                      {/* Spine */}
                      <div className="flex flex-col items-center">
                        <span className={`w-3 h-3 rounded-full flex-shrink-0 mt-1 ring-2 ring-white ${dot}`} />
                        {!isLast && <span className="w-px flex-1 bg-slate-100 my-1" />}
                      </div>

                      {/* Content */}
                      <div className={`pb-6 min-w-0 flex-1 ${isLast ? 'pb-2' : ''}`}>
                        <div className="flex items-center gap-2 flex-wrap mb-1.5 group/event">
                          <StatusBadge status={event.status} />
                          <span className="font-mono text-slate-400 text-xs">{formatDate(event.email_date)}</span>
                          <button
                            onClick={() => handleDeleteEvent(event.id)}
                            disabled={deletingId === event.id}
                            className="ml-auto opacity-0 group-hover/event:opacity-100 transition-opacity p-1 rounded hover:bg-red-50 text-slate-300 hover:text-red-400"
                          >
                            {deletingId === event.id
                              ? <span className="block w-3 h-3 border border-current border-t-transparent rounded-full animate-spin" />
                              : <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            }
                          </button>
                        </div>
                        {event.snippet && (
                          <p className="text-slate-500 text-xs leading-relaxed line-clamp-3">
                            {event.snippet}
                          </p>
                        )}
                      </div>
                    </li>
                  )
                })}
              </ol>
            </>
          )}
        </div>
      </div>
    </>
  )
}
