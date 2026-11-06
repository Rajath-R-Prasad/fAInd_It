import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  ArrowLeft,
  CalendarDays,
  FileText,
  ImageOff,
  MapPin,
  Palette,
  Pencil,
  Search,
  ShieldCheck,
  Tag,
  Trash2,
} from 'lucide-react'
import {
  EmptyState,
  LoadingState,
  NeoAlert,
  NeoBadge,
  NeoButton,
  NeoCard,
  NeoLink,
  PageContainer,
  PageHeader,
} from '../components/neo'
import { API_BASE, authHeaders, imageUrl } from '../lib/api'
import { badgeToneForStatus } from '../lib/badges'
import type { Report } from '../lib/types'

function formatDate(value?: string | null, withTime = false) {
  if (!value) return 'Not set'
  return new Date(value).toLocaleString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    ...(withTime ? { hour: '2-digit', minute: '2-digit' } : {}),
  })
}

export default function ReportDetail() {
  const [report, setReport] = useState<Report | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [actionError, setActionError] = useState('')
  const [deleting, setDeleting] = useState(false)
  const navigate = useNavigate()
  const { id } = useParams()
  const token = localStorage.getItem('token')
  const userId = localStorage.getItem('user_id')
  const isSuperuser = localStorage.getItem('is_superuser') === 'true'

  useEffect(() => {
    if (!token) {
      navigate('/login')
      return
    }

    let cancelled = false
    setLoading(true)
    setLoadError('')

    fetch(`${API_BASE}/reports/${id}`, { headers: authHeaders(token) })
      .then(async (response) => {
        if (response.status === 401) {
          localStorage.removeItem('token')
          navigate('/login')
          return null
        }
        const data = await response.json().catch(() => ({}))
        if (!response.ok) {
          throw new Error(data.detail || 'Could not load this report')
        }
        return data as Report
      })
      .then((data) => {
        if (data && !cancelled) setReport(data)
      })
      .catch((err) => {
        if (!cancelled) setLoadError(err instanceof Error ? err.message : 'Could not load report')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [id, token, navigate])

  const deleteReport = async () => {
    if (!report) return
    if (!window.confirm('Delete this report? This cannot be undone from the UI.')) return
    setDeleting(true)
    setActionError('')
    try {
      const response = await fetch(`${API_BASE}/reports/${report.id}`, {
        method: 'DELETE',
        headers: authHeaders(token),
      })
      if (response.status === 401) {
        localStorage.removeItem('token')
        navigate('/login')
        return
      }
      if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        throw new Error(data.detail || 'Could not delete this report')
      }
      navigate('/dashboard')
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Could not delete report')
    } finally {
      setDeleting(false)
    }
  }

  if (loading) {
    return (
      <PageContainer>
        <LoadingState label="Loading report..." />
      </PageContainer>
    )
  }

  if (loadError || !report) {
    return (
      <PageContainer size="form">
        <NeoAlert tone="error" className="mb-5">
          {loadError || 'Report not found.'}
        </NeoAlert>
        <EmptyState
          icon={<FileText className="h-7 w-7" aria-hidden="true" />}
          title="Report unavailable"
          description="The report may have been removed, or you may not have permission to view it."
          action={
            <NeoLink to="/dashboard" variant="lime">
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              Back to dashboard
            </NeoLink>
          }
        />
      </PageContainer>
    )
  }

  const src = imageUrl(report.image_url)
  const isOwner = Boolean(userId && report.owner_id === userId) || isSuperuser

  return (
    <PageContainer className="py-10 sm:py-12">
      <PageHeader
        icon={<FileText className="h-6 w-6" aria-hidden="true" />}
        eyebrow={report.type === 'LOST' ? 'Lost report' : 'Found report'}
        title={report.title}
        subtitle="Review the report details and use the actions available to you."
        actions={
          <>
            <NeoLink to="/dashboard" variant="white">
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              Back
            </NeoLink>
            {isOwner && (
              <>
                <NeoLink to={`/reports/${report.id}/edit`} variant="lavender">
                  <Pencil className="h-4 w-4" aria-hidden="true" />
                  Edit
                </NeoLink>
                <NeoButton
                  type="button"
                  variant="pink"
                  loading={deleting}
                  onClick={deleteReport}
                >
                  <Trash2 className="h-4 w-4" aria-hidden="true" />
                  Delete
                </NeoButton>
              </>
            )}
          </>
        }
      />

      {actionError && (
        <NeoAlert tone="error" className="mb-5">
          {actionError}
        </NeoAlert>
      )}

      <div className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
        <NeoCard className="overflow-hidden">
          <div className="border-b-[3px] border-ink bg-lavender-soft px-4 py-3">
            <div className="flex flex-wrap gap-2">
              <NeoBadge tone={badgeToneForStatus(report.type)}>{report.type}</NeoBadge>
              <NeoBadge tone={badgeToneForStatus(report.status)}>
                {report.status || 'OPEN'}
              </NeoBadge>
              <NeoBadge tone={badgeToneForStatus(report.moderation_status)}>
                {report.moderation_status || 'ACTIVE'}
              </NeoBadge>
            </div>
          </div>
          {src ? (
            <img
              src={src}
              alt={`${report.title} report image`}
              className="max-h-[520px] w-full object-contain bg-cream"
            />
          ) : (
            <div className="flex h-72 flex-col items-center justify-center gap-2 bg-cream text-muted">
              <ImageOff className="h-10 w-10" aria-hidden="true" />
              <span className="text-sm font-bold uppercase tracking-wide">No image</span>
            </div>
          )}
        </NeoCard>

        <div className="space-y-5">
          <NeoCard className="p-5 sm:p-6">
            <h2 className="font-display text-xl font-extrabold text-ink">Item details</h2>
            <dl className="mt-4 grid gap-3 sm:grid-cols-2">
              {[
                {
                  icon: Tag,
                  label: 'Category',
                  value: report.category || 'Not set',
                },
                {
                  icon: Palette,
                  label: 'Colour',
                  value: report.color || 'Not set',
                },
                {
                  icon: MapPin,
                  label: 'Location',
                  value: report.location || 'Not set',
                },
                {
                  icon: CalendarDays,
                  label: 'Event date',
                  value: formatDate(report.event_date),
                },
              ].map((item) => {
                const Icon = item.icon
                return (
                  <div
                    key={item.label}
                    className="rounded-md border-2 border-ink bg-cream p-3"
                  >
                    <dt className="flex items-center gap-1.5 font-display text-[10px] font-extrabold uppercase tracking-[0.14em] text-muted">
                      <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                      {item.label}
                    </dt>
                    <dd className="mt-1 text-sm font-bold text-ink">{item.value}</dd>
                  </div>
                )
              })}
            </dl>
            <div className="mt-4 rounded-md border-2 border-ink bg-white p-3">
              <p className="font-display text-[10px] font-extrabold uppercase tracking-[0.14em] text-muted">
                Created
              </p>
              <p className="mt-1 text-sm font-bold text-ink">
                {formatDate(report.created_at, true)}
              </p>
            </div>
          </NeoCard>

          <NeoCard className="p-5 sm:p-6">
            <h2 className="font-display text-xl font-extrabold text-ink">Description</h2>
            <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-muted">
              {report.description || 'No description was provided.'}
            </p>
          </NeoCard>

          <NeoCard tone="lavender" className="p-5 sm:p-6">
            <div className="flex items-start gap-3">
              <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
              <div>
                <h2 className="font-display text-lg font-extrabold text-ink">
                  Contact stays private
                </h2>
                <p className="mt-1 text-sm leading-relaxed text-ink/75">
                  Mobile numbers are shared only between the claimant and the found-report
                  owner after the found person accepts a claim.
                </p>
              </div>
            </div>
          </NeoCard>

          {isOwner && (
            <div className="flex flex-wrap gap-3">
              <NeoLink to="/matches" variant="lime" size="lg">
                <Search className="h-4 w-4" aria-hidden="true" />
                Find matches
              </NeoLink>
              <Link to={`/reports/${report.id}/edit`} className="neo-link self-center text-sm">
                Edit this report
              </Link>
            </div>
          )}
        </div>
      </div>
    </PageContainer>
  )
}
