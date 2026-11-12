import { onGetAllBookingsForCurrentUser } from '@/actions/appointment'
import InfoBar from '@/components/infobar'
import React from 'react'

const AppointmentsPage = async () => {
  const result = await onGetAllBookingsForCurrentUser('')
const bookings = result?.bookings || []
  return (
    <>
      <InfoBar />
      <div className="overflow-y-auto w-full chat-window flex-1 h-0">
        <div className="p-6">
          <h1 className="text-xl font-bold mb-6">Appointments</h1>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse border border-muted">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="p-3 text-sm font-medium text-muted-foreground">Customer</th>
                  <th className="p-3 text-sm font-medium text-muted-foreground">Email</th>
                  <th className="p-3 text-sm font-medium text-muted-foreground">Date / Time</th>
                  <th className="p-3 text-sm font-medium text-muted-foreground">Status</th>
                  <th className="p-3 text-sm font-medium text-muted-foreground">Domain</th>
                </tr>
              </thead>
              <tbody>
                {(bookings || []).map((b: any) => (
                  <tr key={b.id} className="border-b hover:bg-muted/50">
                    <td className="p-3 text-sm">{b.email}</td>
                    <td className="p-3 text-sm">{b.email}</td>
                    <td className="p-3 text-sm">{new Date(b.startsAt).toLocaleString()}</td>
                    <td className="p-3 text-sm">
                      <span className={`px-2 py-1 rounded text-xs ${
                        b.status === 'CONFIRMED' ? 'bg-green-100 text-green-700' :
                        b.status === 'CANCELLED' ? 'bg-red-100 text-red-700' :
                        b.status === 'COMPLETED' ? 'bg-blue-100 text-blue-700' :
                        'bg-gray-100 text-gray-700'
                      }`}>{b.status}</span>
                    </td>
                    <td className="p-3 text-sm">{b.Customer?.Domain?.name || '-'}</td>
                  </tr>
                ))}
                {(bookings || []).length === 0 && (
                  <tr>
                    <td colSpan={5} className="p-3 text-muted-foreground text-center">No appointments</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </>
  )
}

export default AppointmentsPage
