import {
  collection, doc, addDoc, updateDoc, deleteDoc,
  getDocs, getDoc, query, where, orderBy, serverTimestamp
} from 'firebase/firestore'
import { db } from './firebase'
import { registrarHistorial, ACCIONES } from './historial'
import { confirmarAsignacion } from './rotacion'

// ─── MÚSICOS ──────────────────────────────────────────────────────────────────

function normalizarMusico(data) {
  // Acepta tanto 'apellido' como 'apellidos' en Firestore
  return { ...data, apellidos: data.apellidos || data.apellido || '' }
}

export async function obtenerMusicos() {
  const snap = await getDocs(collection(db, 'usuarios'))
  const lista = snap.docs
    .map(d => ({ id: d.id, ...normalizarMusico(d.data()) }))
    .filter(m => m.rol !== 'observador')
  lista.sort((a, b) => a.apellidos.localeCompare(b.apellidos))
  return lista
}

export async function obtenerMusico(uid) {
  const snap = await getDoc(doc(db, 'usuarios', uid))
  return snap.exists() ? { id: snap.id, ...snap.data() } : null
}

// ─── TEMPORADAS ───────────────────────────────────────────────────────────────

export async function obtenerTemporadas() {
  const snap = await getDocs(query(collection(db, 'temporadas'), orderBy('fechaInicio', 'desc')))
  return snap.docs.map(d => ({ id: d.id, ...d.data() }))
}

export async function obtenerTemporadaActiva() {
  const snap = await getDocs(query(collection(db, 'temporadas'), where('activa', '==', true)))
  if (snap.empty) return null
  return { id: snap.docs[0].id, ...snap.docs[0].data() }
}

export async function crearTemporada(datos, adminId, adminNombre) {
  const ref = await addDoc(collection(db, 'temporadas'), {
    ...datos,
    activa: true,
    creadaEn: serverTimestamp(),
  })
  await registrarHistorial({
    usuarioId: adminId,
    usuarioNombre: adminNombre,
    accion: ACCIONES.CREAR_TEMPORADA,
    entidad: 'temporada',
    entidadId: ref.id,
    datos,
  })
  return ref.id
}

// ─── PROYECTOS ────────────────────────────────────────────────────────────────

export async function obtenerProyectos(temporadaId) {
  const snap = await getDocs(
    query(collection(db, 'proyectos'), where('temporadaId', '==', temporadaId))
  )
  const lista = snap.docs.map(d => ({ id: d.id, ...d.data() }))
  lista.sort((a, b) => {
    const fa = a.fechaInicio?.toDate?.() || new Date(a.fechaInicio || 0)
    const fb = b.fechaInicio?.toDate?.() || new Date(b.fechaInicio || 0)
    return fa - fb
  })
  return lista
}

export async function obtenerProyecto(id) {
  const snap = await getDoc(doc(db, 'proyectos', id))
  return snap.exists() ? { id: snap.id, ...snap.data() } : null
}

export async function crearProyecto(datos, adminId, adminNombre) {
  const ref = await addDoc(collection(db, 'proyectos'), {
    ...datos,
    creadoEn: serverTimestamp(),
  })
  await registrarHistorial({
    usuarioId: adminId,
    usuarioNombre: adminNombre,
    accion: ACCIONES.CREAR_PROYECTO,
    entidad: 'proyecto',
    entidadId: ref.id,
    datos,
  })
  return ref.id
}

export async function actualizarProyecto(id, datos, adminId, adminNombre, motivo) {
  const antes = await obtenerProyecto(id)
  await updateDoc(doc(db, 'proyectos', id), { ...datos, actualizadoEn: serverTimestamp() })
  await registrarHistorial({
    usuarioId: adminId,
    usuarioNombre: adminNombre,
    accion: ACCIONES.MODIFICAR_PROYECTO,
    entidad: 'proyecto',
    entidadId: id,
    datos: { antes, despues: datos },
    motivo,
  })
}

export async function eliminarProyecto(id, adminId, adminNombre) {
  const datos = await obtenerProyecto(id)
  await deleteDoc(doc(db, 'proyectos', id))
  await registrarHistorial({
    usuarioId: adminId,
    usuarioNombre: adminNombre,
    accion: ACCIONES.ELIMINAR_PROYECTO,
    entidad: 'proyecto',
    entidadId: id,
    datos,
  })
}

// ─── LIBRANZAS ────────────────────────────────────────────────────────────────

export async function obtenerLibranzasProyecto(proyectoId) {
  const snap = await getDocs(
    query(collection(db, 'libranzas'), where('proyectoId', '==', proyectoId))
  )
  return snap.docs.map(d => ({ id: d.id, ...d.data() }))
}

