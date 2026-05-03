import { useState, useRef, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { triggerScan } from '../api'
import { useAuth } from '../App'

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

export default function Header({ email, onScanComplete }) {
  const navigate = useNavigate()
  const location = useLocation()
  const { lastScanned } = useAuth()
  const isHome = location.pathname === '/'
  const [scanning, setScanning] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)
  const profileRef = useRef(null)

  useEffect(() => {
    if (!profileOpen) return
    const handler = (e) => { if (!profileRef.current?.contains(e.target)) setProfileOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [profileOpen])

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

          {isHome ? (
            <button
              onClick={() => navigate('/flow')}
              className="flex items-center gap-1.5 text-slate-400 hover:text-white text-xs font-medium px-3 py-2 rounded-lg hover:bg-white/5 transition-colors"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
              </svg>
              Flow
            </button>
          ) : (
            <button
              onClick={() => navigate('/')}
              className="flex items-center gap-1.5 text-slate-400 hover:text-white text-xs font-medium px-3 py-2 rounded-lg hover:bg-white/5 transition-colors"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" />
              </svg>
              Dashboard
            </button>
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
            <div ref={profileRef} className="relative pl-4 border-l border-white/10">
              <button
                onClick={() => setProfileOpen(o => !o)}
                className="w-8 h-8 rounded-full bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center hover:bg-indigo-500/30 transition-colors"
              >
                <span className="text-xs font-bold text-indigo-300">
                  {email[0].toUpperCase()}
                </span>
              </button>

              <div className={`absolute left-1/2 -translate-x-1/2 top-full mt-2 bg-slate-800 border border-white/10 rounded-xl shadow-xl overflow-hidden transition-all duration-200 ${
                profileOpen ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-1 pointer-events-none'
              }`}>
                <div className="px-4 py-3 whitespace-nowrap">
                  <p className="text-slate-500 text-[10px] uppercase tracking-widest font-semibold mb-1">Signed in as</p>
                  <p className="text-slate-200 text-xs">{email}</p>
                </div>
              </div>
            </div>
          )}
        </div>

      </div>
    </header>
  )
}
