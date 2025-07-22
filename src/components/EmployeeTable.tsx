'use client'

import { useState, useRef } from 'react'
import { EmployeeMetrics, TimePeriod } from '@/types/database'
import { createPortal } from 'react-dom'

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

export default function EmployeeTable({ metrics }: EmployeeTableProps) {
  console.log('EmployeeTable metrics:', metrics)
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set())
  // Tooltip state
  const [tooltip, setTooltip] = useState<null | {
    x: number, y: number, names: string[], label: string
  }>(null)
  const tableRef = useRef<HTMLTableElement>(null)

  function handleExpand(idx: number) {
    setExpandedRows(prev => {
      const next = new Set(prev)
      if (next.has(idx)) next.delete(idx)
      else next.add(idx)
      return next
    })
    if (expandedRows.has(idx)) {
      console.log(`DEBUG: Deal UUIDs for ${cleanEmployeeName(metrics[idx].employee_name)}`)
      // Removed references to deals_in_play_under_150_uuids and deals_overdue_150_plus_uuids
    }
  }

  function handleShowTooltip(e: React.MouseEvent, names: string[], label: string) {
    const rect = (e.target as HTMLElement).getBoundingClientRect()
    setTooltip({
      x: rect.left + rect.width / 2,
      y: rect.bottom + 8, // 8px below
      names,
      label
    })
  }
  function handleHideTooltip() {
    setTooltip(null)
  }

  // Calculate averages for the bottom row
  const avg = (arr: number[]) => arr.length ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) : 0
  const avgDollar = (arr: number[]) => arr.length ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) : 0
  const avgMeeting = avg(metrics.map(m => m.meeting_count))
  const avgWon = avg(metrics.map(m => m.deals_won_count))
  const avgLost = avg(metrics.map(m => m.deals_lost_count))
  const avgInPlay = avg(metrics.map(m => m.deals_in_play_under_150_count))
  const avgOverdue = avg(metrics.map(m => m.deals_overdue_150_plus_count))
  const avgWonAmt = avgDollar(metrics.map(m => m.deals_won_amount))
  const avgLostAmt = avgDollar(metrics.map(m => m.deals_lost_amount))
  const avgInPlayAmt = avgDollar(metrics.map(m => m.deals_in_play_under_150_amount))
  const avgOverdueAmt = avgDollar(metrics.map(m => m.deals_overdue_150_plus_amount))

  return (
    <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-200">
        <h3 className="text-lg font-semibold text-gray-900">
          Employee Performance
        </h3>
      </div>
      {/* Remove overflow-x-auto */}
      <table ref={tableRef} className="min-w-full table-fixed divide-y divide-gray-200 bg-white">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Employee</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Meetings</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Deals Won</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Deals Lost</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">In Play {'<'}150 Days</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Overdue 150+ Days</th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {metrics.map((metric, idx) => {
            const cleanedName = cleanEmployeeName(metric.employee_name)
            return (
              <>
                <tr key={metric.employee_name} className="cursor-pointer" onClick={() => handleExpand(idx)}>
                  <td className="px-4 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{cleanedName}</td>
                  <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">{metric.meeting_count}</td>
                  <td className="px-4 py-4 whitespace-nowrap text-sm text-green-700">{metric.deals_won_count}</td>
                  <td className="px-4 py-4 whitespace-nowrap text-sm text-red-700">{metric.deals_lost_count}</td>
                  <td className="px-4 py-4 whitespace-nowrap text-sm text-blue-700 relative group">
                    <span
                      onMouseEnter={e => metric.deals_in_play_under_150_names?.length > 0 && handleShowTooltip(e, metric.deals_in_play_under_150_names, 'In Play Deals')}
                      onMouseLeave={handleHideTooltip}
                      style={{ cursor: metric.deals_in_play_under_150_names?.length > 0 ? 'pointer' : undefined }}
                    >
                      {metric.deals_in_play_under_150_count}
                    </span>
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap text-sm text-orange-700 relative group">
                    <span
                      onMouseEnter={e => metric.deals_overdue_150_plus_names?.length > 0 && handleShowTooltip(e, metric.deals_overdue_150_plus_names, 'Overdue Deals')}
                      onMouseLeave={handleHideTooltip}
                      style={{ cursor: metric.deals_overdue_150_plus_names?.length > 0 ? 'pointer' : undefined }}
                    >
                      {metric.deals_overdue_150_plus_count}
                    </span>
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
          <tr className="bg-gray-50 font-semibold">
            <td className="px-4 py-3 text-sm text-gray-700">Employee Averages</td>
            <td className="px-4 py-3 text-sm text-gray-700">{avgMeeting}</td>
            <td className="px-4 py-3 text-sm text-green-700">{avgWon} <span className="text-xs text-gray-500">(${avgWonAmt.toLocaleString()})</span></td>
            <td className="px-4 py-3 text-sm text-red-700">{avgLost} <span className="text-xs text-gray-500">(${avgLostAmt.toLocaleString()})</span></td>
            <td className="px-4 py-3 text-sm text-blue-700">{avgInPlay} <span className="text-xs text-gray-500">(${avgInPlayAmt.toLocaleString()})</span></td>
            <td className="px-4 py-3 text-sm text-orange-700">{avgOverdue} <span className="text-xs text-gray-500">(${avgOverdueAmt.toLocaleString()})</span></td>
          </tr>
        </tbody>
      </table>
      {/* Tooltip rendered outside card using portal */}
      {tooltip && createPortal(
        <div
          className="z-50 w-96 bg-white border border-gray-300 rounded shadow-lg p-2 fixed"
          style={{ left: tooltip.x, top: tooltip.y, transform: 'translate(-50%, 0)' }}
        >
          <div className="font-semibold text-xs mb-1">{tooltip.label}</div>
          <table className="w-full text-xs whitespace-nowrap">
            <tbody>
              {tooltip.names.map((name, i) => (
                <tr key={i}><td className="py-1 px-2 whitespace-nowrap">{name}</td></tr>
              ))}
            </tbody>
          </table>
        </div>,
        document.body
      )}
    </div>
  )
} 