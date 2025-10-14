import React, { useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '../supabaseClient'
import { useNavigate } from 'react-router-dom'
import { countries } from '../countries'

export default function UsersList() {
  const [users, setUsers] = useState([])
  const [filteredUsers, setFilteredUsers] = useState([])
  const [currentUser, setCurrentUser] = useState(null)
  const [friendships, setFriendships] = useState([])
  const [filterCountry, setFilterCountry] = useState('')
  const [filterAgeFrom, setFilterAgeFrom] = useState('')
  const [filterAgeTo, setFilterAgeTo] = useState('')
  const [filterGender, setFilterGender] = useState('')
  const [sendingId, setSendingId] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const navigate = useNavigate()
  const profilesChannelRef = useRef(null)
  const statusChannelRef = useRef(null)

  const ONLINE_WINDOW_MS = 5 * 60 * 1000 // 5 minutes

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return navigate('/auth')
      setCurrentUser(user)
      await Promise.all([fetchUsers(), fetchFriendships(user.id)])
      subscribeProfilesRealtime(user.id)
      setIsLoading(false)
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function fetchUsers() {
    const { data, error } = await supabase.from('profiles').select('*')
    if (error) return console.error('fetchUsers error', error)
    const list = data || []
    const myId = currentUser?.id
    const withoutMe = myId ? list.filter(u => u.id !== myId) : list

    // Join with user_status in one extra query
    const ids = withoutMe.map(u => u.id)
    let statusById = new Map()
    if (ids.length > 0) {
      const { data: statuses } = await supabase.from('user_status').select('user_id,is_online,last_seen_at').in('user_id', ids)
      statusById = new Map((statuses || []).map(s => [s.user_id, s]))
    }

    const merged = withoutMe.map(u => ({
      ...u,
      _status: statusById.get(u.id) || null
    }))

    const sorted = sortUsersOnlineFirst(merged)
    setUsers(sorted)
    setFilteredUsers(sorted)
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
    if (filterAgeFrom) temp = temp.filter(u => Number(u.age) >= Number(filterAgeFrom))
    if (filterAgeTo) temp = temp.filter(u => Number(u.age) <= Number(filterAgeTo))
    if (filterGender) temp = temp.filter(u => (u.gender || '').toLowerCase() === filterGender.toLowerCase())
    if (currentUser?.id) temp = temp.filter(u => u.id !== currentUser.id)
    setFilteredUsers(sortUsersOnlineFirst(temp))
  }

  function isUserOnline(user) {
    const status = user?._status || {}
    const last = status?.last_seen_at ? Date.parse(status.last_seen_at) : 0
    const withinWindow = last > 0 && Date.now() - last <= ONLINE_WINDOW_MS
    if (typeof status?.is_online !== 'boolean') return withinWindow
    return Boolean(status.is_online) && withinWindow
  }

  function sortUsersOnlineFirst(list) {
    return [...list].sort((a, b) => {
      const ao = isUserOnline(a) ? 1 : 0
      const bo = isUserOnline(b) ? 1 : 0
      if (bo !== ao) return bo - ao
      const an = (a.username || a.full_name || '').toLowerCase()
      const bn = (b.username || b.full_name || '').toLowerCase()
      return an.localeCompare(bn)
    })
  }

  function subscribeProfilesRealtime(myId) {
    if (profilesChannelRef.current) {
      supabase.removeChannel(profilesChannelRef.current)
      profilesChannelRef.current = null
    }
    const ch = supabase
      .channel('realtime:userslist:profiles')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, (payload) => {
        const row = payload.new || payload.old
        if (!row || row.id === myId) return
        setUsers(prev => {
          const exists = prev.some(u => u.id === row.id)
          let next
          if (payload.eventType === 'DELETE') {
            next = prev.filter(u => u.id !== row.id)
          } else if (exists) {
            next = prev.map(u => (u.id === row.id ? { ...u, ...payload.new } : u))
          } else {
            next = [...prev, payload.new]
          }
          return sortUsersOnlineFirst(next)
        })
        // Re-apply current filters to keep UI consistent
        setFilteredUsers(prev => sortUsersOnlineFirst(
          prev
            .filter(u => u.id !== myId) // ensure self excluded
            .map(u => (u.id === row.id && payload.new ? { ...u, ...payload.new } : u))
        ))
      })
      .subscribe()
    profilesChannelRef.current = ch

    // Subscribe to user_status for live presence updates
    if (statusChannelRef.current) {
      supabase.removeChannel(statusChannelRef.current)
      statusChannelRef.current = null
    }
    const st = supabase
      .channel('realtime:userslist:user_status')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'user_status' }, (payload) => {
        const s = payload.new || payload.old
        if (!s || s.user_id === myId) return
        setUsers(prev => {
          const next = prev.map(u => (u.id === s.user_id ? { ...u, _status: { ...u._status, ...payload.new } } : u))
          return sortUsersOnlineFirst(next)
        })
        setFilteredUsers(prev => sortUsersOnlineFirst(prev.map(u => (u.id === s.user_id ? { ...u, _status: { ...u._status, ...payload.new } } : u))))
      })
      .subscribe()
    statusChannelRef.current = st
  }

  useEffect(() => {
    return () => {
      if (profilesChannelRef.current) {
        supabase.removeChannel(profilesChannelRef.current)
        profilesChannelRef.current = null
      }
      if (statusChannelRef.current) {
        supabase.removeChannel(statusChannelRef.current)
        statusChannelRef.current = null
      }
    }
  }, [])

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
          <div className="filters-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 8 }}>
            <select value={filterCountry} onChange={e => setFilterCountry(e.target.value)} style={{ padding: '8px 10px', borderRadius: 10, border: '1px solid var(--input-border)', background: 'var(--input-bg)', color: 'var(--text-primary)' }}>
              <option value="">All countries</option>
              {countries.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>

            {/* Age From dropdown */}
            <select value={filterAgeFrom} onChange={e => setFilterAgeFrom(e.target.value)} style={{ padding: '8px 10px', borderRadius: 10, border: '1px solid var(--input-border)', background: 'var(--input-bg)', color: 'var(--text-primary)' }}>
              <option value="">Age from</option>
              {ageOptions.map(a => (
                <option key={a} value={a}>{a}</option>
              ))}
            </select>

            {/* Age To dropdown */}
            <select value={filterAgeTo} onChange={e => setFilterAgeTo(e.target.value)} style={{ padding: '8px 10px', borderRadius: 10, border: '1px solid var(--input-border)', background: 'var(--input-bg)', color: 'var(--text-primary)' }}>
              <option value="">Age to</option>
              {ageOptions.map(a => (
                <option key={a} value={a}>{a}</option>
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
              const online = isUserOnline(u)
              return (
                <li key={u.id} className="card" style={{ padding: 12, display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ position: 'relative', width: 48, height: 48 }}>
                    {u.avatar_url ? (
                      <img src={u.avatar_url} alt="avatar" width={48} height={48} style={{ borderRadius: '50%', objectFit: 'cover' }} />
                    ) : (
                      <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'var(--placeholder-avatar-bg)', display: 'grid', placeItems: 'center', color: 'var(--placeholder-avatar-text)', fontWeight: 700 }}>
                        {(u.username || u.full_name || '?')[0]?.toUpperCase()}
                      </div>
                    )}
                    {online && (
                      <span title="Online" aria-label="Online" style={{ position: 'absolute', top: -2, left: -2, width: 12, height: 12, borderRadius: 6, background: '#22c55e', border: '2px solid var(--card-bg)', display: 'inline-block' }} />
                    )}
                  </div>
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
