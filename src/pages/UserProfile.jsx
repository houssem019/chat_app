import React, { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../supabaseClient'

export default function UserProfile() {
  const { username } = useParams()
  const navigate = useNavigate()

  const [currentUser, setCurrentUser] = useState(null)
  const [userProfile, setUserProfile] = useState(null)
  const [friendship, setFriendship] = useState(null)
  const [working, setWorking] = useState(false)
  const [gallery, setGallery] = useState([])

  const headerName = useMemo(
    () => userProfile?.username || userProfile?.full_name || 'User',
    [userProfile]
  )

  useEffect(() => {
    let isMounted = true
    ;(async () => {
      const { data: authData } = await supabase.auth.getUser()
      const authUser = authData?.user
      if (!authUser) {
        navigate('/auth')
        return
      }
      if (!isMounted) return
      setCurrentUser(authUser)

      const { data: target, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('username', username)
        .single()
      if (error || !target) {
        alert('User not found')
        navigate('/')
        return
      }

      if (target.id === authUser.id) {
        navigate('/profile')
        return
      }

      if (!isMounted) return
      setUserProfile(target)
      await fetchFriendship(authUser.id, target.id)
      await loadGallery(target.id)
    })()

    return () => {
      isMounted = false
    }
  }, [username])

  async function fetchFriendship(myId, otherId) {
    const { data, error } = await supabase
      .from('friendships')
      .select('*')
      .or(
        `and(requester_id.eq.${myId},friend_id.eq.${otherId}),and(requester_id.eq.${otherId},friend_id.eq.${myId})`
      )
      .maybeSingle()
    if (error) {
      console.error('fetchFriendship error', error)
      setFriendship(null)
      return
    }
    setFriendship(data || null)
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

  const relationStatus = useMemo(() => {
    if (!friendship || !currentUser || !userProfile) return 'none'
    if (friendship.status === 'accepted') return 'friends'
    if (friendship.status === 'pending') {
      return friendship.requester_id === currentUser.id ? 'pending-out' : 'pending-in'
    }
    return 'none'
  }, [friendship, currentUser, userProfile])

  async function addFriend() {
    if (!currentUser || !userProfile) return
    setWorking(true)
    const { error } = await supabase
      .from('friendships')
      .insert([{ requester_id: currentUser.id, friend_id: userProfile.id, status: 'pending' }])
    if (error) console.error('addFriend error', error)
    await fetchFriendship(currentUser.id, userProfile.id)
    setWorking(false)
  }

  async function removeFriend() {
    if (!currentUser || !userProfile) return
    setWorking(true)
    try {
      const { error } = await supabase
        .from('friendships')
        .delete()
        .or(
          `and(requester_id.eq.${currentUser.id},friend_id.eq.${userProfile.id}),and(requester_id.eq.${userProfile.id},friend_id.eq.${currentUser.id})`
        )
      if (error) console.error('removeFriend error', error)
      await fetchFriendship(currentUser.id, userProfile.id)
    } finally {
      setWorking(false)
    }
  }

  async function acceptRequest() {
    if (!currentUser || !userProfile) return
    setWorking(true)
    const { error } = await supabase
      .from('friendships')
      .update({ status: 'accepted' })
      .match({ requester_id: userProfile.id, friend_id: currentUser.id })
    if (error) console.error('acceptRequest error', error)
    await fetchFriendship(currentUser.id, userProfile.id)
    setWorking(false)
  }

  async function declineRequest() {
    if (!currentUser || !userProfile) return
    setWorking(true)
    const { error } = await supabase
      .from('friendships')
      .delete()
      .match({ requester_id: userProfile.id, friend_id: currentUser.id })
    if (error) console.error('declineRequest error', error)
    await fetchFriendship(currentUser.id, userProfile.id)
    setWorking(false)
  }

  function openChat() {
    if (!userProfile?.username) return
    navigate(`/chat/${userProfile.username}`)
  }

  return (
    <div className="container-page">
      <div style={{ maxWidth: 720, margin: '0 auto', padding: 16 }}>
        <div className="page-header">
          <h2 style={{ margin: 0 }}>{headerName}</h2>
        </div>

        {!userProfile ? (
          <div style={{ textAlign: 'center', color: '#99a3ad', padding: 24 }}>Loading…</div>
        ) : (
          <div className="card profile-grid" style={{ padding: 16, display: 'grid', gridTemplateColumns: '120px 1fr', gap: 16 }}>
            <div>
              {userProfile.avatar_url ? (
                <img
                  src={userProfile.avatar_url}
                  alt="avatar"
                  style={{ width: 100, height: 100, objectFit: 'cover', borderRadius: '50%' }}
                />
              ) : (
                <div
                  style={{
                    width: 100,
                    height: 100,
                    borderRadius: '50%',
                    background: '#e3e7ff',
                    display: 'grid',
                    placeItems: 'center',
                    color: '#3949ab',
                    fontWeight: 700
                  }}
                >
                  {(headerName || '?')[0]?.toUpperCase()}
                </div>
              )}
            </div>

              <div style={{ display: 'grid', gap: 10 }}>
              <div style={{ fontWeight: 700, fontSize: 18 }}>
                {userProfile.full_name || userProfile.username}
              </div>
              <div style={{ color: '#6b7280' }}>
                {(userProfile.country || 'Unknown country')}
                {userProfile.age ? ` · ${userProfile.age}` : ''}
                {userProfile.gender ? ` · ${userProfile.gender}` : ''}
              </div>
              {userProfile.bio && (
                <div style={{ whiteSpace: 'pre-wrap', lineHeight: 1.4 }}>{userProfile.bio}</div>
              )}

              <div className="row gap-8 wrap" style={{ marginTop: 8 }}>
                {relationStatus === 'friends' && (
                  <>
                    <span className="btn-chip">Friends</span>
                    <button className="btn btn-danger" disabled={working} onClick={removeFriend}>
                      {working ? 'Working…' : 'Remove'}
                    </button>
                  </>
                )}
                {relationStatus === 'none' && (
                  <button className="btn btn-primary" disabled={working} onClick={addFriend}>
                    {working ? 'Working…' : 'Add Friend'}
                  </button>
                )}
                {relationStatus === 'pending-out' && (
                  <span className="btn-chip" style={{ background: '#fff7ed', borderColor: '#ffedd5', color: '#9a3412' }}>Request Sent</span>
                )}
                {relationStatus === 'pending-in' && (
                  <>
                    <button className="btn btn-primary" disabled={working} onClick={acceptRequest}>
                      {working ? 'Working…' : 'Accept Request'}
                    </button>
                    <button className="btn btn-danger" disabled={working} onClick={declineRequest}>Decline</button>
                  </>
                )}
                <button className="btn btn-primary" onClick={openChat}>Chat</button>
              </div>
            </div>
          </div>
        )}

        {/* Gallery */}
        {userProfile && (
          <div className="card" style={{ marginTop: 16, padding: 16 }}>
            <h3 style={{ margin: '0 0 12px 0' }}>Photos</h3>
            {gallery.length === 0 ? (
              <div style={{ color: '#99a3ad' }}>No photos</div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: 10 }}>
                {gallery.map(item => (
                  <div key={item.path} style={{ borderRadius: 10, overflow: 'hidden', border: '1px solid #eee' }}>
                    <img src={item.url} alt="profile" style={{ width: '100%', height: 120, objectFit: 'cover' }} />
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
