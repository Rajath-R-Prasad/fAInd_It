export interface Report {
  id: string
  type: 'LOST' | 'FOUND' | string
  title: string
  description?: string | null
  category?: string | null
  color?: string | null
  location?: string | null
  event_date?: string | null
  created_at?: string | null
  status?: string | null
  moderation_status?: string | null
  image_url?: string | null
  owner_id?: string | null
}

export interface MatchScores {
  image_similarity: number | null
  text_similarity: number | null
  metadata_similarity: number | null
  final_score: number
  metadata_components?: Record<string, number | null>
}

export interface Match {
  report_id: string
  report: Report
  scores: MatchScores
  can_claim: boolean
}

export interface MatchGroup {
  source_report_id?: string
  source_report?: Report
  matches: Match[]
}

export interface ClaimContact {
  claimant_mobile?: string | null
  owner_mobile?: string | null
}

export interface Claim {
  id: string
  status: string
  message: string
  report_id: string
  claimant_id: string
  reported_owner_id: string
  created_at?: string | null
  updated_at?: string | null
  reviewed_at?: string | null
  report?: Report | null
  contact?: ClaimContact | null
}

export interface CurrentUser {
  id: string
  email: string
  mobile_number?: string | null
  is_active?: boolean
  is_superuser?: boolean
  created_at?: string | null
}
