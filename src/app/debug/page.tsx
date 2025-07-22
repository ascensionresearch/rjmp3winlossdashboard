'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { getP3Meetings, getContactsFromMeetings, getCompaniesFromContacts, getDealsFromCompanies } from '@/lib/data'

export default function DebugPage() {
  const [logs, setLogs] = useState<string[]>([])
  const [loading, setLoading] = useState(true)

  const addLog = (message: string) => {
    setLogs(prev => [...prev, `${new Date().toLocaleTimeString()}: ${message}`])
  }

  useEffect(() => {
    const runDebug = async () => {
      setLoading(true)
      addLog('Starting debug process...')

      try {
        // Test 1: Basic Supabase connection
        addLog('Testing basic Supabase connection...')
        const { data: testData, error: testError } = await supabase
          .from('Meetings')
          .select('*')
          .limit(1)
        
        if (testError) {
          addLog(`❌ Supabase connection failed: ${testError.message}`)
          return
        }
        addLog(`✅ Supabase connection successful. Found ${testData?.length || 0} meetings`)

        // Test 2: Check meetings table structure
        addLog('Checking meetings table structure...')
        const { data: meetingsSample, error: meetingsError } = await supabase
          .from('Meetings')
          .select('*')
          .limit(3)
        
        if (meetingsError) {
          addLog(`❌ Failed to fetch meetings: ${meetingsError.message}`)
          return
        }
        
        if (meetingsSample && meetingsSample.length > 0) {
          addLog(`✅ Meetings table accessible. Sample meeting keys: ${Object.keys(meetingsSample[0]).join(', ')}`)
          addLog(`Sample meeting: ${JSON.stringify(meetingsSample[0], null, 2)}`)
        } else {
          addLog('⚠️ Meetings table is empty')
        }

        // Test 3: Check for P3 meetings specifically
        addLog('Checking for P3 meetings...')
        const { data: p3Meetings, error: p3Error } = await supabase
          .from('Meetings')
          .select('*')
          .or('meeting_outcome.eq.P3 - Proposal,and(call_and_meeting_type.eq.P3 - Proposal,meeting_outcome.eq.Completed)')
          .limit(5)
        
        if (p3Error) {
          addLog(`❌ P3 meetings query failed: ${p3Error.message}`)
        } else {
          addLog(`✅ Found ${p3Meetings?.length || 0} P3 meetings`)
          if (p3Meetings && p3Meetings.length > 0) {
            addLog(`Sample P3 meeting: ${JSON.stringify(p3Meetings[0], null, 2)}`)
          }
        }

        // Test 4: Check other tables
        addLog('Checking contacts table...')
        const { data: contactsSample, error: contactsError } = await supabase
          .from('Contacts')
          .select('*')
          .limit(1)
        
        if (contactsError) {
          addLog(`❌ Contacts table error: ${contactsError.message}`)
        } else {
          addLog(`✅ Contacts table accessible. Found ${contactsSample?.length || 0} contacts`)
          if (contactsSample && contactsSample.length > 0) {
            addLog(`📋 Sample contact keys: ${Object.keys(contactsSample[0]).join(', ')}`)
            addLog(`📋 Sample contact: ${JSON.stringify(contactsSample[0], null, 2)}`)
          }
        }

        addLog('Checking companies table...')
        const { data: companiesSample, error: companiesError } = await supabase
          .from('Companies')
          .select('*')
          .limit(1)
        
        if (companiesError) {
          addLog(`❌ Companies table error: ${companiesError.message}`)
        } else {
          addLog(`✅ Companies table accessible. Found ${companiesSample?.length || 0} companies`)
          if (companiesSample && companiesSample.length > 0) {
            addLog(`📋 Sample company keys: ${Object.keys(companiesSample[0]).join(', ')}`)
            addLog(`📋 Sample company: ${JSON.stringify(companiesSample[0], null, 2)}`)
          }
        }

        addLog('Checking deals table...')
        const { data: dealsSample, error: dealsError } = await supabase
          .from('Deals')
          .select('*')
          .limit(1)
        
        if (dealsError) {
          addLog(`❌ Deals table error: ${dealsError.message}`)
        } else {
          addLog(`✅ Deals table accessible. Found ${dealsSample?.length || 0} deals`)
          if (dealsSample && dealsSample.length > 0) {
            addLog(`📋 Sample deal keys: ${Object.keys(dealsSample[0]).join(', ')}`)
            addLog(`📋 Sample deal: ${JSON.stringify(dealsSample[0], null, 2)}`)
          }
        }

        // Test 5: Try the full data fetching process
        addLog('Testing full data fetching process...')
        try {
          const p3MeetingsData = await getP3Meetings('all_time')
          addLog(`✅ getP3Meetings returned ${p3MeetingsData.length} meetings`)
          
          if (p3MeetingsData.length > 0) {
            // Show sample contact IDs from meetings
            const contactIds = new Set<string>()
            p3MeetingsData.forEach(meeting => {
              if (meeting.Contacts_fk_Contacts) {
                meeting.Contacts_fk_Contacts.forEach(id => contactIds.add(id))
              }
            })
            addLog(`📋 Found ${contactIds.size} unique contact IDs in meetings`)
            addLog(`📋 Sample contact IDs: ${Array.from(contactIds).slice(0, 3).join(', ')}`)
            
            // Test if any of these contact IDs exist in the Contacts table
            if (contactIds.size > 0) {
              const sampleContactIds = Array.from(contactIds).slice(0, 3)
              addLog(`🔍 Testing if sample contact IDs exist in Contacts table...`)
              
              const { data: testContacts, error: testError } = await supabase
                .from('Contacts')
                .select('whalesync_postgres_id')
                .in('whalesync_postgres_id', sampleContactIds)
              
              if (testError) {
                addLog(`❌ Test query error: ${testError.message}`)
              } else {
                addLog(`✅ Test query found ${testContacts?.length || 0} of ${sampleContactIds.length} sample contacts`)
                if (testContacts && testContacts.length > 0) {
                  addLog(`📋 Found contact IDs: ${testContacts.map(c => c.whalesync_postgres_id).join(', ')}`)
                }
              }
            }
            
            const contactsData = await getContactsFromMeetings(p3MeetingsData)
            addLog(`✅ getContactsFromMeetings returned ${contactsData.length} contacts`)
            
            const companiesData = await getCompaniesFromContacts(contactsData)
            addLog(`✅ getCompaniesFromContacts returned ${companiesData.length} companies`)
            
            const dealsData = await getDealsFromCompanies(companiesData)
            addLog(`✅ getDealsFromCompanies returned ${dealsData.length} deals`)
          }
        } catch (fullProcessError) {
          addLog(`❌ Full process failed: ${fullProcessError}`)
        }

      } catch (err) {
        addLog(`❌ Debug process failed: ${err}`)
      } finally {
        setLoading(false)
        addLog('Debug process completed.')
      }
    }

    runDebug()
  }, [])

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-6">Database Debug Information</h1>
        
        {loading && (
          <div className="mb-4 p-4 bg-blue-100 rounded-lg">
            <p className="text-blue-800">Running debug tests...</p>
          </div>
        )}

        <div className="bg-white rounded-lg shadow-sm border p-6">
          <h2 className="text-xl font-semibold mb-4">Debug Logs</h2>
          <div className="bg-gray-100 p-4 rounded-lg max-h-96 overflow-y-auto font-mono text-sm">
            {logs.map((log, index) => (
              <div key={index} className="mb-1">
                {log}
              </div>
            ))}
            {logs.length === 0 && (
              <p className="text-gray-500">No logs yet...</p>
            )}
          </div>
        </div>

        <div className="mt-6">
          <a 
            href="/" 
            className="inline-block bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
          >
            Back to Dashboard
          </a>
        </div>
      </div>
    </div>
  )
} 