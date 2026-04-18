import { useEffect, useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import { obtenerTemporadaActiva, obtenerProyectos, obtenerLibranzasProyecto, obtenerMusicos } from '../../services/libranzas'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'

const TIPO_BADGE = {
  proyecto: 'bg-green-100 text-green-700',
  parte: 'bg-amber-100 text-amber-700',
  obra: 'bg-blue-100 text-blue-700',
}

export default function MisLibranzas() {
  const { usuario } = useAuth()
  const [temporada, setTemporada] = useState(null)
  const [proyectos, setProyectos] = useState([])
  const [libranzasPorProyecto, setLibranzasPorProyecto] = useState({})
  const [musicos, setMusicos] = useState([])
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    async function cargar() {
      try {
        const t = await obtenerTemporadaActiva()
        if (!t) { setCargando(false); return }
        setTemporada(t)

        const [proys, ms] = await Promise.all([
          obtenerProyectos(t.id),
          obtenerMusicos(),
        ])
        const proyOrdenados = proys.sort((a, b) => (a.fechaInicio?.toDate?.() || 0) - (b.fechaInicio?.toDate?.() || 0))
        setProyectos(proyOrdenados)
        setMusicos(ms)

        const mapa = {}
        await Promise.all(proyOrdenados.map(async p => {
          const libs = await obtenerLibranzasProyecto(p.id)
          mapa[p.id] = libs
        }))
        setLibranzasPorProyecto(mapa)
      } catch (e) {
        console.error('Error cargando:', e)
      } finally {
        setCargando(false)
      }
    }
    cargar()
  }, [usuario.id])

  if (cargando) return (
    <div className="flex items-center justify-center h-64 text-slate-400 text-sm">Cargando...</div>
  )

  if (!temporada) return (
    <div className="p-6 text-center text-slate-500">
      <p className="text-4xl mb-3">🗓️</p>
      <p>No hay temporada activa.</p>
    </div>
  )

  function nombreMusico(id) {
    const m = musicos.find(m => m.id === id)
    return m ? `${m.apellidos}, ${m.nombre}` : '—'
  }

  function etiquetaLib(lib) {
    if (lib.tipo === 'proyecto') return '😊 Proyecto'
    if (lib.tipo === 'parte') return `Parte ${lib.parteNumero}`
    const titulo = lib.obraTitulo || 'Obra'
    return `${titulo} (P${lib.parteNumero})`
  }

  return (
    <div className="p-4 max-w-lg mx-auto">
      <div className="mb-4">
        <h2 className="text-lg font-semibold text-slate-800">Proyectos</h2>
        <p className="text-sm text-slate-500">Temporada {temporada.nombre}</p>
      </div>

      {proyectos.length === 0 ? (
        <div className="text-center py-12 text-slate-400">
          <p className="text-3xl mb-2">🗓️</p>
          <p className="text-sm">No hay proyectos en esta temporada.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {proyectos.map(proyecto => {
            const libs = libranzasPorProyecto[proyecto.id] || []
            return (
              <div key={proyecto.id} className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
                <div className="px-4 py-3 border-b border-slate-100">
                  <p className="font-medium text-slate-800 text-sm">{proyecto.nombre}</p>
                  {proyecto.fechaInicio && (
                    <p className="text-xs text-slate-400 mt-0.5">
                      {format(proyecto.fechaInicio.toDate(), "d 'de' MMMM", { locale: es })}
                      {proyecto.fechaFin
                        ? ` – ${format(proyecto.fechaFin.toDate(), "d 'de' MMMM yyyy", { locale: es })}`
                        : ''}
                    </p>
                  )}
                </div>
                {libs.length === 0 ? (
                  <p className="text-xs text-slate-400 px-4 py-3 text-center">Sin libranzas asignadas</p>
                ) : (
                  <div className="divide-y divide-slate-50">
                    {libs.map(lib => (
                      <div key={lib.id} className="flex items-center gap-2 px-4 py-2.5">
                        <span className="flex-1 text-sm text-slate-700">{nombreMusico(lib.musicoId)}</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${TIPO_BADGE[lib.tipo]}`}>
                          {etiquetaLib(lib)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
