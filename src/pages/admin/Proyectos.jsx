import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { obtenerTemporadaActiva, obtenerProyectos } from '../../services/libranzas'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'

export default function Proyectos() {
  const navigate = useNavigate()
  const [temporada, setTemporada] = useState(null)
  const [proyectos, setProyectos] = useState([])
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    async function cargar() {
      try {
        const t = await obtenerTemporadaActiva()
        if (t) {
          setTemporada(t)
          setProyectos(await obtenerProyectos(t.id))
        }
      } catch (e) {
        console.error('Error cargando proyectos:', e)
      } finally {
        setCargando(false)
      }
    }
    cargar()
  }, [])

  if (cargando) return (
    <div className="flex items-center justify-center h-64 text-slate-400 text-sm">Cargando...</div>
  )

  return (
    <div className="p-4 max-w-lg mx-auto">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-semibold text-slate-800">Proyectos</h2>
          {temporada && <p className="text-xs text-slate-400">{temporada.nombre}</p>}
        </div>
        {temporada && (
          <button
            onClick={() => navigate('/admin/proyectos/nuevo')}
            className="bg-blue-900 text-white text-sm px-3 py-1.5 rounded-lg font-medium"
          >
            + Nuevo
          </button>
        )}
      </div>

      {!temporada ? (
        <p className="text-center text-slate-400 py-8 text-sm">
          No hay temporada activa. <Link to="/admin/temporadas" className="text-blue-700">Crear una</Link>.
        </p>
      ) : proyectos.length === 0 ? (
        <p className="text-center text-slate-400 py-8 text-sm">No hay proyectos aún.</p>
      ) : (
        <div className="space-y-2">
          {proyectos.map(p => (
            <Link
              key={p.id}
              to={`/admin/proyectos/${p.id}`}
              className="flex items-center gap-3 bg-white rounded-xl border border-slate-200 px-4 py-3 active:bg-slate-50"
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-800 truncate">{p.nombre}</p>
                <p className="text-xs text-slate-400">
                  {p.fechaInicio ? format(p.fechaInicio.toDate(), "d MMM", { locale: es }) : '—'}
                  {p.fechaFin
                    ? ` – ${format(p.fechaFin.toDate(), "d MMM yyyy", { locale: es })}`
                    : p.fechaInicio ? ` (${format(p.fechaInicio.toDate(), "yyyy", { locale: es })})` : ''}
                </p>
              </div>
              {p.musicosNecesarios && (
                <span className="text-xs text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
                  {p.musicosNecesarios} músicos
                </span>
              )}
              <span className="text-slate-300">›</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
