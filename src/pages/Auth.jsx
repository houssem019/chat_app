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
    <div style={{ minHeight: '100vh', background: 'var(--bg-page)', display: 'grid', placeItems: 'center', padding: 16 }}>
      <div style={{ width: '100%', maxWidth: 420, background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: 12, padding: 24, boxShadow: '0 4px 16px rgba(0,0,0,0.04)' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'center', gap: 6, marginBottom: 8 }}>
          <span className="brand-title" style={{ fontSize: 22 }}>Chat</span>
          <span className="brand-accent" style={{ fontSize: 22 }}>Twins</span>
        </div>
        <h2 style={{ margin: '0 0 12px 0', textAlign: 'center' }}>{mode === 'login' ? 'Welcome back to ChatTwins' : 'Join ChatTwins'}</h2>
        <div style={{ color: 'var(--text-secondary)', textAlign: 'center', marginBottom: 16 }}>
          {mode === 'login' ? 'Log in to continue' : 'Sign up to get started'}
        </div>
        <div style={{ display: 'grid', gap: 10 }}>
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            style={{ padding: '10px 12px', borderRadius: 10, border: '1px solid var(--input-border)', background: 'var(--input-bg)', color: 'var(--text-primary)' }}
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            style={{ padding: '10px 12px', borderRadius: 10, border: '1px solid var(--input-border)', background: 'var(--input-bg)', color: 'var(--text-primary)' }}
          />
          <button
            onClick={handleAuth}
            disabled={isSubmitting || !email || !password}
            style={{ padding: '10px 14px', borderRadius: 10, background: isSubmitting || !email || !password ? 'var(--brand-primary-disabled)' : 'var(--brand-primary)', color: '#fff', border: 'none', cursor: isSubmitting || !email || !password ? 'not-allowed' : 'pointer', fontWeight: 600 }}
          >
            {isSubmitting ? 'Please wait…' : mode === 'login' ? 'Login' : 'Signup'}
          </button>
          <div style={{ textAlign: 'center', color: 'var(--text-secondary)' }}>
            {mode === 'login' ? 'No account?' : 'Already have an account?'}{' '}
            <span
              style={{ cursor: 'pointer', color: 'var(--brand-primary)', fontWeight: 600 }}
              onClick={() => setMode(mode === 'login' ? 'signup' : 'login')}
            >
              {mode === 'login' ? 'Signup' : 'Login'}
            </span>
          </div>
        </div>
        <div style={{ marginTop: 16, textAlign: 'center', color: 'var(--text-muted)', fontSize: 12 }}>
          By continuing you agree to ChatTwins.com terms.
        </div>
      </div>
    </div>
  )
}
