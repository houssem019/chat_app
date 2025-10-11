import React, { useEffect, useMemo, useState } from 'react'
import { supabase } from '../supabaseClient'
import { useNavigate } from 'react-router-dom'

export default function ChatsList() {
  const [currentUser, setCurrentUser] = useState(null)
  const [chats, setChats] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const navigate = useNavigate()

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) navigate('/auth')
      else {
        setCurrentUser(user)
        fetchChats(user.id).finally(() => setIsLoading(false))
      }
    })
  }, [])

  async function fetchChats(userId) {
    const { data } = await supabase
      .from('messages')
      .select('sender_id, receiver_id')
      .or(`sender_id.eq.${userId},receiver_id.eq.${userId}`)
    if (!data) return

    const userIds = [...new Set(data.map(m => (m.sender_id === userId ? m.receiver_id : m.sender_id)))]
    if (userIds.length === 0) {
      setChats([])
      return
    }
    const { data: users } = await supabase.from('profiles').select('*').in('id', userIds)
    setChats(users || [])
  }

  async function handleLogout() {
    await supabase.auth.signOut()
    navigate('/auth')
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f7f7fb' }}>
      <div style={{ maxWidth: 720, margin: '0 auto', padding: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
          <h2 style={{ margin: 0 }}>My Chats</h2>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => navigate('/')}>All Users</button>
            <button onClick={() => navigate('/notifications')}>Notifications</button>
            <button onClick={() => navigate('/friends')}>Friends</button>
            <button onClick={() => navigate('/profile')}>Profile</button>
            <button onClick={handleLogout}>Logout</button>
          </div>
        </div>

        {isLoading ? (
          <div style={{ textAlign: 'center', color: '#99a3ad', padding: 24 }}>Loading chats…</div>
        ) : chats.length === 0 ? (
          <div style={{ textAlign: 'center', color: '#99a3ad', padding: 24 }}>No chats yet</div>
        ) : (
          <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gridTemplateColumns: '1fr', gap: 8 }}>
            {chats.map(user => (
              <li key={user.id} style={{ border: '1px solid #eee', background: '#fff', borderRadius: 12, padding: 10, display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }} onClick={() => navigate(`/chat/${user.username}`)}>
                {user.avatar_url ? (
                  <img src={user.avatar_url} alt="avatar" width={40} height={40} style={{ borderRadius: '50%', objectFit: 'cover' }} />
                ) : (
                  <div style={{ width: 40, height: 40, borderRadius: '50%', background: '#e3e7ff', display: 'grid', placeItems: 'center', color: '#3949ab', fontWeight: 700 }}>
                    {(user.username || user.full_name || '?')[0]?.toUpperCase()}
                  </div>
                )}
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600 }}>{user.username || user.full_name}</div>
                </div>
                <button style={{ borderRadius: 8 }}>Open</button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
