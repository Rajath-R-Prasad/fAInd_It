import { useEffect, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import {
  ArrowLeft,
  CalendarDays,
  FileText,
  MapPin,
  Save,
  Tag,
} from 'lucide-react'
import ImageUpload from '../components/ImageUpload'
import {
  LoadingState,
  NeoAlert,
  NeoButton,
  NeoCard,
  NeoInput,
  NeoLink,
  NeoSelect,
  NeoTextarea,
  PageContainer,
  PageHeader,
} from '../components/neo'
import { API_BASE, authHeaders, imageUrl } from '../lib/api'
import type { Report } from '../lib/types'

const MAX_IMAGE_MB = 5

function toDateTimeLocal(value?: string | null) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000)
  return local.toISOString().slice(0, 16)
}

export default function ReportForm() {
  const [searchParams] = useSearchParams()
  const initialType = searchParams.get('type') === 'FOUND' ? 'FOUND' : 'LOST'
  const [formData, setFormData] = useState({
    type: initialType,
    title: '',
    description: '',
    category: '',
    color: '',
    location: '',
    event_date: '',
  })
  const [image, setImage] = useState<File | null>(null)
  const [existingImage, setExistingImage] = useState<string | null>(null)
  const [loadingReport, setLoadingReport] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [loadError, setLoadError] = useState('')
  const [imageError, setImageError] = useState('')
  const navigate = useNavigate()
  const { id } = useParams()
  const editing = Boolean(id)
  const token = localStorage.getItem('token')

  useEffect(() => {
    if (id) return
    setFormData({
      type: initialType,
      title: '',
      description: '',
      category: '',
      color: '',
      location: '',
      event_date: '',
    })
    setImage(null)
    setExistingImage(null)
    setError('')
    setLoadError('')
    setImageError('')
  }, [id, initialType])

  useEffect(() => {
    if (!token) {
      navigate('/login')
      return
    }
    if (!id) return

    let cancelled = false
    setLoadingReport(true)
    setLoadError('')

    fetch(`${API_BASE}/reports/${id}`, {
      headers: authHeaders(token),
    })
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
      .then((report) => {
        if (!report || cancelled) return
        setFormData({
          type: report.type === 'FOUND' ? 'FOUND' : 'LOST',
          title: report.title || '',
          description: report.description || '',
          category: report.category || '',
          color: report.color || '',
          location: report.location || '',
          event_date: toDateTimeLocal(report.event_date),
        })
        setExistingImage(imageUrl(report.image_url))
      })
      .catch((err) => {
        if (!cancelled) setLoadError(err instanceof Error ? err.message : 'Could not load report')
      })
      .finally(() => {
        if (!cancelled) setLoadingReport(false)
      })

    return () => {
      cancelled = true
    }
  }, [id, token, navigate])

  const updateField = (field: keyof typeof formData, value: string) => {
    setFormData((current) => ({ ...current, [field]: value }))
  }

  const handleImageChange = (nextImage: File | null) => {
    setImageError('')
    if (!nextImage) {
      setImage(null)
      return
    }
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(nextImage.type)) {
      setImageError('Use a JPEG, PNG, or WebP image.')
      return
    }
    if (nextImage.size > MAX_IMAGE_MB * 1024 * 1024) {
      setImageError(`Image must be smaller than ${MAX_IMAGE_MB} MB.`)
      return
    }
    setImage(nextImage)
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    setError('')
    setImageError('')

    if (!formData.title.trim()) {
      setError('A title is required.')
      return
    }
    if (!editing && !image) {
      setImageError('Add an image for this report.')
      return
    }
    if (image) {
      if (!['image/jpeg', 'image/png', 'image/webp'].includes(image.type)) {
        setImageError('Use a JPEG, PNG, or WebP image.')
        return
      }
      if (image.size > MAX_IMAGE_MB * 1024 * 1024) {
        setImageError(`Image must be smaller than ${MAX_IMAGE_MB} MB.`)
        return
      }
    }

    setSubmitting(true)
    try {
      const data = new FormData()
      data.append('report_type', formData.type)
      data.append('title', formData.title.trim())
      data.append('description', formData.description)
      data.append('category', formData.category)
      data.append('color', formData.color)
      data.append('location', formData.location)
      if (formData.event_date) data.append('event_date', formData.event_date)
      if (image) data.append('image', image)

      const response = await fetch(
        editing ? `${API_BASE}/reports/${id}` : `${API_BASE}/reports/`,
        {
          method: editing ? 'PUT' : 'POST',
          headers: authHeaders(token),
          body: data,
        },
      )

      if (response.status === 401) {
        localStorage.removeItem('token')
        navigate('/login')
        return
      }
      const responseData = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(responseData.detail || 'Could not save the report')
      }

      navigate(editing ? `/reports/${id}` : '/dashboard')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save the report')
    } finally {
      setSubmitting(false)
    }
  }

  if (loadingReport) {
    return (
      <PageContainer size="form">
        <LoadingState label="Loading report..." />
      </PageContainer>
    )
  }

  if (editing && loadError) {
    return (
      <PageContainer size="form">
        <NeoAlert tone="error" className="mb-5">
          {loadError}
        </NeoAlert>
        <NeoLink to="/dashboard" variant="lime">
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Back to dashboard
        </NeoLink>
      </PageContainer>
    )
  }

  return (
    <PageContainer size="form" className="py-10 sm:py-12">
      <PageHeader
        icon={<FileText className="h-6 w-6" aria-hidden="true" />}
        eyebrow={editing ? 'Update report' : 'New report'}
        title={editing ? 'Edit Report' : 'Create Report'}
        subtitle={
          editing
            ? 'Update the details or replace the image. Existing embeddings are refreshed when you save.'
            : 'Add the details that will help fAInd It find a match. A clear image makes the biggest difference.'
        }
      />

      <NeoCard className="overflow-hidden shadow-neo-lime">
        <div className="border-b-[3px] border-ink bg-lavender-soft px-5 py-4 sm:px-8">
          <p className="font-display text-xs font-extrabold uppercase tracking-[0.18em] text-ink/70">
            {editing ? 'Report details' : 'Tell us what happened'}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5 p-5 sm:p-8">
          {error && (
            <NeoAlert tone="error" className="mb-2">
              {error}
            </NeoAlert>
          )}

          <NeoSelect
            label="Report type"
            name="report_type"
            value={formData.type}
            onChange={(event) => updateField('type', event.target.value)}
            required
          >
            <option value="LOST">Lost item</option>
            <option value="FOUND">Found item</option>
          </NeoSelect>

          <NeoInput
            label="Title"
            name="title"
            value={formData.title}
            onChange={(event) => updateField('title', event.target.value)}
            placeholder="e.g., Blue Backpack"
            maxLength={255}
            required
          />

          <NeoTextarea
            label="Description"
            name="description"
            value={formData.description}
            onChange={(event) => updateField('description', event.target.value)}
            placeholder="Provide key details (brand, model, unique marks, etc.)"
            rows={5}
          />

          <div className="grid gap-5 sm:grid-cols-2">
            <NeoInput
              label="Category"
              name="category"
              value={formData.category}
              onChange={(event) => updateField('category', event.target.value)}
              placeholder="e.g., Phone, Wallet, Bottle"
              icon={<Tag className="h-4 w-4" aria-hidden="true" />}
            />
            <NeoInput
              label="Color"
              name="color"
              value={formData.color}
              onChange={(event) => updateField('color', event.target.value)}
              placeholder="e.g., Black, Blue"
            />
          </div>

          <NeoInput
            label="Location"
            name="location"
            value={formData.location}
            onChange={(event) => updateField('location', event.target.value)}
            placeholder="Where it was lost or found"
            icon={<MapPin className="h-4 w-4" aria-hidden="true" />}
          />

          <NeoInput
            label="Date and time"
            name="event_date"
            type="datetime-local"
            value={formData.event_date}
            onChange={(event) => updateField('event_date', event.target.value)}
            icon={<CalendarDays className="h-4 w-4" aria-hidden="true" />}
            hint="Approximate is fine. Date proximity is used as a matching signal."
          />

          <ImageUpload
            file={image}
            onChange={handleImageChange}
            existingUrl={existingImage}
            error={imageError}
            maxSizeMb={MAX_IMAGE_MB}
          />

          <div className="flex flex-col-reverse gap-3 border-t-[3px] border-ink pt-5 sm:flex-row sm:justify-end">
            <NeoLink
              to={editing ? `/reports/${id}` : '/dashboard'}
              variant="white"
              size="lg"
              className="w-full sm:w-auto"
            >
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              Cancel
            </NeoLink>
            <NeoButton
              type="submit"
              variant="lime"
              size="lg"
              loading={submitting}
              className="w-full sm:w-auto"
            >
              <Save className="h-4 w-4" aria-hidden="true" />
              {editing ? 'Save changes' : 'Create report'}
            </NeoButton>
          </div>
        </form>
      </NeoCard>
    </PageContainer>
  )
}
