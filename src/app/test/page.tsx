'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'

export default function TestPage() {
  const [status, setStatus] = useState<string>('Testing connection...')
  const [data, setData] = useState<unknown>(null)

  useEffect(() => {
    const testConnection = async () => {
      try {
        setStatus('Testing Supabase connection...')
        
        // Test a simple query to see if we can connect
        const { data, error } = await supabase
          .from('Meetings')
          .select('count')
          .limit(1)
        
        if (error) {
          setStatus(`Error: ${error.message}`)
          console.error('Supabase error:', error)
        } else {
          setStatus('Connection successful!')
          setData(data)
        }
      } catch (err) {
        setStatus(`Exception: ${err}`)
        console.error('Exception:', err)
      }
    }

    testConnection()
  }, [])

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="bg-white p-8 rounded-lg shadow-md max-w-md">
        <h1 className="text-2xl font-bold mb-4">Supabase Connection Test</h1>
        <p className="mb-4">{status}</p>
        {typeof data === 'string' && (
          <pre className="bg-gray-100 p-4 rounded text-sm overflow-auto">{data}</pre>
        )}
        {typeof data === 'object' && data !== null && (
          <pre className="bg-gray-100 p-4 rounded text-sm overflow-auto">{JSON.stringify(data, null, 2)}</pre>
        )}
        <Link 
          href="/" 
          className="mt-4 inline-block bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
        >
          Back to Dashboard
        </Link>
      </div>
    </div>
  )
} 