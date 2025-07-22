'use client'

import { useState, useEffect } from 'react'
import { EmployeeMetrics, TimePeriod } from '@/types/database'
import { getEmployeeMetrics } from '@/lib/data'
import TimePeriodSelector from '@/components/TimePeriodSelector'
import SummaryCards from '@/components/SummaryCards'
import EmployeeTable from '@/components/EmployeeTable'
import { Loader2, AlertCircle } from 'lucide-react'

export default function Dashboard() {
  const [timePeriod, setTimePeriod] = useState<TimePeriod>('all_time')
  const [metrics, setMetrics] = useState<EmployeeMetrics[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true)
      setError(null)
      
      try {
        console.log('Fetching data for time period:', timePeriod)
        
        // Add timeout to prevent hanging
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Request timeout')), 30000)
        )
        
        const dataPromise = getEmployeeMetrics(timePeriod)
        const data = await Promise.race([dataPromise, timeoutPromise]) as EmployeeMetrics[]
        
        console.log('Received data:', data)
        setMetrics(data)
      } catch (err) {
        console.error('Error fetching data:', err)
        setError(`Failed to load dashboard data: ${err instanceof Error ? err.message : 'Unknown error'}. Please check your connection and try again.`)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [timePeriod])

  const handlePeriodChange = (newPeriod: TimePeriod) => {
    setTimePeriod(newPeriod)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-blue-600 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Loading Dashboard</h2>
          <p className="text-gray-600">Fetching P3 meeting and deal data...</p>
        </div>
      </div>
    )
  }

  // Show empty state if no data
  if (metrics.length === 0 && !error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center max-w-md mx-auto">
          <div className="bg-white p-8 rounded-lg shadow-sm border">
            <h2 className="text-xl font-semibold text-gray-900 mb-2">No P3 Meetings Found</h2>
            <p className="text-gray-600 mb-4">
              No P3 proposal meetings were found in your database for the selected time period.
            </p>
            <div className="space-y-2 text-sm text-gray-500">
              <p>• Check that meetings have <code>meeting_outcome=&quot;P3 - Proposal&quot;</code></p>
              <p>• Or <code>call_and_meeting_type=&quot;P3 - Proposal&quot;</code> with <code>meeting_outcome=&quot;Completed&quot;</code></p>
              <p>• Verify that meetings have <code>employee_name</code> values</p>
            </div>
            <a 
              href="/debug" 
              className="mt-4 inline-block bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
            >
              Debug Database
            </a>
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center max-w-md mx-auto">
          <AlertCircle className="h-12 w-12 text-red-600 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Error Loading Dashboard</h2>
          <p className="text-gray-600 mb-4">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
          >
            Try Again
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            P3 - Proposal and Deal Dashboard
          </h1>
          <p className="text-gray-600">
            Track P3 - Proposal meetings and the resulting deals performance across your team.
          </p>
        </div>
        {/* Time Period Selector */}
        <TimePeriodSelector selectedPeriod={timePeriod} onPeriodChange={handlePeriodChange} />
        {/* Summary Cards */}
        <div className="mb-8">
          <SummaryCards metrics={metrics} />
        </div>
        {/* Employee Performance Table */}
        <EmployeeTable metrics={metrics} timePeriod={timePeriod} />
      </div>
    </div>
  )
}
