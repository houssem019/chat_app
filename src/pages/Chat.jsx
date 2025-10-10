import React, { useState, useEffect, useRef } from 'react'
import { supabase } from '../supabaseClient'
import { useParams, useNavigate } from 'react-router-dom'

export default function Chat() {
  const { username } = useParams()
  const [currentUser, setCurrentUser] = useState(null)
  const [otherUser, setOtherUser] = useState(null)
  const [messages, setMessages] = useState([])
  const [newMessage, setNewMessage] = useState('')
  const [imageFile, setImageFile] = useState(null)
  const bottomRef = useRef(null)
  const navigate = useNavigate()
  const [channel, setChannel] = useState(null)

  useEffect(() => {
    let active = true

    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return navigate('/auth')
      if (!active) return
      setCurrentUser(user)

      // Fetch the other user
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('username', username)
        .single()
      if (error || !data) return alert('User not found')
      if (!active) return
      setOtherUser(data)

      // Fetch initial messages
      fetchMessages(user.id, data.id)

      // Subscribe to messages for this conversation
      const ch = supabase.channel('chat')
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'messages',
            filter: `or(sender_id.eq.${user.id},sender_id.eq.${data.id})`
          },
          payload => {
            const msg = payload.new
            if (
              (msg.sender_id === user.id && msg.receiver_id === data.id) ||
              (msg.sender_id === data.id && msg.receiver_id === user.id)
            ) {
              setMessages(prev => [...prev, msg])
              scrollToBottom()
            }
          }
        )
        .subscribe()

      setChannel(ch)
    })

    return () => {
      active = false
      if (channel) supabase.removeChannel(channel)
    }
  }, [username])

  async function fetchMessages(userId, otherId) {
    const { data } = await supabase
      .from('messages')
      .select('*')
      .or(
        `and(sender_id.eq.${userId},receiver_id.eq.${otherId}),and(sender_id.eq.${otherId},receiver_id.eq.${userId})`
      )
      .order('created_at', { ascending: true })
    setMessages(data || [])
    scrollToBottom()
  }

  function scrollToBottom() {
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 100)
  }

  async function sendMessage() {
    if (!newMessage && !imageFile) return
    if (!currentUser || !otherUser) return

    let image_url = null
    if (imageFile) {
      const fileExt = imageFile.name.split('.').pop()
      const fileName = `${currentUser.id}_${Date.now()}.${fileExt}`
      const { error: uploadError } = await supabase.storage.from('chat-uploads').upload(fileName, imageFile)
      if (uploadError) return alert('Image upload failed: ' + uploadError.message)
      const { data } = supabase.storage.from('chat-uploads').getPublicUrl(fileName)
      image_url = data.publicUrl
    }

    const { error } = await supabase.from('messages').insert([
      { sender_id: currentUser.id, receiver_id: otherUser.id, content: newMessage, image_url }
    ])
    if (error) return alert('Send failed: ' + error.message)
    setNewMessage('')
    setImageFile(null)
  }

  async function handleLogout() {
    await supabase.auth.signOut()
    navigate('/auth')
  }

  return (
    <div className="container">
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '15px' }}>
        <h2>Chat with {otherUser?.username}</h2>
        <div>
          <button onClick={() => navigate('/')}>All Users</button>{' '}
          <button onClick={() => navigate('/notifications')}>Notifications</button>{' '}
          <button onClick={() => navigate('/friends')}>Friends</button>{' '}
          <button onClick={() => navigate('/profile')}>Profile</button>{' '}
          <button onClick={handleLogout}>Logout</button>
        </div>
      </div>

      <div style={{ maxHeight: '400px', overflowY: 'auto', border: '1px solid #ccc', padding: '10px', marginBottom: '10px' }}>
        {messages.map(msg => (
          <div key={msg.id} style={{ textAlign: msg.sender_id === currentUser?.id ? 'right' : 'left', margin: '5px 0' }}>
            {msg.content && <div>{msg.content}</div>}
            {msg.image_url && <img src={msg.image_url} alt="attachment" width={100} />}
          </div>
        ))}
        <div ref={bottomRef}></div>
      </div>

      <input type="text" placeholder="Type a message" value={newMessage} onChange={e => setNewMessage(e.target.value)} />
      <input type="file" accept="image/*" onChange={e => setImageFile(e.target.files[0])} />
      <button onClick={sendMessage}>Send</button>
    </div>
  )
}
