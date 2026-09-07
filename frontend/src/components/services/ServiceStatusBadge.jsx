import Badge from '../common/Badge'

const TONE_BY_STATUS = {
  Pendiente: 'warning',
  Vencido: 'danger',
  Cerrado: 'neutral',
  Completo: 'success',
}

export default function ServiceStatusBadge({ status }) {
  return <Badge tone={TONE_BY_STATUS[status] ?? 'neutral'}>{status}</Badge>
}
