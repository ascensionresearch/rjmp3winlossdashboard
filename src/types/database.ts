export interface Meeting {
  id: string
  meeting_outcome?: string
  call_and_meeting_type?: string
  Contacts_fk_Contacts?: string[] // Array of contact UUIDs
  employee_name?: string
  create_date?: string
  // Add other meeting fields as needed
}

export interface Contact {
  id: string
  company_uuid?: string
  // Add other contact fields as needed
}

export interface Company {
  id: string
  uuid: string
  // Add other company fields as needed
}

export interface Deal {
  id: string
  deal_type?: string
  deal_status?: string
  amount?: number
  create_date?: string
  company_uuid?: string
  // Add other deal fields as needed
}

export interface EmployeeMetrics {
  employee_name: string
  meeting_count: number
  deals_won_count: number
  deals_won_amount: number
  deals_lost_count: number
  deals_lost_amount: number
  deals_in_play_under_150_count: number
  deals_in_play_under_150_amount: number
  deals_overdue_150_plus_count: number
  deals_overdue_150_plus_amount: number
}

export type TimePeriod = 'all_time' | 'year_to_date' | 'month_to_date' 