import { Button } from '../../components/ui/Button'
import { adminAPI } from '../../lib/api'

export function AdminAnalyticsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Platform Analytics</h1>
        <p className="text-gray-600 dark:text-gray-300 mt-1">Download platform-wide reports.</p>
      </div>
      <div className="card">
        <div className="card-body flex gap-3">
          <Button onClick={async () => {
            const blob = await adminAPI.downloadBookingsCsv();
            const link = document.createElement('a'); link.href = URL.createObjectURL(blob); link.download = 'platform-bookings.csv'; link.click();
          }}>Bookings CSV</Button>
          <Button onClick={async () => {
            const blob = await adminAPI.downloadRevenueCsv();
            const link = document.createElement('a'); link.href = URL.createObjectURL(blob); link.download = 'platform-revenue.csv'; link.click();
          }}>Revenue CSV</Button>
        </div>
      </div>
    </div>
  )
}
