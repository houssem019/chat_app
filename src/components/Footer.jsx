import React from 'react'

export default function Footer() {
  return (
    <div style={{ borderTop: '1px solid var(--divider)', padding: '14px 16px', background: 'var(--card-bg)', marginTop: 24 }}>
      <div style={{ maxWidth: 1000, margin: '0 auto', textAlign: 'center', color: 'var(--text-secondary)' }}>
        © {new Date().getFullYear()} ChatTwins.com
      </div>
    </div>
  )
}
