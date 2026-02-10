'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Upload, CheckCircle, X } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useTranslations } from '@/lib/i18n'

const NAME_REGEX = /^[a-z0-9][a-z0-9 ]*[a-z0-9]$|^[a-z0-9]$/
const MAX_VIDEO_SIZE = 100 * 1024 * 1024
const MAX_IMAGE_SIZE = 10 * 1024 * 1024

export default function SubmitAdPage() {
  const [name, setName] = useState('')
  const [nameError, setNameError] = useState('')
  const [files, setFiles] = useState<File[]>([])
  const [uploading, setUploading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()
  const supabase = createClient()
  const { t } = useTranslations()
  const p = t.portal.submit
  const c = t.portal.common

  function validateName(value: string): string | null {
    if (!value.trim()) return p.nameRequired
    if (value.trim().length < 2) return p.nameMinLength
    if (value.trim().length > 50) return p.nameMaxLength
    if (!NAME_REGEX.test(value.trim())) return p.nameInvalidChars
    return null
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const selected = Array.from(e.target.files)
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
      setFiles(selected)
    }
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

      const { data: existing } = await supabase
        .from('campaigns')
        .select('id')
        .ilike('name', name.trim())
        .limit(1)

      if (existing && existing.length > 0) {
        throw new Error(p.nameDuplicate)
      }

      const { data: campaign, error: campError } = await supabase
        .from('campaigns')
        .insert({ client_id: client.id, name: name.trim(), status: 'pending_review' })
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
          <CheckCircle size={48} color="#CCF381" />
          <h2>{p.success}</h2>
          <p>{p.successMessage}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="portal-page">
      <h1 className="portal-page-title">{p.title}</h1>

      <form onSubmit={handleSubmit} className="portal-form">
        {error && <div className="portal-login-error">{error}</div>}

        <div className="portal-input-group">
          <label htmlFor="name">{p.campaignName}</label>
          <input
            id="name"
            type="text"
            value={name}
            onChange={(e) => handleNameChange(e.target.value)}
            placeholder={p.campaignNamePlaceholder}
            required
          />
          {nameError && <span style={{ color: '#EF4444', fontSize: '13px', marginTop: '4px', display: 'block' }}>{nameError}</span>}
          <span style={{ color: '#525252', fontSize: '12px', marginTop: '4px', display: 'block' }}>
            {p.nameHint}
          </span>
        </div>

        <div className="portal-input-group">
          <label>{p.adMedia}</label>
          <div className="file-upload-zone">
            <input
              type="file"
              id="files"
              multiple
              accept="image/*,video/mp4"
              onChange={handleFileChange}
              className="file-input"
            />
            <label htmlFor="files" className="file-upload-label">
              <Upload size={32} />
              <span>{p.uploadLabel}</span>
              <span className="file-hint">{p.uploadHintFormats}</span>
              <span className="file-hint">{p.uploadHintVideo}</span>
            </label>
          </div>

          {files.length > 0 && (
            <div className="file-list">
              {files.map((file, i) => (
                <div key={i} className="file-item">
                  <span>{file.name}</span>
                  <span className="file-size">{(file.size / 1024 / 1024).toFixed(1)} MB</span>
                  <button type="button" onClick={() => removeFile(i)} className="file-remove">
                    <X size={16} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <button type="submit" disabled={uploading} className="portal-btn-primary full-width">
          {uploading ? p.uploading : p.submitForReview}
        </button>
      </form>
    </div>
  )
}