export async function obtenerHistorialLibranzasMusico(musicoId) {
  const snap = await getDocs(
    query(collection(db, 'libranzas'), where('musicoId', '==', musicoId))
  )
  const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }))
  return docs.sort((a, b) => (b.fechaAsignacion?.toMillis?.() || 0) - (a.fechaAsignacion?.toMillis?.() || 0))
}

export async function obtenerLibranzasMusico(musicoId, temporadaId) {
  const snap = await getDocs(
    query(
      collection(db, 'libranzas'),
      where('musicoId', '==', musicoId),
      where('temporadaId', '==', temporadaId),
      orderBy('fechaAsignacion', 'desc')
    )
  )
  return snap.docs.map(d => ({ id: d.id, ...d.data() }))
}

export async function crearLibranzasPermiso(libranzas, adminId, adminNombre) {
  for (const datos of libranzas) {
    await addDoc(collection(db, 'libranzas'), {
      ...datos,
      esPermiso: true,
      asignadaPor: adminId,
      fechaAsignacion: serverTimestamp(),
      esPendienteResuelta: false,
    })
  }
}

export async function crearLibranza(datos, adminId, adminNombre, motivo) {
  const ref = await addDoc(collection(db, 'libranzas'), {
    ...datos,
    asignadaPor: adminId,
    fechaAsignacion: serverTimestamp(),
    esPendienteResuelta: datos.esPendienteResuelta || false,
  })

  await registrarHistorial({
    usuarioId: adminId,
    usuarioNombre: adminNombre,
    accion: datos.esPendienteResuelta ? ACCIONES.LIBRANZA_PENDIENTE_RESUELTA : ACCIONES.CREAR_LIBRANZA,
    entidad: 'libranza',
    entidadId: ref.id,
    datos,
    motivo,
  })

  // Avanzar la rotación
  if (datos.temporadaId && datos.tipo) {
    await confirmarAsignacion(
      datos.temporadaId,
      datos.tipo,
      [datos.musicoId],
      [],
      []
    )
  }

  return ref.id
}

export async function crearLibranzasLote(libranzas, pendientesNuevos, temporadaId, tipo, adminId, adminNombre, motivo, opciones = {}) {
  const ids = []
  for (const datos of libranzas) {
    const ref = await addDoc(collection(db, 'libranzas'), {
      ...datos,
      asignadaPor: adminId,
      fechaAsignacion: serverTimestamp(),
      esPendienteResuelta: datos.esPendienteResuelta || false,
    })
    ids.push(ref.id)
    await registrarHistorial({
      usuarioId: adminId,
      usuarioNombre: adminNombre,
      accion: datos.esPendienteResuelta ? ACCIONES.LIBRANZA_PENDIENTE_RESUELTA : ACCIONES.CREAR_LIBRANZA,
      entidad: 'libranza',
      entidadId: ref.id,
      datos,
      motivo,
    })
  }

  // Marcar nuevos pendientes en historial
  for (const uid of pendientesNuevos) {
    await registrarHistorial({
      usuarioId: adminId,
      usuarioNombre: adminNombre,
      accion: ACCIONES.LIBRANZA_PENDIENTE,
      entidad: 'rotacion',
      entidadId: `${temporadaId}_${tipo}`,
      datos: { musicoId: uid, tipo },
      motivo: 'Restricción de puestos de responsabilidad',
    })
  }

  // Avanzar la rotación una sola vez con todos los asignados
  await confirmarAsignacion(
    temporadaId,
    tipo,
    libranzas.map(l => l.musicoId),
    pendientesNuevos,
    [],
    opciones
  )

  return ids
}

export async function modificarLibranza(id, datos, adminId, adminNombre, motivo) {
  const antes = await getDoc(doc(db, 'libranzas', id))
  await updateDoc(doc(db, 'libranzas', id), { ...datos, modificadoEn: serverTimestamp() })
  await registrarHistorial({
    usuarioId: adminId,
    usuarioNombre: adminNombre,
    accion: ACCIONES.MODIFICAR_LIBRANZA,
    entidad: 'libranza',
    entidadId: id,
    datos: { antes: { id, ...antes.data() }, despues: datos },
    motivo,
  })
}

export async function eliminarLibranza(id, adminId, adminNombre, motivo) {
  const snap = await getDoc(doc(db, 'libranzas', id))
  const datos = snap.data()
  await deleteDoc(doc(db, 'libranzas', id))
  await registrarHistorial({
    usuarioId: adminId,
    usuarioNombre: adminNombre,
    accion: ACCIONES.ELIMINAR_LIBRANZA,
    entidad: 'libranza',
    entidadId: id,
    datos,
    motivo,
  })
}
