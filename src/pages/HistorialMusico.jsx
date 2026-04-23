import { useEffect, useState } from 'react'
import { obtenerHistorialLibranzasMusico, obtenerProyecto, obtenerMusico } from '../services/libranzas'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { calcularRetenes } from '../utils/reten'

const TIPO_BADGE = {
  proyecto: 'bg-green-100 text-green-700',
  parte: 'bg-amber-100 text-amber-700',
  obra: 'bg-blue-100 text-blue-700',
}

function etiqueta(lib) {
  if (lib.tipo === 'proyecto') return 'Proyecto completo'
  if (lib.tipo === 'parte') return `Parte ${lib.parteNumero}`
  return `${lib.obraTitulo || 'Obra'}${lib.parteNumero ? ` (P${lib.parteNumero})` : ''}`
}

export default function HistorialMusico({ musicoId, backLink, backLabel }) {
  const [musico, setMusico] = useState(null)
  const [grupos, setGrupos] = useState([])
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    async function cargar() {
      try {
        const [m, libs] = await Promise.all([
          obtenerMusico(musicoId),
          obtenerHistorialLibranzasMusico(musicoId),
        ])
        setMusico(m)

        // Agrupar por proyecto
        const proyIds = [...new Set(libs.map(l => l.proyectoId).filter(Boolean))]
        const proyectos = {}
        await Promise.all(proyIds.map(async pid => {
          proyectos[pid] = await obtenerProyecto(pid)
        }))

        const agrupado = proyIds.map(pid => ({
          proyecto: proyectos[pid],
          libranzas: libs.filter(l => l.proyectoId === pid),
        })).sort((a, b) => {
          const fa = a.proyecto?.fechaInicio?.toDate?.() || 0
          const fb = b.proyecto?.fechaInicio?.toDate?.() || 0
          return fb - fa
        })

        setGrupos(agrupado)
      } catch (e) {
        console.error('Error cargando historial:', e)
      } finally {
        setCargando(false)
      }
    }
    cargar()
  }, [musicoId])

  if (cargando) return (
    <div className="flex items-center justify-center h-64 text-slate-400 text-sm">Cargando...</div>
  )

  return (
    <div className="p-4 max-w-lg mx-auto pb-8">
      {backLink && (
        <a href={backLink} className="text-slate-400 text-sm flex items-center gap-1 mb-4">‹ {backLabel}</a>
      )}
      <div className="mb-4">
        <h2 className="text-lg font-semibold text-slate-800">
          {musico ? `${musico.apellidos}, ${musico.nombre}` : 'Historial'}
        </h2>
        <p className="text-sm text-slate-500">Historial de libranzas</p>
      </div>

      {grupos.length === 0 ? (
        <div className="text-center py-12 text-slate-400">
          <p className="text-3xl mb-2">📋</p>
          <p className="text-sm">Sin libranzas registradas.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {grupos.map(({ proyecto, libranzas }) => (
            <div key={proyecto?.id} className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-100">
                <p className="font-medium text-slate-800 text-sm">{proyecto?.nombre || '—'}</p>
                {proyecto?.fechaInicio && (
                  <p className="text-xs text-slate-400 mt-0.5">
                    {format(proyecto.fechaInicio.toDate(), "d 'de' MMMM yyyy", { locale: es })}
                    {proyecto.fechaFin ? ` – ${format(proyecto.fechaFin.toDate(), "d 'de' MMMM yyyy", { locale: es })}` : ''}
                  </p>
                )}
              </div>
              <div className="divide-y divide-slate-50">
                {(() => {
                  const retenes = calcularRetenes(libranzas)
                  return libranzas.map(lib => (
                    <div key={lib.id} className="flex items-center gap-2 px-4 py-2.5">
                      <span className="flex-1 text-sm text-slate-600">{etiqueta(lib)}</span>
                      <div className="flex items-center gap-1">
                        {retenes.has(lib.id) && (
                          <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-orange-100 text-orange-700">Retén</span>
                        )}
                        {lib.esPermiso ? (
                          <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-red-100 text-red-700">
                            {lib.motivoPermiso ? `Permiso: ${lib.motivoPermiso}` : 'Permiso / Baja'}
                          </span>
                        ) : (
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${TIPO_BADGE[lib.tipo]}`}>
                            {etiqueta(lib)}
                          </span>
                        )}
                      </div>
                    </div>
                  ))
                })()}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
