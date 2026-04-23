// Calcula qué libranzas son retén: la última de cada grupo (tipo+parte+obra) por fecha.
// Devuelve un Set de IDs de libranza.
export function calcularRetenes(libranzas) {
  const grupos = {}
  for (const lib of libranzas) {
    if (lib.esPermiso) continue
    const key = `${lib.proyectoId}_${lib.tipo}_${lib.parteNumero ?? ''}_${lib.obraIndex ?? ''}`
    if (!grupos[key]) grupos[key] = []
    grupos[key].push(lib)
  }
  const retenes = new Set()
  for (const libs of Object.values(grupos)) {
    if (libs.length < 2) continue
    const sorted = [...libs].sort((a, b) => (a.fechaAsignacion?.toMillis?.() || 0) - (b.fechaAsignacion?.toMillis?.() || 0))
    retenes.add(sorted[sorted.length - 1].id)
  }
  return retenes
}
