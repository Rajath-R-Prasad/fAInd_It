import {
  CalendarDays,
  CheckCircle2,
  Clock3,
  ImageOff,
  MessageSquare,
  Phone,
  UserRound,
  XCircle,
} from 'lucide-react'
import { imageUrl } from '../lib/api'
import { badgeToneForStatus } from '../lib/badges'
import type { Claim } from '../lib/types'
import { NeoBadge, NeoButton, NeoCard } from './neo'

function formatDate(value?: string | null) {
  if (!value) return 'N/A'
  return new Date(value).toLocaleString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function ContactRow({ label, mobile }: { label: string; mobile?: string | null }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded border-2 border-ink bg-white px-3 py-2">
      <div>
        <p className="font-display text-[10px] font-extrabold uppercase tracking-[0.14em] text-muted">
          {label}
        </p>
        <p className="text-sm font-bold text-ink">{mobile || 'Not provided'}</p>
      </div>
      {mobile && (
        <a
          href={`tel:${mobile.replace(/[^\d+]/g, '')}`}
          className="inline-flex items-center gap-1.5 rounded border-2 border-ink bg-lime px-2.5 py-1 font-display text-xs font-extrabold uppercase tracking-wide shadow-[2px_2px_0_#111111] transition-transform hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[1px_1px_0_#111111]"
        >
          <Phone className="h-3.5 w-3.5" aria-hidden="true" />
          Call
        </a>
      )}
    </div>
  )
}

export default function ClaimCard({
  claim,
  received,
  onReview,
}: {
  claim: Claim
  received: boolean
  onReview?: (id: string, action: 'accept' | 'reject') => void
}) {
  const pending = claim.status === 'PENDING'
  const report = claim.report
  const src = imageUrl(report?.image_url)
  const contact = claim.contact

  return (
    <NeoCard className="overflow-hidden">
      <div className="flex flex-col gap-4 p-4 sm:flex-row sm:p-5">
        <div className="h-28 w-full shrink-0 overflow-hidden rounded-md border-[3px] border-ink bg-lavender-soft sm:h-24 sm:w-32">
          {src ? (
            <img
              src={src}
              alt={report?.title ? `${report.title} report image` : 'Claimed report image'}
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full items-center justify-center text-muted">
              <ImageOff className="h-7 w-7" aria-hidden="true" />
            </div>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="font-display text-xl font-extrabold leading-snug text-ink">
                {report?.title || 'Found report'}
              </h3>
              <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-semibold text-muted">
                <span className="inline-flex items-center gap-1">
                  <UserRound className="h-3.5 w-3.5" aria-hidden="true" />
                  Claim {claim.id.slice(0, 8)}
                </span>
                <span className="inline-flex items-center gap-1">
                  <CalendarDays className="h-3.5 w-3.5" aria-hidden="true" />
                  {formatDate(claim.created_at)}
                </span>
              </p>
            </div>
            <NeoBadge tone={badgeToneForStatus(claim.status)}>{claim.status}</NeoBadge>
          </div>

          <div className="mt-3 rounded-md border-2 border-ink bg-cream p-3">
            <p className="flex items-center gap-1.5 font-display text-[10px] font-extrabold uppercase tracking-[0.14em] text-muted">
              <MessageSquare className="h-3.5 w-3.5" aria-hidden="true" />
              Verification message
            </p>
            <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-ink">
              {claim.message || 'No message provided.'}
            </p>
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            <NeoBadge tone={badgeToneForStatus(report?.status)}>
              Report: {report?.status || 'N/A'}
            </NeoBadge>
            <NeoBadge tone="info">
              <Clock3 className="h-3 w-3" aria-hidden="true" />
              Reviewed: {claim.reviewed_at ? formatDate(claim.reviewed_at) : 'Not yet'}
            </NeoBadge>
          </div>

          {contact && (
            <div className="mt-4 rounded-lg border-[3px] border-ink bg-lime p-3 shadow-[4px_4px_0_#111111]">
              <p className="mb-2 flex items-center gap-2 font-display text-xs font-extrabold uppercase tracking-[0.16em] text-ink">
                <Phone className="h-4 w-4" aria-hidden="true" />
                Contact details unlocked
              </p>
              <div className="grid gap-2 sm:grid-cols-2">
                <ContactRow label="Claimant mobile" mobile={contact.claimant_mobile} />
                <ContactRow label="Found report owner mobile" mobile={contact.owner_mobile} />
              </div>
              <p className="mt-2 text-[11px] font-medium text-ink/70">
                These numbers are visible only to the two people in this accepted claim.
              </p>
            </div>
          )}

          {received && pending && onReview && (
            <div className="mt-4 flex flex-wrap gap-3">
              <NeoButton type="button" variant="lime" onClick={() => onReview(claim.id, 'accept')}>
                <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                Accept claim
              </NeoButton>
              <NeoButton type="button" variant="pink" onClick={() => onReview(claim.id, 'reject')}>
                <XCircle className="h-4 w-4" aria-hidden="true" />
                Reject claim
              </NeoButton>
            </div>
          )}
        </div>
      </div>
    </NeoCard>
  )
}
