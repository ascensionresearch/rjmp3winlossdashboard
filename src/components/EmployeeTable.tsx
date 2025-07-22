'use client'

import { useState } from 'react'
import { EmployeeMetrics, TimePeriod } from '@/types/database'

interface EmployeeTableProps {
  metrics: EmployeeMetrics[]
  timePeriod: TimePeriod
}

function cleanEmployeeName(name: string): string {
  return name.replace(/\s*\([^)]*\)$/, '').trim()
}

// Replace DealPieChartLabeled with DealBarChartLabeled
function DealBarChartLabeled({ won, lost, inPlay, overdue, amounts }: { won: number, lost: number, inPlay: number, overdue: number, amounts: { won: number, lost: number, inPlay: number, overdue: number } }) {
  const total = won + lost + inPlay + overdue
  const colors = ['#16a34a', '#dc2626', '#2563eb', '#ea580c']
  const values = [won, lost, inPlay, overdue]
  const valueAmounts = [amounts.won, amounts.lost, amounts.inPlay, amounts.overdue]
  const labels = ['Won', 'Lost', 'In Play', 'Overdue']
  const maxValue = Math.max(...values, 1)
  const barMaxHeight = 220
  const barWidth = 90
  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'end', gap: 40, padding: 24 }}>
      {values.map((value, i) => {
        if (value === 0) return null
        const percent = total === 0 ? 0 : (value / total) * 100
        const percentRounded = Math.round(percent)
        const barHeight = (value / maxValue) * barMaxHeight
        // Only reduce font size for percent < 5%
        const percentFontSize = percentRounded < 5 ? 10 : 16
        return (
          <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: barWidth }}>
            <div style={{ fontWeight: 700, fontSize: 26, color: colors[i], marginBottom: 4 }}>{value}</div>
            <div style={{
              width: barWidth,
              height: barHeight,
              background: colors[i],
              borderRadius: 8,
              marginBottom: 8,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'height 0.3s',
            }}>
              <span style={{ fontWeight: 400, fontSize: percentFontSize, color: '#fff' }}>{percentRounded}%</span>
            </div>
            <div style={{ fontWeight: 400, fontSize: 16, color: '#222', marginTop: 2 }}>${valueAmounts[i].toLocaleString()}</div>
            <div style={{ fontWeight: 500, fontSize: 15, color: '#444', marginTop: 6 }}>{labels[i]}</div>
          </div>
        )
      })}
    </div>
  )
}

export default function EmployeeTable({ metrics, timePeriod }: EmployeeTableProps) {
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set())

  function handleExpand(idx: number) {
    setExpandedRows(prev => {
      const next = new Set(prev)
      if (next.has(idx)) next.delete(idx)
      else next.add(idx)
      return next
    })
    if (expandedRows.has(idx)) {
      console.log(`DEBUG: Deal UUIDs for ${cleanEmployeeName(metrics[idx].employee_name)}`)
      console.log('Deals In Play UUIDs:', metrics[idx].deals_in_play_under_150_uuids || [])
      console.log('Deals Overdue UUIDs:', metrics[idx].deals_overdue_150_plus_uuids || [])
    }
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-200">
        <h3 className="text-lg font-semibold text-gray-900">
          Employee Performance
        </h3>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Employee</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Meetings</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Deals Won</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Deals Lost</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">In Play {'<'}150 Days</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Overdue 150+ Days</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {metrics.map((metric, idx) => {
              const cleanedName = cleanEmployeeName(metric.employee_name)
              return (
                <>
                  <tr key={metric.employee_name} className="cursor-pointer" onClick={() => handleExpand(idx)}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{cleanedName}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{metric.meeting_count}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-green-700">{metric.deals_won_count}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-red-700">{metric.deals_lost_count}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-blue-700 relative group">
                      {metric.deals_in_play_under_150_count}
                      {metric.deals_in_play_under_150_names && metric.deals_in_play_under_150_names.length > 0 && (
                        <div className="absolute left-1/2 top-full z-10 mt-2 w-64 bg-white border border-gray-300 rounded shadow-lg opacity-0 group-hover:opacity-100 pointer-events-none group-hover:pointer-events-auto transition-opacity duration-150" style={{ transform: 'translateX(-50%)' }}>
                          <div className="p-2">
                            <div className="font-semibold text-xs mb-1">In Play Deals</div>
                            <table className="w-full text-xs">
                              <tbody>
                                {metric.deals_in_play_under_150_names.map((name, i) => (
                                  <tr key={i}><td className="py-1 px-2">{name}</td></tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-orange-700 relative group">
                      {metric.deals_overdue_150_plus_count}
                      {metric.deals_overdue_150_plus_names && metric.deals_overdue_150_plus_names.length > 0 && (
                        <div className="absolute left-1/2 top-full z-10 mt-2 w-64 bg-white border border-gray-300 rounded shadow-lg opacity-0 group-hover:opacity-100 pointer-events-none group-hover:pointer-events-auto transition-opacity duration-150" style={{ transform: 'translateX(-50%)' }}>
                          <div className="p-2">
                            <div className="font-semibold text-xs mb-1">Overdue Deals</div>
                            <table className="w-full text-xs">
                              <tbody>
                                {metric.deals_overdue_150_plus_names.map((name, i) => (
                                  <tr key={i}><td className="py-1 px-2">{name}</td></tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )}
                    </td>
                  </tr>
                  {expandedRows.has(idx) && (
                    <tr>
                      <td colSpan={6} className="bg-gray-50 px-6 py-8">
                        <div className="flex flex-col items-center">
                          <DealBarChartLabeled
                            won={metric.deals_won_count}
                            lost={metric.deals_lost_count}
                            inPlay={metric.deals_in_play_under_150_count}
                            overdue={metric.deals_overdue_150_plus_count}
                            amounts={{
                              won: metric.deals_won_amount,
                              lost: metric.deals_lost_amount,
                              inPlay: metric.deals_in_play_under_150_amount,
                              overdue: metric.deals_overdue_150_plus_amount
                            }}
                          />
                          <div className="flex gap-8 mt-4">
                            <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full" style={{background:'#16a34a'}}></span>Won</div>
                            <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full" style={{background:'#dc2626'}}></span>Lost</div>
                            <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full" style={{background:'#2563eb'}}></span>In Play</div>
                            <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full" style={{background:'#ea580c'}}></span>Overdue</div>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
} 