import { useAuth } from '../../context/AuthContext'
import HistorialMusico from '../HistorialMusico'

export default function MiHistorial() {
  const { usuario } = useAuth()
  return <HistorialMusico musicoId={usuario.id} />
}
