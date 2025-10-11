import React, { useEffect, useMemo, useState } from 'react'
import { supabase } from '../supabaseClient'
import { useNavigate } from 'react-router-dom'

export default function ChatsList() {
  const [currentUser, setCurrentUser] = useState(null)
  const [chats, setChats] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [latestByPartner, setLatestByPartner] = useState({})
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
    const { data: msgPairs } = await supabase
      .from('messages')
      .select('sender_id, receiver_id, created_at')
      .or(`sender_id.eq.${userId},receiver_id.eq.${userId}`)
    if (!msgPairs) return

    const userIds = [...new Set(msgPairs.map(m => (m.sender_id === userId ? m.receiver_id : m.sender_id)))]
    if (userIds.length === 0) {
      setChats([])
      setLatestByPartner({})
      return
    }

    // Fetch latest messages for unread indicator
    const { data: latestMsgs } = await supabase
      .from('messages')
      .select('*')
      .or(`sender_id.eq.${userId},receiver_id.eq.${userId}`)
      .order('created_at', { ascending: false })
      .limit(500)

    const latestMap = {}
    for (const m of latestMsgs || []) {
      const partnerId = m.sender_id === userId ? m.receiver_id : m.sender_id
      if (!latestMap[partnerId]) {
        latestMap[partnerId] = m
      }
    }
    setLatestByPartner(latestMap)

    const { data: users } = await supabase.from('profiles').select('*').in('id', userIds)
    setChats(users || [])
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-page)' }}>
      <div style={{ maxWidth: 720, margin: '0 auto', padding: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
          <h2 style={{ margin: 0 }}>My Chats</h2>
        </div>

        {isLoading ? (
          <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 24 }}>Loading chats…</div>
        ) : chats.length === 0 ? (
          <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 24 }}>No chats yet</div>
        ) : (
          <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gridTemplateColumns: '1fr', gap: 8 }}>
            {chats.map(user => {
              const latest = latestByPartner[user.id]
              const lastOpenedIso = latest ? localStorage.getItem(`lastOpenedChatById:${user.id}`) : null
              const lastOpened = lastOpenedIso ? Date.parse(lastOpenedIso) : 0
              const hasUnread = latest ? (latest.sender_id !== currentUser?.id && Date.parse(latest.created_at) > lastOpened) : false
              return (
                <li key={user.id} style={{ border: '1px solid var(--card-border)', background: 'var(--card-bg)', borderRadius: 12, padding: 10, display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }} onClick={() => navigate(`/chat/${user.username}`)}>
                  {user.avatar_url ? (
                    <img src={user.avatar_url} alt="avatar" width={40} height={40} style={{ borderRadius: '50%', objectFit: 'cover' }} />
                  ) : (
                    <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'var(--placeholder-avatar-bg)', display: 'grid', placeItems: 'center', color: 'var(--placeholder-avatar-text)', fontWeight: 700 }}>
                      {(user.username || user.full_name || '?')[0]?.toUpperCase()}
                    </div>
                  )}
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}>
                      {user.username || user.full_name}
                      {hasUnread && (
                        <span title="New messages" style={{ width: 8, height: 8, borderRadius: 4, background: 'var(--unread-dot-bg)', display: 'inline-block' }} />
                      )}
                    </div>
                  </div>
                  <button style={{ borderRadius: 8 }}>Open</button>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </div>
  )
}
