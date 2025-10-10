import React, { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import { useNavigate } from 'react-router-dom'
import { countries } from '../countries'

export default function Profile() {
  const [profile, setProfile] = useState({})
  const [avatarFile, setAvatarFile] = useState(null)
  const navigate = useNavigate()

  // Predefined ages and genders
  const ageOptions = Array.from({ length: 83 }, (_, i) => i + 18) // 18–100
  const genderOptions = ['male', 'female', 'other']

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return navigate('/auth')
      fetchProfile(user.id)
    })
    // eslint-disable-next-line
  }, [])

  async function fetchProfile(userId) {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single()
    setProfile(data || {})
  }

  async function updateProfile() {
    let avatar_url = profile.avatar_url

    if (avatarFile) {
      const fileExt = avatarFile.name.split('.').pop()
      const fileName = `${profile.id || 'new'}_${Date.now()}.${fileExt}`
      const { error: uploadError } = await supabase.storage
        .from('chat-uploads')
        .upload(fileName, avatarFile)
      if (uploadError) return alert(uploadError.message)
      const { data } = supabase.storage.from('chat-uploads').getPublicUrl(fileName)
      avatar_url = data.publicUrl
    }

    const { data: userData } = await supabase.auth.getUser()
    const userId = userData.user.id

    // Try to update first
    const { data: updatedData, error: updateError } = await supabase
      .from('profiles')
      .update({ ...profile, avatar_url })
      .eq('id', userId)
      .select()
      .single()

    if (updateError) {
      // Insert if update fails (row doesn't exist)
      const { data: insertedData, error: insertError } = await supabase
        .from('profiles')
        .insert([{ ...profile, avatar_url, id: userId }])
        .select()
        .single()

      if (insertError) return alert(insertError.message)
      setProfile(insertedData)
    } else {
      setProfile(updatedData)
    }

    alert('Profile updated!')
    navigate('/')
  }

  async function handleLogout() {
    await supabase.auth.signOut()
    navigate('/auth')
  }

  return (
    <div className="container">
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '15px' }}>
        <h2>My Profile</h2>
        <button onClick={handleLogout}>Logout</button>
      </div>

      <input
        placeholder="Username"
        value={profile.username || ''}
        onChange={e => setProfile({ ...profile, username: e.target.value })}
      />
      <input
        placeholder="Full Name"
        value={profile.full_name || ''}
        onChange={e => setProfile({ ...profile, full_name: e.target.value })}
      />

      {/* Age dropdown */}
      <select
        value={profile.age || ''}
        onChange={e => setProfile({ ...profile, age: Number(e.target.value) })}
      >
        <option value="">Select age</option>
        {ageOptions.map(a => (
          <option key={a} value={a}>
            {a}
          </option>
        ))}
      </select>

      {/* Country dropdown */}
      <select
        value={profile.country || ''}
        onChange={e => setProfile({ ...profile, country: e.target.value })}
      >
        <option value="">Select country</option>
        {countries.map(c => (
          <option key={c} value={c}>
            {c}
          </option>
        ))}
      </select>

      {/* Gender dropdown */}
      <select
        value={profile.gender || ''}
        onChange={e => setProfile({ ...profile, gender: e.target.value })}
      >
        <option value="">Select gender</option>
        {genderOptions.map(g => (
          <option key={g} value={g}>
            {g.charAt(0).toUpperCase() + g.slice(1)}
          </option>
        ))}
      </select>

      <textarea
        placeholder="Bio"
        value={profile.bio || ''}
        onChange={e => setProfile({ ...profile, bio: e.target.value })}
      ></textarea>

      <input type="file" accept="image/*" onChange={e => setAvatarFile(e.target.files[0])} />
      <button onClick={updateProfile}>Update Profile</button>
    </div>
  )
}
