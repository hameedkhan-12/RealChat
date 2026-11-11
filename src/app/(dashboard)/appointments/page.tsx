import { onGetAllBookingsForCurrentUser } from '@/actions/appointment'
import AllAppointments from '@/components/appointment/all-appointments'
import InfoBar from '@/components/infobar'
import Section from '@/components/section-label'
import { currentUser } from '@clerk/nextjs/server'
import React from 'react'

const Page = async () => {
  const user = await currentUser()
  if (!user) return null
  const domainBookings = await onGetAllBookingsForCurrentUser(user.id)
  const bookings = domainBookings?.bookings ?? []
  return (
    <>
      <InfoBar />
      <div className="overflow-y-auto w-full chat-window flex-1 h-0">
        <div className="grid grid-cols-1 gap-5 p-4">
          <Section label="All Appointments" message="View all appointments across your domains" />
          <AllAppointments bookings={bookings as any} />
        </div>
      </div>
    </>
  )
}

export default Page