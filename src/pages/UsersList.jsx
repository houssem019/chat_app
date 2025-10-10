import React, { useState, useEffect } from 'react'
import { supabase } from '../supabaseClient'
import { useNavigate } from 'react-router-dom'
import { countries } from '../countries'

export default function UsersList() {
  const [users, setUsers] = useState([])
  const [filteredUsers, setFilteredUsers] = useState([])
  const [currentUser, setCurrentUser] = useState(null)
  const [friendships, setFriendships] = useState([])
  const [filterCountry, setFilterCountry] = useState('')
  const [filterAge, setFilterAge] = useState('')
  const [filterGender, setFilterGender] = useState('')
  const [sendingId, setSendingId] = useState(null)
  const navigate = useNavigate()

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return navigate('/auth')
      setCurrentUser(user)
      await Promise.all([fetchUsers(), fetchFriendships(user.id)])
    })()
  }, [])

  async function fetchUsers() {
    const { data, error } = await supabase.from('profiles').select('*')
    if (error) return console.error('fetchUsers error', error)
    setUsers(data || [])
    setFilteredUsers(data || [])
  }

  async function fetchFriendships(userId) {
    const { data, error } = await supabase
      .from('friendships')
      .select('*')
      .or(`requester_id.eq.${userId},friend_id.eq.${userId}`)
    if (error) return console.error('fetchFriendships error', error)
    setFriendships(data || [])
  }

  // predefined ages for dropdown
  const ageOptions = Array.from({ length: 83 }, (_, i) => i + 18)

  function applyFilters() {
    let temp = [...users]
    if (filterCountry) temp = temp.filter(u => u.country === filterCountry)
    if (filterAge) temp = temp.filter(u => Number(u.age) === Number(filterAge))
    if (filterGender) temp = temp.filter(u => (u.gender || '').toLowerCase() === filterGender.toLowerCase())
    setFilteredUsers(temp)
  }

  function relationWith(userId) {
    if (!currentUser || !friendships) return null
    return friendships.find(f =>
      (f.requester_id === currentUser.id && f.friend_id === userId) ||
      (f.requester_id === userId && f.friend_id === currentUser.id)
    ) || null
  }

  async function addFriend(targetId) {
    if (!currentUser || targetId === currentUser.id) return
    const existing = relationWith(targetId)
    if (existing) return

    setSendingId(targetId)
    const { error } = await supabase.from('friendships').insert([{ requester_id: currentUser.id, friend_id: targetId, status: 'pending' }])
    setSendingId(null)
    if (error) return console.error('addFriend error', error)
    await fetchFriendships(currentUser.id)
  }

  function handleChat(user) {
    if (!user.username) return alert('User has no username')
    navigate(`/chat/${user.username}`)
  }

  async function handleLogout() {
    await supabase.auth.signOut()
    navigate('/auth')
  }

  return (
    <div className="container">
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
        <h2>All Users</h2>
        <div>
          <button onClick={() => navigate('/notifications')}>Notifications</button>{' '}
          <button onClick={() => navigate('/friends')}>Friends</button>{' '}
          <button onClick={() => navigate('/profile')}>Profile</button>{' '}
          <button onClick={() => navigate('/chats')}>My Chats</button>{' '}
          <button onClick={handleLogout}>Logout</button>
        </div>
      </div>

      {/* Filters */}
      <div style={{ marginBottom: '12px' }}>
        <select value={filterCountry} onChange={e => setFilterCountry(e.target.value)}>
          <option value="">All countries</option>
          {countries.map(c => <option key={c} value={c}>{c}</option>)}
        </select>

        <select value={filterAge} onChange={e => setFilterAge(e.target.value)}>
          <option value="">All ages</option>
          {ageOptions.map(a => <option key={a} value={a}>{a}</option>)}
        </select>

        <select value={filterGender} onChange={e => setFilterGender(e.target.value)}>
          <option value="">All genders</option>
          <option value="male">Male</option>
          <option value="female">Female</option>
          <option value="other">Other</option>
        </select>

        <button onClick={applyFilters}>Apply Filters</button>
      </div>

      {/* Users list */}
      <ul>
        {filteredUsers.map(u => {
          const rel = relationWith(u.id)
          const isSelf = currentUser?.id === u.id
          return (
            <li key={u.id} style={{ marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '10px' }}>
              {u.avatar_url && <img src={u.avatar_url} alt="avatar" width={40} style={{ borderRadius: '50%' }} />}
              <div style={{ flex: 1, fontWeight: isSelf ? 'bold' : 'normal', cursor: 'pointer' }} onClick={() => handleChat(u)}>
                {u.username || u.full_name || 'No Name'}
                {isSelf && <span style={{ marginLeft: 8, fontStyle: 'italic' }}>(You)</span>}
              </div>

              {isSelf ? null : (
                <>
                  {rel ? (
                    rel.status === 'pending' ? (
                      rel.requester_id === currentUser.id ? <button disabled style={{ opacity: 0.6 }}>Request Sent</button> :
                      <button onClick={() => navigate('/notifications')}>Respond</button>
                    ) : rel.status === 'accepted' ? (
                      <span style={{ padding: '6px 8px', borderRadius: 6, background: '#e0f7fa' }}>Friends</span>
                    ) : null
                  ) : (
                    <button disabled={sendingId === u.id} onClick={() => addFriend(u.id)}>
                      {sendingId === u.id ? 'Sending…' : 'Add Friend'}
                    </button>
                  )}
                </>
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
