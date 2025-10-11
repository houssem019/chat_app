import React, { useEffect, useMemo, useState } from 'react'
import { supabase } from '../supabaseClient'
import { useNavigate } from 'react-router-dom'
import { countries } from '../countries'

export default function Profile() {
  const [profile, setProfile] = useState({})
  const [avatarFile, setAvatarFile] = useState(null)
  const [previewUrl, setPreviewUrl] = useState(null)
  const [isSaving, setIsSaving] = useState(false)
  const navigate = useNavigate()

  const ageOptions = useMemo(() => Array.from({ length: 83 }, (_, i) => i + 18), [])
  const genderOptions = ['male', 'female', 'other']

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return navigate('/auth')
      fetchProfile(user.id)
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

  async function handleLogout() {
    await supabase.auth.signOut()
    navigate('/auth')
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f7f7fb' }}>
      <div style={{ maxWidth: 720, margin: '0 auto', padding: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h2 style={{ margin: 0 }}>My Profile</h2>
          <button onClick={handleLogout}>Logout</button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: 16, alignItems: 'center', background: '#fff', padding: 16, borderRadius: 12, border: '1px solid #eee' }}>
          <div>
            {previewUrl || profile.avatar_url ? (
              <img src={previewUrl || profile.avatar_url} alt="avatar" style={{ width: 100, height: 100, objectFit: 'cover', borderRadius: '50%' }} />
            ) : (
              <div style={{ width: 100, height: 100, borderRadius: '50%', background: '#e5e7eb', display: 'grid', placeItems: 'center', color: '#6b7280' }}>No avatar</div>
            )}
            <label htmlFor="avatar-input" style={{ display: 'inline-block', marginTop: 8, padding: '6px 10px', borderRadius: 8, border: '1px dashed #cbd5e1', cursor: 'pointer', background: '#f8fafc' }}>Change</label>
            <input id="avatar-input" type="file" accept="image/*" style={{ display: 'none' }} onChange={e => onPickAvatar(e.target.files?.[0])} />
          </div>

          <div style={{ display: 'grid', gap: 10 }}>
            <input
              placeholder="Username"
              value={profile.username || ''}
              onChange={e => setProfile({ ...profile, username: e.target.value })}
              style={{ padding: '10px 12px', borderRadius: 10, border: '1px solid #e5e7eb', background: '#fafafa' }}
            />
            <input
              placeholder="Full Name"
              value={profile.full_name || ''}
              onChange={e => setProfile({ ...profile, full_name: e.target.value })}
              style={{ padding: '10px 12px', borderRadius: 10, border: '1px solid #e5e7eb', background: '#fafafa' }}
            />

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
              <select
                value={profile.age || ''}
                onChange={e => setProfile({ ...profile, age: Number(e.target.value) })}
                style={{ padding: '10px 12px', borderRadius: 10, border: '1px solid #e5e7eb', background: '#fafafa' }}
              >
                <option value="">Select age</option>
                {ageOptions.map(a => (
                  <option key={a} value={a}>{a}</option>
                ))}
              </select>

              <select
                value={profile.country || ''}
                onChange={e => setProfile({ ...profile, country: e.target.value })}
                style={{ padding: '10px 12px', borderRadius: 10, border: '1px solid #e5e7eb', background: '#fafafa' }}
              >
                <option value="">Select country</option>
                {countries.map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>

              <select
                value={profile.gender || ''}
                onChange={e => setProfile({ ...profile, gender: e.target.value })}
                style={{ padding: '10px 12px', borderRadius: 10, border: '1px solid #e5e7eb', background: '#fafafa' }}
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
              style={{ padding: '10px 12px', borderRadius: 10, border: '1px solid #e5e7eb', background: '#fafafa' }}
            />
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}>
          <button
            onClick={updateProfile}
            disabled={isSaving}
            style={{ padding: '10px 14px', borderRadius: 10, background: isSaving ? '#c7d2fe' : '#4f46e5', color: '#fff', border: 'none', cursor: isSaving ? 'not-allowed' : 'pointer', fontWeight: 600 }}
          >
            {isSaving ? 'Saving…' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  )
}
