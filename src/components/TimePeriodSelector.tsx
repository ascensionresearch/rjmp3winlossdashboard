'use client'

import { TimePeriod } from '@/types/database'
import { Calendar, Clock, Infinity } from 'lucide-react'

interface TimePeriodSelectorProps {
  selectedPeriod: TimePeriod
  onPeriodChange: (period: TimePeriod) => void
}

export default function TimePeriodSelector({ selectedPeriod, onPeriodChange }: TimePeriodSelectorProps) {
  const periods = [
    {
      id: 'all_time' as TimePeriod,
      title: 'All Time',
      description: 'All meetings ever recorded',
      icon: Infinity
    },
    {
      id: 'year_to_date' as TimePeriod,
      title: 'Year to Date',
      description: 'From January 1st to today',
      icon: Calendar
    },
    {
      id: 'month_to_date' as TimePeriod,
      title: 'Month to Date',
      description: 'From the 1st of this month to today',
      icon: Clock
    }
  ]

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold text-gray-900">Time Period</h2>
      <div className="space-y-2">
        {periods.map((period) => {
          const Icon = period.icon
          const isSelected = selectedPeriod === period.id
          
          return (
            <button
              key={period.id}
              onClick={() => onPeriodChange(period.id)}
              className={`w-full text-left p-4 rounded-lg border-2 transition-all duration-200 ${
                isSelected
                  ? 'border-blue-500 bg-blue-50 shadow-md'
                  : 'border-gray-200 bg-white hover:border-gray-300 hover:shadow-sm'
              }`}
            >
              <div className="flex items-start space-x-3">
                <Icon
                  size={20}
                  className={`mt-1 ${
                    isSelected ? 'text-blue-600' : 'text-gray-400'
                  }`}
                />
                <div className="flex-1">
                  <h3
                    className={`font-medium ${
                      isSelected ? 'text-blue-900' : 'text-gray-900'
                    }`}
                  >
                    {period.title}
                  </h3>
                  <p
                    className={`text-sm mt-1 ${
                      isSelected ? 'text-blue-700' : 'text-gray-500'
                    }`}
                  >
                    {period.description}
                  </p>
                </div>
                {isSelected && (
                  <div className="w-2 h-2 bg-blue-600 rounded-full mt-2"></div>
                )}
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
} 