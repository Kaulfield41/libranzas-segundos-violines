import { useEffect, useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import { obtenerTemporadaActiva, obtenerMusicos } from '../../services/libranzas'
import { obtenerEstadoCola, obtenerRotacion, TIPOS_LIBRANZA, inicializarRotacion } from '../../services/rotacion'
import { registrarHistorial, ACCIONES } from '../../services/historial'
import { doc, updateDoc } from 'firebase/firestore'
import { db } from '../../services/firebase'

const TIPO_LABELS = {
  proyecto: 'Proyecto completo',
  parte: 'Por parte',
  obra: 'Por obra',
}

const PUESTO_BADGE = {
  normal: '',
  ayuda_solista: '🔶',
  solista: '⭐',
}

export default function Rotacion() {
  const { usuario: admin } = useAuth()
  const [temporada, setTemporada] = useState(null)
  const [musicos, setMusicos] = useState([])
  const [colas, setColas] = useState({})
  const [cargando, setCargando] = useState(true)
  const [tipoActivo, setTipoActivo] = useState('proyecto')
  const [modoEdicion, setModoEdicion] = useState(false)
  const [ordenEdicion, setOrdenEdicion] = useState([])
  const [guardando, setGuardando] = useState(false)

  async function cargar() {
    setCargando(true)
    const t = await obtenerTemporadaActiva()
    if (!t) { setCargando(false); return }
    setTemporada(t)
    const ms = await obtenerMusicos()
    setMusicos(ms)

    // Sincronizar en paralelo
    await Promise.all(Object.values(TIPOS_LIBRANZA).map(async tipo => {
      const rot = await obtenerRotacion(t.id, tipo)
      if (!rot) {
        await inicializarRotacion(t.id, ms.map(m => m.id))
      } else {
        const uidsActivos = ms.map(m => m.id)
        const colaLimpia = rot.cola.filter(uid => uidsActivos.includes(uid))
        const nuevos = uidsActivos.filter(uid => !colaLimpia.includes(uid))
        const colaFinal = [...colaLimpia, ...nuevos]
        const pendientesLimpios = (rot.pendientes || []).filter(uid => uidsActivos.includes(uid))
        if (colaFinal.length !== rot.cola.length || nuevos.length > 0 || pendientesLimpios.length !== (rot.pendientes || []).length) {
          await updateDoc(doc(db, 'rotaciones', `${t.id}_${tipo}`), { cola: colaFinal, pendientes: pendientesLimpios })
        }
      }
    }))

    const colasCargadas = {}
    await Promise.all(Object.values(TIPOS_LIBRANZA).map(async tipo => {
      colasCargadas[tipo] = await obtenerEstadoCola(t.id, tipo, ms)
    }))
    setColas(colasCargadas)
    setCargando(false)
  }

  useEffect(() => { cargar() }, [])

  function abrirEdicion() {
    setOrdenEdicion((colas[tipoActivo] || []).map(item => item.uid))
    setModoEdicion(true)
  }

  function mover(idx, dir) {
    const nueva = [...ordenEdicion]
    const nuevoIdx = (idx + dir + nueva.length) % nueva.length
    ;[nueva[idx], nueva[nuevoIdx]] = [nueva[nuevoIdx], nueva[idx]]
    setOrdenEdicion(nueva)
  }

  async function guardarOrden() {
    setGuardando(true)
    const ref = doc(db, 'rotaciones', `${temporada.id}_${tipoActivo}`)
    await updateDoc(ref, { cola: ordenEdicion })
    await registrarHistorial({
      usuarioId: admin.id,
      usuarioNombre: `${admin.nombre} ${admin.apellidos}`,
      accion: ACCIONES.MODIFICAR_ROTACION,
      entidad: 'rotacion',
      entidadId: `${temporada.id}_${tipoActivo}`,
      datos: { tipo: tipoActivo, nuevaCola: ordenEdicion },
    })
    await cargar()
    setModoEdicion(false)
    setGuardando(false)
  }

  if (cargando) return <div className="flex items-center justify-center h-64 text-slate-400 text-sm">Cargando...</div>
  if (!temporada) return <div className="p-4 text-slate-500 text-sm text-center">No hay temporada activa.</div>

  const cola = colas[tipoActivo] || []

  return (
    <div className="p-4 max-w-lg mx-auto">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-semibold text-slate-800">Rotación</h2>
          <p className="text-xs text-slate-400">{temporada.nombre}</p>
        </div>
        {!modoEdicion && (
          <button
            onClick={abrirEdicion}
            className="text-sm bg-slate-100 text-slate-700 px-3 py-1.5 rounded-lg font-medium"
          >
            Reordenar
          </button>
        )}
      </div>

      {/* Selector de cola */}
      <div className="flex rounded-xl overflow-hidden border border-slate-200 mb-4">
        {Object.entries(TIPO_LABELS).map(([tipo, label]) => (
          <button
            key={tipo}
            onClick={() => { setTipoActivo(tipo); setModoEdicion(false) }}
            className={`flex-1 py-2 text-xs font-medium transition-colors ${
              tipoActivo === tipo ? 'bg-blue-900 text-white' : 'bg-white text-slate-600'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Leyenda */}
      <div className="flex gap-3 mb-3 text-xs text-slate-500">
        <span>⭐ Solista</span>
        <span>🔶 Ayuda solista</span>
      </div>

      {modoEdicion ? (
        <>
          <p className="text-xs text-slate-500 mb-2">Reordena con las flechas. Este orden afecta solo a la cola de <strong>{TIPO_LABELS[tipoActivo]}</strong>.</p>
          <div className="space-y-1.5">
            {ordenEdicion.map((uid, idx) => {
              const m = musicos.find(m => m.id === uid)
              return (
                <div key={uid} className="flex items-center gap-2 bg-slate-50 rounded-xl px-3 py-2.5 border border-slate-200">
                  <span className="text-xs text-slate-400 w-5 text-center font-mono">{idx + 1}</span>
                  <span className="flex-1 text-sm text-slate-700">
                    {PUESTO_BADGE[m?.puesto || 'normal']}{' '}
                    {m ? `${m.apellidos}, ${m.nombre}` : uid}
                  </span>
                  <div className="flex gap-1">
                    <button onClick={() => mover(idx, -1)}
                      className="text-slate-400 w-7 h-7 flex items-center justify-center text-lg">↑</button>
                    <button onClick={() => mover(idx, 1)}
                      className="text-slate-400 w-7 h-7 flex items-center justify-center text-lg">↓</button>
                  </div>
                </div>
              )
            })}
          </div>
          <div className="flex gap-2 mt-4">
            <button onClick={() => setModoEdicion(false)} className="flex-1 border border-slate-300 text-slate-700 py-2.5 rounded-lg text-sm">Cancelar</button>
            <button onClick={guardarOrden} disabled={guardando}
              className="flex-1 bg-blue-900 text-white py-2.5 rounded-lg text-sm font-medium disabled:opacity-50">
              {guardando ? 'Guardando...' : 'Guardar orden'}
            </button>
          </div>
        </>
      ) : (
        <>
          <div className="space-y-1.5">
            {cola.map((item) => (
              <div
                key={item.uid}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl border transition-colors ${
                  item.esPendiente
                    ? 'bg-amber-50 border-amber-200'
                    : 'bg-white border-slate-200'
                }`}
              >
                <span className="text-xs text-slate-400 w-5 text-center font-mono">{item.posicion + 1}</span>
                <span className="text-sm flex-1 text-slate-700">
                  {PUESTO_BADGE[item.musico?.puesto || 'normal']}{' '}
                  {item.musico ? `${item.musico.apellidos}, ${item.musico.nombre}` : item.uid}
                </span>
                <div className="flex gap-1">
                  {item.esPendiente && (
                    <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium">Pendiente</span>
                  )}
                </div>
              </div>
            ))}
          </div>

          <div className="mt-4 bg-slate-50 rounded-xl p-3 text-xs text-slate-500 space-y-1">
            <p><span className="font-medium text-amber-700">Naranja</span> = pendiente por restricción de puestos de responsabilidad (tiene prioridad)</p>
            <p>Siempre deben tocar: mín. 2 de 4 responsables · mín. 1 solista</p>
          </div>
        </>
      )}
    </div>
  )
}
