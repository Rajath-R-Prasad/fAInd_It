import { Link } from 'react-router-dom'
import {
  ArrowUpRight,
  CalendarDays,
  ImageOff,
  MapPin,
  Pencil,
  Tag,
  Trash2,
} from 'lucide-react'
import { imageUrl } from '../lib/api'
import { badgeToneForStatus } from '../lib/badges'
import type { Report } from '../lib/types'
import { NeoBadge, NeoButton, NeoCard } from './neo'

function formatDate(value?: string | null) {
  if (!value) return 'Date not set'
  return new Date(value).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

export default function ReportCard({
  report,
  onDelete,
}: {
  report: Report
  onDelete?: (id: string) => void
}) {
  const src = imageUrl(report.image_url)

  return (
    <NeoCard className="flex h-full flex-col overflow-hidden">
      <Link
        to={`/reports/${report.id}`}
        className="group relative block overflow-hidden border-b-[3px] border-ink bg-lavender-soft"
        aria-label={`View ${report.title}`}
      >
        {src ? (
          <img
            src={src}
            alt={`${report.title} report image`}
            className="h-48 w-full object-cover transition-transform duration-200 group-hover:scale-[1.02]"
          />
        ) : (
          <div className="flex h-48 w-full flex-col items-center justify-center gap-2 text-muted">
            <ImageOff className="h-8 w-8" aria-hidden="true" />
            <span className="text-xs font-bold uppercase tracking-wide">No image</span>
          </div>
        )}
        <div className="absolute left-3 top-3 flex flex-wrap gap-2">
          <NeoBadge tone={badgeToneForStatus(report.type)}>{report.type}</NeoBadge>
          <NeoBadge tone={badgeToneForStatus(report.status)}>
            {report.status || 'OPEN'}
          </NeoBadge>
        </div>
      </Link>

      <div className="flex flex-1 flex-col p-4 sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <Link to={`/reports/${report.id}`} className="group">
            <h3 className="font-display text-xl font-extrabold leading-snug text-ink group-hover:bg-lime">
              {report.title}
            </h3>
          </Link>
          <ArrowUpRight
            className="mt-1 h-5 w-5 shrink-0 text-ink"
            aria-hidden="true"
          />
        </div>

        <p className="mt-2 line-clamp-2 min-h-[2.5rem] text-sm leading-relaxed text-muted">
          {report.description || 'No description provided.'}
        </p>

        <dl className="mt-4 grid gap-2 text-xs font-semibold text-ink">
          <div className="flex items-center gap-2">
            <Tag className="h-4 w-4 shrink-0" aria-hidden="true" />
            <dt className="sr-only">Category</dt>
            <dd>{report.category || 'Uncategorised'}</dd>
          </div>
          <div className="flex items-center gap-2">
            <MapPin className="h-4 w-4 shrink-0" aria-hidden="true" />
            <dt className="sr-only">Location</dt>
            <dd className="line-clamp-1">{report.location || 'Location not set'}</dd>
          </div>
          <div className="flex items-center gap-2">
            <CalendarDays className="h-4 w-4 shrink-0" aria-hidden="true" />
            <dt className="sr-only">Event date</dt>
            <dd>{formatDate(report.event_date)}</dd>
          </div>
        </dl>

        {report.moderation_status && report.moderation_status !== 'ACTIVE' && (
          <div className="mt-3">
            <NeoBadge tone={badgeToneForStatus(report.moderation_status)}>
              {report.moderation_status}
            </NeoBadge>
          </div>
        )}

        <div className="mt-auto flex flex-wrap gap-2 pt-5">
          <Link
            to={`/reports/${report.id}`}
            className="inline-flex items-center gap-1.5 rounded border-2 border-ink bg-white px-3 py-1.5 font-display text-xs font-extrabold uppercase tracking-wide shadow-[2px_2px_0_#111111] transition-transform hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[1px_1px_0_#111111]"
          >
            <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
            View
          </Link>
          <Link
            to={`/reports/${report.id}/edit`}
            className="inline-flex items-center gap-1.5 rounded border-2 border-ink bg-lavender px-3 py-1.5 font-display text-xs font-extrabold uppercase tracking-wide shadow-[2px_2px_0_#111111] transition-transform hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[1px_1px_0_#111111]"
          >
            <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
            Edit
          </Link>
          {onDelete && (
            <NeoButton
              type="button"
              variant="pink"
              size="sm"
              onClick={() => onDelete(report.id)}
              aria-label={`Delete ${report.title}`}
            >
              <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
              Delete
            </NeoButton>
          )}
        </div>
      </div>
    </NeoCard>
  )
}
