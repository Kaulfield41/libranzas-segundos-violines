import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { obtenerTemporadaActiva, obtenerMusicos, crearProyecto } from '../../services/libranzas'
import { calcularLibranzas, TIPOS_LIBRANZA } from '../../services/rotacion'
import { collection, addDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '../../services/firebase'
import { crearLibranzasLote, crearLibranzasPermiso } from '../../services/libranzas'

const obraVacia = () => ({ titulo: '', compositor: '', musicosNecesarios: '' })
const parteVacia = () => ({ musicosNecesarios: '', obras: [obraVacia()] })

export default function NuevoProyecto() {
  const { usuario: admin } = useAuth()
  const navigate = useNavigate()
  const [paso, setPaso] = useState(1)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')
  const [musicosDisponibles, setMusicosDisponibles] = useState([])

  const [form, setForm] = useState({
    nombre: '',
    descripcion: '',
    fechaInicio: '',
    fechaFin: '',
    musicosNecesarios: '',
    permisosBajas: [],
    intercambios: [], // [{ musicoA: uid, musicoB: uid }] — A cede su turno a B
  })

  const [concierto, setConcierto] = useState({
    fecha: '',
    hora: '',
    partes: [parteVacia(), parteVacia()],
  })

  const [libranzasCalculadas, setLibranzasCalculadas] = useState([])
  const [musicos, setMusicos] = useState([])
  const [temporada, setTemporada] = useState(null)

  useEffect(() => { obtenerMusicos().then(setMusicos) }, [])

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
      const t = await obtenerTemporadaActiva()
      const ms = await obtenerMusicos()
      setTemporada(t)
      setMusicos(ms)
      setMusicosDisponibles(ms)

      // Excluir músicos de permiso/baja del cálculo
      const uidsPermiso = form.permisosBajas.map(p => p.musicoId)
      const msDisponibles = ms.filter(m => !uidsPermiso.includes(m.id))

      const secciones = []
      const yaLibranProyecto = []

      const intercambiosValidos = form.intercambios.filter(i => i.musicoA && i.musicoB)

      // Proyecto completo
      if (form.musicosNecesarios) {
        const mn = parseInt(form.musicosNecesarios)
        const numLibranzas = msDisponibles.length - mn
        if (numLibranzas > 0) {
          const calc = await calcularLibranzas({
            temporadaId: t.id,
            tipo: TIPOS_LIBRANZA.PROYECTO,
            totalSeccion: msDisponibles.length,
            musicosNecesarios: mn,
            musicos: msDisponibles,
            yaLibrando: [],
            intercambiosProyecto: intercambiosValidos,
          })
          yaLibranProyecto.push(...calc.asignados)
          secciones.push({
            tipo: TIPOS_LIBRANZA.PROYECTO,
            titulo: 'Proyecto completo',
            musicosNecesarios: mn,
            sugeridos: calc.asignados,
            pendientesNuevos: calc.pendientesNuevos,
            deudasNuevas: calc.deudasNuevas,
            deudasResueltas: calc.deudasResueltas,
            datos: {},
          })
        }
      }

      // Partes y obras
      for (let pi = 0; pi < concierto.partes.length; pi++) {
        const parte = concierto.partes[pi]
        const yaLibranParte = []

        if (parte.musicosNecesarios) {
          const mn = parseInt(parte.musicosNecesarios)
          const yaLibrando = [...yaLibranProyecto]
          const numLibranzas = msDisponibles.length - mn - yaLibranProyecto.length
          if (numLibranzas > 0) {
            const calc = await calcularLibranzas({
              temporadaId: t.id,
              tipo: TIPOS_LIBRANZA.PARTE,
              totalSeccion: msDisponibles.length,
              musicosNecesarios: mn,
              musicos: msDisponibles,
              yaLibrando,
              intercambiosProyecto: intercambiosValidos,
            })
            yaLibranParte.push(...calc.asignados)
            secciones.push({
              tipo: TIPOS_LIBRANZA.PARTE,
              titulo: `Parte ${pi + 1}`,
              musicosNecesarios: mn,
              sugeridos: calc.asignados,
              pendientesNuevos: calc.pendientesNuevos,
              deudasNuevas: calc.deudasNuevas,
              deudasResueltas: calc.deudasResueltas,
              uidsYaLibrando: [...yaLibranProyecto],
              datos: { parteNumero: pi + 1 },
            })
          }
        }

        for (let oi = 0; oi < parte.obras.length; oi++) {
          const obra = parte.obras[oi]
          if (!obra.musicosNecesarios || !obra.titulo) continue
          const mn = parseInt(obra.musicosNecesarios)
          const yaLibrando = [...yaLibranProyecto, ...yaLibranParte]
          const numLibranzas = msDisponibles.length - mn - yaLibranProyecto.length - yaLibranParte.length
          if (numLibranzas > 0) {
            const calc = await calcularLibranzas({
              temporadaId: t.id,
              tipo: TIPOS_LIBRANZA.OBRA,
              totalSeccion: msDisponibles.length,
              musicosNecesarios: mn,
              musicos: msDisponibles,
              yaLibrando,
              intercambiosProyecto: intercambiosValidos,
            })
            secciones.push({
              tipo: TIPOS_LIBRANZA.OBRA,
              titulo: obra.titulo,
              subtitulo: `Parte ${pi + 1}`,
              musicosNecesarios: mn,
              sugeridos: calc.asignados,
              pendientesNuevos: calc.pendientesNuevos,
              deudasNuevas: calc.deudasNuevas,
              deudasResueltas: calc.deudasResueltas,
              uidsYaLibrando: [...yaLibranProyecto, ...yaLibranParte],
              datos: { parteNumero: pi + 1, obraIndex: oi, obraTitulo: obra.titulo },
            })
          }
        }
      }

      setLibranzasCalculadas(secciones)
      setPaso(3)
    } catch (e) {
      setError('Error al calcular libranzas: ' + e.message)
    } finally {
      setGuardando(false)
    }
  }

  async function guardarTodo() {
    setGuardando(true)
    setError('')
    try {
      // 1. Crear proyecto
      const proyectoId = await crearProyecto({
        temporadaId: temporada.id,
        nombre: form.nombre,
        descripcion: form.descripcion,
        fechaInicio: new Date(form.fechaInicio),
        fechaFin: form.fechaFin ? new Date(form.fechaFin) : new Date(form.fechaInicio),
        musicosNecesarios: form.musicosNecesarios ? parseInt(form.musicosNecesarios) : null,
        permisosBajas: form.permisosBajas,
      }, admin.id, `${admin.nombre} ${admin.apellidos}`)

      // 2. Crear concierto si tiene fecha
      let conciertoId = null
      if (concierto.fecha) {
        const ref = await addDoc(collection(db, 'conciertos'), {
          proyectoId,
          temporadaId: temporada.id,
          fecha: new Date(concierto.fecha),
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
          creadoEn: serverTimestamp(),
        })
        conciertoId = ref.id
      }

      // 3. Crear libranzas
      for (const sec of libranzasCalculadas) {
        if (sec.sugeridos.length === 0) continue
        const libranzasACrear = sec.sugeridos.map(uid => ({
          musicoId: uid,
          proyectoId,
          temporadaId: temporada.id,
          tipo: sec.tipo,
          conciertoId: conciertoId || null,
          ...sec.datos,
          musicosNecesarios: sec.musicosNecesarios,
          esPendienteResuelta: false,
        }))
        await crearLibranzasLote(
          libranzasACrear,
          sec.pendientesNuevos,
          temporada.id,
          sec.tipo,
          admin.id,
          `${admin.nombre} ${admin.apellidos}`,
          null,
          { deudasNuevas: sec.deudasNuevas || [], deudasResueltas: sec.deudasResueltas || [], intercambiosProyecto: form.intercambios.filter(i => i.musicoA && i.musicoB), uidsPermiso: [...form.permisosBajas.map(p => p.musicoId), ...(sec.uidsYaLibrando || [])] }
        )
      }

      // 4. Crear libranzas por permiso/baja
      if (form.permisosBajas.length > 0) {
        await crearLibranzasPermiso(
          form.permisosBajas.map(p => ({
            musicoId: p.musicoId,
            proyectoId,
            temporadaId: temporada.id,
            tipo: 'proyecto',
            conciertoId: conciertoId || null,
            motivoPermiso: p.motivo || '',
            musicosNecesarios: form.musicosNecesarios ? parseInt(form.musicosNecesarios) : null,
          })),
          admin.id,
          `${admin.nombre} ${admin.apellidos}`
        )
      }

      navigate(`/admin/proyectos/${proyectoId}`)
    } catch (e) {
      setError('Error al guardar: ' + e.message)
    } finally {
      setGuardando(false)
    }
  }

  function nombreMusico(uid) {
    const m = musicos.find(m => m.id === uid)
    return m ? `${m.apellidos}, ${m.nombre}` : uid
  }

  return (
    <div className="p-4 max-w-lg mx-auto pb-8">
      <Link to="/admin/proyectos" className="text-slate-400 text-sm flex items-center gap-1 mb-4">‹ Proyectos</Link>
      {/* Indicador de paso */}
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
          {paso === 1 ? 'Datos del proyecto' : paso === 2 ? 'Estructura del concierto' : 'Confirmar libranzas'}
        </span>
      </div>

      {/* PASO 1: Datos básicos */}
      {paso === 1 && (
        <div className="space-y-3">
          <input className="w-full border border-slate-300 rounded-xl px-3 py-3 text-sm"
            placeholder="Nombre del proyecto (ej: Programa 5 – Brahms)"
            value={form.nombre} onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))} />
          <input className="w-full border border-slate-300 rounded-xl px-3 py-3 text-sm"
            placeholder="Descripción (opcional)"
            value={form.descripcion} onChange={e => setForm(f => ({ ...f, descripcion: e.target.value }))} />
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
            <label className="text-xs text-slate-500 mb-1 block">Músicos necesarios para todo el proyecto (si libra alguien la semana completa)</label>
            <input type="number" min="1" max="14" className="w-full border border-slate-300 rounded-xl px-3 py-2.5 text-sm"
              placeholder="Ej: 12 — dejar vacío si todos tocan"
              value={form.musicosNecesarios} onChange={e => setForm(f => ({ ...f, musicosNecesarios: e.target.value }))} />
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
                        <input type="checkbox" checked={!!permiso}
                          onChange={() => togglePermiso(m.id)} />
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
        </div>
      )}

      {/* PASO 2: Estructura del concierto */}
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
                    placeholder="Ej: 12 — dejar vacío si no hay libranza por parte"
                    value={parte.musicosNecesarios}
                    onChange={e => updateParte(pi, 'musicosNecesarios', e.target.value)} />
                </div>
                <p className="text-xs text-slate-500 font-medium">Obras:</p>
                {parte.obras.map((obra, oi) => (
                  <div key={oi} className="bg-slate-50 rounded-lg p-2.5 space-y-1.5">
                    <div className="flex gap-1.5">
                      <input className="flex-1 border border-slate-300 rounded-lg px-2 py-1.5 text-xs"
                        placeholder="Título de la obra"
                        value={obra.titulo} onChange={e => updateObra(pi, oi, 'titulo', e.target.value)} />
                      {oi > 0 && (
                        <button onClick={() => removeObra(pi, oi)} className="text-red-400 px-1 text-sm">✕</button>
                      )}
                    </div>
                    <input className="w-full border border-slate-300 rounded-lg px-2 py-1.5 text-xs"
                      placeholder="Compositor"
                      value={obra.compositor} onChange={e => updateObra(pi, oi, 'compositor', e.target.value)} />
                    <input type="number" min="1" max="14"
                      className="w-full border border-slate-300 rounded-lg px-2 py-1.5 text-xs"
                      placeholder="Músicos necesarios para esta obra (dejar vacío si no hay libranza)"
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
              {guardando ? 'Calculando...' : 'Calcular libranzas →'}
            </button>
          </div>
        </div>
      )}

      {/* PASO 3: Confirmar libranzas */}
      {paso === 3 && (
        <div className="space-y-3">
          <p className="text-sm text-slate-600 mb-1">Libranzas calculadas según la rotación:</p>

          {form.permisosBajas.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
              <p className="text-xs font-semibold text-amber-700 mb-1">🏥 Permisos / Bajas (no libran, no trabajan)</p>
              {form.permisosBajas.map(p => {
                const m = musicos.find(m => m.id === p.musicoId)
                return (
                  <p key={p.musicoId} className="text-sm text-amber-800">
                    {m ? `${m.apellidos}, ${m.nombre}` : p.musicoId}
                    {p.motivo ? ` — ${p.motivo}` : ''}
                  </p>
                )
              })}
            </div>
          )}

          {libranzasCalculadas.length === 0 ? (
            <div className="bg-green-50 rounded-xl p-4 text-center">
              <p className="text-green-700 font-medium text-sm">✓ Nadie libra en este proyecto</p>
              <p className="text-green-600 text-xs mt-1">Todos los músicos disponibles tocan en todo</p>
            </div>
          ) : (
            libranzasCalculadas.map((sec, i) => (
              <div key={i} className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                <div className="px-3 py-2 bg-slate-50 border-b border-slate-100">
                  <p className="text-xs font-semibold text-slate-600">{sec.titulo}</p>
                  {sec.subtitulo && <p className="text-xs text-slate-400">{sec.subtitulo}</p>}
                  <p className="text-xs text-slate-400">{sec.musicosNecesarios} músicos necesarios</p>
                </div>
                <div className="px-3 py-2">
                  {sec.sugeridos.map(uid => (
                    <p key={uid} className="text-sm text-slate-700 py-0.5">🎻 {nombreMusico(uid)}</p>
                  ))}
                  {sec.pendientesNuevos.length > 0 && (
                    <p className="text-xs text-amber-600 mt-1">
                      ⚠️ Quedan pendientes: {sec.pendientesNuevos.map(uid => nombreMusico(uid)).join(', ')}
                    </p>
                  )}
                </div>
              </div>
            ))
          )}

          {error && <p className="text-red-600 text-sm">{error}</p>}

          <div className="flex gap-2 pt-2">
            <button onClick={() => setPaso(2)} className="flex-1 border border-slate-300 text-slate-700 py-3 rounded-xl text-sm">← Atrás</button>
            <button onClick={guardarTodo} disabled={guardando}
              className="flex-1 bg-blue-900 text-white py-3 rounded-xl text-sm font-medium disabled:opacity-50">
              {guardando ? 'Guardando...' : '✓ Confirmar y guardar'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
