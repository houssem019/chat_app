import React, { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import { useNavigate } from 'react-router-dom'

export default function Notifications() {
  const [currentUser, setCurrentUser] = useState(null)
  const [requests, setRequests] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [actionId, setActionId] = useState(null)
  const navigate = useNavigate()

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return navigate('/auth')
      setCurrentUser(user)
      fetchRequests(user.id).finally(() => setIsLoading(false))
    })
  }, [])

  // Mark notifications as opened when the page mounts/focuses to keep header badge accurate
  useEffect(() => {
    if (!currentUser?.id) return
    const markNotificationsOpened = () => {
      try {
        localStorage.setItem('lastOpenedNotifications', new Date().toISOString())
      } catch (_) {
        // ignore storage errors
      }
      try {
        window.dispatchEvent(new Event('notifications:lastOpened'))
      } catch (_) {
        // ignore
      }
    }
    markNotificationsOpened()
    const onFocus = () => markNotificationsOpened()
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [currentUser?.id])

  async function fetchRequests(userId) {
    const { data, error } = await supabase
      .from('friendships')
      .select(`
        id,
        requester_id,
        friend_id,
        status,
        requester:profiles!friendships_requester_id_fkey(*)
      `)
      .eq('friend_id', userId)
      .eq('status', 'pending')

    if (error) {
      console.error('fetchRequests error', error)
    } else {
      setRequests(data || [])
    }
  }

  async function acceptRequest(requesterId) {
    setActionId(requesterId)
    await supabase.from('friendships').update({ status: 'accepted' }).match({ requester_id: requesterId, friend_id: currentUser.id })
    setActionId(null)
    fetchRequests(currentUser.id)
  }

  async function removeRequest(requesterId) {
    setActionId(requesterId)
    await supabase.from('friendships').delete().match({ requester_id: requesterId, friend_id: currentUser.id })
    setActionId(null)
    fetchRequests(currentUser.id)
  }

  

  return (
    <div style={{ minHeight: '100vh', background: '#f7f7fb' }}>
      <div style={{ maxWidth: 720, margin: '0 auto', padding: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
          <h2 style={{ margin: 0 }}>Notifications</h2>
        </div>

        {isLoading ? (
          <div style={{ textAlign: 'center', color: '#99a3ad', padding: 24 }}>Loading requests…</div>
        ) : requests.length === 0 ? (
          <div style={{ textAlign: 'center', color: '#99a3ad', padding: 24 }}>No friend requests</div>
        ) : (
          <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gridTemplateColumns: '1fr', gap: 12 }}>
            {requests.map(r => (
              <li key={r.requester_id} style={{ border: '1px solid #eee', background: '#fff', borderRadius: 12, padding: 12, display: 'flex', alignItems: 'center', gap: 12 }}>
                {r.requester?.avatar_url ? (
                  <img src={r.requester.avatar_url} alt="avatar" width={40} height={40} style={{ borderRadius: '50%', objectFit: 'cover' }} />
                ) : (
                  <div style={{ width: 40, height: 40, borderRadius: '50%', background: '#e3e7ff', display: 'grid', placeItems: 'center', color: '#3949ab', fontWeight: 700 }}>
                    {(r.requester?.username || r.requester?.full_name || '?')[0]?.toUpperCase()}
                  </div>
                )}
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600 }}>{r.requester?.username || r.requester?.full_name || 'Unknown user'}</div>
                  <div style={{ color: '#6b7280', fontSize: 12 }}>wants to be your friend</div>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button disabled={actionId === r.requester_id} onClick={() => acceptRequest(r.requester_id)} style={{ borderRadius: 8 }}>
                    {actionId === r.requester_id ? 'Working…' : 'Accept'}
                  </button>
                  <button disabled={actionId === r.requester_id} onClick={() => removeRequest(r.requester_id)} style={{ borderRadius: 8, background: '#fee2e2' }}>
                    Remove
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
