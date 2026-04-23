import { useEffect, useState } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { obtenerProyecto, actualizarProyecto, eliminarProyecto, obtenerLibranzasProyecto, obtenerMusicos } from '../../services/libranzas'
import {
  collection, addDoc, getDocs, doc, deleteDoc, updateDoc,
  query, where, serverTimestamp
} from 'firebase/firestore'
import { db } from '../../services/firebase'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { calcularRetenes } from '../../utils/reten'

const TIPO_BADGE = {
  proyecto: 'bg-green-100 text-green-700',
  parte: 'bg-amber-100 text-amber-700',
  obra: 'bg-blue-100 text-blue-700',
}

export default function ProyectoDetalle() {
  const { id } = useParams()
  const { usuario: admin } = useAuth()
  const navigate = useNavigate()
  const [proyecto, setProyecto] = useState(null)
  const [conciertos, setConciertos] = useState([])
  const [libranzas, setLibranzas] = useState([])
  const [musicos, setMusicos] = useState([])
  const [cargando, setCargando] = useState(true)
  const [modalConcierto, setModalConcierto] = useState(false)
  const [formConcierto, setFormConcierto] = useState({
    fecha: '', hora: '',
    parte1Musicos: '', parte1Obras: [{ titulo: '', compositor: '', musicosNecesarios: '' }],
    parte2Musicos: '', parte2Obras: [{ titulo: '', compositor: '', musicosNecesarios: '' }],
  })
  const [guardando, setGuardando] = useState(false)

  async function cargar() {
    try {
      const [p, ms, libs] = await Promise.all([
        obtenerProyecto(id),
        obtenerMusicos(),
        obtenerLibranzasProyecto(id),
      ])
      setProyecto(p)
      setMusicos(ms)
      setLibranzas(libs)
      const snap = await getDocs(query(collection(db, 'conciertos'), where('proyectoId', '==', id)))
      setConciertos(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    } catch (e) {
      console.error('Error cargando proyecto:', e)
    } finally {
      setCargando(false)
    }
  }

  useEffect(() => { cargar() }, [id])

  function updateObra(parte, idx, campo, valor) {
    setFormConcierto(f => {
      const key = `parte${parte}Obras`
      const obras = [...f[key]]
      obras[idx] = { ...obras[idx], [campo]: valor }
      return { ...f, [key]: obras }
    })
  }

  function addObra(parte) {
    const key = `parte${parte}Obras`
    setFormConcierto(f => ({ ...f, [key]: [...f[key], { titulo: '', compositor: '', musicosNecesarios: '' }] }))
  }

  function removeObra(parte, idx) {
    const key = `parte${parte}Obras`
    setFormConcierto(f => ({ ...f, [key]: f[key].filter((_, i) => i !== idx) }))
  }

  async function guardarConcierto() {
    setGuardando(true)
    try {
      const concierto = {
        proyectoId: id,
        temporadaId: proyecto.temporadaId,
        fecha: new Date(formConcierto.fecha),
        hora: formConcierto.hora,
        tipo: 'concierto',
        partes: [
          {
            numero: 1,
            musicosNecesarios: parseInt(formConcierto.parte1Musicos) || null,
            obras: formConcierto.parte1Obras.filter(o => o.titulo).map(o => ({
              titulo: o.titulo,
              compositor: o.compositor,
              musicosNecesarios: parseInt(o.musicosNecesarios) || null,
            })),
          },
          {
            numero: 2,
            musicosNecesarios: parseInt(formConcierto.parte2Musicos) || null,
            obras: formConcierto.parte2Obras.filter(o => o.titulo).map(o => ({
              titulo: o.titulo,
              compositor: o.compositor,
              musicosNecesarios: parseInt(o.musicosNecesarios) || null,
            })),
          },
        ],
        creadoEn: serverTimestamp(),
      }
      await addDoc(collection(db, 'conciertos'), concierto)
      await cargar()
      setModalConcierto(false)
    } finally {
      setGuardando(false)
    }
  }

  async function eliminarConcierto(cid) {
    if (!confirm('¿Eliminar este concierto?')) return
    await deleteDoc(doc(db, 'conciertos', cid))
    await cargar()
  }

  if (cargando) return <div className="flex items-center justify-center h-64 text-slate-400 text-sm">Cargando...</div>
  if (!proyecto) return <div className="p-4 text-slate-500">Proyecto no encontrado.</div>

  return (
    <div className="p-4 max-w-lg mx-auto">
      <div className="flex items-center justify-between mb-4">
        <Link to="/admin/proyectos" className="text-slate-400 text-sm flex items-center gap-1">‹ Proyectos</Link>
        <Link to={`/admin/proyectos/${id}/editar`} className="text-sm text-blue-700 font-medium">Editar</Link>
      </div>
      <div className="mb-4">
        {proyecto.fechaInicio && (
          <p className="text-sm text-slate-400" style={{marginTop: 0}}>
            {format(proyecto.fechaInicio.toDate(), "d 'de' MMMM", { locale: es })}
            {proyecto.fechaFin ? ` – ${format(proyecto.fechaFin.toDate(), "d 'de' MMMM yyyy", { locale: es })}` : ''}
          </p>
        )}
        {proyecto.descripcion && <p className="text-sm text-slate-500 mt-1">{proyecto.descripcion}</p>}
      </div>

      {/* Resumen de libranzas */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden mb-4">
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
          <h3 className="text-sm font-semibold text-slate-700">Libranzas</h3>
          <Link to={`/admin/proyectos/${id}/libranzas`} className="text-xs text-blue-700 font-medium">
            Gestionar →
          </Link>
        </div>
        {libranzas.length === 0 ? (
          <p className="text-xs text-slate-400 px-4 py-3 text-center">Sin libranzas asignadas</p>
        ) : (
          <div className="divide-y divide-slate-50">
            {(() => {
              const retenes = calcularRetenes(libranzas)
              return libranzas.map(lib => {
                const m = musicos.find(m => m.id === lib.musicoId)
                const permiso = lib.esPermiso
                  ? { motivo: lib.motivoPermiso }
                  : (proyecto.permisosBajas || []).find(p => p.musicoId === lib.musicoId)
                return (
                  <div key={lib.id} className="flex items-center gap-2 px-4 py-2.5">
                    <span className="flex-1 text-sm text-slate-700">
                      {m ? `${m.apellidos}, ${m.nombre}` : lib.musicoId}
                    </span>
                    {permiso ? (
                      <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-red-100 text-red-700">
                        {permiso.motivo ? `Permiso: ${permiso.motivo}` : 'Permiso / Baja'}
                      </span>
                    ) : (
                      <div className="flex items-center gap-1">
                        {retenes.has(lib.id) && (
                          <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-orange-100 text-orange-700">Retén</span>
                        )}
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${TIPO_BADGE[lib.tipo]}`}>
                          {lib.tipo === 'proyecto' ? '😊 Proyecto' : lib.tipo === 'parte' ? `Parte ${lib.parteNumero}` : `${lib.obraTitulo || 'Obra'}${lib.parteNumero ? ` (P${lib.parteNumero})` : ''}`}
                        </span>
                      </div>
                    )}
                  </div>
                )
              })
            })()}
          </div>
        )}
      </div>

      {/* Conciertos */}
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-semibold text-slate-700">Conciertos</h3>
        <button
          onClick={() => setModalConcierto(true)}
          className="text-xs bg-slate-100 text-slate-700 px-3 py-1.5 rounded-lg font-medium"
        >
          + Añadir
        </button>
      </div>

      {conciertos.length === 0 ? (
        <p className="text-sm text-slate-400 text-center py-4">Sin conciertos definidos.</p>
      ) : (
        <div className="space-y-3">
          {conciertos.sort((a, b) => a.fecha?.toDate?.() - b.fecha?.toDate?.()).map(c => (
            <div key={c.id} className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-700">
                    {c.fecha ? format(c.fecha.toDate(), "EEEE d 'de' MMMM", { locale: es }) : 'Sin fecha'}
                    {c.hora ? ` · ${c.hora}` : ''}
                  </p>
                </div>
                <button onClick={() => eliminarConcierto(c.id)} className="text-red-400 text-xs">✕</button>
              </div>
              {c.partes?.map(parte => (
                <div key={parte.numero} className="px-4 py-2 border-b border-slate-50 last:border-0">
                  <p className="text-xs font-semibold text-slate-500 mb-1">
                    Parte {parte.numero}
                    {parte.musicosNecesarios ? ` · ${parte.musicosNecesarios} músicos` : ''}
                  </p>
                  {parte.obras?.map((obra, oi) => (
                    <div key={oi} className="text-xs text-slate-600 pl-2 py-0.5">
                      {obra.titulo}
                      {obra.compositor ? ` — ${obra.compositor}` : ''}
                      {obra.musicosNecesarios ? ` (${obra.musicosNecesarios})` : ''}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          ))}
        </div>
      )}

      {/* Modal concierto */}
      {modalConcierto && (
        <div className="fixed inset-0 bg-black/40 flex items-end justify-center z-50 p-2">
          <div className="bg-white rounded-2xl w-full max-w-sm p-5 space-y-3 max-h-[90vh] overflow-y-auto">
            <h3 className="font-semibold text-slate-800">Añadir concierto</h3>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs text-slate-500">Fecha</label>
                <input type="date" className="w-full border border-slate-300 rounded-lg px-2 py-2 text-sm mt-1"
                  value={formConcierto.fecha} onChange={e => setFormConcierto(f => ({ ...f, fecha: e.target.value }))} />
              </div>
              <div>
                <label className="text-xs text-slate-500">Hora</label>
                <input type="time" className="w-full border border-slate-300 rounded-lg px-2 py-2 text-sm mt-1"
                  value={formConcierto.hora} onChange={e => setFormConcierto(f => ({ ...f, hora: e.target.value }))} />
              </div>
            </div>

            {[1, 2].map(np => (
              <div key={np} className="border border-slate-200 rounded-xl p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold text-slate-600">Parte {np}</p>
                </div>
                <div>
                  <label className="text-xs text-slate-500">Músicos necesarios en esta parte</label>
                  <input type="number" min="1" max="14" className="w-full border border-slate-300 rounded-lg px-2 py-2 text-sm mt-1"
                    placeholder="Ej: 12"
                    value={formConcierto[`parte${np}Musicos`]}
                    onChange={e => setFormConcierto(f => ({ ...f, [`parte${np}Musicos`]: e.target.value }))} />
                </div>
                <p className="text-xs text-slate-500 mt-1">Obras:</p>
                {formConcierto[`parte${np}Obras`].map((obra, oi) => (
                  <div key={oi} className="space-y-1.5 bg-slate-50 rounded-lg p-2">
                    <div className="flex gap-1">
                      <input className="flex-1 border border-slate-300 rounded px-2 py-1.5 text-xs"
                        placeholder="Título" value={obra.titulo}
                        onChange={e => updateObra(np, oi, 'titulo', e.target.value)} />
                      {oi > 0 && (
                        <button onClick={() => removeObra(np, oi)} className="text-red-400 text-xs px-1">✕</button>
                      )}
                    </div>
                    <input className="w-full border border-slate-300 rounded px-2 py-1.5 text-xs"
                      placeholder="Compositor" value={obra.compositor}
                      onChange={e => updateObra(np, oi, 'compositor', e.target.value)} />
                    <input type="number" min="1" max="14" className="w-full border border-slate-300 rounded px-2 py-1.5 text-xs"
                      placeholder="Músicos necesarios para esta obra"
                      value={obra.musicosNecesarios}
                      onChange={e => updateObra(np, oi, 'musicosNecesarios', e.target.value)} />
                  </div>
                ))}
                {formConcierto[`parte${np}Obras`].length < 2 && (
                  <button onClick={() => addObra(np)} className="text-xs text-blue-700 font-medium">+ Añadir obra</button>
                )}
              </div>
            ))}

            <div className="flex gap-2 pt-1">
              <button onClick={() => setModalConcierto(false)} className="flex-1 border border-slate-300 text-slate-700 py-2.5 rounded-lg text-sm">Cancelar</button>
              <button onClick={guardarConcierto} disabled={guardando || !formConcierto.fecha}
                className="flex-1 bg-blue-900 text-white py-2.5 rounded-lg text-sm font-medium disabled:opacity-50">
                {guardando ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
