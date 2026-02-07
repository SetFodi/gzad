'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Upload, CheckCircle, X } from 'lucide-react'
import { useRouter } from 'next/navigation'

export default function SubmitAdPage() {
  const [name, setName] = useState('')
  const [files, setFiles] = useState<File[]>([])
  const [uploading, setUploading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()
  const supabase = createClient()

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setFiles(Array.from(e.target.files))
    }
  }

  const removeFile = (index: number) => {
    setFiles(files.filter((_, i) => i !== index))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name || files.length === 0) {
      setError('Please provide a campaign name and at least one file')
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

      // Create campaign
      const { data: campaign, error: campError } = await supabase
        .from('campaigns')
        .insert({ client_id: client.id, name, status: 'pending_review' })
        .select()
        .single()

      if (campError) throw campError

      // Upload files
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
          <h2>Ad Submitted!</h2>
          <p>Your ad is under review. We will notify you once it is approved.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="portal-page">
      <h1 className="portal-page-title">Submit New Ad</h1>

      <form onSubmit={handleSubmit} className="portal-form">
        {error && <div className="portal-login-error">{error}</div>}

        <div className="portal-input-group">
          <label htmlFor="name">Campaign Name</label>
          <input
            id="name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Summer Sale Promo"
            required
          />
        </div>

        <div className="portal-input-group">
          <label>Ad Media (Images or Videos)</label>
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
              <span>Click to upload or drag files here</span>
              <span className="file-hint">PNG, JPG, GIF, MP4 (max 50MB)</span>
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
          {uploading ? 'Uploading...' : 'Submit for Review'}
        </button>
      </form>
    </div>
  )
}
