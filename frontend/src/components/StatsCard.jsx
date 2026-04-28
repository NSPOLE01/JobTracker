import { useEffect, useRef, useState } from 'react'

function useCountUp(target, duration = 900) {
  const [val, setVal] = useState(0)
  const raf = useRef(null)

  useEffect(() => {
    const start = performance.now()
    const step = (now) => {
      const p = Math.min((now - start) / duration, 1)
      const ease = 1 - Math.pow(1 - p, 3)
      setVal(Math.round(ease * target))
      if (p < 1) raf.current = requestAnimationFrame(step)
    }
    raf.current = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf.current)
  }, [target, duration])

  return val
}

const ACCENT = {
  blue:   'bg-sky-50 text-sky-600',
  purple: 'bg-violet-50 text-violet-600',
  green:  'bg-emerald-50 text-emerald-600',
  red:    'bg-red-50 text-red-500',
}

export default function StatsCard({ label, value, icon, color, delay = 0, onClick, active = false }) {
  const count = useCountUp(value ?? 0)

  return (
    <div
      onClick={onClick}
      className={`bg-white rounded-2xl border p-5 shadow-sm opacity-0 animate-fade-up transition-all duration-150
        ${onClick ? 'cursor-pointer card-lift' : ''}
        ${active ? 'border-indigo-300 ring-2 ring-indigo-100 shadow-indigo-100' : 'border-slate-100'}
      `}
      style={{ animationDelay: `${delay}ms`, animationFillMode: 'forwards' }}
    >
      <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-base mb-4 ${ACCENT[color] ?? ACCENT.blue}`}>
        {icon}
      </div>
      <p className="font-mono text-[2.6rem] leading-none font-semibold text-slate-900 mb-1 tracking-tight">
        {count}
      </p>
      <div className="flex items-center justify-between">
        <p className="text-slate-400 text-xs font-semibold uppercase tracking-widest">{label}</p>
        {onClick && (
          <span className={`text-[10px] font-medium transition-colors ${active ? 'text-indigo-500' : 'text-slate-300'}`}>
            {active ? 'Filtered ↓' : 'View →'}
          </span>
        )}
      </div>
    </div>
  )
}
