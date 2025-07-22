'use client'

import { EmployeeMetrics } from '@/types/database'
import { Users, Calendar, Medal, User } from 'lucide-react'

interface SummaryCardsProps {
  metrics: EmployeeMetrics[]
}

function cleanEmployeeName(name: string): string {
  return name.replace(/\s*\([^)]*\)$/, '').trim()
}

export default function SummaryCards({ metrics }: SummaryCardsProps) {
  const totalMeetings = metrics.reduce((sum, metric) => sum + metric.meeting_count, 0)
  const totalEmployees = metrics.length
  const averagePerEmployee = totalEmployees > 0 ? Math.round(totalMeetings / totalEmployees) : 0
  
  const topPerformer = metrics.reduce((top, current) => 
    current.meeting_count > top.meeting_count ? current : top,
    metrics[0] || { employee_name: 'N/A', meeting_count: 0 }
  )

  const cards = [
    {
      title: 'Total P3 - Proposals',
      value: totalMeetings.toString(),
      subtitle: 'all time',
      icon: Calendar,
      iconColor: 'text-blue-600',
      bgColor: 'bg-blue-50'
    },
    {
      title: 'Top Performer',
      value: cleanEmployeeName(topPerformer.employee_name),
      subtitle: `${topPerformer.meeting_count} meetings`,
      icon: Medal,
      iconColor: 'text-orange-600',
      bgColor: 'bg-orange-50'
    },
    {
      title: 'Average per Employee',
      value: averagePerEmployee.toString(),
      subtitle: 'meetings per person',
      icon: User,
      iconColor: 'text-blue-600',
      bgColor: 'bg-blue-50'
    },
    {
      title: 'Total Employees',
      value: totalEmployees.toString(),
      subtitle: 'team members with meetings',
      icon: Users,
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
                <p className="text-sm text-gray-500">
                  {card.subtitle}
                </p>
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