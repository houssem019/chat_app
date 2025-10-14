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

  const [reporting, setReporting] = useState(false)
  const [reportIssue, setReportIssue] = useState('')
  const [reportDetails, setReportDetails] = useState('')
  const [isSubmittingReport, setIsSubmittingReport] = useState(false)

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
    } catch (e) {}
    try {
      window.dispatchEvent(new Event('chats:lastOpened'))
    } catch (_) {}
  }

  useEffect(() => {
    if (otherProfile?.id) markChatOpened(otherProfile.id)
  }, [otherProfile?.id, messages.length])

  useEffect(() => {
    if (!otherProfile?.id) return
    const onFocus = () => markChatOpened(otherProfile.id)
    const onVisibility = () => {
      if (document.visibilityState === 'visible') markChatOpened(otherProfile.id)
    }
    window.addEventListener('focus', onFocus)
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      window.removeEventListener('focus', onFocus)
      document.removeEventListener('visibilitychange', onVisibility)
    }
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

  async function submitReport() {
    if (!reportIssue || !authUser || !otherProfile) return
    setIsSubmittingReport(true)
    try {
      const { error } = await supabase.from('reports').insert({
        reporter_id: authUser.id,
        reported_id: otherProfile.id,
        issue: reportIssue,
        details: reportDetails || null
      })
      if (error) throw error
      alert('Report submitted successfully')
      setReporting(false)
      setReportIssue('')
      setReportDetails('')
    } catch (err) {
      console.error('submitReport error', err)
      alert('Failed to submit report')
    } finally {
      setIsSubmittingReport(false)
    }
  }

  const headerName = otherProfile?.username || otherProfile?.full_name || 'Chat'

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--bg-page)' }}>
      <div
        className="page-header"
        style={{
          position: 'sticky',
          top: 0,
          background: 'var(--header-bg)',
          borderBottom: '1px solid var(--header-border)',
          padding: '12px 16px',
          zIndex: 5,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button onClick={() => navigate('/chats')} aria-label="Back" style={{ border: 'none', background: 'transparent', cursor: 'pointer' }}>⟵</button>
          {otherProfile?.avatar_url ? (
            <img src={otherProfile.avatar_url} alt="avatar" width={36} height={36} style={{ borderRadius: '50%', objectFit: 'cover' }} />
          ) : (
            <div style={{ width: 36, height: 36, borderRadius: '50%', background: '#e3e7ff', display: 'grid', placeItems: 'center', color: '#3949ab', fontWeight: 700 }}>
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

        <div className="header-actions" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button onClick={() => otherProfile?.username && navigate(`/u/${otherProfile.username}`)}>View Profile</button>
          <button onClick={() => setReporting(true)} style={{ background: 'red', color: 'white', border: 'none', padding: '10px 12px', borderRadius: 6 }}>Report</button>
        </div>
      </div>

      {/* Report Modal */}
      {reporting && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}>
          <div style={{ background: 'white', padding: 24, borderRadius: 12, width: 320, maxWidth: '90%' }}>
            <h3 style={{ marginTop: 0, color: 'black' }}>Report {headerName}</h3>
            <label style={{ display: 'block', marginBottom: 8 , color: 'black' }}>
              Issue:
              <select value={reportIssue} onChange={e => setReportIssue(e.target.value)} style={{ width: '100%', marginTop: 4, padding: 6 }}>
                <option value="">Select an issue</option>
                <option value="Spam or scam">Spam or scam</option>
                <option value="Harassment or bullying">Harassment or bullying</option>
                <option value="Inappropriate content">Inappropriate content</option>
                <option value="Other">Other</option>
              </select>
            </label>
            <label style={{ display: 'block', marginBottom: 12, color: 'black' }}>
              Details (optional):
              <textarea value={reportDetails} onChange={e => setReportDetails(e.target.value)} rows={3} style={{ width: '100%', marginTop: 4, padding: 6 }} />
            </label>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button onClick={() => setReporting(false)} style={{ padding: '6px 12px', borderRadius: 6 }}>Cancel</button>
              <button
                onClick={submitReport}
                disabled={!reportIssue || isSubmittingReport}
                style={{ padding: '6px 12px', borderRadius: 6, background: 'red', color: 'white', border: 'none' }}
              >
                {isSubmittingReport ? 'Submitting…' : 'Submit'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Messages */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 12px 8px', display: 'flex', flexDirection: 'column' }}>
        {messages.length === 0 ? (
          <div style={{ margin: 'auto', textAlign: 'center', color: 'var(--text-muted)' }}>
            <div style={{ fontSize: 18, fontWeight: 600, marginBottom: 6 }}>No messages yet</div>
            <div>Say hi and start the conversation!</div>
          </div>
        ) : (
          messages.map(message => {
            const isMine = message.sender_id === authUser?.id
            const bubbleColor = isMine ? 'var(--brand-primary)' : 'var(--chat-other-bg)'
            const textColor = isMine ? '#ffffff' : 'var(--chat-other-text)'
            const containerJustify = isMine ? 'flex-end' : 'flex-start'
            return (
              <div key={message.id} style={{ display: 'flex', justifyContent: containerJustify, marginBottom: 8 }}>
                <div style={{
                  maxWidth: '72%',
                  background: bubbleColor,
                  color: textColor,
                  border: '1px solid ' + (isMine ? 'var(--brand-primary)' : 'var(--input-border)'),
                  padding: '8px 10px',
                  borderRadius: 14,
                  borderTopLeftRadius: isMine ? 14 : 4,
                  borderTopRightRadius: isMine ? 4 : 14,
                  boxShadow: '0 1px 2px rgba(0,0,0,0.06)',
                  transition: 'transform 120ms ease',
                }}>
                  {message.content && <div style={{ whiteSpace: 'pre-wrap', lineHeight: 1.4 }}>{message.content}</div>}
                  {message.image_url && <img src={message.image_url} alt="attachment" style={{ display: 'block', maxWidth: '100%', borderRadius: 10, marginTop: message.content ? 8 : 0 }} />}
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

      {/* Input */}
      <div style={{ position: 'sticky', bottom: 0, background: 'var(--header-bg)', borderTop: '1px solid var(--header-border)', padding: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
        {imagePreviewUrl && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--subtle-surface-bg)', padding: 6, borderRadius: 8 }}>
            <img src={imagePreviewUrl} alt="preview" style={{ width: 40, height: 40, objectFit: 'cover', borderRadius: 6 }} />
            <button onClick={() => { setImageFile(null); setImagePreviewUrl(null) }} aria-label="Remove image" style={{ border: 'none', background: 'transparent', cursor: 'pointer' }}>✕</button>
          </div>
        )}
        <label htmlFor="file-input" style={{ cursor: 'pointer', padding: '8px 10px', border: '1px dashed var(--input-border)', borderRadius: 8, background: 'var(--muted-surface-bg)' }} title="Upload image">📎</label>
        <input id="file-input" type="file" accept="image/*" style={{ display: 'none' }} onChange={e => onPickImage(e.target.files?.[0])} />

        <textarea value={messageText} onChange={e => setMessageText(e.target.value)} onKeyDown={handleKeyDown} placeholder="Type a message" rows={1} style={{ flex: 1, resize: 'none', padding: '10px 12px', borderRadius: 10, border: '1px solid var(--input-border)', outline: 'none', background: 'var(--input-bg)', color: 'var(--text-primary)' }} />

        <button onClick={sendMessage} disabled={isSending || (!messageText.trim() && !imageFile) || !isReady} style={{ padding: '10px 14px', borderRadius: 10, background: isSending || (!messageText.trim() && !imageFile) ? 'var(--brand-primary-disabled)' : 'var(--brand-primary)', color: '#ffffff', border: 'none', cursor: isSending || (!messageText.trim() && !imageFile) ? 'not-allowed' : 'pointer', fontWeight: 600 }}>
          {isSending ? 'Sending…' : 'Send'}
        </button>
      </div>
    </div>
  )
}
