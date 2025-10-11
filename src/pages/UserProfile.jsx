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
    <div style={{ minHeight: '100vh', background: '#f7f7fb' }}>
      <div style={{ maxWidth: 720, margin: '0 auto', padding: 16 }}>
        <div className="page-header">
          <h2 style={{ margin: 0 }}>{headerName}</h2>
          <div className="header-actions">
            <button onClick={() => navigate('/')}>All Users</button>
            <button onClick={() => navigate('/friends')}>Friends</button>
            <button onClick={() => navigate('/notifications')}>Notifications</button>
            <button onClick={() => navigate('/chats')}>My Chats</button>
          </div>
        </div>

        {!userProfile ? (
          <div style={{ textAlign: 'center', color: '#99a3ad', padding: 24 }}>Loading…</div>
        ) : (
          <div style={{ background: '#fff', border: '1px solid #eee', borderRadius: 12, padding: 16, display: 'grid', gridTemplateColumns: '120px 1fr', gap: 16 }}>
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

              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
                {relationStatus === 'friends' && (
                  <span style={{ padding: '6px 10px', borderRadius: 8, background: '#e0f7fa' }}>Friends</span>
                )}
                {relationStatus === 'none' && (
                  <button disabled={working} onClick={addFriend} style={{ borderRadius: 8 }}>
                    {working ? 'Working…' : 'Add Friend'}
                  </button>
                )}
                {relationStatus === 'pending-out' && (
                  <span style={{ padding: '6px 10px', borderRadius: 8, background: '#fff7ed', color: '#9a3412' }}>Request Sent</span>
                )}
                {relationStatus === 'pending-in' && (
                  <>
                    <button disabled={working} onClick={acceptRequest} style={{ borderRadius: 8 }}>
                      {working ? 'Working…' : 'Accept Request'}
                    </button>
                    <button
                      disabled={working}
                      onClick={declineRequest}
                      style={{ borderRadius: 8, background: '#fee2e2' }}
                    >
                      Decline
                    </button>
                  </>
                )}
                <button onClick={openChat} style={{ borderRadius: 8, background: '#4f46e5', color: '#fff' }}>Chat</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
