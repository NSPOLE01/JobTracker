import { useState, useEffect } from 'react'
import { getAuthStatus } from './api'
import ConnectGmail from './components/ConnectGmail'
import Dashboard from './components/Dashboard'

function Spinner() {
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center">
      <span className="w-7 h-7 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
    </div>
  )
}

export default function App() {
  const [state, setState] = useState({ loading: true, authenticated: false, email: '' })

  const checkAuth = async () => {
    try {
      const { data } = await getAuthStatus()
      setState({ loading: false, authenticated: data.authenticated, email: data.email ?? '' })
    } catch {
      setState({ loading: false, authenticated: false, email: '' })
    }
  }

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('auth') === 'success') {
      window.history.replaceState({}, '', '/')
    }
    checkAuth()
    const id = setInterval(checkAuth, 30_000)
    return () => clearInterval(id)
  }, [])

  if (state.loading)        return <Spinner />
  if (!state.authenticated) return <ConnectGmail />
  return <Dashboard email={state.email} />
}
