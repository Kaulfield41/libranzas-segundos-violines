import { useEffect, useState } from 'react'
import { collection, doc, setDoc, updateDoc, deleteDoc, getDocs, query, orderBy } from 'firebase/firestore'
import { createUserWithEmailAndPassword } from 'firebase/auth'
import { auth, authSecundaria, db } from '../../services/firebase'
import { useAuth } from '../../context/AuthContext'
import { registrarHistorial, ACCIONES } from '../../services/historial'

const PUESTOS = [
  { value: 'normal', label: 'Tutti' },
  { value: 'ayuda_solista', label: 'Ayuda de solista' },
  { value: 'solista', label: 'Solista' },
]

const PUESTO_BADGE = {
  normal: 'bg-slate-100 text-slate-600',
  ayuda_solista: 'bg-amber-100 text-amber-700',
  solista: 'bg-purple-100 text-purple-700',
}

export default function Musicos() {
  const { usuario: admin } = useAuth()
  const [musicos, setMusicos] = useState([])
  const [cargando, setCargando] = useState(true)
  const [modal, setModal] = useState(null) // null | 'nuevo' | {musico}
  const [form, setForm] = useState({ nombre: '', apellidos: '', email: '', password: '', puesto: 'normal', observador: false })
  const [error, setError] = useState('')
  const [guardando, setGuardando] = useState(false)

  async function cargar() {
    const snap = await getDocs(collection(db, 'usuarios'))
    const lista = snap.docs.map(d => {
      const data = d.data()
      return { id: d.id, ...data, apellidos: data.apellidos || data.apellido || '' }
    })
    lista.sort((a, b) => a.apellidos.localeCompare(b.apellidos))
    setMusicos(lista)
    setCargando(false)
  }

  useEffect(() => { cargar() }, [])

  function abrirNuevo() {
    setForm({ nombre: '', apellidos: '', email: '', password: '', puesto: 'normal', observador: false })
    setError('')
    setModal('nuevo')
  }

  function abrirEditar(m) {
    setForm({ nombre: m.nombre, apellidos: m.apellidos, email: m.email, password: '', puesto: m.puesto || 'normal' })
    setError('')
    setModal(m)
  }

  async function guardarNuevo() {
    setGuardando(true)
    setError('')
    try {
      const cred = await createUserWithEmailAndPassword(authSecundaria, form.email, form.password)
      await setDoc(doc(db, 'usuarios', cred.user.uid), {
        nombre: form.nombre,
        apellidos: form.apellidos,
        email: form.email,
        puesto: form.observador ? null : form.puesto,
        rol: form.observador ? 'observador' : 'musico',
        activo: true,
      })
      await registrarHistorial({
        usuarioId: admin.id,
        usuarioNombre: `${admin.nombre} ${admin.apellidos}`,
        accion: ACCIONES.CREAR_MUSICO,
        entidad: 'usuario',
        entidadId: cred.user.uid,
        datos: { nombre: form.nombre, apellidos: form.apellidos, puesto: form.puesto },
      })
      await cargar()
      setModal(null)
    } catch (e) {
      setError(e.code === 'auth/email-already-in-use' ? 'Ese email ya está en uso.' : e.message)
    } finally {
      setGuardando(false)
    }
  }

  async function guardarEdicion() {
    setGuardando(true)
    setError('')
    try {
      await updateDoc(doc(db, 'usuarios', modal.id), {
        nombre: form.nombre,
        apellidos: form.apellidos,
        puesto: form.puesto,
      })
      await registrarHistorial({
        usuarioId: admin.id,
        usuarioNombre: `${admin.nombre} ${admin.apellidos}`,
        accion: ACCIONES.MODIFICAR_MUSICO,
        entidad: 'usuario',
        entidadId: modal.id,
        datos: { nombre: form.nombre, apellidos: form.apellidos, puesto: form.puesto },
      })
      await cargar()
      setModal(null)
    } catch (e) {
      setError(e.message)
    } finally {
      setGuardando(false)
    }
  }

  if (cargando) return (
    <div className="flex items-center justify-center h-64 text-slate-400 text-sm">Cargando...</div>
  )

  return (
    <div className="p-4 max-w-lg mx-auto">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-slate-800">Músicos ({musicos.length})</h2>
        <button
          onClick={abrirNuevo}
          className="bg-blue-900 text-white text-sm px-3 py-1.5 rounded-lg font-medium"
        >
          + Añadir
        </button>
      </div>

      <div className="space-y-2">
        {musicos.map(m => (
          <div key={m.id} className="flex items-center gap-2 bg-white rounded-xl border border-slate-200 px-4 py-3">
            <button onClick={() => abrirEditar(m)} className="flex-1 flex items-center gap-3 text-left min-w-0">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-800">{m.apellidos}, {m.nombre}</p>
                <p className="text-xs text-slate-400">{m.email}</p>
              </div>
              <div className="flex flex-col items-end gap-1">
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${PUESTO_BADGE[m.puesto || 'normal']}`}>
                  {PUESTOS.find(p => p.value === m.puesto)?.label || 'Músico'}
                </span>
                {m.rol === 'admin' && (
                  <span className="text-xs text-blue-600 font-medium">Admin</span>
                )}
                {m.rol === 'observador' && (
                  <span className="text-xs text-slate-500 font-medium">Solo lectura</span>
                )}
              </div>
            </button>
            <a href={`/admin/musicos/${m.id}/historial`} className="text-xs text-slate-400 hover:text-blue-700 px-1 shrink-0">📋</a>
          </div>
        ))}
      </div>

      {/* Modal */}
      {modal && (
        <div className="fixed inset-0 bg-black/40 flex items-end justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm p-5 space-y-4">
            <h3 className="font-semibold text-slate-800">
              {modal === 'nuevo' ? 'Añadir músico' : `Editar: ${modal.apellidos}, ${modal.nombre}`}
            </h3>

            <div className="space-y-3">
              <input
                className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm"
                placeholder="Nombre"
                value={form.nombre}
                onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))}
              />
              <input
                className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm"
                placeholder="Apellidos"
                value={form.apellidos}
                onChange={e => setForm(f => ({ ...f, apellidos: e.target.value }))}
              />
              {modal === 'nuevo' && (
                <>
                  <input
                    type="email"
                    className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm"
                    placeholder="Email"
                    value={form.email}
                    onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                  />
                  <input
                    type="password"
                    className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm"
                    placeholder="Contraseña temporal"
                    value={form.password}
                    onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                  />
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={form.observador}
                      onChange={e => setForm(f => ({ ...f, observador: e.target.checked }))} />
                    <span className="text-sm text-slate-700">Solo lectura (no es músico de la sección)</span>
                  </label>
                </>
              )}
              {!form.observador && (
                <select
                  className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm"
                  value={form.puesto}
                  onChange={e => setForm(f => ({ ...f, puesto: e.target.value }))}
                >
                  {PUESTOS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
                </select>
              )}
            </div>

            {error && <p className="text-red-600 text-sm bg-red-50 px-3 py-2 rounded-lg">{error}</p>}

            <div className="flex gap-2 pt-1">
              <button
                onClick={() => setModal(null)}
                className="flex-1 border border-slate-300 text-slate-700 py-2.5 rounded-lg text-sm font-medium"
              >
                Cancelar
              </button>
              <button
                onClick={modal === 'nuevo' ? guardarNuevo : guardarEdicion}
                disabled={guardando}
                className="flex-1 bg-blue-900 text-white py-2.5 rounded-lg text-sm font-medium disabled:opacity-50"
              >
                {guardando ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
