import { collection, addDoc, serverTimestamp, query, orderBy, getDocs, where } from 'firebase/firestore'
import { db } from './firebase'

export const ACCIONES = {
  CREAR_LIBRANZA: 'CREAR_LIBRANZA',
  MODIFICAR_LIBRANZA: 'MODIFICAR_LIBRANZA',
  ELIMINAR_LIBRANZA: 'ELIMINAR_LIBRANZA',
  LIBRANZA_PENDIENTE: 'LIBRANZA_PENDIENTE',
  LIBRANZA_PENDIENTE_RESUELTA: 'LIBRANZA_PENDIENTE_RESUELTA',
  CREAR_PROYECTO: 'CREAR_PROYECTO',
  MODIFICAR_PROYECTO: 'MODIFICAR_PROYECTO',
  ELIMINAR_PROYECTO: 'ELIMINAR_PROYECTO',
  CREAR_TEMPORADA: 'CREAR_TEMPORADA',
  CREAR_MUSICO: 'CREAR_MUSICO',
  MODIFICAR_MUSICO: 'MODIFICAR_MUSICO',
  MODIFICAR_ROTACION: 'MODIFICAR_ROTACION',
}

export async function registrarHistorial({ usuarioId, usuarioNombre, accion, entidad, entidadId, datos, motivo }) {
  await addDoc(collection(db, 'historial'), {
    fecha: serverTimestamp(),
    usuarioId,
    usuarioNombre,
    accion,
    entidad,
    entidadId: entidadId || null,
    datos: datos || {},
    motivo: motivo || null,
  })
}

export async function obtenerHistorial(filtros = {}) {
  let q = query(collection(db, 'historial'), orderBy('fecha', 'desc'))
  const snapshot = await getDocs(q)
  return snapshot.docs.map(d => ({ id: d.id, ...d.data() }))
}

export async function obtenerHistorialPorEntidad(entidad, entidadId) {
  const q = query(
    collection(db, 'historial'),
    where('entidad', '==', entidad),
    where('entidadId', '==', entidadId),
    orderBy('fecha', 'desc')
  )
  const snapshot = await getDocs(q)
  return snapshot.docs.map(d => ({ id: d.id, ...d.data() }))
}
