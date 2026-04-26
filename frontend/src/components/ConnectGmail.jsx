import { useState } from 'react'
import { getAuthUrl } from '../api'

function GoogleIcon() {
  return (
    <svg className="w-5 h-5 flex-shrink-0" viewBox="0 0 24 24">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
    </svg>
  )
}

const FEATURES = [
  { icon: '📧', text: 'Scans Gmail for job application emails automatically' },
  { icon: '🏢', text: 'Extracts company, role, and current status' },
  { icon: '📊', text: 'Visualizes your job search progress over time' },
]

export default function ConnectGmail() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const handleConnect = async () => {
    setLoading(true)
    setError(null)
    try {
      const { data } = await getAuthUrl()
      window.location.href = data.auth_url
    } catch {
      setError('Could not reach the backend. Make sure it is running on port 8000.')
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-dot-grid bg-slate-50 flex flex-col items-center justify-center p-6">
      {/* Logo mark */}
      <div
        className="opacity-0 animate-fade-up mb-10 text-center"
        style={{ animationDelay: '0ms', animationFillMode: 'forwards' }}
      >
        <div className="inline-flex items-center gap-3 mb-3">
          <div className="w-11 h-11 bg-slate-900 rounded-2xl flex items-center justify-center shadow-lg shadow-slate-900/20">
            <span className="font-display text-white font-bold text-xl">J</span>
          </div>
          <h1 className="font-display text-3xl font-bold text-slate-900 tracking-tight">
            JobTracker
          </h1>
        </div>
        <p className="text-slate-500 text-sm">Your job search, on autopilot.</p>
      </div>

      {/* Card */}
      <div
        className="opacity-0 animate-fade-up w-full max-w-sm"
        style={{ animationDelay: '80ms', animationFillMode: 'forwards' }}
      >
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xl shadow-slate-200/60 p-7">
          {/* Feature list */}
          <ul className="space-y-3.5 mb-7">
            {FEATURES.map(({ icon, text }) => (
              <li key={text} className="flex items-start gap-3">
                <span className="text-base mt-0.5 flex-shrink-0">{icon}</span>
                <span className="text-slate-600 text-sm leading-snug">{text}</span>
              </li>
            ))}
          </ul>

          <div className="border-t border-slate-100 mb-6" />

          {/* CTA */}
          <button
            onClick={handleConnect}
            disabled={loading}
            className="w-full flex items-center justify-center gap-2.5 bg-slate-900 hover:bg-slate-800 active:bg-slate-950 disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold py-3 px-5 rounded-xl transition-colors duration-150 group"
          >
            {loading ? (
              <>
                <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                Redirecting to Google…
              </>
            ) : (
              <>
                <GoogleIcon />
                Connect Gmail
                <svg
                  className="w-4 h-4 ml-auto opacity-50 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all"
                  fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                </svg>
              </>
            )}
          </button>

          {error && (
            <p className="mt-3 text-xs text-red-500 text-center">{error}</p>
          )}

          <p className="mt-4 text-xs text-center text-slate-400 leading-relaxed">
            Read-only access. Your emails are processed locally and never stored on external servers.
          </p>
        </div>
      </div>
    </div>
  )
}
