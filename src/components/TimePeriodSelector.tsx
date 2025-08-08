'use client'

import { TimePeriod } from '@/types/database'

interface TimePeriodSelectorProps {
  selectedPeriod: TimePeriod
  onPeriodChange: (period: TimePeriod) => void
  selectedMonth: string
  onMonthChange: (month: string) => void
}

export default function TimePeriodSelector({ selectedPeriod, onPeriodChange, selectedMonth, onMonthChange }: TimePeriodSelectorProps) {
  const periods = [
    { id: 'all_time' as TimePeriod, title: 'All Time' },
    { id: 'year_to_date' as TimePeriod, title: 'Year to Date' },
    { id: 'month_to_date' as TimePeriod, title: 'Specific Month' },
  ]
  return (
    <div className="flex items-center gap-3 my-4">
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
      {selectedPeriod === 'month_to_date' && (
        <input
          type="month"
          value={selectedMonth}
          onChange={(e) => onMonthChange(e.target.value)}
          className="border border-gray-300 rounded px-3 py-2 text-sm"
        />
      )}
    </div>
  )
} 