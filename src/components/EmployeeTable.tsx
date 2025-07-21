'use client'

import { EmployeeMetrics, TimePeriod } from '@/types/database'

interface EmployeeTableProps {
  metrics: EmployeeMetrics[]
  timePeriod: TimePeriod
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)
}

function formatPercentage(value: number, total: number): string {
  if (total === 0) return '0%'
  return `${((value / total) * 100).toFixed(1)}%`
}

export default function EmployeeTable({ metrics, timePeriod }: EmployeeTableProps) {
  // Calculate team totals and averages
  const totals = metrics.reduce(
    (acc, metric) => ({
      meetings: acc.meetings + metric.meeting_count,
      dealsWonCount: acc.dealsWonCount + metric.deals_won_count,
      dealsWonAmount: acc.dealsWonAmount + metric.deals_won_amount,
      dealsLostCount: acc.dealsLostCount + metric.deals_lost_count,
      dealsLostAmount: acc.dealsLostAmount + metric.deals_lost_amount,
      dealsInPlayUnder150Count: acc.dealsInPlayUnder150Count + metric.deals_in_play_under_150_count,
      dealsInPlayUnder150Amount: acc.dealsInPlayUnder150Amount + metric.deals_in_play_under_150_amount,
      dealsOverdue150Count: acc.dealsOverdue150Count + metric.deals_overdue_150_plus_count,
      dealsOverdue150Amount: acc.dealsOverdue150Amount + metric.deals_overdue_150_plus_amount,
    }),
    {
      meetings: 0,
      dealsWonCount: 0,
      dealsWonAmount: 0,
      dealsLostCount: 0,
      dealsLostAmount: 0,
      dealsInPlayUnder150Count: 0,
      dealsInPlayUnder150Amount: 0,
      dealsOverdue150Count: 0,
      dealsOverdue150Amount: 0,
    }
  )

  const teamSize = metrics.length
  const averages = {
    meetings: teamSize > 0 ? (totals.meetings / teamSize).toFixed(1) : '0',
    dealsWonCount: teamSize > 0 ? (totals.dealsWonCount / teamSize).toFixed(1) : '0',
    dealsWonAmount: teamSize > 0 ? totals.dealsWonAmount / teamSize : 0,
    dealsLostCount: teamSize > 0 ? (totals.dealsLostCount / teamSize).toFixed(1) : '0',
    dealsLostAmount: teamSize > 0 ? totals.dealsLostAmount / teamSize : 0,
    dealsInPlayUnder150Count: teamSize > 0 ? (totals.dealsInPlayUnder150Count / teamSize).toFixed(1) : '0',
    dealsInPlayUnder150Amount: teamSize > 0 ? totals.dealsInPlayUnder150Amount / teamSize : 0,
    dealsOverdue150Count: teamSize > 0 ? (totals.dealsOverdue150Count / teamSize).toFixed(1) : '0',
    dealsOverdue150Amount: teamSize > 0 ? totals.dealsOverdue150Amount / teamSize : 0,
  }

  const getPeriodLabel = () => {
    switch (timePeriod) {
      case 'all_time':
        return 'All Time (Annualized)'
      case 'year_to_date':
        return 'Year to Date (Annualized)'
      case 'month_to_date':
        return 'Month to Date'
      default:
        return ''
    }
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-200">
        <h3 className="text-lg font-semibold text-gray-900">
          Employee Performance - {getPeriodLabel()}
        </h3>
      </div>
      
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Employee
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Meetings
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Deals Won / Amount
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Deals Lost / Amount
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Deals In Play &lt;150 Days
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Deals Overdue 150+ Days
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {metrics.map((metric, index) => (
              <tr key={metric.employee_name} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                  {metric.employee_name}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {metric.meeting_count}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  <div className="flex flex-col">
                    <span className="font-medium text-green-600">
                      {metric.deals_won_count} / {formatCurrency(metric.deals_won_amount)}
                    </span>
                    <span className="text-xs text-gray-500">
                      {formatPercentage(metric.deals_won_count, metric.deals_won_count + metric.deals_lost_count)}
                    </span>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  <div className="flex flex-col">
                    <span className="font-medium text-red-600">
                      {metric.deals_lost_count} / {formatCurrency(metric.deals_lost_amount)}
                    </span>
                    <span className="text-xs text-gray-500">
                      {formatPercentage(metric.deals_lost_count, metric.deals_won_count + metric.deals_lost_count)}
                    </span>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  <div className="flex flex-col">
                    <span className="font-medium text-blue-600">
                      {metric.deals_in_play_under_150_count} / {formatCurrency(metric.deals_in_play_under_150_amount)}
                    </span>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  <div className="flex flex-col">
                    <span className="font-medium text-orange-600">
                      {metric.deals_overdue_150_plus_count} / {formatCurrency(metric.deals_overdue_150_plus_amount)}
                    </span>
                  </div>
                </td>
              </tr>
            ))}
            
            {/* Team Total Average Row */}
            <tr className="bg-blue-50 border-t-2 border-blue-200">
              <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-blue-900">
                Team Total Avg.
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-blue-900">
                {averages.meetings}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-blue-900">
                <div className="flex flex-col">
                  <span>
                    {averages.dealsWonCount} / {formatCurrency(averages.dealsWonAmount)}
                  </span>
                  <span className="text-xs text-blue-700">
                    {formatPercentage(totals.dealsWonCount, totals.dealsWonCount + totals.dealsLostCount)}
                  </span>
                </div>
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-blue-900">
                <div className="flex flex-col">
                  <span>
                    {averages.dealsLostCount} / {formatCurrency(averages.dealsLostAmount)}
                  </span>
                  <span className="text-xs text-blue-700">
                    {formatPercentage(totals.dealsLostCount, totals.dealsWonCount + totals.dealsLostCount)}
                  </span>
                </div>
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-blue-900">
                {averages.dealsInPlayUnder150Count} / {formatCurrency(averages.dealsInPlayUnder150Amount)}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-blue-900">
                {averages.dealsOverdue150Count} / {formatCurrency(averages.dealsOverdue150Amount)}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  )
} 