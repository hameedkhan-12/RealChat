import { getUserAppointments } from '@/actions/appointment'
import { getUserClients, getUserPlanInfo } from '@/actions/dashboard'
import DashboardCard from '@/components/dashboard/cards'
import { PlanUsage } from '@/components/dashboard/plan-usage'
import InfoBar from '@/components/infobar'
import CalIcon from '@/icons/cal-icon'
import PersonIcon from '@/icons/person-icon'
import React from 'react'

const Page = async () => {
  const clientsRes = await getUserClients()
  const bookingsRes = await getUserAppointments()
  const planRes = await getUserPlanInfo()

  const clients = clientsRes?.ok ? (clientsRes.data as number) : 0
  const bookings = bookingsRes?.ok ? (bookingsRes.data as number) : 0
  const planData = planRes?.ok ? (planRes.data as any) : null

  return (
    <>
      <InfoBar />
      <div className="overflow-y-auto w-full chat-window flex-1 h-0">
        <div className="flex gap-5 flex-wrap">
          <DashboardCard value={clients || 0} title="Potential Clients" icon={<PersonIcon />} />
          <DashboardCard value={bookings || 0} title="Appointments" icon={<CalIcon />} />
        </div>
        <div className="w-full grid grid-cols-1 lg:grid-cols-2 py-10">
          <div>
            <h2 className="font-bold text-2xl">Plan Usage</h2>
            <p className="text-sm font-light">Overview of your domains and leads</p>
            <PlanUsage plan={(planData?.plan as any) || 'STANDARD'} credits={planData?.credits || 0} domains={planData?.domains || 0} clients={clients || 0} />
          </div>
        </div>
      </div>
    </>
  )
}

export default Page