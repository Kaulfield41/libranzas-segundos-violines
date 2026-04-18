import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import {
  obtenerProyecto, obtenerMusicos, obtenerLibranzasProyecto,
  crearLibranzasLote, eliminarLibranza
} from '../../services/libranzas'
import { calcularLibranzas, obtenerRotacion, TIPOS_LIBRANZA, PUESTOS } from '../../services/rotacion'
import { collection, getDocs, query, where } from 'firebase/firestore'
import { db } from '../../services/firebase'

export default function GestionLibranzas() {
  const { id } = useParams()
  const { usuario: admin } = useAuth()
  const [proyecto, setProyecto] = useState(null)
  const [musicos, setMusicos] = useState([])
  const [conciertos, setConciertos] = useState([])
  const [libranzas, setLibranzas] = useState([])
  const [secciones, setSecciones] = useState([]) // secciones calculadas
  const [cargando, setCargando] = useState(true)
  const [confirmando, setConfirmando] = useState(null) // seccion en confirmación
  const [motivo, setMotivo] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [confirmEliminar, setConfirmEliminar] = useState(null)
  const [motivoEliminar, setMotivoEliminar] = useState('')
  const [modalManual, setModalManual] = useState(null)
  const [seleccionadosManual, setSeleccionadosManual] = useState([])

  async function cargar() {
    setCargando(true)
    try {
      const p = await obtenerProyecto(id)
      if (!p) { setCargando(false); return }
      setProyecto(p)
      const ms = await obtenerMusicos()
      setMusicos(ms)
      const snap = await getDocs(query(collection(db, 'conciertos'), where('proyectoId', '==', id)))
      const cs = snap.docs.map(d => ({ id: d.id, ...d.data() }))
      setConciertos(cs)
      const libs = await obtenerLibranzasProyecto(id)
      setLibranzas(libs)
      await calcularTodasSecciones(p, ms, cs, libs)
    } catch (e) {
      console.error('Error cargando libranzas:', e)
    } finally {
      setCargando(false)
    }
  }

  async function calcularTodasSecciones(p, ms, cs, libs) {
    const resultado = []

    // ── Sección: proyecto completo ──
    if (p.musicosNecesarios) {
      const yaLibran = libs.filter(l => l.tipo === 'proyecto').map(l => l.musicoId)
      const numLibranzas = ms.length - p.musicosNecesarios
      let sugeridos = [], pendientesNuevos = []
      if (numLibranzas > 0 && yaLibran.length < numLibranzas) {
        const calc = await calcularLibranzas({
          temporadaId: p.temporadaId,
          tipo: TIPOS_LIBRANZA.PROYECTO,
          totalSeccion: ms.length,
          musicosNecesarios: p.musicosNecesarios,
          musicos: ms,
          yaLibrando: yaLibran,
        })
        sugeridos = calc.asignados
        pendientesNuevos = calc.pendientesNuevos
      }
      resultado.push({
        key: 'proyecto',
        titulo: 'Proyecto completo',
        tipo: TIPOS_LIBRANZA.PROYECTO,
        musicosNecesarios: p.musicosNecesarios,
        yaLibran,
        sugeridos,
        pendientesNuevos,
        libranzas: libs.filter(l => l.tipo === 'proyecto'),
        datos: {},
      })
    }

    // ── Secciones por concierto / parte / obra ──
    const yaLibranProyecto = libs.filter(l => l.tipo === 'proyecto').map(l => l.musicoId)

    for (const c of cs) {
      for (const parte of (c.partes || [])) {
        // Parte
        if (parte.musicosNecesarios) {
          const yaLibranParte = libs
            .filter(l => l.tipo === 'parte' && l.conciertoId === c.id && l.parteNumero === parte.numero)
            .map(l => l.musicoId)
          const yaLibrando = [...yaLibranProyecto, ...yaLibranParte]
          const numLibranzas = ms.length - parte.musicosNecesarios - yaLibranProyecto.length
          let sugeridos = [], pendientesNuevos = []
          if (numLibranzas > 0 && yaLibranParte.length < numLibranzas) {
            const calc = await calcularLibranzas({
              temporadaId: p.temporadaId,
              tipo: TIPOS_LIBRANZA.PARTE,
              totalSeccion: ms.length,
              musicosNecesarios: parte.musicosNecesarios,
              musicos: ms,
              yaLibrando,
            })
            sugeridos = calc.asignados
            pendientesNuevos = calc.pendientesNuevos
          }
          resultado.push({
            key: `parte-${c.id}-${parte.numero}`,
            titulo: `Parte ${parte.numero}`,
            subtitulo: formatFecha(c.fecha),
            tipo: TIPOS_LIBRANZA.PARTE,
            musicosNecesarios: parte.musicosNecesarios,
            yaLibran: yaLibranParte,
            sugeridos,
            pendientesNuevos,
            libranzas: libs.filter(l => l.tipo === 'parte' && l.conciertoId === c.id && l.parteNumero === parte.numero),
            datos: { conciertoId: c.id, parteNumero: parte.numero },
          })
        }

        // Obras
        for (let oi = 0; oi < (parte.obras || []).length; oi++) {
          const obra = parte.obras[oi]
          if (!obra.musicosNecesarios) continue
          const yaLibranObra = libs
            .filter(l => l.tipo === 'obra' && l.conciertoId === c.id && l.parteNumero === parte.numero && l.obraIndex === oi)
            .map(l => l.musicoId)
          const yaLibranParteActual = libs
            .filter(l => l.tipo === 'parte' && l.conciertoId === c.id && l.parteNumero === parte.numero)
            .map(l => l.musicoId)
          const yaLibrando = [...yaLibranProyecto, ...yaLibranParteActual, ...yaLibranObra]
          const numLibranzas = ms.length - obra.musicosNecesarios - yaLibranProyecto.length - yaLibranParteActual.length
          let sugeridos = [], pendientesNuevos = []
          if (numLibranzas > 0 && yaLibranObra.length < numLibranzas) {
            const calc = await calcularLibranzas({
              temporadaId: p.temporadaId,
              tipo: TIPOS_LIBRANZA.OBRA,
              totalSeccion: ms.length,
              musicosNecesarios: obra.musicosNecesarios,
              musicos: ms,
              yaLibrando,
            })
            sugeridos = calc.asignados
            pendientesNuevos = calc.pendientesNuevos
          }
          resultado.push({
            key: `obra-${c.id}-${parte.numero}-${oi}`,
            titulo: obra.titulo || `Obra ${oi + 1}`,
            subtitulo: `Parte ${parte.numero} · ${formatFecha(c.fecha)}`,
            tipo: TIPOS_LIBRANZA.OBRA,
            musicosNecesarios: obra.musicosNecesarios,
            yaLibran: yaLibranObra,
            sugeridos,
            pendientesNuevos,
            libranzas: libs.filter(l => l.tipo === 'obra' && l.conciertoId === c.id && l.parteNumero === parte.numero && l.obraIndex === oi),
            datos: { conciertoId: c.id, parteNumero: parte.numero, obraIndex: oi, obraTitulo: obra.titulo },
          })
        }
      }
    }

    setSecciones(resultado)
  }

  useEffect(() => { cargar() }, [id])

  function formatFecha(fecha) {
    if (!fecha) return ''
    const d = fecha.toDate ? fecha.toDate() : new Date(fecha)
    return d.toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' })
  }

  function nombreMusico(uid) {
    const m = musicos.find(m => m.id === uid)
    return m ? `${m.apellidos}, ${m.nombre}` : uid
  }

  async function confirmarSeccion(seccion) {
    setGuardando(true)
    try {
      const libranzasACrear = seccion.sugeridos.map(uid => ({
        musicoId: uid,
        proyectoId: id,
        temporadaId: proyecto.temporadaId,
        tipo: seccion.tipo,
        ...seccion.datos,
        musicosNecesarios: seccion.musicosNecesarios,
        esPendienteResuelta: false,
      }))
      await crearLibranzasLote(
        libranzasACrear,
        seccion.pendientesNuevos,
        proyecto.temporadaId,
        seccion.tipo,
        admin.id,
        `${admin.nombre} ${admin.apellidos}`,
        motivo || null
      )
      setConfirmando(null)
      setMotivo('')
      await cargar()
    } finally {
      setGuardando(false)
    }
  }

  async function confirmarManual(seccion) {
    setGuardando(true)
    try {
      const libranzasACrear = seleccionadosManual.map(uid => ({
        musicoId: uid,
        proyectoId: id,
        temporadaId: proyecto.temporadaId,
        tipo: seccion.tipo,
        ...seccion.datos,
        musicosNecesarios: seccion.musicosNecesarios,
        esPendienteResuelta: false,
      }))
      await crearLibranzasLote(
        libranzasACrear,
        [],
        proyecto.temporadaId,
        seccion.tipo,
        admin.id,
        `${admin.nombre} ${admin.apellidos}`,
        motivo || 'Asignación manual'
      )
      setModalManual(null)
      setSeleccionadosManual([])
      setMotivo('')
      await cargar()
    } finally {
      setGuardando(false)
    }
  }

  async function handleEliminar() {
    await eliminarLibranza(confirmEliminar.id, admin.id, `${admin.nombre} ${admin.apellidos}`, motivoEliminar)
    setConfirmEliminar(null)
    setMotivoEliminar('')
    await cargar()
  }

  if (cargando) return <div className="flex items-center justify-center h-64 text-slate-400 text-sm">Cargando...</div>
  if (!proyecto) return <div className="p-4">Proyecto no encontrado.</div>

  return (
    <div className="p-4 max-w-lg mx-auto pb-8">
      <div className="mb-4">
        <Link to={`/admin/proyectos/${id}`} className="text-slate-400 text-sm flex items-center gap-1 mb-2">‹ {proyecto.nombre}</Link>
        <h2 className="text-lg font-semibold text-slate-800">Libranzas</h2>
      </div>

      {secciones.length === 0 ? (
        <div className="text-center py-12 text-slate-400">
          <p className="text-3xl mb-2">📋</p>
          <p className="text-sm">Define los músicos necesarios en el proyecto y los conciertos para calcular las libranzas.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {secciones.map(sec => (
            <SeccionLibranza
              key={sec.key}
              seccion={sec}
              nombreMusico={nombreMusico}
              musicos={musicos}
              libranzasExistentes={libranzas}
              onConfirmar={() => setConfirmando(sec)}
              onManual={() => { setModalManual(sec); setSeleccionadosManual([]) }}
              onEliminar={setConfirmEliminar}
            />
          ))}
        </div>
      )}

      {/* Modal confirmación automática */}
      {confirmando && (
        <div className="fixed inset-0 bg-black/40 flex items-end justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm p-5 space-y-3">
            <h3 className="font-semibold text-slate-800">Confirmar libranzas</h3>
            <p className="text-sm text-slate-600">
              <strong>{confirmando.titulo}</strong> — {confirmando.musicosNecesarios} músicos necesarios
            </p>
            <div className="bg-slate-50 rounded-xl px-3 py-2">
              <p className="text-xs text-slate-500 mb-1">Libran según rotación:</p>
              {confirmando.sugeridos.map(uid => (
                <p key={uid} className="text-sm font-medium text-slate-700">{nombreMusico(uid)}</p>
              ))}
              {confirmando.pendientesNuevos.length > 0 && (
                <p className="text-xs text-amber-600 mt-1">
                  ⚠️ Quedan pendientes: {confirmando.pendientesNuevos.map(uid => nombreMusico(uid)).join(', ')}
                </p>
              )}
            </div>
            <div>
              <label className="text-xs text-slate-500">Motivo (opcional)</label>
              <input className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm mt-1"
                placeholder="Baja, permiso..." value={motivo} onChange={e => setMotivo(e.target.value)} />
            </div>
            <div className="flex gap-2">
              <button onClick={() => setConfirmando(null)} className="flex-1 border border-slate-300 text-slate-700 py-2.5 rounded-lg text-sm">Cancelar</button>
              <button onClick={() => confirmarSeccion(confirmando)} disabled={guardando}
                className="flex-1 bg-blue-900 text-white py-2.5 rounded-lg text-sm font-medium disabled:opacity-50">
                {guardando ? 'Guardando...' : 'Confirmar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal asignación manual */}
      {modalManual && (
        <div className="fixed inset-0 bg-black/40 flex items-end justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm p-5 space-y-3 max-h-[85vh] overflow-y-auto">
            <h3 className="font-semibold text-slate-800">Asignación manual — {modalManual.titulo}</h3>
            <p className="text-xs text-slate-500">Selecciona quién libra (fuera de rotación):</p>
            <div className="space-y-1 max-h-52 overflow-y-auto">
              {musicos.map(m => {
                const yaLibra = libranzas.some(l => l.musicoId === m.id && l.tipo === 'proyecto')
                return (
                  <label key={m.id} className={`flex items-center gap-2 px-3 py-2 rounded-lg ${yaLibra ? 'opacity-40' : 'hover:bg-slate-50'}`}>
                    <input type="checkbox" checked={seleccionadosManual.includes(m.id)}
                      onChange={() => !yaLibra && setSeleccionadosManual(prev =>
                        prev.includes(m.id) ? prev.filter(u => u !== m.id) : [...prev, m.id]
                      )}
                      disabled={yaLibra} />
                    <span className="text-sm text-slate-700">{m.apellidos}, {m.nombre}</span>
                    {yaLibra && <span className="text-xs text-red-500">ya libra proyecto</span>}
                  </label>
                )
              })}
            </div>
            <div>
              <label className="text-xs text-slate-500">Motivo (obligatorio para historial)</label>
              <input className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm mt-1"
                placeholder="Baja, permiso, sustitución..." value={motivo} onChange={e => setMotivo(e.target.value)} />
            </div>
            <div className="flex gap-2">
              <button onClick={() => setModalManual(null)} className="flex-1 border border-slate-300 text-slate-700 py-2.5 rounded-lg text-sm">Cancelar</button>
              <button onClick={() => confirmarManual(modalManual)}
                disabled={guardando || seleccionadosManual.length === 0 || !motivo}
                className="flex-1 bg-blue-900 text-white py-2.5 rounded-lg text-sm font-medium disabled:opacity-50">
                {guardando ? 'Guardando...' : `Asignar (${seleccionadosManual.length})`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmar eliminar */}
      {confirmEliminar && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm p-5 space-y-3">
            <h3 className="font-semibold text-slate-800">Eliminar libranza</h3>
            <p className="text-sm text-slate-600">
              ¿Eliminar la libranza de <strong>{nombreMusico(confirmEliminar.musicoId)}</strong>?
              Quedará registrado en el historial.
            </p>
            <div>
              <label className="text-xs text-slate-500">Motivo (obligatorio)</label>
              <input className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm mt-1"
                placeholder="Baja médica, error..." value={motivoEliminar}
                onChange={e => setMotivoEliminar(e.target.value)} />
            </div>
            <div className="flex gap-2">
              <button onClick={() => setConfirmEliminar(null)} className="flex-1 border border-slate-300 text-slate-700 py-2.5 rounded-lg text-sm">Cancelar</button>
              <button onClick={handleEliminar} disabled={!motivoEliminar}
                className="flex-1 bg-red-600 text-white py-2.5 rounded-lg text-sm font-medium disabled:opacity-50">
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function SeccionLibranza({ seccion, nombreMusico, musicos, libranzasExistentes, onConfirmar, onManual, onEliminar }) {
  const yaAsignadas = seccion.libranzas.length > 0
  const tieneSugerencias = seccion.sugeridos.length > 0
  const completa = yaAsignadas && seccion.libranzas.length >= (musicos.length - seccion.musicosNecesarios)

  return (
    <div className={`bg-white rounded-2xl border overflow-hidden ${completa ? 'border-green-200' : tieneSugerencias ? 'border-blue-200' : 'border-slate-200'}`}>
      <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-slate-700">{seccion.titulo}</p>
          {seccion.subtitulo && <p className="text-xs text-slate-400">{seccion.subtitulo}</p>}
          <p className="text-xs text-slate-400">{seccion.musicosNecesarios} músicos necesarios</p>
        </div>
        {completa
          ? <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">✓ Completo</span>
          : <button onClick={onManual} className="text-xs text-slate-400 underline">Manual</button>
        }
      </div>

      {/* Libranzas ya asignadas */}
      {yaAsignadas && (
        <div className="divide-y divide-slate-50">
          {seccion.libranzas.map(lib => (
            <div key={lib.id} className="flex items-center gap-2 px-4 py-2">
              <span className="flex-1 text-sm text-slate-700">{nombreMusico(lib.musicoId)}</span>
              {lib.motivo && <span className="text-xs text-slate-400 italic">{lib.motivo}</span>}
              <button onClick={() => onEliminar(lib)} className="text-red-400 text-xs">✕</button>
            </div>
          ))}
        </div>
      )}

      {/* Sugerencia automática */}
      {!completa && tieneSugerencias && (
        <div className="px-4 py-3 bg-blue-50 border-t border-blue-100">
          <p className="text-xs text-blue-600 mb-1.5">Según rotación:</p>
          {seccion.sugeridos.map(uid => (
            <p key={uid} className="text-sm font-medium text-blue-800">{nombreMusico(uid)}</p>
          ))}
          {seccion.pendientesNuevos.length > 0 && (
            <p className="text-xs text-amber-600 mt-1">
              ⚠️ Quedan pendientes: {seccion.pendientesNuevos.map(uid => nombreMusico(uid)).join(', ')}
            </p>
          )}
          <button onClick={onConfirmar}
            className="mt-2 w-full bg-blue-900 text-white py-2 rounded-xl text-sm font-medium">
            Confirmar libranzas
          </button>
        </div>
      )}

      {!completa && !tieneSugerencias && !yaAsignadas && (
        <div className="px-4 py-3 text-xs text-slate-400 text-center">
          Sin libranzas pendientes
        </div>
      )}
    </div>
  )
}
