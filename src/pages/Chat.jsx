import React, { useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '../supabaseClient'
import { useParams, useNavigate } from 'react-router-dom'

function formatTime(isoString) {
  if (!isoString) return ''
  const date = new Date(isoString)
  const hours = date.getHours().toString().padStart(2, '0')
  const minutes = date.getMinutes().toString().padStart(2, '0')
  return `${hours}:${minutes}`
}

export default function Chat() {
  const { username } = useParams()
  const navigate = useNavigate()

  const [authUser, setAuthUser] = useState(null)
  const [myProfile, setMyProfile] = useState(null)
  const [otherProfile, setOtherProfile] = useState(null)
  const [messages, setMessages] = useState([])
  const [messageText, setMessageText] = useState('')
  const [imageFile, setImageFile] = useState(null)
  const [imagePreviewUrl, setImagePreviewUrl] = useState(null)
  const [isSending, setIsSending] = useState(false)

  const bottomRef = useRef(null)
  const channelRef = useRef(null)
  const messageIdsRef = useRef(new Set())

  const isReady = useMemo(() => Boolean(authUser && otherProfile), [authUser, otherProfile])

  useEffect(() => {
    let isActive = true

    ;(async () => {
      const { data: authData } = await supabase.auth.getUser()
      const user = authData?.user
      if (!user) {
        navigate('/auth')
        return
      }
      if (!isActive) return
      setAuthUser(user)

      const [{ data: other, error: otherErr }, { data: me, error: meErr }] = await Promise.all([
        supabase.from('profiles').select('*').eq('username', username).single(),
        supabase.from('profiles').select('*').eq('id', user.id).single()
      ])

      if (otherErr || !other) {
        alert('User not found')
        navigate('/')
        return
      }
      if (!isActive) return
      setOtherProfile(other)
      if (!meErr) setMyProfile(me)

      await fetchMessages(user.id, other.id)

      const ch = supabase
        .channel(`realtime:messages`)
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'messages' },
          payload => {
            const inserted = payload.new
            const isInThisChat =
              (inserted.sender_id === user.id && inserted.receiver_id === other.id) ||
              (inserted.sender_id === other.id && inserted.receiver_id === user.id)
            if (!isInThisChat) return

            if (messageIdsRef.current.has(inserted.id)) return
            messageIdsRef.current.add(inserted.id)
            setMessages(prev => [...prev, inserted])
            scrollToBottom()
          }
        )
        .subscribe()

      channelRef.current = ch
    })()

    return () => {
      isActive = false
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current)
        channelRef.current = null
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [username])

  function markChatOpened(partnerId) {
    try {
      localStorage.setItem(`lastOpenedChatById:${partnerId}`, new Date().toISOString())
    } catch (e) {
      // ignore storage errors
    }
  }

  useEffect(() => {
    if (otherProfile?.id) {
      markChatOpened(otherProfile.id)
    }
    // Also refresh when new messages arrive while on this page
  }, [otherProfile?.id, messages.length])

  useEffect(() => {
    if (!otherProfile?.id) return
    const onFocus = () => markChatOpened(otherProfile.id)
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [otherProfile?.id])

  async function fetchMessages(userId, otherId) {
    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .or(
        `and(sender_id.eq.${userId},receiver_id.eq.${otherId}),and(sender_id.eq.${otherId},receiver_id.eq.${userId})`
      )
      .order('created_at', { ascending: true })

    if (error) {
      console.error('fetchMessages error', error)
      setMessages([])
      return
    }

    const safe = Array.isArray(data) ? data : []
    messageIdsRef.current = new Set(safe.map(m => m.id))
    setMessages(safe)
    scrollToBottom()
  }

  function scrollToBottom() {
    requestAnimationFrame(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }))
  }

  function onPickImage(file) {
    if (!file) {
      setImageFile(null)
      setImagePreviewUrl(null)
      return
    }
    setImageFile(file)
    const objectUrl = URL.createObjectURL(file)
    setImagePreviewUrl(objectUrl)
  }

  async function sendMessage() {
    if (!isReady) return
    const trimmed = messageText.trim()
    if (!trimmed && !imageFile) return

    setIsSending(true)

    const tempId = `temp-${Date.now()}`
    const optimistic = {
      id: tempId,
      sender_id: authUser.id,
      receiver_id: otherProfile.id,
      content: trimmed || null,
      image_url: imagePreviewUrl || null,
      created_at: new Date().toISOString(),
      _status: 'sending'
    }

    setMessages(prev => [...prev, optimistic])
    scrollToBottom()
    setMessageText('')
    setImageFile(null)
    setImagePreviewUrl(null)

    try {
      let publicUrl = null
      if (optimistic.image_url) {
        const fileExt = imageFile.name.split('.').pop()
        const filePath = `messages/${authUser.id}/${Date.now()}.${fileExt}`
        const { error: uploadError } = await supabase.storage
          .from('chat-uploads')
          .upload(filePath, imageFile, { contentType: imageFile.type })
        if (uploadError) throw uploadError
        const { data: publicData } = await supabase.storage
          .from('chat-uploads')
          .getPublicUrl(filePath)
        publicUrl = publicData?.publicUrl || null
      }

      const { data: inserted, error: insertError } = await supabase
        .from('messages')
        .insert({
          sender_id: authUser.id,
          receiver_id: otherProfile.id,
          content: trimmed || null,
          image_url: publicUrl
        })
        .select()
        .single()

      if (insertError) throw insertError

      if (!messageIdsRef.current.has(inserted.id)) {
        messageIdsRef.current.add(inserted.id)
        setMessages(prev => prev.map(m => (m.id === tempId ? inserted : m)))
        scrollToBottom()
      } else {
        // already handled by realtime; drop optimistic
        setMessages(prev => prev.filter(m => m.id !== tempId))
      }
    } catch (err) {
      console.error('sendMessage error', err)
      setMessages(prev => prev.filter(m => m.id !== tempId))
      alert('Send failed. Please try again.')
    } finally {
      setIsSending(false)
    }
  }

  function handleKeyDown(event) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      sendMessage()
    }
  }

  

  const headerName = otherProfile?.username || otherProfile?.full_name || 'Chat'

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: '#f7f7fb' }}>
      <div
        className="page-header"
        style={{
          position: 'sticky',
          top: 0,
          background: '#ffffff',
          borderBottom: '1px solid #eee',
          padding: '12px 16px',
          zIndex: 5,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button onClick={() => navigate('/chats')} aria-label="Back" style={{ border: 'none', background: 'transparent', cursor: 'pointer' }}>
            ⟵
          </button>
          {otherProfile?.avatar_url ? (
            <img
              src={otherProfile.avatar_url}
              alt="avatar"
              width={36}
              height={36}
              style={{ borderRadius: '50%', objectFit: 'cover' }}
            />
          ) : (
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: '50%',
                background: '#e3e7ff',
                display: 'grid',
                placeItems: 'center',
                color: '#3949ab',
                fontWeight: 700
              }}
            >
              {headerName?.[0]?.toUpperCase() || '?'}
            </div>
          )}
          <div
            onClick={() => otherProfile?.username && navigate(`/u/${otherProfile.username}`)}
            style={{ fontSize: 16, fontWeight: 600, cursor: otherProfile?.username ? 'pointer' : 'default' }}
            title="View profile"
          >
            {headerName}
          </div>
        </div>
        <div className="header-actions" style={{ display: 'flex', alignItems: 'center' }}>
          <button onClick={() => otherProfile?.username && navigate(`/u/${otherProfile.username}`)}>View Profile</button>
        </div>
      </div>

      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '12px 12px 8px',
          display: 'flex',
          flexDirection: 'column'
        }}
      >
        {messages.length === 0 ? (
          <div style={{ margin: 'auto', textAlign: 'center', color: '#99a3ad' }}>
            <div style={{ fontSize: 18, fontWeight: 600, marginBottom: 6 }}>No messages yet</div>
            <div>Say hi and start the conversation!</div>
          </div>
        ) : (
          messages.map(message => {
            const isMine = message.sender_id === authUser?.id
            const bubbleColor = isMine ? '#4f46e5' : '#ffffff'
            const textColor = isMine ? '#ffffff' : '#0f172a'
            const containerJustify = isMine ? 'flex-end' : 'flex-start'
            return (
              <div key={message.id} style={{ display: 'flex', justifyContent: containerJustify, marginBottom: 8 }}>
                <div
                  style={{
                    maxWidth: '72%',
                    background: bubbleColor,
                    color: textColor,
                    border: '1px solid ' + (isMine ? '#4f46e5' : '#e5e7eb'),
                    padding: '8px 10px',
                    borderRadius: 14,
                    borderTopLeftRadius: isMine ? 14 : 4,
                    borderTopRightRadius: isMine ? 4 : 14,
                    boxShadow: '0 1px 2px rgba(0,0,0,0.06)',
                    transition: 'transform 120ms ease',
                  }}
                >
                  {message.content && <div style={{ whiteSpace: 'pre-wrap', lineHeight: 1.4 }}>{message.content}</div>}
                  {message.image_url && (
                    <img
                      src={message.image_url}
                      alt="attachment"
                      style={{
                        display: 'block',
                        maxWidth: '100%',
                        borderRadius: 10,
                        marginTop: message.content ? 8 : 0
                      }}
                    />
                  )}
                  <div style={{ fontSize: 11, opacity: 0.8, marginTop: 6, textAlign: 'right' }}>
                    {formatTime(message.created_at)} {String(message.id).startsWith('temp-') ? '· sending…' : ''}
                  </div>
                </div>
              </div>
            )
          })
        )}
        <div ref={bottomRef} />
      </div>

      <div
        style={{
          position: 'sticky',
          bottom: 0,
          background: '#ffffff',
          borderTop: '1px solid #eee',
          padding: 12,
          display: 'flex',
          alignItems: 'center',
          gap: 8
        }}
      >
        {imagePreviewUrl && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#f1f5f9', padding: 6, borderRadius: 8 }}>
            <img src={imagePreviewUrl} alt="preview" style={{ width: 40, height: 40, objectFit: 'cover', borderRadius: 6 }} />
            <button onClick={() => { setImageFile(null); setImagePreviewUrl(null) }} aria-label="Remove image" style={{ border: 'none', background: 'transparent', cursor: 'pointer' }}>✕</button>
          </div>
        )}
        <label
          htmlFor="file-input"
          style={{ cursor: 'pointer', padding: '8px 10px', border: '1px dashed #cbd5e1', borderRadius: 8, background: '#f8fafc' }}
          title="Upload image"
        >
          📎
        </label>
        <input
          id="file-input"
          type="file"
          accept="image/*"
          style={{ display: 'none' }}
          onChange={e => onPickImage(e.target.files?.[0])}
        />

        <textarea
          value={messageText}
          onChange={e => setMessageText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type a message"
          rows={1}
          style={{
            flex: 1,
            resize: 'none',
            padding: '10px 12px',
            borderRadius: 10,
            border: '1px solid #e5e7eb',
            outline: 'none',
            background: '#fafafa'
          }}
        />

        <button
          onClick={sendMessage}
          disabled={isSending || (!messageText.trim() && !imageFile) || !isReady}
          style={{
            padding: '10px 14px',
            borderRadius: 10,
            background: isSending || (!messageText.trim() && !imageFile) ? '#c7d2fe' : '#4f46e5',
            color: '#ffffff',
            border: 'none',
            cursor: isSending || (!messageText.trim() && !imageFile) ? 'not-allowed' : 'pointer',
            fontWeight: 600
          }}
        >
          {isSending ? 'Sending…' : 'Send'}
        </button>
      </div>
    </div>
  )
}
