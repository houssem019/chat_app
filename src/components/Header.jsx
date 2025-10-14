import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { supabase } from '../supabaseClient'

function Brand({ onClick }) {
  return (
    <div
      onClick={onClick}
      className="row gap-8"
      style={{ alignItems: 'baseline', cursor: 'pointer', userSelect: 'none' }}
      title="Go to home"
    >
     <div style={{ display: 'inline-flex', gap: 0 }}>
       <span className="brand-title" style={{ fontSize: 22 }}>Chat</span>
       <span className="brand-accent" style={{ fontSize: 22 }}>Twins</span>
     </div>
    </div>
  )
}

function Badge({ count }) {
  if (!count || count <= 0) return null
  const text = count > 99 ? '99+' : String(count)
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        marginLeft: 6,
        minWidth: 18,
        height: 18,
        padding: '0 5px',
        borderRadius: 9,
        background: 'var(--unread-dot-bg)',
        color: '#fff',
        fontSize: 11,
        fontWeight: 700,
        lineHeight: '18px',
      }}
    >
      {text}
    </span>
  )
}

export default function Header() {
  const navigate = useNavigate()
  const location = useLocation()

  const [authUser, setAuthUser] = useState(null)
  const [pendingRequests, setPendingRequests] = useState(0)
  const [unreadChats, setUnreadChats] = useState(0)

  const messageChannelRef = useRef(null)
  const friendshipChannelRef = useRef(null)
  const presenceIntervalRef = useRef(null)
  const presenceWarnedRef = useRef(false)

  useEffect(() => {
    let mounted = true
    supabase.auth.getUser().then(({ data }) => {
      if (!mounted) return
      const user = data?.user || null
      setAuthUser(user)
      if (user) {
        refreshCounts(user.id)
        subscribeRealtime(user.id)
        startPresence(user.id)
      } else {
        cleanupRealtime()
        setPendingRequests(0)
        setUnreadChats(0)
        stopPresence()
      }
    })
    return () => {
      mounted = false
      cleanupRealtime()
      stopPresence()
    }
  }, [])

  useEffect(() => {
    const { data: { subscription } = {} } = supabase.auth.onAuthStateChange((_event, session) => {
      const user = session?.user || null
      setAuthUser(user)
      if (user) {
        refreshCounts(user.id)
        subscribeRealtime(user.id)
        startPresence(user.id)
      } else {
        cleanupRealtime()
        setPendingRequests(0)
        setUnreadChats(0)
        stopPresence()
      }
    })
    return () => subscription?.unsubscribe?.()
  }, [])

  useEffect(() => {
    if (!authUser?.id) return
    const myId = authUser.id

    const handleStorage = (event) => {
      const key = event?.key || ''
      if (key.startsWith('lastOpenedChatById:')) computeUnreadChats(myId)
      if (key === 'lastOpenedNotifications') fetchPendingRequests(myId)
    }

    const handleChatsOpened = () => computeUnreadChats(myId)
    const handleNotificationsOpened = () => fetchPendingRequests(myId)
    const handleFocus = () => refreshCounts(myId)

    window.addEventListener('storage', handleStorage)
    window.addEventListener('chats:lastOpened', handleChatsOpened)
    window.addEventListener('notifications:lastOpened', handleNotificationsOpened)
    window.addEventListener('focus', handleFocus)

    return () => {
      window.removeEventListener('storage', handleStorage)
      window.removeEventListener('chats:lastOpened', handleChatsOpened)
      window.removeEventListener('notifications:lastOpened', handleNotificationsOpened)
      window.removeEventListener('focus', handleFocus)
    }
  }, [authUser?.id])

  useEffect(() => {
    if (authUser) refreshCounts(authUser.id)
  }, [location.pathname])

  async function refreshCounts(myId) {
    await Promise.all([fetchPendingRequests(myId), computeUnreadChats(myId)])
  }

  async function fetchPendingRequests(myId) {
    const { data, error } = await supabase
      .from('friendships')
      .select('id, created_at')
      .eq('friend_id', myId)
      .eq('status', 'pending')
    if (error) {
      console.error('fetchPendingRequests error', error)
      setPendingRequests(0)
      return
    }
    const list = Array.isArray(data) ? data : []
    let unseen = list.length
    try {
      const lastIso = localStorage.getItem('lastOpenedNotifications')
      const lastOpened = lastIso ? Date.parse(lastIso) : 0
      if (lastOpened > 0) {
        const newer = list.filter((it) => it?.created_at && Date.parse(it.created_at) > lastOpened)
        unseen = newer.length
      }
    } catch (_) {}
    setPendingRequests(unseen)
  }

  async function computeUnreadChats(myId) {
    const { data, error } = await supabase
      .from('messages')
      .select('sender_id,receiver_id,created_at')
      .or(`sender_id.eq.${myId},receiver_id.eq.${myId}`)
      .order('created_at', { ascending: false })
      .limit(500)
    if (error) {
      console.error('computeUnreadChats error', error)
      setUnreadChats(0)
      return
    }
    const latestByPartner = new Map()
    for (const m of data || []) {
      const partnerId = m.sender_id === myId ? m.receiver_id : m.sender_id
      if (!latestByPartner.has(partnerId)) {
        latestByPartner.set(partnerId, m)
      }
    }
    let count = 0
    latestByPartner.forEach((msg, partnerId) => {
      const lastOpenedKey = `lastOpenedChatById:${partnerId}`
      const lastOpenedIso = localStorage.getItem(lastOpenedKey)
      const lastOpened = lastOpenedIso ? Date.parse(lastOpenedIso) : 0
      const msgTime = Date.parse(msg.created_at)
      const isFromPartner = msg.sender_id !== myId
      if (isFromPartner && msgTime > lastOpened) count += 1
    })
    setUnreadChats(count)
  }

  function subscribeRealtime(myId) {
    cleanupRealtime()
    const msgCh = supabase
      .channel('realtime:header:messages')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, (payload) => {
        const m = payload.new
        if (m.receiver_id === myId) computeUnreadChats(myId)
      })
      .subscribe()
    messageChannelRef.current = msgCh

    const frCh = supabase
      .channel('realtime:header:friendships')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'friendships' }, (payload) => {
        const f = payload.new || payload.old
        if (f.friend_id === myId || f.requester_id === myId) fetchPendingRequests(myId)
      })
      .subscribe()
    friendshipChannelRef.current = frCh
  }

  function cleanupRealtime() {
    if (messageChannelRef.current) {
      supabase.removeChannel(messageChannelRef.current)
      messageChannelRef.current = null
    }
    if (friendshipChannelRef.current) {
      supabase.removeChannel(friendshipChannelRef.current)
      friendshipChannelRef.current = null
    }
  }

  // Presence management: update last_seen_at and is_online regularly while the app is open.
  function stopPresence() {
    if (presenceIntervalRef.current) {
      clearInterval(presenceIntervalRef.current)
      presenceIntervalRef.current = null
    }
    try {
      window.removeEventListener('visibilitychange', onVisibilityHeartbeat)
      window.removeEventListener('focus', onFocusHeartbeat)
      window.removeEventListener('beforeunload', onBeforeUnloadHeartbeat)
    } catch (_) {}
  }

  function startPresence(userId) {
    stopPresence()
    // Heartbeat immediately and then every 60s
    heartbeat(userId)
    presenceIntervalRef.current = setInterval(() => heartbeat(userId), 60_000)
    try {
      window.addEventListener('visibilitychange', onVisibilityHeartbeat)
      window.addEventListener('focus', onFocusHeartbeat)
      window.addEventListener('beforeunload', onBeforeUnloadHeartbeat)
    } catch (_) {}
  }

  function onVisibilityHeartbeat() {
    if (document.visibilityState === 'visible' && authUser?.id) heartbeat(authUser.id)
  }

  function onFocusHeartbeat() {
    if (authUser?.id) heartbeat(authUser.id)
  }

  async function heartbeat(userId) {
    try {
      await supabase
        .from('profiles')
        .update({ last_seen_at: new Date().toISOString(), is_online: true })
        .eq('id', userId)
    } catch (e) {
      if (!presenceWarnedRef.current) {
        console.warn('presence heartbeat failed (ensure DB columns exist):', e)
        presenceWarnedRef.current = true
      }
    }
  }

  async function setOfflineNow(userId) {
    try {
      await supabase
        .from('profiles')
        .update({ is_online: false, last_seen_at: new Date().toISOString() })
        .eq('id', userId)
    } catch (_) {}
  }

  function onBeforeUnloadHeartbeat() {
    // Best-effort heartbeat so user appears online for the next 5 minutes window.
    if (authUser?.id) void heartbeat(authUser.id)
  }

  async function handleLogout() {
    if (authUser?.id) await setOfflineNow(authUser.id)
    await supabase.auth.signOut()
    setAuthUser(null)
    setPendingRequests(0)
    setUnreadChats(0)
    navigate('/auth')
  }

  const isAuthed = useMemo(() => Boolean(authUser), [authUser])
  const isAuthPage = location.pathname === '/auth'

  return (
    <div
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 10,
        background: 'var(--header-bg)',
        borderBottom: '1px solid var(--header-border)',
        padding: '10px 16px',
      }}
    >
      <div className="header-inner">
        <Brand onClick={() => navigate('/')} />
        <div className="row gap-8 header-buttons" style={{ alignItems: 'center' }}>
          {isAuthed ? (
            <>
              <button className="btn" onClick={() => navigate('/')}>
                All Users
              </button>
              <button className="btn" onClick={() => navigate('/chats')}>
                My Chats <Badge count={unreadChats} />
              </button>
              <button className="btn" onClick={() => navigate('/friends')}>Friends</button>
              <button className="btn" onClick={() => navigate('/notifications')}>
                Notifications <Badge count={pendingRequests} />
              </button>
              <button className="btn" onClick={() => navigate('/profile')}>Profile</button>
              <button className="btn btn-danger" onClick={handleLogout}>Logout</button>
            </>
          ) : (
            !isAuthPage && (
              <button className="btn btn-primary" onClick={() => navigate('/auth')}>
                Login
              </button>
            )
          )}
        </div>
      </div>
    </div>
  )
}
