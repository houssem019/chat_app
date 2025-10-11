import React, { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import { useNavigate } from 'react-router-dom'

export default function Friends() {
  const [currentUser, setCurrentUser] = useState(null)
  const [friends, setFriends] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const navigate = useNavigate()

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return navigate('/auth')
      setCurrentUser(user)
      fetchFriends(user.id).finally(() => setIsLoading(false))
    })
  }, [])

  async function fetchFriends(userId) {
    const { data, error } = await supabase
      .from('friendships')
      .select(`
        requester_id,
        friend_id,
        status,
        requester:profiles!friendships_requester_id_fkey(*),
        friend:profiles!friendships_friend_id_fkey(*)
      `)
      .or(`and(requester_id.eq.${userId},status.eq.accepted),and(friend_id.eq.${userId},status.eq.accepted)`)

    if (error) {
      console.error('Error fetching friends:', error)
    } else {
      const friendsList = data.map(f => (f.requester_id === userId ? f.friend : f.requester))
      setFriends(friendsList)
    }
  }

  useEffect(() => {
    if (!currentUser) return
    const channel = supabase
      .channel('friendship-updates')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'friendships' },
        payload => {
          if (
            payload.new?.requester_id === currentUser.id ||
            payload.new?.friend_id === currentUser.id ||
            payload.old?.requester_id === currentUser.id ||
            payload.old?.friend_id === currentUser.id
          ) {
            fetchFriends(currentUser.id)
          }
        }
      )
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [currentUser])

  

  return (
    <div style={{ minHeight: '100vh', background: '#f7f7fb' }}>
      <div style={{ maxWidth: 720, margin: '0 auto', padding: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
          <h2 style={{ margin: 0 }}>My Friends</h2>
        </div>

        {isLoading ? (
          <div style={{ textAlign: 'center', color: '#99a3ad', padding: 24 }}>Loading friends…</div>
        ) : friends.length === 0 ? (
          <div style={{ textAlign: 'center', color: '#99a3ad', padding: 24 }}>No friends yet</div>
        ) : (
          <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
            {friends.map(user => (
              <li key={user.id} style={{ border: '1px solid #eee', background: '#fff', borderRadius: 12, padding: 12, display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }} onClick={() => navigate(`/chat/${user.username}`)}>
                {user.avatar_url ? (
                  <img src={user.avatar_url} alt="avatar" width={48} height={48} style={{ borderRadius: '50%', objectFit: 'cover' }} />
                ) : (
                  <div style={{ width: 48, height: 48, borderRadius: '50%', background: '#e3e7ff', display: 'grid', placeItems: 'center', color: '#3949ab', fontWeight: 700 }}>
                    {(user.username || user.full_name || '?')[0]?.toUpperCase()}
                  </div>
                )}
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600 }}>{user.username || user.full_name || 'No Name'}</div>
                  <div style={{ color: '#6b7280', fontSize: 12 }}>{user.country || 'Unknown country'}</div>
                </div>
                <button style={{ borderRadius: 8 }}>Open Chat</button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
