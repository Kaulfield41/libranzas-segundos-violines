import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { obtenerTemporadaActiva, obtenerProyectos } from '../../services/libranzas'
import { format, isAfter, isBefore, isToday } from 'date-fns'
import { es } from 'date-fns/locale'

function estadoProyecto(p) {
  const hoy = new Date()
  const ini = p.fechaInicio?.toDate?.()
  const fin = p.fechaFin?.toDate?.()
  if (!ini) return 'sin-fecha'
  if (isToday(ini) || (isAfter(hoy, ini) && isBefore(hoy, fin || ini))) return 'en-curso'
  if (isBefore(hoy, ini)) return 'próximo'
  return 'finalizado'
}

const ESTADO_BADGE = {
  'en-curso': 'bg-green-100 text-green-700',
  'próximo': 'bg-blue-100 text-blue-700',
  'finalizado': 'bg-slate-100 text-slate-500',
  'sin-fecha': 'bg-slate-100 text-slate-400',
}

export default function Dashboard() {
  const [temporada, setTemporada] = useState(null)
  const [proyectos, setProyectos] = useState([])
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    async function cargar() {
      try {
        const t = await obtenerTemporadaActiva()
        if (t) {
          setTemporada(t)
          const ps = await obtenerProyectos(t.id)
          setProyectos(ps)
        }
      } catch (e) {
        console.error('Error cargando dashboard:', e)
      } finally {
        setCargando(false)
      }
    }
    cargar()
  }, [])

  if (cargando) return (
    <div className="flex items-center justify-center h-64 text-slate-400 text-sm">Cargando...</div>
  )

  const proximos = proyectos.filter(p => ['en-curso', 'próximo'].includes(estadoProyecto(p))).slice(0, 5)

  return (
    <div className="p-4 max-w-lg mx-auto">
      {!temporada ? (
        <div className="text-center py-12">
          <p className="text-4xl mb-3">🗓️</p>
          <p className="text-slate-600 mb-4">No hay temporada activa.</p>
          <Link to="/admin/temporadas" className="text-blue-700 font-medium text-sm">
            Crear temporada →
          </Link>
        </div>
      ) : (
        <>
          <div className="bg-blue-900 text-white rounded-2xl p-4 mb-4">
            <p className="text-blue-300 text-xs">Temporada activa</p>
            <p className="font-semibold text-lg">{temporada.nombre}</p>
            {temporada.fechaInicio && (
              <p className="text-blue-300 text-xs mt-1">
                {format(temporada.fechaInicio.toDate(), "MMM yyyy", { locale: es })} –{' '}
                {temporada.fechaFin ? format(temporada.fechaFin.toDate(), "MMM yyyy", { locale: es }) : '—'}
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3 mb-4">
            <Link to="/admin/proyectos" className="bg-white rounded-2xl border border-slate-200 p-4 text-center active:bg-slate-50">
              <p className="text-2xl font-bold text-blue-900">{proyectos.length}</p>
              <p className="text-xs text-slate-500 mt-1">Proyectos</p>
            </Link>
            <Link to="/admin/rotacion" className="bg-white rounded-2xl border border-slate-200 p-4 text-center active:bg-slate-50">
              <p className="text-2xl">🔄</p>
              <p className="text-xs text-slate-500 mt-1">Rotación</p>
            </Link>
          </div>

          <h3 className="text-sm font-semibold text-slate-700 mb-2">Próximos proyectos</h3>
          {proximos.length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-6">No hay proyectos próximos.</p>
          ) : (
            <div className="space-y-2">
              {proximos.map(p => {
                const estado = estadoProyecto(p)
                return (
                  <Link
                    key={p.id}
                    to={`/admin/proyectos/${p.id}`}
                    className="flex items-center gap-3 bg-white rounded-xl border border-slate-200 px-4 py-3 active:bg-slate-50"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-800 truncate">{p.nombre}</p>
                      {p.fechaInicio && (
                        <p className="text-xs text-slate-400">
                          {format(p.fechaInicio.toDate(), "d MMM", { locale: es })}
                          {p.fechaFin ? ` – ${format(p.fechaFin.toDate(), "d MMM", { locale: es })}` : ''}
                        </p>
                      )}
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${ESTADO_BADGE[estado]}`}>
                      {estado}
                    </span>
                  </Link>
                )
              })}
            </div>
          )}
        </>
      )}
    </div>
  )
}
