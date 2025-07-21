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
        const data = await getEmployeeMetrics(timePeriod)
        setMetrics(data)
      } catch (err) {
        console.error('Error fetching data:', err)
        setError('Failed to load dashboard data. Please check your connection and try again.')
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
            P3 Proposal Dashboard
          </h1>
          <p className="text-gray-600">
            Track P3 proposal meetings and resulting deals performance across your team
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Left Sidebar - Time Period Selector */}
          <div className="lg:col-span-1">
            <TimePeriodSelector
              selectedPeriod={timePeriod}
              onPeriodChange={handlePeriodChange}
            />
          </div>

          {/* Main Content */}
          <div className="lg:col-span-3 space-y-8">
            {/* Summary Cards */}
            <SummaryCards metrics={metrics} />

            {/* Meeting Distribution Section */}
            <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-semibold text-gray-900">
                  Meeting Distribution
                </h2>
                <div className="flex space-x-2">
                  <button className="px-3 py-1 text-sm border border-gray-300 rounded-md hover:bg-gray-50 transition-colors">
                    📊 Bar Chart
                  </button>
                  <button className="px-3 py-1 text-sm border border-gray-300 rounded-md hover:bg-gray-50 transition-colors">
                    🥧 Pie Chart
                  </button>
                </div>
              </div>
              
              {/* Simple Bar Chart Visualization */}
              <div className="space-y-4">
                <h3 className="text-sm font-medium text-gray-700 mb-4">
                  Meetings by Employee ({metrics.reduce((sum, m) => sum + m.meeting_count, 0)} total meetings)
                </h3>
                {metrics.map((metric, index) => {
                  const maxMeetings = Math.max(...metrics.map(m => m.meeting_count))
                  const widthPercentage = maxMeetings > 0 ? (metric.meeting_count / maxMeetings) * 100 : 0
                  
                  const colors = ['bg-red-500', 'bg-blue-500', 'bg-green-500', 'bg-yellow-500', 'bg-purple-500']
                  const color = colors[index % colors.length]
                  
                  return (
                    <div key={metric.employee_name} className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="font-medium text-gray-900">{metric.employee_name}</span>
                        <span className="text-gray-600">{metric.meeting_count}</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-8 relative">
                        <div
                          className={`h-8 rounded-full ${color} flex items-center justify-center text-white text-sm font-medium transition-all duration-500`}
                          style={{ width: `${Math.max(widthPercentage, 5)}%` }}
                        >
                          {metric.meeting_count}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Employee Performance Table */}
            <EmployeeTable metrics={metrics} timePeriod={timePeriod} />
          </div>
        </div>
      </div>
    </div>
  )
}
