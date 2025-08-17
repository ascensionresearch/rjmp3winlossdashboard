'use client'

import { useState, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { getEmployeeMetrics } from '@/lib/data'
import { EmployeeMetrics, TimePeriod } from '@/types/database'
import TimePeriodSelector from '@/components/TimePeriodSelector'
import SummaryCards from '@/components/SummaryCards'
import EmployeeTable from '@/components/EmployeeTable'

function getCurrentMonthValue(): string {
  const now = new Date()
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  return `${y}-${m}`
}

// Data sanitization functions for client view - only mask display names, keep all data
function sanitizeEmployeeMetrics(metrics: EmployeeMetrics[], isClientView: boolean): EmployeeMetrics[] {
  if (!isClientView) return metrics
  
  // Create a mapping of original employee names to generic names
  const employeeMapping = new Map<string, string>()
  const sortedEmployeeNames = [...new Set(metrics.map(m => m.employee_name))].sort()
  
  sortedEmployeeNames.forEach((name, index) => {
    if (name.includes('Service Manager')) {
      employeeMapping.set(name, 'Service Manager')
    } else {
      employeeMapping.set(name, `Employee ${index + 1}`) // Employee 1, Employee 2, etc.
    }
  })
  
  // Create deal name mapping
  let dealCounter = 1
  const dealMapping = new Map<string, string>()
  
  const sanitizeDealNames = (dealNames: string[]): string[] => {
    return dealNames.map(dealName => {
      if (!dealMapping.has(dealName)) {
        dealMapping.set(dealName, `Deal ${dealCounter}`)
        dealCounter++
      }
      return dealMapping.get(dealName)!
    })
  }
  
  const sanitizeTooltipDetails = (details?: { name: string; stage?: string; classification?: 'won' | 'lost' | 'in_play' | 'overdue' }[]) => {
    if (!details) return details
    return details.map(detail => ({
      ...detail,
      name: dealMapping.get(detail.name) || (() => {
        const sanitized = `Deal ${dealCounter}`
        dealMapping.set(detail.name, sanitized)
        dealCounter++
        return sanitized
      })()
    }))
  }
  
  return metrics.map(metric => ({
    ...metric,
    employee_name: employeeMapping.get(metric.employee_name) || metric.employee_name,
    deals_won_names: sanitizeDealNames(metric.deals_won_names),
    deals_lost_names: sanitizeDealNames(metric.deals_lost_names),
    deals_in_play_under_150_names: sanitizeDealNames(metric.deals_in_play_under_150_names),
    deals_overdue_150_plus_names: sanitizeDealNames(metric.deals_overdue_150_plus_names),
    deals_without_p3_names: metric.deals_without_p3_names ? sanitizeDealNames(metric.deals_without_p3_names) : undefined,
    deals_in_play_under_150_details: sanitizeTooltipDetails(metric.deals_in_play_under_150_details),
    deals_overdue_150_plus_details: sanitizeTooltipDetails(metric.deals_overdue_150_plus_details),
    deals_without_p3_details: sanitizeTooltipDetails(metric.deals_without_p3_details),
  }))
}

function DashboardContent() {
  const searchParams = useSearchParams()
  const isClientView = searchParams.get('view') === 'client'
  
  const [selectedPeriod, setSelectedPeriod] = useState<TimePeriod>('all_time')
  const [selectedMonth, setSelectedMonth] = useState<string>(getCurrentMonthValue())
  const [metrics, setMetrics] = useState<EmployeeMetrics[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'disconnected' | 'checking'>('checking')
  const [showAllDeals, setShowAllDeals] = useState(false)
  const [showAllEmployees, setShowAllEmployees] = useState(false)
  const [showCriteria, setShowCriteria] = useState(false)

  const fetchData = async () => {
    setLoading(true)
    setError(null)
    setConnectionStatus('checking')
    
    try {
      console.log('Starting data fetch...')
      const data = await getEmployeeMetrics(selectedPeriod, selectedMonth, showAllDeals)
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedPeriod, selectedMonth, showAllDeals])

  const handleRetry = () => {
    fetchData()
  }

  // Filter metrics based on employee selection
  const filteredMetrics = showAllEmployees 
    ? metrics 
    : metrics.filter(metric => {
        const name = metric.employee_name.toLowerCase()
        return name.includes('rob') || name.includes('john') || name.includes('mike')
      })

  // Apply client view sanitization only for display
  const displayMetrics = sanitizeEmployeeMetrics(filteredMetrics, isClientView)

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
        <div className="mb-8 relative">
          <div className="flex justify-between items-start">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <h1 className="text-3xl font-bold text-gray-900">
                  P3 - Proposal and Deal Dashboard
                </h1>
                {isClientView && (
                  <span className="bg-blue-100 text-blue-800 text-sm font-medium px-3 py-1 rounded-full">
                    Client View
                  </span>
                )}
              </div>
              <p className="text-gray-600 mb-3">
                {isClientView 
                  ? "Demo dashboard showing sanitized data for client presentation."
                  : "Track P3 - Proposal meetings and the resulting deals performance across your team."
                }
              </p>
              
              {/* Criteria Information Toggle - Hidden in client view */}
              {!isClientView && (
                <div className="mt-3">
                <button
                  onClick={() => setShowCriteria(!showCriteria)}
                  className={`flex items-center text-sm transition-colors duration-200 cursor-pointer ${
                    showCriteria 
                      ? 'text-blue-600 hover:text-blue-800' 
                      : 'text-gray-600 hover:text-gray-800'
                  }`}
                >
                  <svg
                    className="w-4 h-4 mr-1"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                  </svg>
                  <span>Dashboard Calculation Rules</span>
                </button>
                
                {/* Expandable Criteria Content */}
                {showCriteria && (
                  <div className="mt-2 p-3 bg-gray-50 rounded-md border border-gray-200 max-w-2xl">
                    <ul className="text-xs text-gray-700 space-y-1">
                      <li className="flex items-start">
                        <span className="w-1 h-1 bg-gray-400 rounded-full mt-1.5 mr-2 flex-shrink-0"></span>
                        <span>Only P3 proposal meetings where meeting outcome is &quot;Completed&quot; or &quot;P3 - Proposal&quot;.</span>
                      </li>
                      <li className="flex items-start">
                        <span className="w-1 h-1 bg-gray-400 rounded-full mt-1.5 mr-2 flex-shrink-0"></span>
                        <span>Only deals where deal type is &quot;Monthly&quot; or &quot;Recurring Special Service&quot;.</span>
                      </li>
                      <li className="flex items-start">
                        <span className="w-1 h-1 bg-gray-400 rounded-full mt-1.5 mr-2 flex-shrink-0"></span>
                        <span>Deal stage for Won column is when deal stage is &quot;Closed Won&quot;.</span>
                      </li>
                      <li className="flex items-start">
                        <span className="w-1 h-1 bg-gray-400 rounded-full mt-1.5 mr-2 flex-shrink-0"></span>
                        <span>Deal stage for Lost column is when deal stage is &quot;Closed Lost&quot;.</span>
                      </li>
                      <li className="flex items-start">
                        <span className="w-1 h-1 bg-gray-400 rounded-full mt-1.5 mr-2 flex-shrink-0"></span>
                        <span>Deal stage for In Play is open deals created &lt;150 days ago.</span>
                      </li>
                      <li className="flex items-start">
                        <span className="w-1 h-1 bg-gray-400 rounded-full mt-1.5 mr-2 flex-shrink-0"></span>
                        <span>Deal stage for Overdue is open deals created ≥150 days ago.</span>
                      </li>
                      <li className="flex items-start">
                        <span className="w-1 h-1 bg-gray-400 rounded-full mt-1.5 mr-2 flex-shrink-0"></span>
                        <span>Priority tags for In Play and Overdue deals are assigned only for deal stages A and B.</span>
                      </li>
                      <li className="flex items-start">
                        <span className="w-1 h-1 bg-gray-400 rounded-full mt-1.5 mr-2 flex-shrink-0"></span>
                        <span>Split deals marked &quot;JQ 1/2&quot; go to John Quinn and &quot;MM 1/2&quot; go to Mike Malan, regardless of P3 meeting owner.</span>
                      </li>
                      <li className="flex items-start">
                        <span className="w-1 h-1 bg-gray-400 rounded-full mt-1.5 mr-2 flex-shrink-0"></span>
                        <span>The top 3 employees are Rob, John, and Mike when toggle view is enabled.</span>
                      </li>
                      <li className="flex items-start">
                        <span className="w-1 h-1 bg-gray-400 rounded-full mt-1.5 mr-2 flex-shrink-0"></span>
                        <span>When toggle view is enabled for All Deals it is showing all monthly deals regardless of P3 meeting connections.</span>
                      </li>
                    </ul>
                  </div>
                )}
                </div>
              )}
            </div>
            
            {/* Controls Container */}
            <div className="flex flex-col items-end space-y-3">
              {/* Data Scope Toggle */}
              <div className="inline-flex rounded-lg bg-gray-100 p-1">
                <button
                  onClick={() => setShowAllDeals(false)}
                  className={`px-4 py-2 text-sm font-medium rounded-md transition-all duration-200 ${
                    !showAllDeals
                      ? 'bg-white text-gray-900 shadow-sm ring-1 ring-gray-200'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  P3 Meetings
                </button>
                <button
                  onClick={() => setShowAllDeals(true)}
                  className={`px-4 py-2 text-sm font-medium rounded-md transition-all duration-200 ${
                    showAllDeals
                      ? 'bg-white text-gray-900 shadow-sm ring-1 ring-gray-200'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  All Deals
                </button>
              </div>

              {/* Employee Filter Toggle */}
              <div className="inline-flex rounded-lg bg-gray-100 p-1">
                <button
                  onClick={() => setShowAllEmployees(false)}
                  className={`px-4 py-2 text-sm font-medium rounded-md transition-all duration-200 ${
                    !showAllEmployees
                      ? 'bg-white text-gray-900 shadow-sm ring-1 ring-gray-200'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  Top 3 Employees
                </button>
                <button
                  onClick={() => setShowAllEmployees(true)}
                  className={`px-4 py-2 text-sm font-medium rounded-md transition-all duration-200 ${
                    showAllEmployees
                      ? 'bg-white text-gray-900 shadow-sm ring-1 ring-gray-200'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  All Employees
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Time Period Selector */}
        <TimePeriodSelector selectedPeriod={selectedPeriod} onPeriodChange={setSelectedPeriod} selectedMonth={selectedMonth} onMonthChange={setSelectedMonth} />

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
            <SummaryCards metrics={displayMetrics} timePeriod={selectedPeriod} showAllDeals={showAllDeals} />
            <div className="mt-8">
              <EmployeeTable metrics={displayMetrics} timePeriod={selectedPeriod} showAllDeals={showAllDeals} />
            </div>
          </>
        )}
      </div>
    </div>
  )
}

export default function Dashboard() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50 p-8">
        <div className="max-w-7xl mx-auto">
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
                  Loading Dashboard...
                </h3>
              </div>
            </div>
          </div>
        </div>
      </div>
    }>
      <DashboardContent />
    </Suspense>
  )
}
