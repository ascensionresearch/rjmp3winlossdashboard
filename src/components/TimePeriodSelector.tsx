'use client'

import { TimePeriod } from '@/types/database'
import { Calendar, Clock, Infinity } from 'lucide-react'

interface TimePeriodSelectorProps {
  selectedPeriod: TimePeriod
  onPeriodChange: (period: TimePeriod) => void
}

export default function TimePeriodSelector({ selectedPeriod, onPeriodChange }: TimePeriodSelectorProps) {
  const periods = [
    { id: 'all_time' as TimePeriod, title: 'All Time' },
    { id: 'year_to_date' as TimePeriod, title: 'Year to Date' },
    { id: 'month_to_date' as TimePeriod, title: 'Month to Date' },
  ]
  return (
    <div className="flex items-center gap-2 my-4">
      {periods.map(period => (
        <button
          key={period.id}
          onClick={() => onPeriodChange(period.id)}
          className={`px-5 py-2 rounded-full font-medium border transition-colors duration-150 focus:outline-none ${
            selectedPeriod === period.id
              ? 'bg-blue-600 text-white border-blue-600 shadow'
              : 'bg-white text-gray-700 border-gray-300 hover:bg-blue-50'
          }`}
        >
          {period.title}
        </button>
      ))}
    </div>
  )
} 