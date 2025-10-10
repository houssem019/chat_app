import React, { useState, useEffect } from 'react'
import { supabase } from '../supabaseClient'
import { useNavigate } from 'react-router-dom'

export default function Notifications() {
  const [currentUser, setCurrentUser] = useState(null)
  const [requests, setRequests] = useState([])
  const navigate = useNavigate()

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return navigate('/auth')
      setCurrentUser(user)
      fetchRequests(user.id)
    })
  }, [])

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
    await supabase.from('friendships').update({ status: 'accepted' }).match({ requester_id: requesterId, friend_id: currentUser.id })
    fetchRequests(currentUser.id)
  }

  async function removeRequest(requesterId) {
    await supabase.from('friendships').delete().match({ requester_id: requesterId, friend_id: currentUser.id })
    fetchRequests(currentUser.id)
  }

  async function handleLogout() {
    await supabase.auth.signOut()
    navigate('/auth')
  }

  return (
    <div className="container">
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '15px' }}>
        <h2>Notifications</h2>
        <div>
          <button onClick={() => navigate('/')}>All Users</button>{' '}
          <button onClick={() => navigate('/friends')}>Friends</button>{' '}
          <button onClick={() => navigate('/profile')}>Profile</button>{' '}
          <button onClick={() => navigate('/chats')}>My Chats</button>{' '}
          <button onClick={handleLogout}>Logout</button>
        </div>
      </div>

      {requests.length === 0 && <p>No friend requests.</p>}
      <ul>
        {requests.map(r => (
          <li key={r.requester_id}>
            {r.requester.username || r.requester.full_name}
            <button onClick={() => acceptRequest(r.requester_id)}>Accept</button>
            <button onClick={() => removeRequest(r.requester_id)}>Remove</button>
          </li>
        ))}
      </ul>
    </div>
  )
}
