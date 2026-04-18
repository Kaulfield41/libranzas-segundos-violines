/**
 * Motor de rotación de libranzas
 *
 * Reglas:
 * - 3 colas independientes: proyecto, parte, obra
 * - El orden es fijo y se define al inicio de temporada
 * - Los 4 puestos de responsabilidad (2 solistas + 2 ayudas) tienen restricciones:
 *     1. Siempre mínimo 2 de los 4 tocando en cualquier momento
 *     2. Los 2 solistas nunca libran a la vez (siempre mínimo 1 solista)
 * - Si un músico no puede librar por estas restricciones, queda "pendiente"
 *   y tiene prioridad en la próxima asignación donde sea posible
 */

import { doc, getDoc, setDoc, updateDoc, collection, getDocs, query, where } from 'firebase/firestore'
import { db } from './firebase'

export const TIPOS_LIBRANZA = {
  PROYECTO: 'proyecto',
  PARTE: 'parte',
  OBRA: 'obra',
}

export const PUESTOS = {
  NORMAL: 'normal',
  SOLISTA: 'solista',
  AYUDA_SOLISTA: 'ayuda_solista',
}

// Obtiene el estado de la rotación para una temporada y tipo
export async function obtenerRotacion(temporadaId, tipo) {
  const ref = doc(db, 'rotaciones', `${temporadaId}_${tipo}`)
  const snap = await getDoc(ref)
  if (!snap.exists()) return null
  return snap.data()
}

// Inicializa las 3 colas de rotación al crear una temporada
export async function inicializarRotacion(temporadaId, ordenMusicos) {
  for (const tipo of Object.values(TIPOS_LIBRANZA)) {
    const ref = doc(db, 'rotaciones', `${temporadaId}_${tipo}`)
    await setDoc(ref, {
      temporadaId,
      tipo,
      cola: ordenMusicos, // array de UIDs en orden fijo
      posicionActual: 0,
      pendientes: [], // UIDs con libranza pendiente (tienen prioridad)
      deudas: [],    // [{acreedor: uid, deudor: uid}] — intercambios pendientes de saldar
    })
  }
}

// Actualiza el orden de la cola (si el admin reordena)
export async function actualizarOrdenRotacion(temporadaId, tipo, nuevaCola) {
  const ref = doc(db, 'rotaciones', `${temporadaId}_${tipo}`)
  await updateDoc(ref, { cola: nuevaCola })
}

/**
 * Calcula qué músicos deben librar dado:
 * - cuántos se necesitan (musicosNecesarios)
 * - el estado actual de la rotación
 * - los músicos disponibles (no bajas, no ya librando en ese contexto)
 * - restricciones de puestos de responsabilidad
 *
 * @param {Object} params
 * @param {string} params.temporadaId
 * @param {string} params.tipo - 'proyecto' | 'parte' | 'obra'
 * @param {number} params.totalSeccion - total músicos en sección
 * @param {number} params.musicosNecesarios - cuántos se necesitan
 * @param {Array}  params.musicos - array de objetos musico {id, puesto, ...}
 * @param {Array}  params.yaLibrando - UIDs que ya libran en este contexto superior
 *                 (ej: si calculamos libranzas de obra, los que ya libran el proyecto/parte)
 * @returns {Object} { asignados: uid[], pendientesNuevos: uid[] }
 */
export async function calcularLibranzas({ temporadaId, tipo, totalSeccion, musicosNecesarios, musicos, yaLibrando = [], intercambiosProyecto = [] }) {
  const rotacion = await obtenerRotacion(temporadaId, tipo)
  if (!rotacion) throw new Error('Rotación no inicializada')

  const numLibranzas = totalSeccion - musicosNecesarios - yaLibrando.length
  if (numLibranzas <= 0) return { asignados: [], pendientesNuevos: [], deudasNuevas: [], deudasResueltas: [] }

  const disponibles = musicos.filter(m => !yaLibrando.includes(m.id))
  const solistas = disponibles.filter(m => m.puesto === PUESTOS.SOLISTA)
  const responsables = disponibles.filter(m =>
    m.puesto === PUESTOS.SOLISTA || m.puesto === PUESTOS.AYUDA_SOLISTA
  )

  const { cola, posicionActual, pendientes, deudas = [] } = rotacion

  // Intercambios de este proyecto: A cede su turno a B
  const cedentes = new Set(intercambiosProyecto.map(i => i.musicoA))
  const intercambioMap = Object.fromEntries(intercambiosProyecto.map(i => [i.musicoA, i.musicoB]))

  // Deudas activas: cuando toque a B (deudor), libra A (acreedor) en su lugar
  const deudaActiva = {}
  for (const deuda of deudas) {
    if (disponibles.some(m => m.id === deuda.acreedor) &&
        disponibles.some(m => m.id === deuda.deudor) &&
        !cedentes.has(deuda.acreedor)) {
      deudaActiva[deuda.deudor] = deuda.acreedor
    }
  }

  const pendientesDisponibles = pendientes.filter(uid =>
    disponibles.some(m => m.id === uid) && !cedentes.has(uid)
  )

  // Cola circular desde posicionActual, sustituyendo cedentes por sus sustitutos
  const colaCircular = [...cola.slice(posicionActual), ...cola.slice(0, posicionActual)]
  const colaSinPendientes = []
  const seen = new Set(pendientesDisponibles)

  for (const uid of colaCircular) {
    if (pendientesDisponibles.includes(uid)) continue
    if (cedentes.has(uid)) {
      const sustituto = intercambioMap[uid]
      if (sustituto && !seen.has(sustituto) && disponibles.some(m => m.id === sustituto)) {
        colaSinPendientes.push(sustituto)
        seen.add(sustituto)
      }
    } else if (disponibles.some(m => m.id === uid) && !seen.has(uid)) {
      colaSinPendientes.push(uid)
      seen.add(uid)
    }
  }

  const candidatos = [...pendientesDisponibles, ...colaSinPendientes]

  const asignados = []
  const pendientesNuevos = []
  const deudasResueltas = []

  for (const uid of candidatos) {
    if (asignados.length >= numLibranzas) break

    // Si B tiene deuda con A, A libra en lugar de B
    const uidEfectivo = deudaActiva[uid] !== undefined ? deudaActiva[uid] : uid
    const musico = disponibles.find(m => m.id === uidEfectivo)
    if (!musico) continue

    const tentativoLibrando = [...yaLibrando, ...asignados, uidEfectivo]
    if (violaRestriccionesPuestos(musico, tentativoLibrando, disponibles, solistas, responsables)) {
      if (!pendientes.includes(uidEfectivo) && !pendientesNuevos.includes(uidEfectivo)) {
        pendientesNuevos.push(uidEfectivo)
      }
      continue
    }

    asignados.push(uidEfectivo)
    if (deudaActiva[uid] !== undefined) {
      deudasResueltas.push({ acreedor: uidEfectivo, deudor: uid })
    }
  }

  // Nuevas deudas por intercambios de este proyecto (B libró en lugar de A → B debe a A)
  const deudasNuevas = intercambiosProyecto
    .filter(({ musicoB }) => asignados.includes(musicoB))
    .map(({ musicoA, musicoB }) => ({ acreedor: musicoA, deudor: musicoB }))

  return { asignados, pendientesNuevos, deudasNuevas, deudasResueltas }
}

