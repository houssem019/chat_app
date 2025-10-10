import React, { useState } from 'react'
import { supabase } from '../supabaseClient'
import { useNavigate } from 'react-router-dom'

export default function Auth() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [mode, setMode] = useState('login')
  const navigate = useNavigate()

  async function handleAuth() {
    if (mode === 'login') {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) alert(error.message)
      else {
        // after login, check if profile complete
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
  }

  return (
    <div className="container">
      <h2>{mode === 'login' ? 'Login' : 'Signup'}</h2>
      <input type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} />
      <input type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} />
      <button onClick={handleAuth}>{mode === 'login' ? 'Login' : 'Signup'}</button>
      <p>
        {mode === 'login' ? 'No account?' : 'Already have an account?'}{' '}
        <span style={{ cursor: 'pointer', color: 'blue' }} onClick={() => setMode(mode === 'login' ? 'signup' : 'login')}>
          {mode === 'login' ? 'Signup' : 'Login'}
        </span>
      </p>
    </div>
  )
}
