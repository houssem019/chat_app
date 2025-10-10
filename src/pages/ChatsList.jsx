import React, { useState, useEffect } from 'react'
import { supabase } from '../supabaseClient'
import { useNavigate } from 'react-router-dom'

export default function ChatsList() {
  const [currentUser, setCurrentUser] = useState(null)
  const [chats, setChats] = useState([])
  const navigate = useNavigate()

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) navigate('/auth')
      else {
        setCurrentUser(user)
        fetchChats(user.id)
      }
    })
  }, [])

  async function fetchChats(userId) {
    const { data } = await supabase
      .from('messages')
      .select('sender_id, receiver_id')
      .or(`sender_id.eq.${userId},receiver_id.eq.${userId}`)
    if (!data) return

    // get unique user IDs
    const userIds = [...new Set(data.map(m => (m.sender_id === userId ? m.receiver_id : m.sender_id)))]

    // fetch their profiles
    const { data: users } = await supabase.from('profiles').select('*').in('id', userIds)
    setChats(users || [])
  }

  async function handleLogout() {
    await supabase.auth.signOut()
    navigate('/auth')
  }

  return (
    <div className="container">
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '15px' }}>
        <h2>My Chats</h2>
        <div>
          <button onClick={() => navigate('/')}>All Users</button>{' '}
          <button onClick={() => navigate('/notifications')}>Notifications</button>{' '}
          <button onClick={() => navigate('/friends')}>Friends</button>{' '}
          <button onClick={() => navigate('/profile')}>Profile</button>{' '}
          <button onClick={handleLogout}>Logout</button>
        </div>
      </div>

      <ul>
        {chats.map(user => (
          <li key={user.id} style={{ marginBottom: '10px', cursor: 'pointer' }} onClick={() => navigate(`/chat/${user.username}`)}>
            {user.avatar_url && <img src={user.avatar_url} alt="avatar" width={40} style={{ borderRadius: '50%', marginRight: '10px' }} />}
            {user.username || user.full_name}
          </li>
        ))}
      </ul>
    </div>
  )
}