function violaRestriccionesPuestos(musico, librando, disponibles, solistas, responsables) {
  if (musico.puesto !== PUESTOS.SOLISTA && musico.puesto !== PUESTOS.AYUDA_SOLISTA) {
    return false // músico normal, sin restricción
  }

  const responsablesTocando = responsables.filter(m => !librando.includes(m.id))
  const solistasTocando = solistas.filter(m => !librando.includes(m.id))

  if (responsablesTocando.length < 2) return true // quedarían menos de 2 responsables
  if (solistasTocando.length < 1) return true // no quedaría ningún solista

  return false
}

// Avanza la posición de la cola tras asignar libranzas
export async function confirmarAsignacion(temporadaId, tipo, asignados, pendientesNuevos, cola, opciones = {}) {
  const { deudasNuevas = [], deudasResueltas = [], intercambiosProyecto = [], uidsPermiso = [] } = opciones
  const ref = doc(db, 'rotaciones', `${temporadaId}_${tipo}`)
  const snap = await getDoc(ref)
  const rotacion = snap.data()

  // Si B libró en lugar de A (intercambio), avanzar past la posición de A (no de B)
  const intercambioReverso = Object.fromEntries(intercambiosProyecto.map(i => [i.musicoB, i.musicoA]))

  let nuevaPosicion = rotacion.posicionActual
  const asignadosNoPendientes = asignados.filter(uid => !rotacion.pendientes.includes(uid))
  if (asignadosNoPendientes.length > 0) {
    const ultimoAsignado = asignadosNoPendientes[asignadosNoPendientes.length - 1]
    const uidParaAvance = intercambioReverso[ultimoAsignado] || ultimoAsignado
    const idxEnCola = rotacion.cola.indexOf(uidParaAvance)
    if (idxEnCola >= 0) nuevaPosicion = (idxEnCola + 1) % rotacion.cola.length
  }

  const pendientesActualizados = [
    ...rotacion.pendientes.filter(uid => !asignados.includes(uid)),
    ...pendientesNuevos.filter(uid => !rotacion.pendientes.includes(uid))
  ]

  // Si el puntero cruzó la posición de alguien de baja/permiso → queda pendiente
  if (uidsPermiso.length > 0 && nuevaPosicion !== rotacion.posicionActual) {
    let p = rotacion.posicionActual
    while (p !== nuevaPosicion) {
      const uid = rotacion.cola[p]
      if (uidsPermiso.includes(uid) && !pendientesActualizados.includes(uid) && !asignados.includes(uid)) {
        pendientesActualizados.push(uid)
      }
      p = (p + 1) % rotacion.cola.length
    }
  }

  const deudasActuales = rotacion.deudas || []
  const deudasActualizadas = [
    ...deudasActuales.filter(d => !deudasResueltas.some(r => r.acreedor === d.acreedor && r.deudor === d.deudor)),
    ...deudasNuevas.filter(d => !deudasActuales.some(e => e.acreedor === d.acreedor && e.deudor === d.deudor))
  ]

  await updateDoc(ref, {
    posicionActual: nuevaPosicion,
    pendientes: pendientesActualizados,
    deudas: deudasActualizadas,
  })
}

// Obtiene el estado visual de la cola para mostrar en UI
export async function obtenerEstadoCola(temporadaId, tipo, musicos) {
  const rotacion = await obtenerRotacion(temporadaId, tipo)
  if (!rotacion) return []

  return rotacion.cola.map((uid, idx) => {
    const musico = musicos.find(m => m.id === uid)
    const esPendiente = rotacion.pendientes.includes(uid)
    const esProximo = idx === rotacion.posicionActual && !esPendiente
    return { uid, musico, esPendiente, esProximo, posicion: idx }
  })
}
