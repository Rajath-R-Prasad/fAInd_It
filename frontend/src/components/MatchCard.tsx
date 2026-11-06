import type { ReactNode } from 'react'
import {
  ArrowRight,
  CalendarDays,
  ImageOff,
  Info,
  MapPin,
  Sparkles,
  Tag,
} from 'lucide-react'
import { imageUrl } from '../lib/api'
import { badgeToneForStatus } from '../lib/badges'
import type { Match, Report } from '../lib/types'
import { NeoBadge, NeoCard } from './neo'

function scoreLabel(value: number | null | undefined) {
  if (value === null || value === undefined) return 'N/A'
  return `${Math.round(value * 100)}%`
}

function formatDate(value?: string | null) {
  if (!value) return 'Date not set'
  return new Date(value).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

function ItemSnapshot({
  report,
  label,
  accent,
}: {
  report: Report
  label: string
  accent: 'lavender' | 'lime'
}) {
  const src = imageUrl(report.image_url)
  return (
    <div className="flex min-w-0 flex-col overflow-hidden rounded-lg border-[3px] border-ink bg-white shadow-neo-sm">
      <div
        className={`flex items-center justify-between gap-2 border-b-[3px] border-ink px-3 py-2 ${
          accent === 'lavender' ? 'bg-lavender-soft' : 'bg-lime'
        }`}
      >
        <span className="font-display text-[10px] font-extrabold uppercase tracking-[0.16em] text-ink">
          {label}
        </span>
        <NeoBadge tone={badgeToneForStatus(report.type)}>{report.type}</NeoBadge>
      </div>
      <div className="relative h-44 bg-lavender-soft">
        {src ? (
          <img
            src={src}
            alt={`${report.title} report image`}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-muted">
            <ImageOff className="h-8 w-8" aria-hidden="true" />
            <span className="text-xs font-bold uppercase tracking-wide">No image</span>
          </div>
        )}
      </div>
      <div className="p-3">
        <h3 className="line-clamp-2 font-display text-lg font-extrabold leading-snug text-ink">
          {report.title}
        </h3>
        <div className="mt-2 grid gap-1.5 text-[11px] font-semibold text-muted">
          <span className="flex items-center gap-1.5">
            <Tag className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            {report.category || 'Uncategorised'}
          </span>
          <span className="flex items-center gap-1.5">
            <MapPin className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span className="line-clamp-1">{report.location || 'Location not set'}</span>
          </span>
          <span className="flex items-center gap-1.5">
            <CalendarDays className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            {formatDate(report.event_date)}
          </span>
        </div>
      </div>
    </div>
  )
}

function SimilarityBar({ label, value }: { label: string; value: number | null | undefined }) {
  const width = value === null || value === undefined ? 0 : Math.max(0, Math.min(100, value * 100))
  return (
    <div>
      <div className="mb-1 flex items-center justify-between gap-2 text-[10px] font-extrabold uppercase tracking-[0.12em] text-ink">
        <span>{label}</span>
        <span>{scoreLabel(value)}</span>
      </div>
      <div className="h-3 overflow-hidden rounded-sm border-2 border-ink bg-white">
        <div className="h-full bg-lavender" style={{ width: `${width}%` }} />
      </div>
    </div>
  )
}

export default function MatchCard({
  source,
  match,
  children,
}: {
  source: Report
  match: Match
  children?: ReactNode
}) {
  const sourceLabel = source.type === 'LOST' ? 'Your lost item' : 'Your found item'
  const candidateLabel =
    match.report.type === 'FOUND' ? 'Potential found match' : 'Potential lost match'

  return (
    <NeoCard className="overflow-hidden p-3 sm:p-5">
      <div className="grid items-stretch gap-3 lg:grid-cols-[1fr_auto_1fr]">
        <ItemSnapshot report={source} label={sourceLabel} accent="lavender" />
        <div className="flex flex-row items-center justify-center gap-3 lg:flex-col">
          <span className="flex h-10 w-10 items-center justify-center rounded-full border-[3px] border-ink bg-lime shadow-[3px_3px_0_#111111]">
            <ArrowRight className="h-5 w-5 rotate-90 lg:rotate-0" aria-hidden="true" />
          </span>
          <div className="rounded-md border-[3px] border-ink bg-white px-3 py-2 text-center shadow-[3px_3px_0_#111111]">
            <p className="font-display text-[9px] font-extrabold uppercase tracking-[0.16em] text-muted">
              Final score
            </p>
            <p className="font-display text-2xl font-extrabold leading-none text-ink">
              {scoreLabel(match.scores.final_score)}
            </p>
          </div>
        </div>
        <ItemSnapshot report={match.report} label={candidateLabel} accent="lime" />
      </div>

      <div className="mt-4 grid gap-3 rounded-lg border-[3px] border-ink bg-cream p-3 sm:grid-cols-3">
        <SimilarityBar label="Image similarity" value={match.scores.image_similarity} />
        <SimilarityBar label="Text similarity" value={match.scores.text_similarity} />
        <SimilarityBar
          label="Metadata similarity"
          value={match.scores.metadata_similarity}
        />
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <NeoBadge tone={badgeToneForStatus(match.report.status)}>
          {match.report.status || 'OPEN'}
        </NeoBadge>
        <NeoBadge tone={badgeToneForStatus(match.report.moderation_status)}>
          {match.report.moderation_status || 'ACTIVE'}
        </NeoBadge>
        <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-muted">
          <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
          Ranking signal, not a probability
        </span>
      </div>

      <details className="group mt-4 rounded-md border-2 border-ink bg-white p-3">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-2 font-display text-sm font-extrabold uppercase tracking-wide">
          <span className="inline-flex items-center gap-2">
            <Info className="h-4 w-4" aria-hidden="true" />
            View full match details
          </span>
          <span className="text-xs text-muted group-open:hidden">Open</span>
          <span className="hidden text-xs text-muted group-open:inline">Close</span>
        </summary>
        <div className="mt-3 grid gap-3 border-t-2 border-ink pt-3 text-sm text-muted sm:grid-cols-2">
          <div>
            <p className="font-display text-xs font-extrabold uppercase tracking-wide text-ink">
              Your report
            </p>
            <p className="mt-1 leading-relaxed">{source.description || 'No description.'}</p>
            <p className="mt-2 text-xs">
              Colour: {source.color || 'N/A'} · Category: {source.category || 'N/A'}
            </p>
          </div>
          <div>
            <p className="font-display text-xs font-extrabold uppercase tracking-wide text-ink">
              Candidate report
            </p>
            <p className="mt-1 leading-relaxed">
              {match.report.description || 'No description.'}
            </p>
            <p className="mt-2 text-xs">
              Colour: {match.report.color || 'N/A'} · Category:{' '}
              {match.report.category || 'N/A'}
            </p>
          </div>
        </div>
      </details>

      {children && <div className="mt-4 border-t-[3px] border-ink pt-4">{children}</div>}
    </NeoCard>
  )
}
