import { supabase } from './supabase'
import { Meeting, Contact, Company, Deal, EmployeeMetrics, TimePeriod } from '@/types/database'
import { startOfYear, startOfMonth, parseISO, differenceInDays } from 'date-fns'

export async function getP3Meetings(timePeriod: TimePeriod = 'all_time'): Promise<Meeting[]> {
  let query = supabase
    .from('meetings')
    .select('*')
    .or('meeting_outcome.eq.P3 - Proposal,and(call_and_meeting_type.eq.P3 - Proposal,meeting_outcome.eq.Completed)')

  // Apply time filtering
  if (timePeriod !== 'all_time') {
    const now = new Date()
    let startDate: Date

    if (timePeriod === 'year_to_date') {
      startDate = startOfYear(now)
    } else {
      startDate = startOfMonth(now)
    }

    query = query.gte('create_date', startDate.toISOString())
  }

  const { data, error } = await query

  if (error) {
    console.error('Error fetching P3 meetings:', error)
    return []
  }

  return data || []
}

export async function getContactsFromMeetings(meetings: Meeting[]): Promise<Contact[]> {
  const contactIds = new Set<string>()
  
  meetings.forEach(meeting => {
    if (meeting.Contacts_fk_Contacts) {
      meeting.Contacts_fk_Contacts.forEach(contactId => {
        contactIds.add(contactId)
      })
    }
  })

  if (contactIds.size === 0) return []

  const { data, error } = await supabase
    .from('contacts')
    .select('*')
    .in('id', Array.from(contactIds))

  if (error) {
    console.error('Error fetching contacts:', error)
    return []
  }

  return data || []
}

export async function getCompaniesFromContacts(contacts: Contact[]): Promise<Company[]> {
  const companyUuids = new Set<string>()
  
  contacts.forEach(contact => {
    if (contact.company_uuid) {
      companyUuids.add(contact.company_uuid)
    }
  })

  if (companyUuids.size === 0) return []

  const { data, error } = await supabase
    .from('companies')
    .select('*')
    .in('uuid', Array.from(companyUuids))

  if (error) {
    console.error('Error fetching companies:', error)
    return []
  }

  return data || []
}

export async function getDealsFromCompanies(companies: Company[]): Promise<Deal[]> {
  const companyUuids = companies.map(company => company.uuid)

  if (companyUuids.length === 0) return []

  const { data, error } = await supabase
    .from('deals')
    .select('*')
    .in('company_uuid', companyUuids)
    .in('deal_type', ['Monthly Service', 'Recurring Special Service'])

  if (error) {
    console.error('Error fetching deals:', error)
    return []
  }

  return data || []
}

export async function getEmployeeMetrics(timePeriod: TimePeriod = 'all_time'): Promise<EmployeeMetrics[]> {
  // Get P3 meetings
  const meetings = await getP3Meetings(timePeriod)
  
  // Get related contacts, companies, and deals
  const contacts = await getContactsFromMeetings(meetings)
  const companies = await getCompaniesFromContacts(contacts)
  const deals = await getDealsFromCompanies(companies)

  // Create a map of company UUIDs to employee names from meetings
  const companyToEmployeeMap = new Map<string, Set<string>>()
  
  meetings.forEach(meeting => {
    if (meeting.employee_name && meeting.Contacts_fk_Contacts) {
      meeting.Contacts_fk_Contacts.forEach(contactId => {
        const contact = contacts.find(c => c.id === contactId)
        if (contact?.company_uuid) {
          if (!companyToEmployeeMap.has(contact.company_uuid)) {
            companyToEmployeeMap.set(contact.company_uuid, new Set())
          }
          companyToEmployeeMap.get(contact.company_uuid)!.add(meeting.employee_name!)
        }
      })
    }
  })

  // Group meetings by employee
  const employeeMetricsMap = new Map<string, EmployeeMetrics>()

  meetings.forEach(meeting => {
    if (meeting.employee_name) {
      if (!employeeMetricsMap.has(meeting.employee_name)) {
        employeeMetricsMap.set(meeting.employee_name, {
          employee_name: meeting.employee_name,
          meeting_count: 0,
          deals_won_count: 0,
          deals_won_amount: 0,
          deals_lost_count: 0,
          deals_lost_amount: 0,
          deals_in_play_under_150_count: 0,
          deals_in_play_under_150_amount: 0,
          deals_overdue_150_plus_count: 0,
          deals_overdue_150_plus_amount: 0,
        })
      }
      employeeMetricsMap.get(meeting.employee_name)!.meeting_count++
    }
  })

  // Process deals and assign to employees
  const now = new Date()
  
  deals.forEach(deal => {
    if (deal.company_uuid && companyToEmployeeMap.has(deal.company_uuid)) {
      const employeeNames = companyToEmployeeMap.get(deal.company_uuid)!
      
      employeeNames.forEach(employeeName => {
        const metrics = employeeMetricsMap.get(employeeName)
        if (!metrics) return

        const amount = deal.amount || 0
        const annualizedAmount = timePeriod === 'month_to_date' ? amount : amount * 12

        if (deal.deal_status === 'Closed Won') {
          metrics.deals_won_count++
          metrics.deals_won_amount += annualizedAmount
        } else if (deal.deal_status === 'Closed Lost') {
          metrics.deals_lost_count++
          metrics.deals_lost_amount += annualizedAmount
        } else {
          // Deal is in play, check days since creation
          if (deal.create_date) {
            const daysSinceCreation = differenceInDays(now, parseISO(deal.create_date))
            
            if (daysSinceCreation < 150) {
              metrics.deals_in_play_under_150_count++
              metrics.deals_in_play_under_150_amount += annualizedAmount
            } else {
              metrics.deals_overdue_150_plus_count++
              metrics.deals_overdue_150_plus_amount += annualizedAmount
            }
          }
        }
      })
    }
  })

  return Array.from(employeeMetricsMap.values())
} 