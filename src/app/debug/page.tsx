'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'

export default function DebugPage() {
  const [status, setStatus] = useState<string>('Ready to test')
  const [error, setError] = useState<string>('')
  const [data, setData] = useState<any>(null)

  const testConnection = async () => {
    setStatus('Testing connection...')
    setError('')
    setData(null)

    try {
      console.log('Testing Supabase connection...')
      console.log('URL:', process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://khsiujplqnvjmatvuest.supabase.co')
      console.log('Key length:', (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imtoc2l1anBscW52am1hdHZ1ZXN0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTEwNzk3MTQsImV4cCI6MjA2NjY1NTcxNH0.VCzQiV7FG8XdGg6bpeXVPPr5oy-Kg2u-Vj_HpGV1UWM').length)

      // Test basic connection
      const { data, error } = await supabase
        .from('Meetings')
        .select('count')
        .limit(1)

      if (error) {
        console.error('Supabase error:', error)
        setError(`Connection failed: ${error.message}`)
        setStatus('❌ Connection failed')
      } else {
        console.log('Supabase connection successful:', data)
        setData(data)
        setStatus('✅ Connection successful')
      }
    } catch (err) {
      console.error('Fetch error:', err)
      setError(`Fetch error: ${err instanceof Error ? err.message : String(err)}`)
      setStatus('❌ Fetch failed')
    }
  }

  const testNetworkConnectivity = async () => {
    setStatus('Testing network connectivity...')
    setError('')
    setData(null)

    try {
      // Test basic network connectivity to external services
      const testUrls = [
        'https://httpbin.org/get',
        'https://api.github.com',
        'https://khsiujplqnvjmatvuest.supabase.co/rest/v1/'
      ]

      const results = []
      for (const url of testUrls) {
        try {
          const response = await fetch(url, { 
            method: 'GET',
            headers: { 'Accept': 'application/json' }
          })
          results.push({ url, status: response.status, ok: response.ok })
        } catch (err) {
          results.push({ url, status: 'error', ok: false, error: err instanceof Error ? err.message : String(err) })
        }
      }

      setData({ networkTest: results })
      setStatus('✅ Network test completed')
    } catch (err) {
      setError(`Network test error: ${err instanceof Error ? err.message : String(err)}`)
      setStatus('❌ Network test failed')
    }
  }

  const testSimpleQuery = async () => {
    setStatus('Testing simple query...')
    setError('')
    setData(null)

    try {
      const { data, error } = await supabase
        .from('Meetings')
        .select('*')
        .limit(5)

      if (error) {
        setError(`Query failed: ${error.message}`)
        setStatus('❌ Query failed')
      } else {
        setData(data)
        setStatus(`✅ Query successful - ${data?.length || 0} records`)
      }
    } catch (err) {
      setError(`Query error: ${err instanceof Error ? err.message : String(err)}`)
      setStatus('❌ Query failed')
    }
  }

  const testSupabaseDetailed = async () => {
    setStatus('Testing Supabase connectivity in detail...')
    setError('')
    setData(null)

    try {
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://khsiujplqnvjmatvuest.supabase.co'
      const results = []

      // Test 1: Basic health check endpoint
      try {
        const healthResponse = await fetch(`${supabaseUrl}/rest/v1/`, {
          method: 'GET',
          headers: { 'Accept': 'application/json' }
        })
        results.push({ 
          test: 'Health Check', 
          url: `${supabaseUrl}/rest/v1/`,
          status: healthResponse.status, 
          ok: healthResponse.ok,
          statusText: healthResponse.statusText
        })
      } catch (err) {
        results.push({ 
          test: 'Health Check', 
          url: `${supabaseUrl}/rest/v1/`,
          status: 'error', 
          ok: false, 
          error: err instanceof Error ? err.message : String(err)
        })
      }

      // Test 2: Try with Supabase client
      try {
        const { data, error } = await supabase
          .from('Meetings')
          .select('count')
          .limit(1)
        
        if (error) {
          results.push({ 
            test: 'Supabase Client Query', 
            status: 'error', 
            ok: false, 
            error: error.message,
            details: error
          })
        } else {
          results.push({ 
            test: 'Supabase Client Query', 
            status: 'success', 
            ok: true, 
            data: data
          })
        }
      } catch (err) {
        results.push({ 
          test: 'Supabase Client Query', 
          status: 'error', 
          ok: false, 
          error: err instanceof Error ? err.message : String(err)
        })
      }

      // Test 3: Try different Supabase endpoints
      const endpoints = [
        '/auth/v1/',
        '/rest/v1/',
        '/storage/v1/'
      ]

      for (const endpoint of endpoints) {
        try {
          const response = await fetch(`${supabaseUrl}${endpoint}`, {
            method: 'GET',
            headers: { 'Accept': 'application/json' }
          })
          results.push({ 
            test: `Endpoint: ${endpoint}`, 
            url: `${supabaseUrl}${endpoint}`,
            status: response.status, 
            ok: response.ok,
            statusText: response.statusText
          })
        } catch (err) {
          results.push({ 
            test: `Endpoint: ${endpoint}`, 
            url: `${supabaseUrl}${endpoint}`,
            status: 'error', 
            ok: false, 
            error: err instanceof Error ? err.message : String(err)
          })
        }
      }

      setData({ supabaseTests: results })
      setStatus('✅ Detailed Supabase test completed')
    } catch (err) {
      setError(`Detailed test error: ${err instanceof Error ? err.message : String(err)}`)
      setStatus('❌ Detailed test failed')
    }
  }

  const testAuthenticatedQuery = async () => {
    setStatus('Testing authenticated Supabase query...')
    setError('')
    setData(null)

    try {
      // Test with proper Supabase client authentication
      const { data, error } = await supabase
        .from('Meetings')
        .select('*')
        .limit(3)

      if (error) {
        console.error('Authenticated query error:', error)
        setError(`Authenticated query failed: ${error.message}`)
        setStatus('❌ Authenticated query failed')
        
        // Check if it's an RLS issue
        if (error.message.includes('permission') || error.message.includes('RLS')) {
          setData({ 
            issue: 'RLS Policy Issue',
            error: error.message,
            suggestion: 'Check RLS policies for the Meetings table'
          })
        }
      } else {
        setData({ 
          success: true, 
          records: data,
          count: data?.length || 0,
          message: 'Authenticated query successful - RLS is working properly'
        })
        setStatus('✅ Authenticated query successful')
      }
    } catch (err) {
      console.error('Authenticated query exception:', err)
      setError(`Authenticated query exception: ${err instanceof Error ? err.message : String(err)}`)
      setStatus('❌ Authenticated query failed')
    }
  }

  const testAllMeetings = async () => {
    setStatus('Testing all meetings in database...')
    setError('')
    setData(null)

    try {
      // Test 1: Get all meetings to see what exists
      const { data: allMeetings, error: allError } = await supabase
        .from('Meetings')
        .select('*')
        .limit(10)

      if (allError) {
        setError(`All meetings query failed: ${allError.message}`)
        setStatus('❌ All meetings query failed')
        return
      }

      // Test 2: Check for P3 meetings specifically
      const { data: p3Meetings, error: p3Error } = await supabase
        .from('Meetings')
        .select('*')
        .or('meeting_outcome.eq.P3 - Proposal,and(call_and_meeting_type.eq.P3 - Proposal,meeting_outcome.eq.Completed)')
        .limit(10)

      if (p3Error) {
        setError(`P3 meetings query failed: ${p3Error.message}`)
        setStatus('❌ P3 meetings query failed')
        return
      }

      // Test 3: Check for meetings with the new array columns
      const { data: meetingsWithArrays, error: arraysError } = await supabase
        .from('Meetings')
        .select('*')
        .limit(10)

      if (arraysError) {
        setError(`Array columns query failed: ${arraysError.message}`)
        setStatus('❌ Array columns query failed')
        return
      }

      setData({ 
        allMeetings: allMeetings || [],
        p3Meetings: p3Meetings || [],
        meetingsWithArrays: meetingsWithArrays || [],
        summary: {
          totalMeetings: allMeetings?.length || 0,
          p3MeetingsCount: p3Meetings?.length || 0,
          meetingsWithCompanies: meetingsWithArrays?.filter(m => m.Companies_fk_Companies && m.Companies_fk_Companies.length > 0).length || 0,
          meetingsWithDeals: meetingsWithArrays?.filter(m => m.Deals_fk_Deals && m.Deals_fk_Deals.length > 0).length || 0,
          meetingsWithContacts: meetingsWithArrays?.filter(m => m.Contacts_fk_Contacts && m.Contacts_fk_Contacts.length > 0).length || 0
        }
      })
      setStatus('✅ All meetings test completed')
    } catch (err) {
      console.error('All meetings test exception:', err)
      setError(`All meetings test exception: ${err instanceof Error ? err.message : String(err)}`)
      setStatus('❌ All meetings test failed')
    }
  }

  const testTableNames = async () => {
    setStatus('Testing different table names...')
    setError('')
    setData(null)

    try {
      const results = []
      
      // Test different table name variations
      const tableNames = ['Meetings', 'meetings', 'Meeting', 'meeting']
      
      for (const tableName of tableNames) {
        try {
          const { data, error } = await supabase
            .from(tableName)
            .select('*')
            .limit(1)
          
          if (error) {
            results.push({ 
              tableName, 
              status: 'error', 
              error: error.message 
            })
          } else {
            results.push({ 
              tableName, 
              status: 'success', 
              count: data?.length || 0,
              sampleData: data?.[0] || null
            })
          }
        } catch (err) {
          results.push({ 
            tableName, 
            status: 'exception', 
            error: err instanceof Error ? err.message : String(err)
          })
        }
      }

      setData({ tableTests: results })
      setStatus('✅ Table name tests completed')
    } catch (err) {
      setError(`Table name test error: ${err instanceof Error ? err.message : String(err)}`)
      setStatus('❌ Table name test failed')
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">Supabase Debug Page</h1>
        
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">Connection Test</h2>
          <div className="space-y-4">
            <div>
              <p className="text-sm text-gray-600 mb-2">Status: {status}</p>
              {error && (
                <div className="bg-red-50 border border-red-200 rounded p-3">
                  <p className="text-red-800 text-sm">{error}</p>
                </div>
              )}
            </div>
            
            <div className="space-x-4">
              <button
                onClick={testConnection}
                className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
              >
                Test Basic Connection
              </button>
              <button
                onClick={testNetworkConnectivity}
                className="bg-purple-600 text-white px-4 py-2 rounded hover:bg-purple-700"
              >
                Test Network Connectivity
              </button>
              <button
                onClick={testSimpleQuery}
                className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
              >
                Test Simple Query
              </button>
              <button
                onClick={testSupabaseDetailed}
                className="bg-yellow-600 text-white px-4 py-2 rounded hover:bg-yellow-700"
              >
                Test Supabase Detailed
              </button>
              <button
                onClick={testAuthenticatedQuery}
                className="bg-indigo-600 text-white px-4 py-2 rounded hover:bg-indigo-700"
              >
                Test Authenticated Query
              </button>
              <button
                onClick={testAllMeetings}
                className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700"
              >
                Test All Meetings
              </button>
              <button
                onClick={testTableNames}
                className="bg-orange-600 text-white px-4 py-2 rounded hover:bg-orange-700"
              >
                Test Table Names
              </button>
            </div>
          </div>
        </div>

        {data && (
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold mb-4">Query Results</h2>
            <pre className="bg-gray-100 p-4 rounded text-sm overflow-auto">
              {JSON.stringify(data, null, 2)}
            </pre>
          </div>
        )}

        <div className="bg-white rounded-lg shadow p-6 mt-6">
          <h2 className="text-xl font-semibold mb-4">Environment Variables</h2>
          <div className="space-y-2 text-sm">
            <p><strong>NEXT_PUBLIC_SUPABASE_URL:</strong> {process.env.NEXT_PUBLIC_SUPABASE_URL ? 'Set' : 'Not set'}</p>
            <p><strong>NEXT_PUBLIC_SUPABASE_ANON_KEY:</strong> {process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? 'Set' : 'Not set'}</p>
            <p><strong>Fallback URL:</strong> https://khsiujplqnvjmatvuest.supabase.co</p>
            <p><strong>Key length:</strong> {(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imtoc2l1anBscW52am1hdHZ1ZXN0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTEwNzk3MTQsImV4cCI6MjA2NjY1NTcxNH0.VCzQiV7FG8XdGg6bpeXVPPr5oy-Kg2u-Vj_HpGV1UWM').length} characters</p>
          </div>
        </div>
      </div>
    </div>
  )
} 