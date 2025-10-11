import React from 'react'

export default function Footer() {
  return (
    <div style={{ borderTop: '1px solid #eee', padding: '14px 16px', background: '#ffffff', marginTop: 24 }}>
      <div style={{ maxWidth: 1000, margin: '0 auto', textAlign: 'center', color: '#6b7280' }}>
        © {new Date().getFullYear()} ChatTwins.com
      </div>
    </div>
  )
}
