'use client'

import { useState, useEffect } from 'react'
import { getEmployeeMetrics } from '@/lib/data'
import { EmployeeMetrics, TimePeriod } from '@/types/database'
import TimePeriodSelector from '@/components/TimePeriodSelector'
import SummaryCards from '@/components/SummaryCards'
import EmployeeTable from '@/components/EmployeeTable'

export default function Dashboard() {
  const [selectedPeriod, setSelectedPeriod] = useState<TimePeriod>('all_time')
  const [metrics, setMetrics] = useState<EmployeeMetrics[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'disconnected' | 'checking'>('checking')

  const fetchData = async () => {
    setLoading(true)
    setError(null)
    setConnectionStatus('checking')
    
    try {
      console.log('Starting data fetch...')
      const data = await getEmployeeMetrics(selectedPeriod)
      setMetrics(data)
      setConnectionStatus('connected')
      console.log('Data fetch completed successfully')
    } catch (err) {
      console.error('Error fetching data:', err)
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred'
      setError(errorMessage)
      setConnectionStatus('disconnected')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [selectedPeriod])

  const handleRetry = () => {
    fetchData()
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Connection Status */}
        {connectionStatus === 'disconnected' && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-red-800">
                    Supabase Security Issue Detected
                  </h3>
                  <div className="mt-2 text-sm text-red-700">
                    <p>Your Supabase instance appears to have SSL certificate and security issues.</p>
                    <p className="mt-1">This affects both local development and production deployments.</p>
                    {error && <p className="mt-1 font-mono text-xs">Error: {error}</p>}
                    <div className="mt-2 text-xs">
                      <p><strong>Recommended actions:</strong></p>
                      <ul className="list-disc list-inside mt-1 space-y-1">
                        <li>Contact Supabase support about instance security</li>
                        <li>Check your Supabase dashboard for alerts</li>
                        <li>Consider migrating to a new Supabase instance</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
              <button
                onClick={handleRetry}
                className="bg-red-100 text-red-800 px-3 py-2 rounded-md text-sm font-medium hover:bg-red-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
              >
                Retry Connection
              </button>
            </div>
          </div>
        )}

        {connectionStatus === 'checking' && (
          <div className="mb-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <svg className="animate-spin h-5 w-5 text-blue-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-blue-800">
                  Connecting to Database...
                </h3>
              </div>
            </div>
          </div>
        )}

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
        <TimePeriodSelector selectedPeriod={selectedPeriod} onPeriodChange={setSelectedPeriod} />

        {/* Loading State */}
        {loading && (
          <div className="flex justify-center items-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <span className="ml-3 text-gray-600">Loading dashboard data...</span>
          </div>
        )}

        {/* Error State */}
        {error && connectionStatus === 'disconnected' && (
          <div className="text-center py-12">
            <p className="text-gray-500">Unable to load dashboard data due to connection issues.</p>
          </div>
        )}

        {/* Dashboard Content */}
        {!loading && connectionStatus === 'connected' && (
          <>
            <SummaryCards metrics={metrics} />
            <div className="mt-8">
              <EmployeeTable metrics={metrics} timePeriod={selectedPeriod} />
            </div>
          </>
        )}
      </div>
    </div>
  )
}
