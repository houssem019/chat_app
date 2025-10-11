import React, { useEffect, useMemo, useState } from 'react'
import { supabase } from '../supabaseClient'
import { useNavigate } from 'react-router-dom'
import { countries } from '../countries'

export default function Profile() {
  const [profile, setProfile] = useState({})
  const [avatarFile, setAvatarFile] = useState(null)
  const [previewUrl, setPreviewUrl] = useState(null)
  const [isSaving, setIsSaving] = useState(false)
  const [gallery, setGallery] = useState([])
  const [isUploading, setIsUploading] = useState(false)
  const [myUserId, setMyUserId] = useState(null)
  const navigate = useNavigate()

  const ageOptions = useMemo(() => Array.from({ length: 83 }, (_, i) => i + 18), [])
  const genderOptions = ['male', 'female', 'other']

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return navigate('/auth')
      setMyUserId(user.id)
      fetchProfile(user.id)
      loadGallery(user.id)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function fetchProfile(userId) {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single()
    setProfile(data || {})
  }

  function onPickAvatar(file) {
    if (!file) {
      setAvatarFile(null)
      setPreviewUrl(null)
      return
    }
    setAvatarFile(file)
    setPreviewUrl(URL.createObjectURL(file))
  }

  async function loadGallery(userId) {
    try {
      const { data: files, error } = await supabase.storage
        .from('chat-uploads')
        .list(`profile-photos/${userId}`, { limit: 50, offset: 0, sortBy: { column: 'name', order: 'desc' } })
      if (error) throw error
      const items = Array.isArray(files) ? files : []
      const urls = await Promise.all(
        items.map(async (f) => {
          const path = `profile-photos/${userId}/${f.name}`
          const { data } = await supabase.storage.from('chat-uploads').getPublicUrl(path)
          return { name: f.name, path, url: data?.publicUrl || null }
        })
      )
      setGallery(urls.filter(u => u.url))
    } catch (e) {
      console.error('loadGallery error', e)
      setGallery([])
    }
  }

  async function uploadPhotos(files) {
    if (!myUserId) return
    const filesArr = Array.from(files || [])
    if (filesArr.length === 0) return
    const remaining = Math.max(0, 5 - gallery.length)
    if (remaining <= 0) {
      alert('You can upload up to 5 photos.')
      return
    }
    const toUpload = filesArr.slice(0, remaining)
    setIsUploading(true)
    try {
      for (const file of toUpload) {
        const ext = file.name.split('.').pop()
        const filePath = `profile-photos/${myUserId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
        const { error: uploadError } = await supabase.storage
          .from('chat-uploads')
          .upload(filePath, file, { contentType: file.type })
        if (uploadError) throw uploadError
      }
      await loadGallery(myUserId)
    } catch (e) {
      console.error('uploadPhotos error', e)
      alert('Upload failed. Please try again.')
    } finally {
      setIsUploading(false)
    }
  }

  async function deletePhoto(item) {
    if (!item?.path) return
    try {
      const { error } = await supabase.storage.from('chat-uploads').remove([item.path])
      if (error) throw error
      setGallery(prev => prev.filter(x => x.path !== item.path))
    } catch (e) {
      console.error('deletePhoto error', e)
      alert('Failed to delete photo')
    }
  }

  async function updateProfile() {
    setIsSaving(true)
    let avatar_url = profile.avatar_url || null

    try {
      if (avatarFile) {
        const ext = avatarFile.name.split('.').pop()
        const filePath = `avatars/${profile.id || 'new'}/${Date.now()}.${ext}`
        const { error: uploadError } = await supabase.storage
          .from('chat-uploads')
          .upload(filePath, avatarFile, { contentType: avatarFile.type })
        if (uploadError) throw uploadError
        const { data } = await supabase.storage.from('chat-uploads').getPublicUrl(filePath)
        avatar_url = data?.publicUrl || null
      }

      const { data: userData } = await supabase.auth.getUser()
      const userId = userData.user.id

      const { data: updatedData, error: updateError } = await supabase
        .from('profiles')
        .update({ ...profile, avatar_url })
        .eq('id', userId)
        .select()
        .single()

      if (updateError) {
        const { data: insertedData, error: insertError } = await supabase
          .from('profiles')
          .insert([{ ...profile, avatar_url, id: userId }])
          .select()
          .single()
        if (insertError) throw insertError
        setProfile(insertedData)
      } else {
        setProfile(updatedData)
      }

      alert('Profile updated!')
      navigate('/')
    } catch (e) {
      console.error('updateProfile error', e)
      alert('Failed to update profile')
    } finally {
      setIsSaving(false)
    }
  }

  

  return (
    <div className="container-page">
      <div style={{ maxWidth: 720, margin: '0 auto', padding: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h2 style={{ margin: 0 }}>My Profile</h2>
        </div>

        <div className="card profile-grid" style={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: 16, alignItems: 'center', padding: 16 }}>
          <div>
            {previewUrl || profile.avatar_url ? (
              <img src={previewUrl || profile.avatar_url} alt="avatar" style={{ width: 100, height: 100, objectFit: 'cover', borderRadius: '50%' }} />
            ) : (
              <div style={{ width: 100, height: 100, borderRadius: '50%', background: var(--input-border), display: 'grid', placeItems: 'center', color: var(--text-secondary) }}>No avatar</div>
            )}
            <label htmlFor="avatar-input" style={{ display: 'inline-block', marginTop: 8, padding: '6px 10px', borderRadius: 8, border: '1px dashed var(--input-border)', cursor: 'pointer', background: 'var(--muted-surface-bg)' }}>Change</label>
            <input id="avatar-input" type="file" accept="image/*" style={{ display: 'none' }} onChange={e => onPickAvatar(e.target.files?.[0])} />
          </div>

          <div style={{ display: 'grid', gap: 10 }}>
            <input
              placeholder="Username"
              value={profile.username || ''}
              onChange={e => setProfile({ ...profile, username: e.target.value })}
              style={{ padding: '10px 12px', borderRadius: 10, border: '1px solid var(--input-border)', background: 'var(--input-bg)', color: 'var(--text-primary)' }}
            />
            <input
              placeholder="Full Name"
              value={profile.full_name || ''}
              onChange={e => setProfile({ ...profile, full_name: e.target.value })}
              style={{ padding: '10px 12px', borderRadius: 10, border: '1px solid var(--input-border)', background: 'var(--input-bg)', color: 'var(--text-primary)' }}
            />

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
              <select
                value={profile.age || ''}
                onChange={e => setProfile({ ...profile, age: Number(e.target.value) })}
                style={{ padding: '10px 12px', borderRadius: 10, border: '1px solid var(--input-border)', background: 'var(--input-bg)', color: 'var(--text-primary)' }}
              >
                <option value="">Select age</option>
                {ageOptions.map(a => (
                  <option key={a} value={a}>{a}</option>
                ))}
              </select>

              <select
                value={profile.country || ''}
                onChange={e => setProfile({ ...profile, country: e.target.value })}
                style={{ padding: '10px 12px', borderRadius: 10, border: '1px solid var(--input-border)', background: 'var(--input-bg)', color: 'var(--text-primary)' }}
              >
                <option value="">Select country</option>
                {countries.map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>

              <select
                value={profile.gender || ''}
                onChange={e => setProfile({ ...profile, gender: e.target.value })}
                style={{ padding: '10px 12px', borderRadius: 10, border: '1px solid var(--input-border)', background: 'var(--input-bg)', color: 'var(--text-primary)' }}
              >
                <option value="">Select gender</option>
                {genderOptions.map(g => (
                  <option key={g} value={g}>{g.charAt(0).toUpperCase() + g.slice(1)}</option>
                ))}
              </select>
            </div>

            <textarea
              placeholder="Bio"
              value={profile.bio || ''}
              onChange={e => setProfile({ ...profile, bio: e.target.value })}
              rows={3}
              style={{ padding: '10px 12px', borderRadius: 10, border: '1px solid var(--input-border)', background: 'var(--input-bg)', color: 'var(--text-primary)' }}
            />
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}>
          <button className="btn btn-primary" onClick={updateProfile} disabled={isSaving}>
            {isSaving ? 'Saving…' : 'Save Changes'}
          </button>
        </div>

        <div className="card" style={{ marginTop: 20, padding: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <h3 style={{ margin: 0 }}>My Photos</h3>
            <div>
              <label htmlFor="gallery-input" style={{ display: 'inline-block', padding: '6px 10px', borderRadius: 8, border: '1px dashed #cbd5e1', cursor: gallery.length >= 5 || isUploading ? 'not-allowed' : 'pointer', background: '#f8fafc', opacity: gallery.length >= 5 ? 0.6 : 1 }}>
                {isUploading ? 'Uploading…' : (gallery.length >= 5 ? 'Limit Reached' : 'Add Photos')}
              </label>
              <input id="gallery-input" type="file" accept="image/*" multiple disabled={gallery.length >= 5 || isUploading} style={{ display: 'none' }} onChange={e => { uploadPhotos(e.target.files); e.target.value = '' }} />
            </div>
          </div>
          {gallery.length === 0 ? (
            <div style={{ color: 'var(--text-muted)' }}>No photos yet.</div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: 10 }}>
              {gallery.map(item => (
                <div key={item.path} style={{ position: 'relative', borderRadius: 10, overflow: 'hidden', border: '1px solid var(--card-border)' }}>
                  <img src={item.url} alt="profile" style={{ width: '100%', height: 120, objectFit: 'cover' }} />
                  <button onClick={() => deletePhoto(item)} title="Remove" style={{ position: 'absolute', top: 6, right: 6, borderRadius: 8, border: 'none', background: '#111827cc', color: '#fff', cursor: 'pointer', padding: '4px 6px' }}>✕</button>
                </div>
              ))}
            </div>
          )}
          <div style={{ marginTop: 8, color: 'var(--text-secondary)', fontSize: 12 }}>You can upload up to 5 photos.</div>
        </div>
      </div>
    </div>
  )
}
