export type NeoBadgeTone =
  | 'lost'
  | 'found'
  | 'open'
  | 'matched'
  | 'closed'
  | 'pending'
  | 'accepted'
  | 'rejected'
  | 'active'
  | 'flagged'
  | 'removed'
  | 'neutral'
  | 'info'

export function badgeToneForStatus(status?: string | null): NeoBadgeTone {
  switch ((status || '').toUpperCase()) {
    case 'LOST':
      return 'lost'
    case 'FOUND':
      return 'found'
    case 'OPEN':
      return 'open'
    case 'MATCHED':
      return 'matched'
    case 'CLOSED':
      return 'closed'
    case 'PENDING':
      return 'pending'
    case 'ACCEPTED':
      return 'accepted'
    case 'REJECTED':
      return 'rejected'
    case 'ACTIVE':
      return 'active'
    case 'FLAGGED':
      return 'flagged'
    case 'REMOVED':
      return 'removed'
    default:
      return 'neutral'
  }
}
