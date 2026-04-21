import { useEffect, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { obtenerProyecto, actualizarProyecto, eliminarProyecto, obtenerMusicos, obtenerLibranzasProyecto, crearLibranzasLote, crearLibranzasPermiso } from '../../services/libranzas'
import { calcularLibranzas, TIPOS_LIBRANZA } from '../../services/rotacion'
import { collection, getDocs, query, where, doc, updateDoc, addDoc, deleteDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '../../services/firebase'

const obraVacia = () => ({ titulo: '', compositor: '', musicosNecesarios: '' })

export default function EditarProyecto() {
  const { id } = useParams()
  const { usuario: admin } = useAuth()
  const navigate = useNavigate()
  const [paso, setPaso] = useState(1)
  const [cargando, setCargando] = useState(true)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')
  const [conciertoId, setConciertoId] = useState(null)
  const [confirmEliminar, setConfirmEliminar] = useState(false)
  const [eliminando, setEliminando] = useState(false)
  const [temporadaId, setTemporadaId] = useState(null)
  const [musicos, setMusicos] = useState([])
  const [libranzasExistentes, setLibranzasExistentes] = useState([])
  const [libranzasNuevas, setLibranzasNuevas] = useState([])

  const [form, setForm] = useState({
    nombre: '', descripcion: '', fechaInicio: '', fechaFin: '', musicosNecesarios: '',
    permisosBajas: [],
    intercambios: [],
  })
  const [concierto, setConcierto] = useState({
    fecha: '', hora: '',
    partes: [
      { musicosNecesarios: '', obras: [obraVacia()] },
      { musicosNecesarios: '', obras: [obraVacia()] },
    ],
  })

  useEffect(() => {
    async function cargar() {
      try {
        const p = await obtenerProyecto(id)
        if (!p) { navigate('/admin/proyectos'); return }
        setTemporadaId(p.temporadaId)
        setForm({
          nombre: p.nombre || '',
          descripcion: p.descripcion || '',
          fechaInicio: p.fechaInicio ? toInputDate(p.fechaInicio) : '',
          fechaFin: p.fechaFin ? toInputDate(p.fechaFin) : '',
          musicosNecesarios: p.musicosNecesarios || '',
          permisosBajas: p.permisosBajas || [],
          intercambios: p.intercambios || [],
        })

        // Cargar concierto existente
        const snap = await getDocs(query(collection(db, 'conciertos'), where('proyectoId', '==', id)))
        if (!snap.empty) {
          const c = { id: snap.docs[0].id, ...snap.docs[0].data() }
          setConciertoId(c.id)
          setConcierto({
            fecha: c.fecha ? toInputDate(c.fecha) : '',
            hora: c.hora || '',
            partes: [0, 1].map(pi => {
              const parte = c.partes?.[pi]
              return {
                musicosNecesarios: parte?.musicosNecesarios || '',
                obras: parte?.obras?.length > 0
                  ? parte.obras.map(o => ({ titulo: o.titulo || '', compositor: o.compositor || '', musicosNecesarios: o.musicosNecesarios || '' }))
                  : [obraVacia()],
              }
            }),
          })
        }

        const [ms, libs] = await Promise.all([obtenerMusicos(), obtenerLibranzasProyecto(id)])
        setMusicos(ms)
        setLibranzasExistentes(libs)
      } catch (e) {
        console.error(e)
      } finally {
        setCargando(false)
      }
    }
    cargar()
  }, [id])

  function toInputDate(fecha) {
    const d = fecha?.toDate ? fecha.toDate() : new Date(fecha)
    return d.toISOString().split('T')[0]
  }

  function updateParte(pi, campo, valor) {
    setConcierto(c => {
      const partes = [...c.partes]
      partes[pi] = { ...partes[pi], [campo]: valor }
      return { ...c, partes }
    })
  }

  function updateObra(pi, oi, campo, valor) {
    setConcierto(c => {
      const partes = [...c.partes]
      const obras = [...partes[pi].obras]
      obras[oi] = { ...obras[oi], [campo]: valor }
      partes[pi] = { ...partes[pi], obras }
      return { ...c, partes }
    })
  }

  function addObra(pi) {
    setConcierto(c => {
      const partes = [...c.partes]
      partes[pi] = { ...partes[pi], obras: [...partes[pi].obras, obraVacia()] }
      return { ...c, partes }
    })
  }

  function removeObra(pi, oi) {
    setConcierto(c => {
      const partes = [...c.partes]
      partes[pi] = { ...partes[pi], obras: partes[pi].obras.filter((_, i) => i !== oi) }
      return { ...c, partes }
    })
  }

  function togglePermiso(uid) {
    setForm(f => {
      const existe = f.permisosBajas.find(p => p.musicoId === uid)
      return {
        ...f,
        permisosBajas: existe
          ? f.permisosBajas.filter(p => p.musicoId !== uid)
          : [...f.permisosBajas, { musicoId: uid, motivo: '' }]
      }
    })
  }
  function updateMotivoPermiso(uid, motivo) {
    setForm(f => ({
      ...f,
      permisosBajas: f.permisosBajas.map(p => p.musicoId === uid ? { ...p, motivo } : p)
    }))
  }

  function addIntercambio() {
    setForm(f => ({ ...f, intercambios: [...f.intercambios, { musicoA: '', musicoB: '' }] }))
  }
  function removeIntercambio(idx) {
    setForm(f => ({ ...f, intercambios: f.intercambios.filter((_, i) => i !== idx) }))
  }
  function updateIntercambio(idx, campo, valor) {
    setForm(f => {
      const intercambios = [...f.intercambios]
      intercambios[idx] = { ...intercambios[idx], [campo]: valor }
      return { ...f, intercambios }
    })
  }

  async function calcular() {
    setGuardando(true)
    setError('')
    try {
      const ms = musicos
      const secciones = []
      const yaLibranProyecto = libranzasExistentes.filter(l => l.tipo === 'proyecto').map(l => l.musicoId)

      const intercambiosValidos = form.intercambios.filter(i => i.musicoA && i.musicoB)

      // Proyecto completo — solo si cambió el número o no hay libranzas
      if (form.musicosNecesarios) {
        const mn = parseInt(form.musicosNecesarios)
        const numNecesarias = ms.length - mn
        const yaAsignadas = libranzasExistentes.filter(l => l.tipo === 'proyecto').length
        if (yaAsignadas < numNecesarias) {
          const calc = await calcularLibranzas({
            temporadaId, tipo: TIPOS_LIBRANZA.PROYECTO,
            totalSeccion: ms.length, musicosNecesarios: mn, musicos: ms,
            yaLibrando: yaLibranProyecto, intercambiosProyecto: intercambiosValidos,
          })
          if (calc.asignados.length > 0) {
            secciones.push({ tipo: TIPOS_LIBRANZA.PROYECTO, titulo: 'Proyecto completo', musicosNecesarios: mn, sugeridos: calc.asignados, pendientesNuevos: calc.pendientesNuevos, deudasNuevas: calc.deudasNuevas, deudasResueltas: calc.deudasResueltas, datos: {} })
          }
        }
      }

      for (let pi = 0; pi < concierto.partes.length; pi++) {
        const parte = concierto.partes[pi]
        const yaLibranParte = libranzasExistentes.filter(l => l.tipo === 'parte' && l.parteNumero === pi + 1).map(l => l.musicoId)

        if (parte.musicosNecesarios) {
          const mn = parseInt(parte.musicosNecesarios)
          const numNecesarias = ms.length - mn - yaLibranProyecto.length
          const yaAsignadas = yaLibranParte.length
          if (yaAsignadas < numNecesarias) {
            const calc = await calcularLibranzas({
              temporadaId, tipo: TIPOS_LIBRANZA.PARTE,
              totalSeccion: ms.length, musicosNecesarios: mn, musicos: ms,
              yaLibrando: [...yaLibranProyecto, ...yaLibranParte], intercambiosProyecto: intercambiosValidos,
            })
            if (calc.asignados.length > 0) {
              secciones.push({ tipo: TIPOS_LIBRANZA.PARTE, titulo: `Parte ${pi + 1}`, musicosNecesarios: mn, sugeridos: calc.asignados, pendientesNuevos: calc.pendientesNuevos, deudasNuevas: calc.deudasNuevas, deudasResueltas: calc.deudasResueltas, uidsYaLibrando: [...yaLibranProyecto], datos: { parteNumero: pi + 1 } })
            }
          }
        }

        for (let oi = 0; oi < parte.obras.length; oi++) {
          const obra = parte.obras[oi]
          if (!obra.musicosNecesarios || !obra.titulo) continue
          const mn = parseInt(obra.musicosNecesarios)
          const yaLibranObra = libranzasExistentes.filter(l => l.tipo === 'obra' && l.parteNumero === pi + 1 && l.obraIndex === oi).map(l => l.musicoId)
          const numNecesarias = ms.length - mn - yaLibranProyecto.length - yaLibranParte.length
          if (yaLibranObra.length < numNecesarias) {
            const calc = await calcularLibranzas({
              temporadaId, tipo: TIPOS_LIBRANZA.OBRA,
              totalSeccion: ms.length, musicosNecesarios: mn, musicos: ms,
              yaLibrando: [...yaLibranProyecto, ...yaLibranParte, ...yaLibranObra], intercambiosProyecto: intercambiosValidos,
            })
            if (calc.asignados.length > 0) {
              secciones.push({ tipo: TIPOS_LIBRANZA.OBRA, titulo: obra.titulo, subtitulo: `Parte ${pi + 1}`, musicosNecesarios: mn, sugeridos: calc.asignados, pendientesNuevos: calc.pendientesNuevos, deudasNuevas: calc.deudasNuevas, deudasResueltas: calc.deudasResueltas, uidsYaLibrando: [...yaLibranProyecto, ...yaLibranParte], datos: { parteNumero: pi + 1, obraIndex: oi, obraTitulo: obra.titulo } })
            }
          }
        }
      }

      setLibranzasNuevas(secciones)
      setPaso(3)
    } catch (e) {
      setError('Error al calcular: ' + e.message)
    } finally {
      setGuardando(false)
    }
  }

  async function guardarTodo() {
    setGuardando(true)
    setError('')
    try {
      // Actualizar proyecto
      await actualizarProyecto(id, {
        nombre: form.nombre,
        descripcion: form.descripcion,
        fechaInicio: new Date(form.fechaInicio),
        fechaFin: form.fechaFin ? new Date(form.fechaFin) : new Date(form.fechaInicio),
        musicosNecesarios: form.musicosNecesarios ? parseInt(form.musicosNecesarios) : null,
      }, admin.id, `${admin.nombre} ${admin.apellidos}`, 'Edición del proyecto')

      // Actualizar o crear concierto
      const conciertoData = {
        proyectoId: id,
        temporadaId,
        fecha: concierto.fecha ? new Date(concierto.fecha) : null,
        hora: concierto.hora,
        tipo: 'concierto',
        partes: concierto.partes.map((p, pi) => ({
          numero: pi + 1,
          musicosNecesarios: p.musicosNecesarios ? parseInt(p.musicosNecesarios) : null,
          obras: p.obras.filter(o => o.titulo).map(o => ({
            titulo: o.titulo,
            compositor: o.compositor,
            musicosNecesarios: o.musicosNecesarios ? parseInt(o.musicosNecesarios) : null,
          })),
        })),
      }
      let cId = conciertoId
      if (cId) {
        await updateDoc(doc(db, 'conciertos', cId), conciertoData)
      } else if (concierto.fecha) {
        const ref = await addDoc(collection(db, 'conciertos'), { ...conciertoData, creadoEn: serverTimestamp() })
        cId = ref.id
      }

      // Crear nuevas libranzas
      for (const sec of libranzasNuevas) {
        if (sec.sugeridos.length === 0) continue
        await crearLibranzasLote(
          sec.sugeridos.map(uid => ({
            musicoId: uid, proyectoId: id, temporadaId,
            tipo: sec.tipo, conciertoId: cId || null,
            ...sec.datos, musicosNecesarios: sec.musicosNecesarios, esPendienteResuelta: false,
          })),
          sec.pendientesNuevos, temporadaId, sec.tipo,
          admin.id, `${admin.nombre} ${admin.apellidos}`, 'Edición del proyecto',
          { deudasNuevas: sec.deudasNuevas || [], deudasResueltas: sec.deudasResueltas || [], intercambiosProyecto: form.intercambios.filter(i => i.musicoA && i.musicoB), uidsPermiso: [...form.permisosBajas.map(p => p.musicoId), ...(sec.uidsYaLibrando || [])] }
        )
      }

      navigate(`/admin/proyectos/${id}`)
    } catch (e) {
      setError('Error al guardar: ' + e.message)
    } finally {
      setGuardando(false)
    }
  }

  async function handleEliminar() {
    setEliminando(true)
    try {
      // Eliminar concierto si existe
      if (conciertoId) await deleteDoc(doc(db, 'conciertos', conciertoId))
      // Eliminar proyecto (incluye historial)
      await eliminarProyecto(id, admin.id, `${admin.nombre} ${admin.apellidos}`)
      navigate('/admin/proyectos')
    } catch (e) {
      setError('Error al eliminar: ' + e.message)
      setEliminando(false)
    }
  }

  function nombreMusico(uid) {
    const m = musicos.find(m => m.id === uid)
    return m ? `${m.apellidos}, ${m.nombre}` : uid
  }

  if (cargando) return <div className="flex items-center justify-center h-64 text-slate-400 text-sm">Cargando...</div>

  return (
    <div className="p-4 max-w-lg mx-auto pb-8">
      <Link to={`/admin/proyectos/${id}`} className="text-slate-400 text-sm flex items-center gap-1 mb-4">‹ {form.nombre || 'Proyecto'}</Link>
      <div className="flex items-center gap-2 mb-5">
        {[1, 2, 3].map(n => (
          <div key={n} className="flex items-center gap-2">
            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
              paso === n ? 'bg-blue-900 text-white' : paso > n ? 'bg-green-500 text-white' : 'bg-slate-200 text-slate-500'
            }`}>{paso > n ? '✓' : n}</div>
            {n < 3 && <div className={`h-0.5 w-6 ${paso > n ? 'bg-green-500' : 'bg-slate-200'}`} />}
          </div>
        ))}
        <span className="text-sm text-slate-500 ml-1">
          {paso === 1 ? 'Datos del proyecto' : paso === 2 ? 'Estructura del concierto' : 'Nuevas libranzas'}
        </span>
      </div>

      {paso === 1 && (
        <div className="space-y-3">
          <input className="w-full border border-slate-300 rounded-xl px-3 py-3 text-sm"
            placeholder="Nombre del proyecto" value={form.nombre}
            onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))} />
          <input className="w-full border border-slate-300 rounded-xl px-3 py-3 text-sm"
            placeholder="Descripción (opcional)" value={form.descripcion}
            onChange={e => setForm(f => ({ ...f, descripcion: e.target.value }))} />
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs text-slate-500 mb-1 block">Fecha inicio</label>
              <input type="date" className="w-full border border-slate-300 rounded-xl px-3 py-2.5 text-sm"
                value={form.fechaInicio} onChange={e => setForm(f => ({ ...f, fechaInicio: e.target.value }))} />
            </div>
            <div>
              <label className="text-xs text-slate-500 mb-1 block">Fecha fin</label>
              <input type="date" className="w-full border border-slate-300 rounded-xl px-3 py-2.5 text-sm"
                value={form.fechaFin} onChange={e => setForm(f => ({ ...f, fechaFin: e.target.value }))} />
            </div>
          </div>
          <div>
            <label className="text-xs text-slate-500 mb-1 block">Músicos necesarios para el proyecto completo</label>
            <input type="number" min="1" max="14" className="w-full border border-slate-300 rounded-xl px-3 py-2.5 text-sm"
              placeholder="Dejar vacío si todos tocan" value={form.musicosNecesarios}
              onChange={e => setForm(f => ({ ...f, musicosNecesarios: e.target.value }))} />
          </div>
          {musicos.length > 0 && (
            <div>
              <label className="text-xs text-slate-500 mb-1 block">Permisos / Bajas en este proyecto</label>
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                {musicos.map(m => {
                  const permiso = form.permisosBajas.find(p => p.musicoId === m.id)
                  return (
                    <div key={m.id} className="border-b border-slate-100 last:border-0">
                      <label className="flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-slate-50">
                        <input type="checkbox" checked={!!permiso} onChange={() => togglePermiso(m.id)} />
                        <span className="text-sm text-slate-700 flex-1">{m.apellidos}, {m.nombre}</span>
                      </label>
                      {permiso && (
                        <select
                          className="w-full border-t border-slate-100 px-3 py-1.5 text-xs text-slate-600 bg-amber-50"
                          value={permiso.motivo}
                          onChange={e => updateMotivoPermiso(m.id, e.target.value)}
                        >
                          <option value="">Motivo...</option>
                          <option value="Baja médica">Baja médica</option>
                          <option value="Permiso">Permiso</option>
                          <option value="Motivos particulares">Motivos particulares</option>
                        </select>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {musicos.length > 1 && (
            <div>
              <label className="text-xs text-slate-500 mb-2 block">Intercambios de turno</label>
              {form.intercambios.map((int, idx) => (
                <div key={idx} className="flex items-center gap-1.5 mb-2">
                  <select value={int.musicoA}
                    onChange={e => updateIntercambio(idx, 'musicoA', e.target.value)}
                    className="flex-1 border border-slate-300 rounded-lg px-2 py-2 text-xs">
                    <option value="">Cede turno...</option>
                    {musicos.filter(m => m.id !== int.musicoB).map(m => (
                      <option key={m.id} value={m.id}>{m.apellidos}, {m.nombre}</option>
                    ))}
                  </select>
                  <span className="text-slate-400 text-xs shrink-0">↔</span>
                  <select value={int.musicoB}
                    onChange={e => updateIntercambio(idx, 'musicoB', e.target.value)}
                    className="flex-1 border border-slate-300 rounded-lg px-2 py-2 text-xs">
                    <option value="">Recibe turno...</option>
                    {musicos.filter(m => m.id !== int.musicoA).map(m => (
                      <option key={m.id} value={m.id}>{m.apellidos}, {m.nombre}</option>
                    ))}
                  </select>
                  <button onClick={() => removeIntercambio(idx)} className="text-red-400 text-xs px-1 shrink-0">✕</button>
                </div>
              ))}
              <button onClick={addIntercambio} className="text-xs text-blue-700 font-medium">+ Añadir intercambio</button>
            </div>
          )}

          <button onClick={() => setPaso(2)} disabled={!form.nombre || !form.fechaInicio}
            className="w-full bg-blue-900 text-white py-3 rounded-xl text-sm font-medium disabled:opacity-50 mt-2">
            Siguiente →
          </button>
          <button onClick={() => setConfirmEliminar(true)}
            className="w-full border border-red-200 text-red-600 py-2.5 rounded-xl text-sm font-medium mt-1">
            Eliminar proyecto
          </button>
        </div>
      )}

      {/* Modal confirmar eliminar */}
      {confirmEliminar && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm p-5 space-y-3">
            <h3 className="font-semibold text-slate-800">Eliminar proyecto</h3>
            <p className="text-sm text-slate-600">
              ¿Eliminar <strong>{form.nombre}</strong>? Se borrarán también sus conciertos.
              Las libranzas asignadas quedarán en el historial pero dejarán de estar activas.
            </p>
            {error && <p className="text-red-600 text-sm">{error}</p>}
            <div className="flex gap-2">
              <button onClick={() => setConfirmEliminar(false)}
                className="flex-1 border border-slate-300 text-slate-700 py-2.5 rounded-lg text-sm">
                Cancelar
              </button>
              <button onClick={handleEliminar} disabled={eliminando}
                className="flex-1 bg-red-600 text-white py-2.5 rounded-lg text-sm font-medium disabled:opacity-50">
                {eliminando ? 'Eliminando...' : 'Eliminar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {paso === 2 && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs text-slate-500 mb-1 block">Fecha del concierto</label>
              <input type="date" className="w-full border border-slate-300 rounded-xl px-3 py-2.5 text-sm"
                value={concierto.fecha} onChange={e => setConcierto(c => ({ ...c, fecha: e.target.value }))} />
            </div>
            <div>
              <label className="text-xs text-slate-500 mb-1 block">Hora</label>
              <input type="time" className="w-full border border-slate-300 rounded-xl px-3 py-2.5 text-sm"
                value={concierto.hora} onChange={e => setConcierto(c => ({ ...c, hora: e.target.value }))} />
            </div>
          </div>

          {concierto.partes.map((parte, pi) => (
            <div key={pi} className="border border-slate-200 rounded-xl overflow-hidden">
              <div className="bg-slate-50 px-4 py-2.5 border-b border-slate-200">
                <p className="text-sm font-semibold text-slate-700">Parte {pi + 1}</p>
              </div>
              <div className="p-3 space-y-2">
                <div>
                  <label className="text-xs text-slate-500">Músicos necesarios en esta parte</label>
                  <input type="number" min="1" max="14"
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm mt-1"
                    placeholder="Dejar vacío si no hay libranza por parte"
                    value={parte.musicosNecesarios}
                    onChange={e => updateParte(pi, 'musicosNecesarios', e.target.value)} />
                </div>
                <p className="text-xs text-slate-500 font-medium">Obras:</p>
                {parte.obras.map((obra, oi) => (
                  <div key={oi} className="bg-slate-50 rounded-lg p-2.5 space-y-1.5">
                    <div className="flex gap-1.5">
                      <input className="flex-1 border border-slate-300 rounded-lg px-2 py-1.5 text-xs"
                        placeholder="Título de la obra" value={obra.titulo}
                        onChange={e => updateObra(pi, oi, 'titulo', e.target.value)} />
                      {oi > 0 && (
                        <button onClick={() => removeObra(pi, oi)} className="text-red-400 px-1 text-sm">✕</button>
                      )}
                    </div>
                    <input className="w-full border border-slate-300 rounded-lg px-2 py-1.5 text-xs"
                      placeholder="Compositor" value={obra.compositor}
                      onChange={e => updateObra(pi, oi, 'compositor', e.target.value)} />
                    <input type="number" min="1" max="14"
                      className="w-full border border-slate-300 rounded-lg px-2 py-1.5 text-xs"
                      placeholder="Músicos necesarios (dejar vacío si no hay libranza)"
                      value={obra.musicosNecesarios}
                      onChange={e => updateObra(pi, oi, 'musicosNecesarios', e.target.value)} />
                  </div>
                ))}
                {parte.obras.length < 2 && (
                  <button onClick={() => addObra(pi)} className="text-xs text-blue-700 font-medium">+ Añadir obra</button>
                )}
              </div>
            </div>
          ))}

          {error && <p className="text-red-600 text-sm">{error}</p>}

          <div className="flex gap-2">
            <button onClick={() => setPaso(1)} className="flex-1 border border-slate-300 text-slate-700 py-3 rounded-xl text-sm">← Atrás</button>
            <button onClick={calcular} disabled={guardando}
              className="flex-1 bg-blue-900 text-white py-3 rounded-xl text-sm font-medium disabled:opacity-50">
              {guardando ? 'Calculando...' : 'Calcular →'}
            </button>
          </div>
        </div>
      )}

      {paso === 3 && (
        <div className="space-y-3">
          {libranzasExistentes.length > 0 && (
            <div className="bg-slate-50 rounded-xl p-3">
              <p className="text-xs font-semibold text-slate-600 mb-1">Libranzas ya asignadas (se mantienen):</p>
              {libranzasExistentes.map(lib => {
                const m = musicos.find(m => m.id === lib.musicoId)
                return (
                  <p key={lib.id} className="text-xs text-slate-500">
                    {m ? `${m.apellidos}, ${m.nombre}` : lib.musicoId} — {lib.tipo}{lib.obraTitulo ? ` (${lib.obraTitulo})` : ''}
                  </p>
                )
              })}
            </div>
          )}

          {libranzasNuevas.length === 0 ? (
            <div className="bg-green-50 rounded-xl p-4 text-center">
              <p className="text-green-700 font-medium text-sm">✓ Sin nuevas libranzas que añadir</p>
            </div>
          ) : (
            <>
              <p className="text-sm text-slate-600">Nuevas libranzas a añadir:</p>
              {libranzasNuevas.map((sec, i) => (
                <div key={i} className="bg-blue-50 border border-blue-100 rounded-xl p-3">
                  <p className="text-xs font-semibold text-blue-700 mb-1">{sec.titulo}{sec.subtitulo ? ` · ${sec.subtitulo}` : ''}</p>
                  {sec.sugeridos.map(uid => (
                    <p key={uid} className="text-sm text-blue-800">🎻 {nombreMusico(uid)}</p>
                  ))}
                  {sec.pendientesNuevos.length > 0 && (
                    <p className="text-xs text-amber-600 mt-1">⚠️ Pendientes: {sec.pendientesNuevos.map(uid => nombreMusico(uid)).join(', ')}</p>
                  )}
                </div>
              ))}
            </>
          )}

          {error && <p className="text-red-600 text-sm">{error}</p>}

          <div className="flex gap-2 pt-1">
            <button onClick={() => setPaso(2)} className="flex-1 border border-slate-300 text-slate-700 py-3 rounded-xl text-sm">← Atrás</button>
            <button onClick={guardarTodo} disabled={guardando}
              className="flex-1 bg-blue-900 text-white py-3 rounded-xl text-sm font-medium disabled:opacity-50">
              {guardando ? 'Guardando...' : '✓ Guardar cambios'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
