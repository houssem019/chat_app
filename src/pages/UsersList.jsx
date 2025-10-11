import React, { useEffect, useMemo, useState } from 'react'
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
  const [isLoading, setIsLoading] = useState(true)
  const navigate = useNavigate()

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return navigate('/auth')
      setCurrentUser(user)
      await Promise.all([fetchUsers(), fetchFriendships(user.id)])
      setIsLoading(false)
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function fetchUsers() {
    // Fetch all users; we will filter out the current user after we know them
    const { data, error } = await supabase.from('profiles').select('*')
    if (error) return console.error('fetchUsers error', error)
    const list = data || []
    const myId = currentUser?.id
    const withoutMe = myId ? list.filter(u => u.id !== myId) : list
    setUsers(withoutMe)
    setFilteredUsers(withoutMe)
  }

  async function fetchFriendships(userId) {
    const { data, error } = await supabase
      .from('friendships')
      .select('*')
      .or(`requester_id.eq.${userId},friend_id.eq.${userId}`)
    if (error) return console.error('fetchFriendships error', error)
    setFriendships(data || [])
  }

  const ageOptions = useMemo(() => Array.from({ length: 83 }, (_, i) => i + 18), [])

  function applyFilters() {
    let temp = [...users]
    if (filterCountry) temp = temp.filter(u => u.country === filterCountry)
    if (filterAge) temp = temp.filter(u => Number(u.age) === Number(filterAge))
    if (filterGender) temp = temp.filter(u => (u.gender || '').toLowerCase() === filterGender.toLowerCase())
    if (currentUser?.id) temp = temp.filter(u => u.id !== currentUser.id)
    setFilteredUsers(temp)
  }

  function relationWith(userId) {
    if (!currentUser || !friendships) return null
    return (
      friendships.find(
        f =>
          (f.requester_id === currentUser.id && f.friend_id === userId) ||
          (f.requester_id === userId && f.friend_id === currentUser.id)
      ) || null
    )
  }

  async function addFriend(targetId) {
    if (!currentUser || targetId === currentUser.id) return
    const existing = relationWith(targetId)
    if (existing) return

    setSendingId(targetId)
    const { error } = await supabase
      .from('friendships')
      .insert([{ requester_id: currentUser.id, friend_id: targetId, status: 'pending' }])
    setSendingId(null)
    if (error) return console.error('addFriend error', error)
    await fetchFriendships(currentUser.id)
  }

  function handleChat(user) {
    if (!user.username) return alert('User has no username')
    navigate(`/chat/${user.username}`)
  }

  

  return (
    <div className="container-page">
      <div style={{ maxWidth: 840, margin: '0 auto', padding: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
          <h2 style={{ margin: 0 }}>All Users</h2>
        </div>

        <div className="card" style={{ padding: 12, marginBottom: 12 }}>
          <div className="filters-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
            <select value={filterCountry} onChange={e => setFilterCountry(e.target.value)} style={{ padding: '8px 10px', borderRadius: 10, border: '1px solid var(--input-border)', background: 'var(--input-bg)', color: 'var(--text-primary)' }}>
              <option value="">All countries</option>
              {countries.map(c => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>

            <select value={filterAge} onChange={e => setFilterAge(e.target.value)} style={{ padding: '8px 10px', borderRadius: 10, border: '1px solid var(--input-border)', background: 'var(--input-bg)', color: 'var(--text-primary)' }}>
              <option value="">All ages</option>
              {ageOptions.map(a => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>

            <select value={filterGender} onChange={e => setFilterGender(e.target.value)} style={{ padding: '8px 10px', borderRadius: 10, border: '1px solid var(--input-border)', background: 'var(--input-bg)', color: 'var(--text-primary)' }}>
              <option value="">All genders</option>
              <option value="male">Male</option>
              <option value="female">Female</option>
              <option value="other">Other</option>
            </select>

            <button className="btn btn-primary" onClick={applyFilters}>Apply Filters</button>
          </div>
        </div>

        {isLoading ? (
          <div style={{ textAlign: 'center', color: '#99a3ad', padding: 24 }}>Loading users…</div>
        ) : filteredUsers.length === 0 ? (
          <div style={{ textAlign: 'center', color: '#99a3ad', padding: 24 }}>No users found</div>
        ) : (
          <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
            {filteredUsers.map(u => {
              const rel = relationWith(u.id)
              const isSelf = currentUser?.id === u.id
              if (isSelf) return null
              return (
                <li key={u.id} className="card" style={{ padding: 12, display: 'flex', alignItems: 'center', gap: 12 }}>
                  {u.avatar_url ? (
                    <img src={u.avatar_url} alt="avatar" width={48} height={48} style={{ borderRadius: '50%', objectFit: 'cover' }} />
                  ) : (
                    <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'var(--placeholder-avatar-bg)', display: 'grid', placeItems: 'center', color: 'var(--placeholder-avatar-text)', fontWeight: 700 }}>
                      {(u.username || u.full_name || '?')[0]?.toUpperCase()}
                    </div>
                  )}
                  <div style={{ flex: 1 }}>
                    <div onClick={(e) => { e.stopPropagation(); u.username && navigate(`/u/${u.username}`) }} style={{ cursor: u.username ? 'pointer' : 'default', fontWeight: 600 }}>
                      {u.username || u.full_name || 'No Name'}
                    </div>
                    <div style={{ color: 'var(--text-secondary)', fontSize: 12 }}>
                      {u.country || 'Unknown country'} {u.age ? `· ${u.age}` : ''} {u.gender ? `· ${u.gender}` : ''}
                    </div>
                  </div>

                  {isSelf ? null : (
                    rel ? (
                      rel.status === 'pending' ? (
                        rel.requester_id === currentUser.id ? (
                          <span className="btn-chip" style={{ opacity: 0.9 }}>Request Sent</span>
                        ) : (
                          <button className="btn" onClick={() => navigate('/notifications')}>Respond</button>
                        )
                      ) : rel.status === 'accepted' ? (
                        <span className="btn-chip">Friends</span>
                      ) : null
                    ) : (
                      <div className="row gap-8">
                        <button className="btn" onClick={() => handleChat(u)}>Chat</button>
                        <button className="btn btn-primary" disabled={sendingId === u.id} onClick={() => addFriend(u.id)}>
                          {sendingId === u.id ? 'Sending…' : 'Add Friend'}
                        </button>
                      </div>
                    )
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </div>
  )
}
