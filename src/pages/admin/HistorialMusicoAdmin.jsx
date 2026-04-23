import { useParams } from 'react-router-dom'
import HistorialMusico from '../HistorialMusico'

export default function HistorialMusicoAdmin() {
  const { id } = useParams()
  return <HistorialMusico musicoId={id} backLink="/admin/musicos" backLabel="Músicos" />
}
