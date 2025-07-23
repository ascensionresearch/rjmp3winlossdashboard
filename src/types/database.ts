export interface Meeting {
  id: string
  meeting_outcome?: string
  call_and_meeting_type?: string
  Contacts_fk_Contacts?: string[] // Array of contact UUIDs
  Companies_fk_Companies?: string[] // Array of company UUIDs
  Deals_fk_Deals?: string[] // Array of deal UUIDs
  activity_assigned_to?: string
  create_date?: string
  // Add other meeting fields as needed
}

export interface Contact {
  whalesync_postgres_id: string
  companies?: string
  Companies_fk_Companies?: string[]
  // Add other contact fields as needed
}

export interface Company {
  whalesync_postgres_id: string
  companies?: string // This is the company UUID used for linking
  deals?: string // Deal UUID for this company
  Companies_fk_Companies?: string[] // Related company UUIDs
  // Add other company fields as needed
}

export interface Deal {
  whalesync_postgres_id: string
  companies: string
  deal_type?: string
  deal_stage?: string
  amount?: number
  create_date?: string
  deal_name?: string
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
  deals_in_play_under_150_names: string[]
  deals_overdue_150_plus_names: string[]
}

export type TimePeriod = 'all_time' | 'year_to_date' | 'month_to_date' 