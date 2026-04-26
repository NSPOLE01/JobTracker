export const STATUS_CONFIG = {
  applied:              { label: 'Applied',        cls: 'bg-sky-50 text-sky-700 ring-sky-200' },
  in_review:            { label: 'In Review',      cls: 'bg-slate-100 text-slate-600 ring-slate-200' },
  phone_screen:         { label: 'Phone Screen',   cls: 'bg-violet-50 text-violet-700 ring-violet-200' },
  interview_scheduled:  { label: 'Interview',      cls: 'bg-amber-50 text-amber-700 ring-amber-200' },
  offer:                { label: 'Offer ✦',        cls: 'bg-emerald-50 text-emerald-700 ring-emerald-200' },
  rejected:             { label: 'Rejected',       cls: 'bg-red-50 text-red-600 ring-red-200' },
  withdrawn:            { label: 'Withdrawn',      cls: 'bg-slate-50 text-slate-400 ring-slate-200' },
}

export default function StatusBadge({ status }) {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.applied
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ring-1 ${cfg.cls}`}>
      {cfg.label}
    </span>
  )
}
