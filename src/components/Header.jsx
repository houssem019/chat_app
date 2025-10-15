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
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const [isDarkMode, setIsDarkMode] = useState(false)

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
    // Close mobile menu when navigating to a new route
    setIsMobileMenuOpen(false)
  }, [location.pathname])

  // Close on Escape key when the mobile menu is open
  useEffect(() => {
    if (!isMobileMenuOpen) return
    function onKeyDown(e) {
      if (e.key === 'Escape') setIsMobileMenuOpen(false)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [isMobileMenuOpen])

  // Theme initialization from localStorage or system preference
  useEffect(() => {
    try {
      const saved = localStorage.getItem('theme')
      if (saved === 'light' || saved === 'dark') {
        document.documentElement.setAttribute('data-theme', saved)
        setIsDarkMode(saved === 'dark')
      } else {
        const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches
        setIsDarkMode(Boolean(prefersDark))
      }
    } catch (_) {}
  }, [])

  function toggleTheme() {
    const nextIsDark = !isDarkMode
    setIsDarkMode(nextIsDark)
    const next = nextIsDark ? 'dark' : 'light'
    try {
      document.documentElement.setAttribute('data-theme', next)
      localStorage.setItem('theme', next)
    } catch (_) {}
  }

  // Disable body scroll while the drawer is open
  useEffect(() => {
    const { style } = document.body
    const prev = style.overflow
    if (isMobileMenuOpen) style.overflow = 'hidden'
    else style.overflow = prev || ''
    return () => {
      style.overflow = prev || ''
    }
  }, [isMobileMenuOpen])

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
        .update({
          last_seen_at: new Date().toISOString(),
          is_online: true,
        })
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
        .update({
          is_online: false,
          last_seen_at: new Date().toISOString(),
        })
        .eq('id', userId)
    } catch (_) {}
  }

  function onBeforeUnloadHeartbeat() {
    // Best-effort heartbeat so user appears online for the next 5 minutes window.
    if (authUser?.id) void heartbeat(authUser.id)
  }

  async function handleLogout() {
    setIsMobileMenuOpen(false)
    if (authUser?.id) await setOfflineNow(authUser.id)
    await supabase.auth.signOut()
    setAuthUser(null)
    setPendingRequests(0)
    setUnreadChats(0)
    navigate('/auth')
  }

  const isAuthed = useMemo(() => Boolean(authUser), [authUser])
  const isAuthPage = location.pathname === '/auth'

  function handleNavigate(path) {
    setIsMobileMenuOpen(false)
    navigate(path)
  }

  function renderMenuButtons({ vertical = false } = {}) {
    const containerClass = vertical ? 'col gap-8' : 'row gap-8'
    return (
      <div className={containerClass} style={{ alignItems: vertical ? 'stretch' : 'center' }}>
        {isAuthed ? (
          <>
            <button className="btn" onClick={() => handleNavigate('/')}>All Users</button>
            <button className="btn" onClick={() => handleNavigate('/chats')}>
              My Chats <Badge count={unreadChats} />
            </button>
            <button className="btn" onClick={() => handleNavigate('/friends')}>Friends</button>
            <button className="btn" onClick={() => handleNavigate('/notifications')}>
              Notifications <Badge count={pendingRequests} />
            </button>
            <button className="btn" onClick={() => handleNavigate('/profile')}>Profile</button>
            <button className="btn btn-danger" onClick={handleLogout}>Logout</button>
            {/* Theme toggle (modern switch) */}
            <div
              className={`theme-toggle${isDarkMode ? ' is-dark' : ''}`}
              role="switch"
              aria-checked={isDarkMode}
              aria-label={isDarkMode ? 'Switch to light mode' : 'Switch to dark mode'}
              onClick={toggleTheme}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  toggleTheme()
                }
              }}
              tabIndex={0}
              title={isDarkMode ? 'Dark mode: on' : 'Dark mode: off'}
            >
              <span className="theme-toggle__icon theme-toggle__icon--sun" aria-hidden="true">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="2" />
                  <path d="M12 2v2M12 20v2M4 12H2M22 12h-2M5 5l1.5 1.5M17.5 17.5L19 19M19 5l-1.5 1.5M7.5 17.5L6 19" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
              </span>
              <span className="theme-toggle__icon theme-toggle__icon--moon" aria-hidden="true">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" stroke="currentColor" strokeWidth="2" fill="none" />
                </svg>
              </span>
              <span className="theme-toggle__thumb" />
            </div>
          </>
        ) : (
          !isAuthPage && (
            <button className="btn btn-primary" onClick={() => handleNavigate('/auth')}>
              Login
            </button>
          )
        )}
      </div>
    )
  }

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
        <div className="header-buttons" style={{ alignItems: 'center' }}>{renderMenuButtons()}</div>
        <button
          className="btn btn-icon mobile-menu-button"
          aria-label="Open menu"
          aria-expanded={isMobileMenuOpen}
          onClick={() => setIsMobileMenuOpen((v) => !v)}
          title="Open menu"
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M4 6h16M4 12h16M4 18h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </button>
      </div>
      {/* Mobile overlay and drawer */}
      <div
        className={`mobile-overlay${isMobileMenuOpen ? ' open' : ''}`}
        onClick={() => setIsMobileMenuOpen(false)}
      />
      <div className={`mobile-drawer${isMobileMenuOpen ? ' open' : ''}`} role="dialog" aria-modal="true">
        <div className="row center-between" style={{ alignItems: 'center', marginBottom: 12 }}>
          <Brand onClick={() => handleNavigate('/')} />
          <button
            className="btn btn-icon"
            aria-label="Close menu"
            onClick={() => setIsMobileMenuOpen(false)}
            title="Close menu"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
        </div>
        <div className="mobile-menu-vertical">{renderMenuButtons({ vertical: true })}</div>
      </div>
    </div>
  )
}
