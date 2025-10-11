import React, { useState } from 'react'
import { supabase } from '../supabaseClient'
import { useNavigate } from 'react-router-dom'

export default function Auth() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [mode, setMode] = useState('login')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const navigate = useNavigate()

  async function handleAuth() {
    setIsSubmitting(true)
    if (mode === 'login') {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) alert(error.message)
      else {
        const user = data.user
        const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single()
        if (!profile || !profile.username || !profile.full_name) navigate('/profile')
        else navigate('/')
      }
    } else {
      const { error } = await supabase.auth.signUp({ email, password })
      if (error) alert(error.message)
      else {
        alert('Signup successful! Please confirm your email.')
        setMode('login')
      }
    }
    setIsSubmitting(false)
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f7f7fb', display: 'grid', placeItems: 'center', padding: 16 }}>
      <div style={{ width: '100%', maxWidth: 380, background: '#ffffff', border: '1px solid #eee', borderRadius: 12, padding: 20, boxShadow: '0 4px 16px rgba(0,0,0,0.04)' }}>
        <h2 style={{ margin: '0 0 12px 0', textAlign: 'center' }}>{mode === 'login' ? 'Welcome back' : 'Create your account'}</h2>
        <div style={{ color: '#6b7280', textAlign: 'center', marginBottom: 16 }}>
          {mode === 'login' ? 'Log in to continue' : 'Sign up to get started'}
        </div>
        <div style={{ display: 'grid', gap: 10 }}>
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            style={{ padding: '10px 12px', borderRadius: 10, border: '1px solid #e5e7eb', background: '#fafafa' }}
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            style={{ padding: '10px 12px', borderRadius: 10, border: '1px solid #e5e7eb', background: '#fafafa' }}
          />
          <button
            onClick={handleAuth}
            disabled={isSubmitting || !email || !password}
            style={{ padding: '10px 14px', borderRadius: 10, background: isSubmitting || !email || !password ? '#c7d2fe' : '#4f46e5', color: '#fff', border: 'none', cursor: isSubmitting || !email || !password ? 'not-allowed' : 'pointer', fontWeight: 600 }}
          >
            {isSubmitting ? 'Please wait…' : mode === 'login' ? 'Login' : 'Signup'}
          </button>
          <div style={{ textAlign: 'center', color: '#6b7280' }}>
            {mode === 'login' ? 'No account?' : 'Already have an account?'}{' '}
            <span
              style={{ cursor: 'pointer', color: '#4f46e5', fontWeight: 600 }}
              onClick={() => setMode(mode === 'login' ? 'signup' : 'login')}
            >
              {mode === 'login' ? 'Signup' : 'Login'}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
