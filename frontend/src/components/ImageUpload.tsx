import { useEffect, useId, useRef, useState } from 'react'
import { ImagePlus, RefreshCw, Trash2, UploadCloud } from 'lucide-react'
import { cn } from '../lib/cn'

function formatBytes(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export default function ImageUpload({
  file,
  onChange,
  existingUrl,
  error,
  maxSizeMb = 5,
}: {
  file: File | null
  onChange: (file: File | null) => void
  existingUrl?: string | null
  error?: string
  maxSizeMb?: number
}) {
  const inputId = useId()
  const inputRef = useRef<HTMLInputElement>(null)
  const [preview, setPreview] = useState<string | null>(existingUrl || null)
  const [dragging, setDragging] = useState(false)

  useEffect(() => {
    if (!file) {
      setPreview(existingUrl || null)
      return
    }
    const url = URL.createObjectURL(file)
    setPreview(url)
    return () => URL.revokeObjectURL(url)
  }, [file, existingUrl])

  const handleFiles = (files: FileList | null) => {
    const next = files?.[0]
    if (next) onChange(next)
  }

  return (
    <div>
      <div className="mb-2 flex items-end justify-between gap-3">
        <div>
          <p className="neo-label mb-0">Item image</p>
          <p className="mt-1 text-xs text-muted">
            JPEG, PNG or WebP. Maximum {maxSizeMb} MB.
          </p>
        </div>
        {file && (
          <button
            type="button"
            onClick={() => onChange(null)}
            className="inline-flex items-center gap-1 text-xs font-bold underline decoration-2 underline-offset-2 hover:bg-bubble"
          >
            <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
            Remove new image
          </button>
        )}
      </div>

      <input
        id={inputId}
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="sr-only"
        onChange={(event) => handleFiles(event.target.files)}
      />

      {preview ? (
        <div className="overflow-hidden rounded-lg border-[3px] border-ink bg-white shadow-neo-sm">
          <img
            src={preview}
            alt={file ? 'Selected item preview' : 'Current report image'}
            className="h-56 w-full object-cover sm:h-64"
          />
          <div className="flex flex-wrap items-center justify-between gap-3 border-t-[3px] border-ink bg-lavender-soft px-3 py-2.5">
            <p className="min-w-0 truncate text-xs font-semibold text-ink">
              {file ? `${file.name} · ${formatBytes(file.size)}` : 'Current saved image'}
            </p>
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="inline-flex items-center gap-1.5 rounded border-2 border-ink bg-white px-2.5 py-1 text-xs font-bold shadow-[2px_2px_0_#111111] transition-transform hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[1px_1px_0_#111111]"
            >
              <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
              {file ? 'Replace' : 'Choose a new image'}
            </button>
          </div>
        </div>
      ) : (
        <label
          htmlFor={inputId}
          onDragOver={(event) => {
            event.preventDefault()
            setDragging(true)
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(event) => {
            event.preventDefault()
            setDragging(false)
            handleFiles(event.dataTransfer.files)
          }}
          className={cn(
            'flex cursor-pointer flex-col items-center justify-center rounded-lg border-[3px] border-dashed border-ink px-6 py-10 text-center transition-colors',
            dragging ? 'bg-lime' : 'bg-lavender-soft hover:bg-lavender',
            error && 'border-bubble bg-bubble/30',
          )}
        >
          <span className="flex h-14 w-14 items-center justify-center rounded-md border-[3px] border-ink bg-white shadow-[3px_3px_0_#111111]">
            {dragging ? (
              <ImagePlus className="h-6 w-6" aria-hidden="true" />
            ) : (
              <UploadCloud className="h-6 w-6" aria-hidden="true" />
            )}
          </span>
          <span className="mt-4 font-display text-base font-extrabold text-ink">
            Drop an image here or browse
          </span>
          <span className="mt-1 text-xs font-medium text-muted">
            Click this area to open your file picker.
          </span>
        </label>
      )}

      {error && (
        <p className="mt-2 text-xs font-bold text-ink">
          <span className="inline-block bg-bubble px-1.5 py-0.5">{error}</span>
        </p>
      )}
    </div>
  )
}
