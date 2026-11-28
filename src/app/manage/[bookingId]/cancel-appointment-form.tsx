'use client'

import { useState } from 'react'

type Props = {
  bookingId: string
  token: string
}

type Status = 'idle' | 'submitting' | 'cancelled' | 'failed'

export function CancelAppointmentForm({ bookingId, token }: Props) {
  const [status, setStatus] = useState<Status>('idle')

  const onSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setStatus('submitting')
    try {
      const res = await fetch('/api/manage/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // The raw token is verified (and hashed) server-side; the stored
        // hash is never sent to the client.
        body: JSON.stringify({ bookingId, token }),
      })
      setStatus(res.ok ? 'cancelled' : 'failed')
    } catch {
      setStatus('failed')
    }
  }

  if (status === 'cancelled') {
    return <p style={{ color: '#16a34a', marginTop: '1.5rem' }}>Appointment cancelled.</p>
  }

  return (
    <form onSubmit={onSubmit} style={{ marginTop: '1.5rem' }}>
      <button
        type="submit"
        disabled={status === 'submitting'}
        style={{
          background: '#dc2626',
          color: '#fff',
          border: 'none',
          padding: '0.5rem 1rem',
          borderRadius: '0.5rem',
          cursor: 'pointer',
          opacity: status === 'submitting' ? 0.6 : 1,
        }}
      >
        {status === 'submitting' ? 'Cancelling…' : 'Cancel Appointment'}
      </button>
      {status === 'failed' && (
        <p style={{ color: '#dc2626', marginTop: '0.5rem' }}>Failed to cancel appointment.</p>
      )}
    </form>
  )
}
