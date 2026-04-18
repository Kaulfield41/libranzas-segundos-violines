import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'

const navItems = [
  { to: '/admin', label: 'Inicio', icon: '🏠', end: true },
  { to: '/admin/proyectos', label: 'Proyectos', icon: '📋' },
  { to: '/admin/rotacion', label: 'Rotación', icon: '🔄' },
  { to: '/admin/mis-libranzas', label: 'Mis lib.', icon: '🎻' },
  { to: '/admin/musicos', label: 'Músicos', icon: '👥' },
  { to: '/admin/historial', label: 'Historial', icon: '📜' },
  { to: '/admin/temporadas', label: 'Temporadas', icon: '🗓️' },
]

export default function AdminLayout() {
  const { usuario, logout } = useAuth()
  const navigate = useNavigate()

  async function handleLogout() {
    await logout()
    navigate('/login')
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Header */}
      <header className="bg-blue-900 text-white px-4 py-3 flex items-center justify-between sticky top-0 z-10">
        <div>
          <span className="font-semibold text-sm">🎻 Libranzas</span>
          <span className="text-blue-300 text-xs ml-2">Admin</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-blue-200 text-xs truncate max-w-32">{usuario?.nombre}</span>
          <button
            onClick={handleLogout}
            className="text-xs text-blue-300 hover:text-white transition-colors"
          >
            Salir
          </button>
        </div>
      </header>

      {/* Contenido */}
      <main className="flex-1 overflow-auto pb-20">
        <Outlet />
      </main>

      {/* Nav inferior */}
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
