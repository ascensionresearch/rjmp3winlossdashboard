'use client'

import { EmployeeMetrics, TimePeriod } from '@/types/database'
import { Calendar, User, Trophy, DollarSign, TrendingUp, TrendingDown, FileSignature, Banknote } from 'lucide-react'

interface SummaryCardsProps {
  metrics: EmployeeMetrics[]
  timePeriod: TimePeriod
}

function cleanEmployeeName(name: string): string {
  return name.replace(/\s*\([^)]*\)$/, '').trim()
}

export default function SummaryCards({ metrics, timePeriod }: SummaryCardsProps) {
  const totalMeetings = metrics.reduce((sum, metric) => sum + metric.meeting_count, 0)
  const totalEmployees = metrics.length
  const averagePerEmployee = totalEmployees > 0 ? Math.round(totalMeetings / totalEmployees) : 0
  
  const totalWonCount = metrics.reduce((sum, m) => sum + m.deals_won_count, 0)
  const totalLostCount = metrics.reduce((sum, m) => sum + m.deals_lost_count, 0)
  // const totalInPlayCount = metrics.reduce((sum, m) => sum + m.deals_in_play_under_150_count, 0)
  // const totalOverdueCount = metrics.reduce((sum, m) => sum + m.deals_overdue_150_plus_count, 0)
  // Match collapsed rows logic: percentage is count divided by P3 meeting count
  const avgWinningPct = totalMeetings > 0 ? Math.round((totalWonCount / totalMeetings) * 100) : 0
  const avgLosingPct = totalMeetings > 0 ? Math.round((totalLostCount / totalMeetings) * 100) : 0

  // Backend already annualizes amounts for all_time/YTD, raw for month. Keep conditional for clarity.
  const totalWonAmount = metrics.reduce((sum, m) => sum + m.deals_won_amount, 0)
  const avgDealValueRaw = totalWonCount > 0 ? Math.round(totalWonAmount / totalWonCount) : 0
  const avgDealValue = avgDealValueRaw
  const isAnnualized = timePeriod === 'all_time' || timePeriod === 'year_to_date'

  const topProposer = metrics.reduce((top, current) => 
    current.meeting_count > top.meeting_count ? current : top,
    metrics[0] || { employee_name: 'N/A', meeting_count: 0, deals_won_count: 0, deals_won_amount: 0 }
  )

  const mostDealsWon = metrics.reduce((top, current) => 
    current.deals_won_count > top.deals_won_count ? current : top,
    metrics[0] || { employee_name: 'N/A', meeting_count: 0, deals_won_count: 0, deals_won_amount: 0 }
  )

  const topRevenueGenerator = metrics.reduce((top, current) => 
    current.deals_won_amount > top.deals_won_amount ? current : top,
    metrics[0] || { employee_name: 'N/A', meeting_count: 0, deals_won_count: 0, deals_won_amount: 0 }
  )

  const cards = [
    {
      title: 'Total P3 - Proposals',
      value: totalMeetings.toString(),
      subtitle: '',
      icon: Calendar,
      iconColor: 'text-blue-600',
      bgColor: 'bg-blue-50'
    },
    {
      title: 'Top Proposer',
      value: cleanEmployeeName(topProposer.employee_name),
      subtitle: `${topProposer.meeting_count} meetings`,
      icon: FileSignature,
      iconColor: 'text-orange-600',
      bgColor: 'bg-orange-50'
    },
    {
      title: 'Top Closer (by Volume)',
      value: cleanEmployeeName(mostDealsWon.employee_name),
      subtitle: `${mostDealsWon.deals_won_count} won`,
      icon: Trophy,
      iconColor: 'text-indigo-600',
      bgColor: 'bg-indigo-50'
    },
    {
      title: 'Top Closer (by Value)',
      value: cleanEmployeeName(topRevenueGenerator.employee_name),
      subtitle: `$${Math.round(topRevenueGenerator.deals_won_amount).toLocaleString()}`,
      icon: DollarSign,
      iconColor: 'text-green-600',
      bgColor: 'bg-green-50'
    },
    {
      title: 'Avg. # of Meetings',
      value: averagePerEmployee.toString(),
      subtitle: '',
      icon: User,
      iconColor: 'text-blue-600',
      bgColor: 'bg-blue-50'
    },
    {
      title: 'Avg. Winning Percentage',
      value: `${avgWinningPct}%`,
      subtitle: '',
      icon: TrendingUp,
      iconColor: 'text-emerald-600',
      bgColor: 'bg-emerald-50'
    },
    {
      title: 'Avg. Losing Percentage',
      value: `${avgLosingPct}%`,
      subtitle: '',
      icon: TrendingDown,
      iconColor: 'text-red-600',
      bgColor: 'bg-red-50'
    },
    {
      title: 'Avg. Deal Value',
      value: `$${avgDealValue.toLocaleString()}`,
      subtitle: isAnnualized ? '(Annualized)' : '(Not Annualized)',
      icon: Banknote,
      iconColor: 'text-green-600',
      bgColor: 'bg-green-50'
    }
  ]

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      {cards.map((card, index) => {
        const Icon = card.icon
        
        return (
          <div
            key={index}
            className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm hover:shadow-md transition-shadow duration-200"
          >
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-600 mb-2">
                  {card.title}
                </p>
                <p className="text-3xl font-bold text-gray-900 mb-1">
                  {card.value}
                </p>
                {card.subtitle && (
                  <p className="text-sm text-gray-500">
                    {card.subtitle}
                  </p>
                )}
              </div>
              <div className={`p-3 rounded-lg ${card.bgColor}`}>
                <Icon size={24} className={card.iconColor} />
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
} 