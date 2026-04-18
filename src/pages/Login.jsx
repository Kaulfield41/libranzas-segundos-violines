import { useState } from 'react'
import { sendPasswordResetEmail } from 'firebase/auth'
import { useAuth } from '../context/AuthContext'
import { auth } from '../services/firebase'

export default function Login() {
  const { login, errorAuth } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [cargando, setCargando] = useState(false)
  const [resetEnviado, setResetEnviado] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setCargando(true)
    try {
      await login(email, password)
    } catch {
      setError('Email o contraseña incorrectos')
    } finally {
      setCargando(false)
    }
  }

  async function handleReset() {
    if (!email) { setError('Escribe tu email primero'); return }
    try {
      await sendPasswordResetEmail(auth, email)
      setResetEnviado(true)
      setError('')
    } catch {
      setError('No se encontró ese email')
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="text-4xl mb-2">🎻</div>
          <h1 className="text-2xl font-semibold text-slate-800">Libranzas</h1>
          <p className="text-slate-500 text-sm mt-1">Gestión de la sección</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              autoComplete="email"
              className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="nombre@orquesta.com"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Contraseña</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              autoComplete="current-password"
              className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="••••••••"
            />
          </div>

          {error && (
            <p className="text-red-600 text-sm bg-red-50 px-3 py-2 rounded-lg">{error}</p>
          )}
          {errorAuth && (
            <p className="text-red-600 text-sm bg-red-50 px-3 py-2 rounded-lg">{errorAuth}</p>
          )}
          {resetEnviado && (
            <p className="text-green-600 text-sm bg-green-50 px-3 py-2 rounded-lg">
              Email de recuperación enviado. Revisa tu bandeja de entrada.
            </p>
          )}

          <button
            type="submit"
            disabled={cargando}
            className="w-full bg-blue-900 text-white py-2.5 rounded-lg font-medium hover:bg-blue-800 active:bg-blue-950 transition-colors disabled:opacity-50"
          >
            {cargando ? 'Entrando...' : 'Entrar'}
          </button>

          <button
            type="button"
            onClick={handleReset}
            className="w-full text-sm text-slate-400 hover:text-slate-600 transition-colors pt-1"
          >
            ¿Olvidaste tu contraseña?
          </button>
        </form>
      </div>
    </div>
  )
}
