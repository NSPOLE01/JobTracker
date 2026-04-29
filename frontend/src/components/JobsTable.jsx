import React, { useState } from 'react'
import { deleteJob } from '../api'
import StatusBadge, { STATUS_CONFIG } from './StatusBadge'
import StatusSelect from './StatusSelect'
import CompanyTimeline from './CompanyTimeline'

function formatDate(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function CompanyAvatar({ name }) {
  const letter = name?.[0]?.toUpperCase() ?? '?'
  const colors = ['bg-sky-100 text-sky-700', 'bg-violet-100 text-violet-700', 'bg-amber-100 text-amber-700',
    'bg-emerald-100 text-emerald-700', 'bg-rose-100 text-rose-700', 'bg-indigo-100 text-indigo-700']
  const color = colors[(letter.charCodeAt(0) || 0) % colors.length]
  return (
    <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0 ${color}`}>
      {letter}
    </div>
  )
}

const FILTER_LABELS = {
  all:                  'All statuses',
  interviews:           'Interviews',
  ...Object.fromEntries(Object.entries(STATUS_CONFIG).map(([k, v]) => [k, v.label])),
}
const STATUSES = ['all', 'interviews', ...Object.keys(STATUS_CONFIG)]

function matchesFilter(job, filter) {
  if (filter === 'all')        return true
  if (filter === 'interviews') return job.status === 'phone_screen' || job.status === 'interview_scheduled'
  return job.status === filter
}

export default function JobsTable({ jobs, onDelete, onStatusChange, filter: externalFilter, onFilterChange }) {
  const [internalFilter, setInternalFilter] = useState('all')
  const [search, setSearch]       = useState('')
  const [deletingId, setDeletingId] = useState(null)
  const [selectedJob, setSelectedJob] = useState(null)

  const filter    = externalFilter !== undefined ? externalFilter : internalFilter
  const setFilter = (v) => {
    if (onFilterChange) {
      onFilterChange(v)
    } else {
      setInternalFilter(v)
    }
  }

  const filtered = jobs.filter((j) => {
    const matchStatus = matchesFilter(j, filter)
    const q = search.toLowerCase()
    const matchSearch = !q ||
      j.company?.toLowerCase().includes(q) ||
      j.role?.toLowerCase().includes(q)
    return matchStatus && matchSearch
  })

  const handleDelete = async (e, id) => {
    e.stopPropagation()
    setDeletingId(id)
    try {
      await deleteJob(id)
      onDelete?.(id)
    } catch {
      /* swallow */
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <>
    {selectedJob && (
      <CompanyTimeline job={selectedJob} onClose={() => setSelectedJob(null)} />
    )}
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
      {/* Toolbar */}
      <div className="px-5 py-3.5 border-b border-slate-100 flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <h2 className="font-semibold text-slate-800 text-sm">
          Applications
          <span className="ml-2 font-mono text-slate-400 text-xs">{filtered.length}</span>
        </h2>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Search */}
          <label className="relative flex items-center">
            <svg className="absolute left-2.5 w-3.5 h-3.5 text-slate-400 pointer-events-none" fill="none"
              viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round"
                d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
            </svg>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search…"
              className="pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-400/30 focus:border-indigo-300 w-36 placeholder:text-slate-400"
            />
          </label>

          {/* Status filter */}
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-400/30 text-slate-600 cursor-pointer"
          >
            {STATUSES.map((s) => (
              <option key={s} value={s}>{FILTER_LABELS[s] ?? s}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        {filtered.length === 0 ? (
          <div className="py-20 text-center">
            <p className="text-3xl mb-2">📭</p>
            <p className="text-slate-400 text-sm">No applications match your filter</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100">
                {['Company', 'Role', 'Status', 'Date', 'Preview'].map((h) => (
                  <th key={h}
                    className="text-left text-[10px] font-bold text-slate-400 uppercase tracking-widest px-5 py-2.5 bg-slate-50/60"
                  >
                    {h}
                  </th>
                ))}
                <th className="bg-slate-50/60 w-10" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filtered.map((job) => (
                <React.Fragment key={job.id}>
                  <tr
                    key={job.id}
                    onClick={() => setSelectedJob(job)}
                    className="hover:bg-slate-50/80 transition-colors cursor-pointer group"
                  >
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-2.5">
                        <CompanyAvatar name={job.company} />
                        <span className="font-medium text-slate-800 text-sm whitespace-nowrap">
                          {job.company || '—'}
                        </span>
                      </div>
                    </td>
                    <td className="px-5 py-3.5 max-w-[200px]">
                      <span className="text-slate-600 text-sm truncate block">{job.role || '—'}</span>
                    </td>
                    <td className="px-5 py-3.5 whitespace-nowrap">
                      <StatusSelect job={job} onChange={onStatusChange} />
                    </td>
                    <td className="px-5 py-3.5 whitespace-nowrap">
                      <span className="font-mono text-slate-400 text-xs">{formatDate(job.email_date)}</span>
                    </td>
                    <td className="px-5 py-3.5 max-w-[260px] hidden lg:table-cell">
                      <p className="text-slate-400 text-xs truncate">{job.snippet || '—'}</p>
                    </td>
                    <td className="px-3 py-3.5 text-right">
                      <button
                        onClick={(e) => handleDelete(e, job.id)}
                        disabled={deletingId === job.id}
                        className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded-lg hover:bg-red-50 text-slate-300 hover:text-red-400"
                      >
                        {deletingId === job.id
                          ? <span className="block w-3.5 h-3.5 border border-current border-t-transparent rounded-full animate-spin" />
                          : (
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          )
                        }
                      </button>
                    </td>
                  </tr>

                </React.Fragment>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
    </>
  )
}
