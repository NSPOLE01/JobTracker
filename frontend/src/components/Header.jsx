import { useState } from 'react'
import { triggerScan } from '../api'

function RefreshIcon({ spinning }) {
  return (
    <svg
      className={`w-3.5 h-3.5 ${spinning ? 'animate-spin' : ''}`}
      fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}
    >
      <path strokeLinecap="round" strokeLinejoin="round"
        d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
    </svg>
  )
}

export default function Header({ email, lastScanned, onScanComplete }) {
  const [scanning, setScanning] = useState(false)

  const handleScan = async () => {
    setScanning(true)
    try {
      await triggerScan()
      setTimeout(() => {
        setScanning(false)
        onScanComplete?.()
      }, 4000)
    } catch {
      setScanning(false)
    }
  }

  const formatScanned = (iso) => {
    if (!iso) return null
    const d = new Date(iso)
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }

  return (
    <header className="bg-slate-900 sticky top-0 z-10 border-b border-white/5">
      <div className="max-w-6xl mx-auto px-5 h-14 flex items-center justify-between gap-4">

        {/* Brand */}
        <div className="flex items-center gap-2.5 flex-shrink-0">
          <div className="w-7 h-7 bg-indigo-500 rounded-lg flex items-center justify-center">
            <span className="font-display text-white font-bold text-sm leading-none">J</span>
          </div>
          <span className="font-display text-white font-bold text-lg tracking-tight">JobTracker</span>
        </div>

        {/* Right cluster */}
        <div className="flex items-center gap-3">
          {lastScanned && (
            <span className="hidden sm:inline text-slate-500 text-xs">
              Updated {formatScanned(lastScanned)}
            </span>
          )}

          <button
            onClick={handleScan}
            disabled={scanning}
            className="flex items-center gap-1.5 bg-indigo-500 hover:bg-indigo-400 active:bg-indigo-600 disabled:opacity-60 disabled:cursor-not-allowed text-white text-xs font-semibold px-3.5 py-2 rounded-lg transition-colors"
          >
            <RefreshIcon spinning={scanning} />
            {scanning ? 'Scanning…' : 'Scan Now'}
          </button>

          {email && (
            <div className="flex items-center gap-2 pl-1 border-l border-white/10">
              <div className="w-6 h-6 rounded-full bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center flex-shrink-0">
                <span className="text-[10px] font-bold text-indigo-300">
                  {email[0].toUpperCase()}
                </span>
              </div>
              <span className="hidden md:inline text-slate-400 text-xs max-w-[140px] truncate">
                {email}
              </span>
            </div>
          )}
        </div>

      </div>
    </header>
  )
}
