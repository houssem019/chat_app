import React from 'react'
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import Auth from './pages/Auth'
import Profile from './pages/Profile'
import UsersList from './pages/UsersList'
import ChatsList from './pages/ChatsList'
import Chat from './pages/Chat'
import Notifications from './pages/Notifications'
import Friends from './pages/Friends'

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/auth" element={<Auth />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/" element={<UsersList />} />
        <Route path="/chats" element={<ChatsList />} />
        <Route path="/chat/:username" element={<Chat />} />
        <Route path="/notifications" element={<Notifications />} />
        <Route path="/friends" element={<Friends />} />
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </Router>
  )
}
