import { useEffect, useState } from 'react'
import { obtenerHistorial } from '../../services/historial'
import { obtenerMusicos } from '../../services/libranzas'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'

const ACCION_LABELS = {
  CREAR_LIBRANZA: { label: 'Libranza asignada', color: 'text-green-700 bg-green-50' },
  MODIFICAR_LIBRANZA: { label: 'Libranza modificada', color: 'text-amber-700 bg-amber-50' },
  ELIMINAR_LIBRANZA: { label: 'Libranza eliminada', color: 'text-red-700 bg-red-50' },
  LIBRANZA_PENDIENTE: { label: 'Quedó pendiente', color: 'text-amber-700 bg-amber-50' },
  LIBRANZA_PENDIENTE_RESUELTA: { label: 'Pendiente resuelta', color: 'text-blue-700 bg-blue-50' },
  CREAR_PROYECTO: { label: 'Proyecto creado', color: 'text-slate-700 bg-slate-100' },
  MODIFICAR_PROYECTO: { label: 'Proyecto modificado', color: 'text-slate-700 bg-slate-100' },
  ELIMINAR_PROYECTO: { label: 'Proyecto eliminado', color: 'text-red-700 bg-red-50' },
  CREAR_TEMPORADA: { label: 'Temporada creada', color: 'text-blue-700 bg-blue-50' },
  CREAR_MUSICO: { label: 'Músico añadido', color: 'text-slate-700 bg-slate-100' },
  MODIFICAR_MUSICO: { label: 'Músico modificado', color: 'text-slate-700 bg-slate-100' },
  MODIFICAR_ROTACION: { label: 'Rotación modificada', color: 'text-purple-700 bg-purple-50' },
}

const TIPO_LIBRANZA = { proyecto: 'proyecto', parte: 'parte', obra: 'obra' }

export default function Historial() {
  const [entradas, setEntradas] = useState([])
  const [musicos, setMusicos] = useState([])
  const [cargando, setCargando] = useState(true)
  const [expandida, setExpandida] = useState(null)
  const [filtro, setFiltro] = useState('')

  useEffect(() => {
    async function cargar() {
      const [hist, ms] = await Promise.all([obtenerHistorial(), obtenerMusicos()])
      setEntradas(hist)
      setMusicos(ms)
      setCargando(false)
    }
    cargar()
  }, [])

  function nombreMusico(uid) {
    const m = musicos.find(m => m.id === uid)
    return m ? `${m.apellidos}, ${m.nombre}` : uid
  }

  function descripcionEntrada(e) {
    const datos = e.datos || {}
    if (e.accion === 'CREAR_LIBRANZA' || e.accion === 'LIBRANZA_PENDIENTE_RESUELTA') {
      return `${nombreMusico(datos.musicoId)} — ${datos.tipo || ''}`
        + (datos.obraTitulo ? ` "${datos.obraTitulo}"` : '')
        + (datos.parteNumero ? ` (Parte ${datos.parteNumero})` : '')
    }
    if (e.accion === 'ELIMINAR_LIBRANZA') {
      return `${nombreMusico(datos.musicoId)} — ${datos.tipo || ''}`
    }
    if (e.accion === 'LIBRANZA_PENDIENTE') {
      return `${nombreMusico(datos.musicoId)} queda pendiente (${datos.tipo})`
    }
    if (e.accion === 'CREAR_PROYECTO' || e.accion === 'MODIFICAR_PROYECTO') {
      return datos.nombre || datos.despues?.nombre || ''
    }
    if (e.accion === 'CREAR_MUSICO' || e.accion === 'MODIFICAR_MUSICO') {
      return `${datos.apellidos || ''}, ${datos.nombre || ''}`
    }
    return ''
  }

  const entradasFiltradas = filtro
    ? entradas.filter(e =>
        e.accion?.includes(filtro.toUpperCase()) ||
        descripcionEntrada(e).toLowerCase().includes(filtro.toLowerCase()) ||
        e.usuarioNombre?.toLowerCase().includes(filtro.toLowerCase()) ||
        e.motivo?.toLowerCase().includes(filtro.toLowerCase())
      )
    : entradas

  if (cargando) return <div className="flex items-center justify-center h-64 text-slate-400 text-sm">Cargando...</div>

  return (
    <div className="p-4 max-w-lg mx-auto">
      <div className="mb-4">
        <h2 className="text-lg font-semibold text-slate-800">Historial</h2>
        <p className="text-xs text-slate-400">{entradas.length} registros totales</p>
      </div>

      <input
        className="w-full border border-slate-300 rounded-xl px-3 py-2.5 text-sm mb-4"
        placeholder="Buscar por músico, acción, motivo..."
        value={filtro}
        onChange={e => setFiltro(e.target.value)}
      />

      {entradasFiltradas.length === 0 ? (
        <p className="text-sm text-slate-400 text-center py-8">Sin registros.</p>
      ) : (
        <div className="space-y-2">
          {entradasFiltradas.map(e => {
            const meta = ACCION_LABELS[e.accion] || { label: e.accion, color: 'text-slate-700 bg-slate-100' }
            const desc = descripcionEntrada(e)
            const isOpen = expandida === e.id
            return (
              <button
                key={e.id}
                onClick={() => setExpandida(isOpen ? null : e.id)}
                className="w-full text-left bg-white rounded-xl border border-slate-200 px-3 py-3 active:bg-slate-50"
              >
                <div className="flex items-start gap-2">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium shrink-0 ${meta.color}`}>
                    {meta.label}
                  </span>
                  <div className="flex-1 min-w-0">
                    {desc && <p className="text-sm text-slate-700 truncate">{desc}</p>}
                    <p className="text-xs text-slate-400 mt-0.5">
                      {e.fecha?.toDate ? format(e.fecha.toDate(), "d MMM yyyy · HH:mm", { locale: es }) : '—'}
                      {' · '}{e.usuarioNombre}
                    </p>
                    {e.motivo && <p className="text-xs text-slate-500 italic mt-0.5">"{e.motivo}"</p>}
                  </div>
                </div>
                {isOpen && (
                  <div className="mt-2 pt-2 border-t border-slate-100">
                    <pre className="text-xs text-slate-500 whitespace-pre-wrap font-mono bg-slate-50 rounded p-2 overflow-x-auto">
                      {JSON.stringify(e.datos, null, 2)}
                    </pre>
                  </div>
                )}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
