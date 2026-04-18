import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './context/AuthContext'

import Login from './pages/Login'
import AdminLayout from './pages/admin/AdminLayout'
import Dashboard from './pages/admin/Dashboard'
import Musicos from './pages/admin/Musicos'
import Temporadas from './pages/admin/Temporadas'
import Proyectos from './pages/admin/Proyectos'
import NuevoProyecto from './pages/admin/NuevoProyecto'
import EditarProyecto from './pages/admin/EditarProyecto'
import ProyectoDetalle from './pages/admin/ProyectoDetalle'
import GestionLibranzas from './pages/admin/GestionLibranzas'
import Rotacion from './pages/admin/Rotacion'
import Historial from './pages/admin/Historial'

import MusicoLayout from './pages/musico/MusicoLayout'
import MisLibranzas from './pages/musico/MisLibranzas'
import RotacionMusico from './pages/musico/Rotacion'

function RutaProtegida({ children, soloAdmin = false }) {
  const { usuario, cargando } = useAuth()
  if (cargando) return <div className="flex items-center justify-center min-h-screen text-slate-500">Cargando...</div>
  if (!usuario) return <Navigate to="/login" replace />
  if (soloAdmin && usuario.rol !== 'admin') return <Navigate to="/musico" replace />
  if (!soloAdmin && usuario.rol === 'admin') return <Navigate to="/admin" replace />
  return children
}

export default function App() {
  const { usuario, cargando } = useAuth()

  if (cargando) return (
    <div className="flex items-center justify-center min-h-screen bg-slate-50">
      <div className="text-slate-400 text-sm">Cargando...</div>
    </div>
  )

  return (
    <BrowserRouter>
      <Routes>
        <Route
          path="/login"
          element={!usuario
            ? <Login />
            : <Navigate to={usuario.rol === 'admin' ? '/admin' : '/musico'} replace />}
        />

        {/* Rutas del músico */}
        <Route path="/musico" element={<RutaProtegida><MusicoLayout /></RutaProtegida>}>
          <Route index element={<MisLibranzas />} />
          <Route path="rotacion" element={<RotacionMusico />} />
        </Route>

        {/* Rutas del admin */}
        <Route path="/admin" element={<RutaProtegida soloAdmin><AdminLayout /></RutaProtegida>}>
          <Route index element={<Dashboard />} />
          <Route path="musicos" element={<Musicos />} />
          <Route path="temporadas" element={<Temporadas />} />
          <Route path="proyectos" element={<Proyectos />} />
          <Route path="proyectos/nuevo" element={<NuevoProyecto />} />
          <Route path="proyectos/:id" element={<ProyectoDetalle />} />
          <Route path="proyectos/:id/editar" element={<EditarProyecto />} />
          <Route path="proyectos/:id/libranzas" element={<GestionLibranzas />} />
          <Route path="rotacion" element={<Rotacion />} />
          <Route path="historial" element={<Historial />} />
          <Route path="mis-libranzas" element={<MisLibranzas />} />
        </Route>

        <Route
          path="*"
          element={<Navigate to={usuario?.rol === 'admin' ? '/admin' : '/musico'} replace />}
        />
      </Routes>
    </BrowserRouter>
  )
}
