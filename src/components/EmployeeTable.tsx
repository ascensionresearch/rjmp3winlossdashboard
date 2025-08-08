'use client'

import { useState, useRef, Fragment } from 'react'
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
function DealBarChartLabeled({ won, lost, inPlay, overdue, amounts, meetingCount: _meetingCount }: { 
  won: number, 
  lost: number, 
  inPlay: number, 
  overdue: number, 
  amounts: { won: number, lost: number, inPlay: number, overdue: number },
  meetingCount: number 
}) {
  const total = won + lost + inPlay + overdue
  const colors = ['#16a34a', '#dc2626', '#2563eb', '#ea580c']
  const values = [won, lost, inPlay, overdue]
  const valueAmounts = [amounts.won, amounts.lost, amounts.inPlay, amounts.overdue]
  const labels = ['Won', 'Lost', 'In Play', 'Overdue']
  const maxValue = Math.max(...values, 1)
  const barMaxHeight = 220
  const barWidth = 90
  
  // Calculate average amounts
  const averageAmounts = values.map((value, i) => 
    value > 0 ? Math.round(valueAmounts[i] / value) : 0
  )
  
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
            <div style={{ fontWeight: 400, fontSize: 12, color: '#666', marginTop: 2 }}>avg: ${averageAmounts[i].toLocaleString()}</div>
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
  // Tooltip state (supports either simple name list or detailed items with stage)
  type TooltipState =
    | null
    | { x: number; y: number; label: string; names: string[] }
    | { x: number; y: number; label: string; items: { name: string; stage?: string; classification?: 'won' | 'lost' | 'in_play' | 'overdue' }[] }
  const [tooltip, setTooltip] = useState<TooltipState>(null)
  const tableRef = useRef<HTMLTableElement>(null)
  const hideTimeoutRef = useRef<number | null>(null)

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

  function handleShowTooltip(e: React.MouseEvent<HTMLElement>, names: string[], label: string) {
    const rect = (e.target as HTMLElement).getBoundingClientRect()
    if (hideTimeoutRef.current) {
      window.clearTimeout(hideTimeoutRef.current)
      hideTimeoutRef.current = null
    }
    setTooltip({
      x: rect.left + rect.width / 2,
      y: rect.bottom + 8, // 8px below
      names,
      label
    })
  }
  function handleShowTooltipDetails(
    e: React.MouseEvent<HTMLElement>,
    items: { name: string; stage?: string; classification?: 'won' | 'lost' | 'in_play' | 'overdue' }[],
    label: string
  ) {
    const rect = (e.target as HTMLElement).getBoundingClientRect()
    if (hideTimeoutRef.current) {
      window.clearTimeout(hideTimeoutRef.current)
      hideTimeoutRef.current = null
    }
    setTooltip({
      x: rect.left + rect.width / 2,
      y: rect.bottom + 8,
      items,
      label,
    })
  }
  function handleHideTooltip() {
    if (hideTimeoutRef.current) window.clearTimeout(hideTimeoutRef.current)
    hideTimeoutRef.current = window.setTimeout(() => setTooltip(null), 120)
  }

  // Calculate averages for the bottom row
  // (Averages removed; shown in summary cards instead)

  return (
    <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-200">
        <h3 className="text-lg font-semibold text-gray-900">
          Employee Performance
        </h3>
        <p className="text-xs text-gray-500 mt-1">*Note: Monthly Deals Only</p>
      </div>
      {/* Remove overflow-x-auto */}
      <table ref={tableRef} className="min-w-full table-fixed divide-y divide-gray-200 bg-white">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Employee</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">P3 MEETINGS</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Deals Won</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Deals Lost</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">In Play {'<'}150 Days</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Overdue 150+ Days</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Deals w/o P3</th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {metrics.map((metric, idx) => {
            const cleanedName = cleanEmployeeName(metric.employee_name)
            const denom = metric.meeting_count
            const wonPct = denom > 0 ? Math.round((metric.deals_won_count / denom) * 100) : 0
            const lostPct = denom > 0 ? Math.round((metric.deals_lost_count / denom) * 100) : 0
            const inPlayPct = denom > 0 ? Math.round((metric.deals_in_play_under_150_count / denom) * 100) : 0
            const overduePct = denom > 0 ? Math.round((metric.deals_overdue_150_plus_count / denom) * 100) : 0
            return (
              <Fragment key={metric.employee_name}>
                <tr className="cursor-pointer" onClick={() => handleExpand(idx)}>
                  <td className="px-4 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{cleanedName}</td>
                  <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">{metric.meeting_count}</td>
                  <td className="px-4 py-4 whitespace-nowrap text-sm text-green-700 relative group">
                    <span
                      onMouseEnter={e => metric.deals_won_names?.length > 0 && handleShowTooltip(e, metric.deals_won_names, 'Won Deals')}
                      onMouseLeave={handleHideTooltip}
                      style={{ cursor: metric.deals_won_names?.length > 0 ? 'pointer' : undefined }}
                    >
                      {metric.deals_won_count}
                    </span>
                    <span className="ml-1 text-xs text-gray-500">({wonPct}%)</span>
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap text-sm text-red-700 relative group">
                    <span
                      onMouseEnter={e => metric.deals_lost_names?.length > 0 && handleShowTooltip(e, metric.deals_lost_names, 'Lost Deals')}
                      onMouseLeave={handleHideTooltip}
                      style={{ cursor: metric.deals_lost_names?.length > 0 ? 'pointer' : undefined }}
                    >
                      {metric.deals_lost_count}
                    </span>
                    <span className="ml-1 text-xs text-gray-500">({lostPct}%)</span>
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap text-sm text-blue-700 relative group">
                    <span
                      onMouseEnter={e => {
                        if (metric.deals_in_play_under_150_details?.length) handleShowTooltipDetails(e, metric.deals_in_play_under_150_details, 'In Play Deals')
                        else if (metric.deals_in_play_under_150_names?.length) handleShowTooltip(e, metric.deals_in_play_under_150_names, 'In Play Deals')
                      }}
                      onMouseLeave={handleHideTooltip}
                      style={{ cursor: (metric.deals_in_play_under_150_details?.length || metric.deals_in_play_under_150_names?.length) ? 'pointer' : undefined }}
                    >
                      {metric.deals_in_play_under_150_count}
                    </span>
                    <span className="ml-1 text-xs text-gray-500">({inPlayPct}%)</span>
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap text-sm text-orange-700 relative group">
                    <span
                      onMouseEnter={e => {
                        if (metric.deals_overdue_150_plus_details?.length) handleShowTooltipDetails(e, metric.deals_overdue_150_plus_details, 'Overdue Deals')
                        else if (metric.deals_overdue_150_plus_names?.length) handleShowTooltip(e, metric.deals_overdue_150_plus_names, 'Overdue Deals')
                      }}
                      onMouseLeave={handleHideTooltip}
                      style={{ cursor: (metric.deals_overdue_150_plus_details?.length || metric.deals_overdue_150_plus_names?.length) ? 'pointer' : undefined }}
                    >
                      {metric.deals_overdue_150_plus_count}
                    </span>
                    <span className="ml-1 text-xs text-gray-500">({overduePct}%)</span>
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-400 relative group">
                    <span
                      onMouseEnter={e => metric.deals_without_p3_details?.length ? handleShowTooltipDetails(e, metric.deals_without_p3_details!, 'Deals without P3') : undefined}
                      onMouseLeave={handleHideTooltip}
                      style={{ cursor: metric.deals_without_p3_details?.length ? 'pointer' : undefined }}
                    >
                      {metric.deals_without_p3_count ?? 0}
                    </span>
                  </td>
                </tr>
                {expandedRows.has(idx) && (
                  <tr key={`${metric.employee_name}-expanded`}>
                    <td colSpan={7} className="bg-gray-50 px-6 py-8">
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
                          meetingCount={metric.meeting_count}
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
              </Fragment>
            )
          })}
          {/* Averages row removed */}
        </tbody>
      </table>
      {/* Tooltip rendered outside card using portal */}
      {tooltip && createPortal(
        <div
          className="z-50 w-[640px] max-w-[85vw] max-h-[60vh] overflow-y-auto bg-white border border-gray-300 rounded shadow-lg p-3 fixed"
          style={{ left: tooltip.x, top: tooltip.y, transform: 'translate(-50%, 0)' }}
          onMouseEnter={() => {
            if (hideTimeoutRef.current) {
              window.clearTimeout(hideTimeoutRef.current)
              hideTimeoutRef.current = null
            }
          }}
          onMouseLeave={() => setTooltip(null)}
        >
          <div className="font-semibold text-xs mb-1">{tooltip.label}</div>
          {'names' in tooltip ? (
            <table className="w-full text-xs whitespace-nowrap">
              <tbody>
                {tooltip.names.map((name, i) => (
                  <tr key={i}><td className="py-1 px-2 whitespace-nowrap">{name}</td></tr>
                ))}
              </tbody>
            </table>
          ) : (
            <table className="w-full text-xs whitespace-nowrap">
              <tbody>
                 {[...tooltip.items]
                  .sort((a, b) => {
                    // Primary: classification order won -> lost -> in_play -> overdue
                    const order: Record<'won' | 'lost' | 'in_play' | 'overdue', number> = { won: 0, lost: 1, in_play: 2, overdue: 3 }
                    const aClass: 'won' | 'lost' | 'in_play' | 'overdue' = (a.classification ?? 'in_play')
                    const bClass: 'won' | 'lost' | 'in_play' | 'overdue' = (b.classification ?? 'in_play')
                    const ra = order[aClass]
                    const rb = order[bClass]
                    if (ra !== rb) return ra - rb
                    // Secondary: stage alpha, then name
                    const sa = (a.stage || '').localeCompare(b.stage || '')
                    if (sa !== 0) return sa
                    return a.name.localeCompare(b.name)
                  })
                  .map((item, i) => {
                    const classification = item.classification as 'won' | 'lost' | 'in_play' | 'overdue' | undefined
                    const isDealsWithoutP3 = tooltip.label === 'Deals without P3'
                    const color = classification === 'won' ? 'text-green-700' : classification === 'lost' ? 'text-red-700' : classification === 'in_play' ? 'text-blue-700' : classification === 'overdue' ? 'text-orange-700' : 'text-slate-800'
                    const isPriority = item.stage === 'A - Verbal Commitment' || item.stage === 'B - Strong Opportunity'
                    return (
                      <tr key={i}>
                        <td className={`py-1 px-2 whitespace-nowrap ${color}`}>
                          <span className={isDealsWithoutP3 ? '' : (isPriority ? 'font-semibold' : '')}>
                            {item.name}
                          </span>
                          {isDealsWithoutP3 && (classification === 'in_play' || classification === 'overdue') ? (
                            <span className="ml-2 text-[10px] text-gray-600">({classification === 'in_play' ? 'IN PLAY' : 'OVERDUE'})</span>
                          ) : (
                            item.stage && (
                              <span className="ml-2 text-[10px] text-gray-500 uppercase tracking-wide">[{item.stage}]</span>
                            )
                          )}
                          {!isDealsWithoutP3 && isPriority && (
                            <span className="ml-2 text-[10px] text-emerald-700 font-semibold">PRIORITY</span>
                          )}
                        </td>
                      </tr>
                    )
                  })}
              </tbody>
            </table>
          )}
        </div>,
        document.body
      )}
    </div>
  )
} 