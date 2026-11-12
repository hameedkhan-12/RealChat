import { client } from '@/lib/prisma'
import { redirect } from 'next/navigation'
import React from 'react'

export default function ManagePage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-8 text-center">
      <h1 className="text-3xl font-bold">Manage Appointment</h1>
      <p className="mt-3 text-muted-foreground">
        Appointment management coming in a future phase. Use the confirmation email links to cancel or reschedule.
      </p>
    </div>
  )
}
