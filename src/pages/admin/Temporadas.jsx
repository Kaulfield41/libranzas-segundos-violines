import { useEffect, useState } from 'react'
import { collection, addDoc, updateDoc, doc, getDocs, query, orderBy, serverTimestamp } from 'firebase/firestore'
import { db } from '../../services/firebase'
import { useAuth } from '../../context/AuthContext'
import { obtenerMusicos, obtenerProyectos } from '../../services/libranzas'
import { inicializarRotacion } from '../../services/rotacion'
import { registrarHistorial, ACCIONES } from '../../services/historial'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { Link, useNavigate } from 'react-router-dom'

export default function Temporadas() {
  const { usuario: admin } = useAuth()
  const navigate = useNavigate()
  const [temporadas, setTemporadas] = useState([])
  const [proyectosPorTemporada, setProyectosPorTemporada] = useState({})
  const [musicos, setMusicos] = useState([])
  const [modal, setModal] = useState(false)
  const [form, setForm] = useState({ nombre: '', fechaInicio: '', fechaFin: '' })
  const [ordenMusicos, setOrdenMusicos] = useState([])
  const [paso, setPaso] = useState(1)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')

  async function cargar() {
    const snap = await getDocs(query(collection(db, 'temporadas'), orderBy('fechaInicio', 'desc')))
    const ts = snap.docs.map(d => ({ id: d.id, ...d.data() }))
    setTemporadas(ts)
    const mapa = {}
    await Promise.all(ts.map(async t => {
      mapa[t.id] = await obtenerProyectos(t.id)
    }))
    setProyectosPorTemporada(mapa)
    const ms = await obtenerMusicos()
    setMusicos(ms)
    setOrdenMusicos(ms.map(m => m.id))
  }

  useEffect(() => { cargar() }, [])

  function moverMusico(idx, dir) {
    const nueva = [...ordenMusicos]
    const nuevoIdx = idx + dir
    if (nuevoIdx < 0 || nuevoIdx >= nueva.length) return
    ;[nueva[idx], nueva[nuevoIdx]] = [nueva[nuevoIdx], nueva[idx]]
    setOrdenMusicos(nueva)
  }

  async function crearTemporada() {
    setGuardando(true)
    setError('')
    try {
      // Desactivar temporadas anteriores
      for (const t of temporadas.filter(t => t.activa)) {
        await updateDoc(doc(db, 'temporadas', t.id), { activa: false })
      }
      const ref = await addDoc(collection(db, 'temporadas'), {
        nombre: form.nombre,
        fechaInicio: new Date(form.fechaInicio),
        fechaFin: new Date(form.fechaFin),
        activa: true,
        ordenRotacion: ordenMusicos,
        creadaEn: serverTimestamp(),
      })
      await inicializarRotacion(ref.id, ordenMusicos)
      await registrarHistorial({
        usuarioId: admin.id,
        usuarioNombre: `${admin.nombre} ${admin.apellidos}`,
        accion: ACCIONES.CREAR_TEMPORADA,
        entidad: 'temporada',
        entidadId: ref.id,
        datos: { nombre: form.nombre, ordenRotacion: ordenMusicos },
      })
      await cargar()
      setModal(false)
      setPaso(1)
    } catch (e) {
      setError(e.message)
    } finally {
      setGuardando(false)
    }
  }

  return (
    <div className="p-4 max-w-lg mx-auto">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-slate-800">Temporadas</h2>
        <button
          onClick={() => { setModal(true); setPaso(1); setError('') }}
          className="bg-blue-900 text-white text-sm px-3 py-1.5 rounded-lg font-medium"
        >
          + Nueva
        </button>
      </div>

      <div className="space-y-3">
        {temporadas.map(t => {
          const proyectos = proyectosPorTemporada[t.id] || []
          return (
            <div key={t.id} className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
              {/* Cabecera temporada */}
              <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-100">
                <div className="flex-1">
                  <p className="text-sm font-semibold text-slate-800">{t.nombre}</p>
                  {t.fechaInicio && (
                    <p className="text-xs text-slate-400">
                      {format(t.fechaInicio.toDate?.() || new Date(t.fechaInicio), "MMM yyyy", { locale: es })}
                      {' – '}
                      {t.fechaFin ? format(t.fechaFin.toDate?.() || new Date(t.fechaFin), "MMM yyyy", { locale: es }) : '—'}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {t.activa && (
                    <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">Activa</span>
                  )}
                  {t.activa && (
                    <button
                      onClick={() => navigate('/admin/proyectos/nuevo')}
                      className="text-xs bg-blue-900 text-white px-2.5 py-1 rounded-lg font-medium"
                    >
                      + Proyecto
                    </button>
                  )}
                </div>
              </div>

              {/* Proyectos de la temporada */}
              {proyectos.length === 0 ? (
                <p className="text-xs text-slate-400 px-4 py-3 text-center">Sin proyectos</p>
              ) : (
                <div className="divide-y divide-slate-50">
                  {proyectos.map(p => (
                    <Link
                      key={p.id}
                      to={`/admin/proyectos/${p.id}`}
                      className="flex items-center gap-3 px-4 py-2.5 active:bg-slate-50"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-slate-700 truncate">{p.nombre}</p>
                        <p className="text-xs text-slate-400">
                          {p.fechaInicio ? format(p.fechaInicio.toDate(), "d MMM yyyy", { locale: es }) : '—'}
                        </p>
                      </div>
                      <span className="text-slate-300 text-sm">›</span>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Modal */}
      {modal && (
        <div className="fixed inset-0 bg-black/40 flex items-end justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm p-5 space-y-4 max-h-[85vh] overflow-y-auto">
            {paso === 1 ? (
              <>
                <h3 className="font-semibold text-slate-800">Nueva temporada</h3>
                <div className="space-y-3">
                  <input
                    className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm"
                    placeholder="Nombre (ej: 2025-2026)"
                    value={form.nombre}
                    onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))}
                  />
                  <div>
                    <label className="block text-xs text-slate-500 mb-1">Fecha inicio</label>
                    <input type="date" className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm"
                      value={form.fechaInicio} onChange={e => setForm(f => ({ ...f, fechaInicio: e.target.value }))} />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-500 mb-1">Fecha fin</label>
                    <input type="date" className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm"
                      value={form.fechaFin} onChange={e => setForm(f => ({ ...f, fechaFin: e.target.value }))} />
                  </div>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => setModal(false)} className="flex-1 border border-slate-300 text-slate-700 py-2.5 rounded-lg text-sm">Cancelar</button>
                  <button
                    onClick={() => setPaso(2)}
                    disabled={!form.nombre || !form.fechaInicio}
                    className="flex-1 bg-blue-900 text-white py-2.5 rounded-lg text-sm font-medium disabled:opacity-50"
                  >
                    Siguiente →
                  </button>
                </div>
              </>
            ) : (
              <>
                <div>
                  <h3 className="font-semibold text-slate-800">Orden de rotación</h3>
                  <p className="text-xs text-slate-500 mt-1">
                    Este orden es el mismo para las 3 colas (proyecto, parte, obra). Puedes reordenarlo con las flechas.
                  </p>
                </div>
                <div className="space-y-1.5">
                  {ordenMusicos.map((uid, idx) => {
                    const m = musicos.find(m => m.id === uid)
                    if (!m) return null
                    return (
                      <div key={uid} className="flex items-center gap-2 bg-slate-50 rounded-lg px-3 py-2">
                        <span className="text-xs text-slate-400 w-5 text-center">{idx + 1}</span>
                        <span className="flex-1 text-sm text-slate-700">{m.apellidos}, {m.nombre}</span>
                        <div className="flex gap-1">
                          <button onClick={() => moverMusico(idx, -1)} disabled={idx === 0}
                            className="text-slate-400 disabled:opacity-20 w-6 h-6 flex items-center justify-center">↑</button>
                          <button onClick={() => moverMusico(idx, 1)} disabled={idx === ordenMusicos.length - 1}
                            className="text-slate-400 disabled:opacity-20 w-6 h-6 flex items-center justify-center">↓</button>
                        </div>
                      </div>
                    )
                  })}
                </div>
                {error && <p className="text-red-600 text-sm">{error}</p>}
                <div className="flex gap-2">
                  <button onClick={() => setPaso(1)} className="flex-1 border border-slate-300 text-slate-700 py-2.5 rounded-lg text-sm">← Atrás</button>
                  <button
                    onClick={crearTemporada}
                    disabled={guardando}
                    className="flex-1 bg-blue-900 text-white py-2.5 rounded-lg text-sm font-medium disabled:opacity-50"
                  >
                    {guardando ? 'Creando...' : 'Crear temporada'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
