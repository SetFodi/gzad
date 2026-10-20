'use client'

import { useEffect, useState, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Upload, CheckCircle, X } from 'lucide-react'
import ScreenPreview from '@/components/portal/ScreenPreview'
import { useRouter } from 'next/navigation'
import { useTranslations } from '@/lib/i18n'

const NAME_REGEX = /^[a-z0-9][a-z0-9 ]*[a-z0-9]$|^[a-z0-9]$/
const MAX_VIDEO_SIZE = 100 * 1024 * 1024
const MAX_IMAGE_SIZE = 10 * 1024 * 1024

// Kept in step with the storage bucket's allowed_mime_types (migration 009) —
// the bucket rejects anything else, so catch it here for a readable error.
const ALLOWED_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'video/mp4',
  'video/webm',
]

type AdDuration = 10 | 20 | 30

export default function SubmitAdPage() {
  const [name, setName] = useState('')
  const [nameError, setNameError] = useState('')
  const [files, setFiles] = useState<File[]>([])
  const [duration, setDuration] = useState<AdDuration>(10)
  const [uploading, setUploading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState('')
  const [dragOver, setDragOver] = useState(false)
  const router = useRouter()
  const supabase = createClient()
  const { t } = useTranslations()
  const p = t.portal.submit

  // Generate preview URLs for selected files
  const previews = useMemo(() => {
    return files.map(file => ({
      url: URL.createObjectURL(file),
      isVideo: file.type.startsWith('video/'),
      name: file.name,
      size: file.size,
    }))
  }, [files])

  useEffect(() => () => previews.forEach(preview => URL.revokeObjectURL(preview.url)), [previews])

  function validateName(value: string): string | null {
    if (!value.trim()) return p.nameRequired
    if (value.trim().length < 2) return p.nameMinLength
    if (value.trim().length > 50) return p.nameMaxLength
    if (!NAME_REGEX.test(value.trim())) return p.nameInvalidChars
    return null
  }

  const acceptFiles = (selected: File[]) => {
    if (selected.length === 0) return

    const wrongType = selected.find(f => !ALLOWED_TYPES.includes(f.type))
    if (wrongType) {
      setError(`${wrongType.name}: unsupported file type. Use JPG, PNG, WebP, MP4 or WebM.`)
      return
    }

    const invalid = selected.find(f => {
      const limit = f.type.startsWith('video/') ? MAX_VIDEO_SIZE : MAX_IMAGE_SIZE
      return f.size > limit
    })
    if (invalid) {
      const isVideo = invalid.type.startsWith('video/')
      setError(`${invalid.name} ${p.fileTooLarge} (${(invalid.size / 1024 / 1024).toFixed(1)}MB). ${isVideo ? p.maxForVideos : p.maxForImages}.`)
      return
    }
    setError('')
    setFiles(current => {
      const seen = new Set(current.map(f => `${f.name}|${f.size}`))
      return [...current, ...selected.filter(f => !seen.has(`${f.name}|${f.size}`))]
    })
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) acceptFiles(Array.from(e.target.files))
    // Let the same file be picked again after removing it.
    e.target.value = ''
  }

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setDragOver(false)
    acceptFiles(Array.from(e.dataTransfer.files))
  }

  const removeFile = (index: number) => {
    setFiles(files.filter((_, i) => i !== index))
  }

  const handleNameChange = (value: string) => {
    const cleaned = value.toLowerCase().replace(/[^a-z0-9 ]/g, '')
    setName(cleaned)
    const err = validateName(cleaned)
    setNameError(err || '')
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const nameErr = validateName(name)
    if (nameErr) {
      setNameError(nameErr)
      return
    }
    if (files.length === 0) {
      setError(p.noFiles)
      return
    }

    setUploading(true)
    setError('')

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      const { data: client } = await supabase
        .from('clients')
        .select('id')
        .eq('auth_user_id', user.id)
        .single()

      if (!client) throw new Error('Client profile not found')

      // Global uniqueness check (RLS hides other clients' campaigns, so this
      // must go through the API — play logs are matched to campaigns by name)
      const checkRes = await fetch('/api/campaigns/check-name', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim() }),
      })
      const check = await checkRes.json()
      if (!checkRes.ok || !check.available) {
        throw new Error(p.nameDuplicate)
      }

      const { data: campaign, error: campError } = await supabase
        .from('campaigns')
        .insert({ client_id: client.id, name: name.trim(), status: 'pending_review', slot_duration: duration })
        .select()
        .single()

      if (campError) throw campError

      for (const file of files) {
        const ext = file.name.split('.').pop()
        const path = `${client.id}/${campaign.id}/${Date.now()}.${ext}`

        const { error: uploadError } = await supabase.storage
          .from('ad-media')
          .upload(path, file)

        if (uploadError) throw uploadError

        const { data: { publicUrl } } = supabase.storage
          .from('ad-media')
          .getPublicUrl(path)

        await supabase.from('ad_media').insert({
          campaign_id: campaign.id,
          file_url: publicUrl,
          file_type: file.type,
          file_name: file.name,
          display_duration_seconds: duration,
        })
      }

      setSuccess(true)
      setTimeout(() => router.push('/portal/dashboard/campaigns'), 2000)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setUploading(false)
    }
  }

  if (success) {
    return (
      <div className="portal-page">
        <div className="portal-success">
          <CheckCircle size={48} color="var(--portal-success)" />
          <h2>{p.success}</h2>
          <p>{p.successMessage}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="portal-page">
      <div className="portal-page-header">
        <div>
          <h1 className="portal-page-title">{p.title}</h1>
          <p className="portal-subtitle">{p.subtitle}</p>
        </div>
      </div>

      <div className="submit-layout">
        <form onSubmit={handleSubmit} className="portal-form submit-form">
          {error && <div className="portal-login-error" role="alert">{error}</div>}

          <div className="portal-input-group">
            <label htmlFor="name">{p.campaignName}</label>
            <input
              id="name"
              type="text"
              value={name}
              onChange={(e) => handleNameChange(e.target.value)}
              placeholder={p.campaignNamePlaceholder}
              aria-invalid={nameError ? true : undefined}
              aria-describedby="name-hint"
              required
            />
            {nameError
              ? <span className="field-error">{nameError}</span>
              : <span id="name-hint" className="field-hint">{p.nameHint}</span>}
          </div>

          <div className="portal-input-group">
            <label htmlFor="files">{p.adMedia}</label>
            <div
              className="file-upload-zone"
              data-drag={dragOver || undefined}
              onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
            >
              <input
                type="file"
                id="files"
                multiple
                accept="image/jpeg,image/png,image/webp,video/mp4,video/webm"
                onChange={handleFileChange}
                className="file-input"
              />
              <label htmlFor="files" className="file-upload-label">
                <Upload size={28} aria-hidden />
                <span>{p.uploadLabel}</span>
                <span className="file-hint">{p.uploadHintFormats}</span>
                <span className="file-hint">{p.uploadHintVideo}</span>
              </label>
            </div>

            {files.length > 0 && (
              <ul className="file-list">
                {previews.map((preview, i) => (
                  <li key={`${preview.name}-${preview.size}`} className="file-row">
                    <div className="file-row-thumb">
                      {preview.isVideo ? (
                        <video src={preview.url} muted playsInline />
                      ) : (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={preview.url} alt="" />
                      )}
                    </div>
                    <div className="file-row-text">
                      <span className="file-row-name">{preview.name}</span>
                      <span className="file-row-size">{(preview.size / 1024 / 1024).toFixed(1)} MB</span>
                    </div>
                    <button type="button" className="app-icon-btn" onClick={() => removeFile(i)} aria-label={`${p.remove} ${preview.name}`}>
                      <X size={16} aria-hidden />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="portal-input-group">
            <span className="field-label" id="duration-label">{p.adDuration}</span>
            <div className="segmented" role="radiogroup" aria-labelledby="duration-label">
              {([10, 20, 30] as AdDuration[]).map(d => (
                <button
                  type="button"
                  key={d}
                  role="radio"
                  aria-checked={duration === d}
                  onClick={() => setDuration(d)}
                >
                  {d} {p.seconds}
                </button>
              ))}
            </div>
            <span className="field-hint">{p.adDurationHint}</span>
          </div>

          <button type="submit" disabled={uploading} className="portal-btn-primary full-width">
            {uploading ? p.uploading : p.submitForReview}
          </button>
        </form>

        <aside className="submit-preview">
          <h2>{p.previewTitle}</h2>
          <ScreenPreview
            src={previews[0]?.url}
            isVideo={previews[0]?.isVideo}
            emptyLabel={p.previewEmpty}
          />
          <p className="field-hint">{p.previewNote}</p>
          {files.length > 0 && (
            <dl className="submit-summary">
              <div><dt>{p.files}</dt><dd>{files.length}</dd></div>
              <div><dt>{p.adDuration}</dt><dd>{duration} {p.seconds}</dd></div>
            </dl>
          )}
        </aside>
      </div>
    </div>
  )
}
