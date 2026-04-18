import { Outlet, useNavigate, NavLink } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'

const navItems = [
  { to: '/musico', label: 'Proyectos', icon: '🎻', end: true },
  { to: '/musico/rotacion', label: 'Rotación', icon: '🔄' },
]

export default function MusicoLayout() {
  const { usuario, logout } = useAuth()
  const navigate = useNavigate()

  async function handleLogout() {
    await logout()
    navigate('/login')
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <header className="bg-blue-900 text-white px-4 py-3 flex items-center justify-between sticky top-0 z-10">
        <span className="font-semibold text-sm">🎻 Libranzas</span>
        <div className="flex items-center gap-3">
          <span className="text-blue-200 text-xs truncate max-w-36">
            {usuario?.nombre} {usuario?.apellidos}
          </span>
          {usuario?.rol === 'admin' && (
            <button
              onClick={() => navigate('/admin')}
              className="text-xs bg-blue-700 text-white px-2 py-1 rounded-lg font-medium"
            >
              → Admin
            </button>
          )}
          <button
            onClick={handleLogout}
            className="text-xs text-blue-300 hover:text-white transition-colors"
          >
            Salir
          </button>
        </div>
      </header>
      <main className="flex-1 overflow-auto pb-20">
        <Outlet />
      </main>
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 flex justify-around items-center h-16 z-10">
        {navItems.map(item => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) =>
              `flex flex-col items-center gap-0.5 px-2 py-1 rounded-lg transition-colors min-w-0 ${
                isActive ? 'text-blue-900' : 'text-slate-400'
              }`
            }
          >
            <span className="text-lg leading-none">{item.icon}</span>
            <span className="text-[10px] font-medium leading-none">{item.label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  )
}
