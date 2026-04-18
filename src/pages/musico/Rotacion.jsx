import { useEffect, useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import { obtenerTemporadaActiva, obtenerMusicos } from '../../services/libranzas'
import { obtenerEstadoCola, TIPOS_LIBRANZA } from '../../services/rotacion'

const TIPO_LABELS = {
  proyecto: 'Proyecto',
  parte: 'Parte',
  obra: 'Obra',
}

const PUESTO_BADGE = {
  normal: '',
  ayuda_solista: '🔶',
  solista: '⭐',
}

export default function RotacionMusico() {
  const { usuario } = useAuth()
  const [temporada, setTemporada] = useState(null)
  const [musicos, setMusicos] = useState([])
  const [colas, setColas] = useState({})
  const [cargando, setCargando] = useState(true)
  const [tipoActivo, setTipoActivo] = useState('proyecto')

  useEffect(() => {
    async function cargar() {
      try {
        const t = await obtenerTemporadaActiva()
        if (!t) { setCargando(false); return }
        setTemporada(t)
        const ms = await obtenerMusicos()
        setMusicos(ms)

        const colasCargadas = {}
        await Promise.all(Object.values(TIPOS_LIBRANZA).map(async tipo => {
          colasCargadas[tipo] = await obtenerEstadoCola(t.id, tipo, ms)
        }))
        setColas(colasCargadas)
      } catch (e) {
        console.error('Error cargando rotación:', e)
      } finally {
        setCargando(false)
      }
    }
    cargar()
  }, [])

  if (cargando) return (
    <div className="flex items-center justify-center h-64 text-slate-400 text-sm">Cargando...</div>
  )

  if (!temporada) return (
    <div className="p-6 text-center text-slate-500">
      <p className="text-4xl mb-3">🗓️</p>
      <p>No hay temporada activa.</p>
    </div>
  )

  const cola = colas[tipoActivo] || []

  return (
    <div className="p-4 max-w-lg mx-auto pb-8">
      <div className="mb-4">
        <h2 className="text-lg font-semibold text-slate-800">Rotación</h2>
        <p className="text-sm text-slate-500">{temporada.nombre}</p>
      </div>

      {/* Selector de cola */}
      <div className="flex rounded-xl overflow-hidden border border-slate-200 mb-4">
        {Object.entries(TIPO_LABELS).map(([tipo, label]) => (
          <button
            key={tipo}
            onClick={() => setTipoActivo(tipo)}
            className={`flex-1 py-2 text-xs font-medium transition-colors ${
              tipoActivo === tipo ? 'bg-blue-900 text-white' : 'bg-white text-slate-600'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="space-y-1.5">
        {cola.map((item) => {
          const esMiPosicion = item.uid === usuario.id
          return (
            <div
              key={item.uid}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl border transition-colors ${
                esMiPosicion
                  ? 'bg-blue-50 border-blue-300'
                  : item.esPendiente
                  ? 'bg-amber-50 border-amber-200'
                  : 'bg-white border-slate-200'
              }`}
            >
              <span className="text-xs text-slate-400 w-5 text-center font-mono">{item.posicion + 1}</span>
              <span className={`text-sm flex-1 ${esMiPosicion ? 'font-semibold text-blue-900' : 'text-slate-700'}`}>
                {PUESTO_BADGE[item.musico?.puesto || 'normal']}{' '}
                {item.musico ? `${item.musico.apellidos}, ${item.musico.nombre}` : item.uid}
              </span>
              <div className="flex gap-1">
                {item.esProximo && (
                  <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium">Siguiente</span>
                )}
                {item.esPendiente && (
                  <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium">Pendiente</span>
                )}
              </div>
            </div>
          )
        })}
      </div>

      <div className="mt-4 bg-slate-50 rounded-xl p-3 text-xs text-slate-500 space-y-1">
        <p><span className="font-medium text-blue-700">Azul</span> = tu posición</p>
        <p><span className="font-medium text-amber-700">Naranja</span> = pendiente (tiene prioridad en la próxima asignación)</p>
        <p><span className="font-medium text-slate-600">Siguiente</span> = próximo en librar</p>
      </div>
    </div>
  )
}
