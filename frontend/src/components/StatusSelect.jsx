import { useState, useRef, useEffect } from 'react'
import { updateJobStatus } from '../api'
import StatusBadge, { STATUS_CONFIG } from './StatusBadge'

const STATUSES = Object.keys(STATUS_CONFIG)

export default function StatusSelect({ job, onChange }) {
  const [open, setOpen]     = useState(false)
  const [saving, setSaving] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    if (!open) return
    const handler = (e) => { if (!ref.current?.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const handleSelect = async (status) => {
    setOpen(false)
    if (status === job.status) return
    setSaving(true)
    try {
      await updateJobStatus(job.id, status)
      onChange(job.id, status)
    } catch {}
    finally { setSaving(false) }
  }

  return (
    <div
      ref={ref}
      className="relative inline-block"
      onClick={(e) => e.stopPropagation()}
    >
      <button
        onClick={() => setOpen((o) => !o)}
        disabled={saving}
        className="group flex items-center gap-1 focus:outline-none"
      >
        <StatusBadge status={job.status} />
        {saving ? (
          <span className="w-2.5 h-2.5 border border-slate-400 border-t-transparent rounded-full animate-spin" />
        ) : (
          <svg
            className="w-2.5 h-2.5 text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity"
            fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
          </svg>
        )}
      </button>

      {open && (
        <div className="absolute left-0 top-full mt-1.5 z-20 bg-white rounded-xl shadow-lg border border-slate-100 py-1 min-w-[168px]">
          {STATUSES.map((s) => (
            <button
              key={s}
              onClick={() => handleSelect(s)}
              className={`w-full flex items-center gap-2 px-3 py-1.5 hover:bg-slate-50 transition-colors ${s === job.status ? 'bg-slate-50' : ''}`}
            >
              <StatusBadge status={s} />
              {s === job.status && (
                <svg className="ml-auto w-3 h-3 text-indigo-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                </svg>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
