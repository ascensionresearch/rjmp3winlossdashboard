import { supabase } from './supabase'
import { Meeting, Contact, Company, Deal, EmployeeMetrics, TimePeriod } from '@/types/database'
import { startOfYear, startOfMonth, parseISO, differenceInDays } from 'date-fns'

export async function getP3Meetings(timePeriod: TimePeriod = 'all_time'): Promise<Meeting[]> {
  let query = supabase
    .from('Meetings')
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

  console.log(`Looking for ${contactIds.size} unique contact IDs`)
  console.log(`Sample contact IDs: ${Array.from(contactIds).slice(0, 5).join(', ')}`)

  if (contactIds.size === 0) return []

  // Process contacts in batches to avoid URL length limits
  const contactIdsArray = Array.from(contactIds)
  const batchSize = 100 // Supabase has limits on URL length
  const allContacts: Contact[] = []

  for (let i = 0; i < contactIdsArray.length; i += batchSize) {
    const batch = contactIdsArray.slice(i, i + batchSize)
    
    console.log(`Fetching contacts batch ${i / batchSize + 1}: ${batch.length} IDs`)
    
    console.log(`Querying Contacts table with IDs: ${batch.slice(0, 3).join(', ')}...`)
    
    const { data, error } = await supabase
      .from('Contacts')
      .select('*')
      .in('whalesync_postgres_id', batch)

    if (error) {
      console.error(`Error fetching contacts batch ${i / batchSize + 1}:`, error)
      console.error('Error details:', JSON.stringify(error, null, 2))
      continue
    }

    if (data) {
      console.log(`Batch ${i / batchSize + 1} returned ${data.length} contacts`)
      allContacts.push(...data)
    } else {
      console.log(`Batch ${i / batchSize + 1} returned no data`)
    }
  }

  console.log(`Total contacts found: ${allContacts.length}`)
  return allContacts
}

export async function getCompaniesFromContacts(contacts: Contact[]): Promise<Company[]> {
  const companyUuids = new Set<string>()
  contacts.forEach(contact => {
    if (contact.companies) {
      companyUuids.add(contact.companies)
    }
    // Optionally, also check Companies_fk_Companies if you want to support multiple companies per contact
    if (contact.Companies_fk_Companies) {
      contact.Companies_fk_Companies.forEach(companyId => companyUuids.add(companyId))
    }
  })
  if (companyUuids.size === 0) return []
  const { data, error } = await supabase
    .from('Companies')
    .select('*')
    .in('companies', Array.from(companyUuids))
  if (error) {
    console.error('Error fetching companies:', error)
    return []
  }
  return data || []
}

export async function getDealsFromCompanies(companies: Company[]): Promise<Deal[]> {
  const companyUuids = companies.map(company => company.companies).filter(Boolean)
  if (companyUuids.length === 0) return []
  const { data, error } = await supabase
    .from('Deals')
    .select('whalesync_postgres_id, companies, deal_stage, annual_contract_value, amount, deal_type, create_date, deal_name')
    .in('whalesync_postgres_id', companyUuids)
    .in('deal_type', ['Monthly Service', 'Recurring Special Service'])
  if (error) {
    console.error('Error fetching deals:', error)
    return []
  }
  if (data) {
    console.log('Fetched deals:', data)
  }
  return data || []
}

export async function getEmployeeMetrics(timePeriod: TimePeriod = 'all_time'): Promise<EmployeeMetrics[]> {
  // Get P3 meetings
  const meetings = await getP3Meetings(timePeriod)
  console.log(`Found ${meetings.length} P3 meetings`)

  // 1. Collect all unique contact UUIDs from meetings
  const contactIds = new Set<string>()
  meetings.forEach(meeting => {
    if (meeting.Contacts_fk_Contacts) {
      meeting.Contacts_fk_Contacts.forEach(id => contactIds.add(id))
    }
  })
  const contactIdsArray = Array.from(contactIds)

  // 2. Batch fetch all contacts
  let contacts: Contact[] = []
  const batchSize = 100
  for (let i = 0; i < contactIdsArray.length; i += batchSize) {
    const batch = contactIdsArray.slice(i, i + batchSize)
    const { data, error } = await supabase
      .from('Contacts')
      .select('whalesync_postgres_id, companies')
      .in('whalesync_postgres_id', batch)
    if (error) continue
    if (data) contacts.push(...data)
  }
  const contactMap = new Map(contacts.map(c => [c.whalesync_postgres_id, c]))

  // 3. Collect all unique company UUIDs from contacts
  const companyIds = new Set<string>()
  contacts.forEach(contact => {
    if (contact.companies) companyIds.add(contact.companies)
  })
  const companyIdsArray = Array.from(companyIds)

  // 4. Batch fetch all companies
  let companies: Company[] = []
  for (let i = 0; i < companyIdsArray.length; i += batchSize) {
    const batch = companyIdsArray.slice(i, i + batchSize)
    const { data, error } = await supabase
      .from('Companies')
      .select('whalesync_postgres_id, deals, Companies_fk_Companies')
      .in('whalesync_postgres_id', batch)
    if (error) continue
    if (data) companies.push(...data)
  }
  const companyMap = new Map(companies.map(c => [c.whalesync_postgres_id, c]))

  // 5. Collect all unique deal UUIDs from companies and related companies
  const dealIds = new Set<string>()
  for (const company of companies) {
    if (company.deals) dealIds.add(company.deals)
    if (company.Companies_fk_Companies && Array.isArray(company.Companies_fk_Companies)) {
      for (const relatedCompanyId of company.Companies_fk_Companies) {
        const relatedCompany = companyMap.get(relatedCompanyId)
        if (relatedCompany && relatedCompany.deals) dealIds.add(relatedCompany.deals)
      }
    }
  }
  const dealIdsArray = Array.from(dealIds)

  // 6. Batch fetch all deals
  let deals: Deal[] = []
  for (let i = 0; i < dealIdsArray.length; i += batchSize) {
    const batch = dealIdsArray.slice(i, i + batchSize)
    const { data, error } = await supabase
      .from('Deals')
      .select('whalesync_postgres_id, companies, deal_stage, annual_contract_value, amount, deal_type, create_date, deal_name')
      .in('whalesync_postgres_id', batch)
    if (error) continue
    if (data) deals.push(...data)
  }
  const dealMap = new Map(deals.map(d => [d.whalesync_postgres_id, d]))

  // 7. Map everything in-memory to aggregate per employee
  const employeeMetricsMap = new Map<string, EmployeeMetrics>()
  const now = new Date()
  // Track all counted deals globally to dedupe by UUID
  const countedDealIds = new Set<string>()

  for (const meeting of meetings) {
    const assignee = meeting.activity_assigned_to || 'Unassigned'
    if (!employeeMetricsMap.has(assignee)) {
      employeeMetricsMap.set(assignee, {
        employee_name: assignee,
        meeting_count: 0,
        deals_won_count: 0,
        deals_won_amount: 0,
        deals_lost_count: 0,
        deals_lost_amount: 0,
        deals_in_play_under_150_count: 0,
        deals_in_play_under_150_amount: 0,
        deals_overdue_150_plus_count: 0,
        deals_overdue_150_plus_amount: 0,
        deals_in_play_under_150_names: [],
        deals_overdue_150_plus_names: [],
      })
    }
    employeeMetricsMap.get(assignee)!.meeting_count++

    if (meeting.Contacts_fk_Contacts && meeting.Contacts_fk_Contacts.length > 0) {
      for (const contactId of meeting.Contacts_fk_Contacts) {
        const contact = contactMap.get(contactId)
        if (!contact || !contact.companies) continue
        const company = companyMap.get(contact.companies)
        if (!company) continue
        // Gather all deal UUIDs for this company and related companies
        const allDealIds: string[] = []
        if (company.deals) allDealIds.push(company.deals)
        if (company.Companies_fk_Companies && Array.isArray(company.Companies_fk_Companies)) {
          for (const relatedCompanyId of company.Companies_fk_Companies) {
            const relatedCompany = companyMap.get(relatedCompanyId)
            if (relatedCompany && relatedCompany.deals) allDealIds.push(relatedCompany.deals)
          }
        }
        for (const dealId of allDealIds) {
          if (!dealId || countedDealIds.has(dealId)) continue // Dedupe globally
          countedDealIds.add(dealId)
          const deal = dealMap.get(dealId)
          if (!deal) continue
          // Only include valid deal types
          const validDealTypes = ['Monthly Service', 'Recurring Special Service']
          if (!deal.deal_type || !validDealTypes.some(type => type.toLowerCase() === (deal.deal_type?.toLowerCase() ?? ''))) continue
          // Calculate deal amount
          const isAnnualized = timePeriod === 'all_time' || timePeriod === 'year_to_date'
          const dealValue = isAnnualized ? (deal.amount ?? 0) * 12 : (deal.amount ?? 0)
          // Use dealValue in all aggregations for won, lost, in play, and overdue
          const metrics = employeeMetricsMap.get(assignee)!
          if (deal.deal_stage === 'Closed Won') {
            metrics.deals_won_count++
            metrics.deals_won_amount += dealValue
          } else if (deal.deal_stage === 'Closed Lost') {
            metrics.deals_lost_count++
            metrics.deals_lost_amount += dealValue
          } else {
            if (deal.create_date) {
              const daysSinceCreation = differenceInDays(now, parseISO(deal.create_date))
              if (daysSinceCreation < 150) {
                metrics.deals_in_play_under_150_count++
                metrics.deals_in_play_under_150_amount += dealValue
                if (deal.deal_name) metrics.deals_in_play_under_150_names.push(deal.deal_name)
              } else {
                metrics.deals_overdue_150_plus_count++
                metrics.deals_overdue_150_plus_amount += dealValue
                if (deal.deal_name) metrics.deals_overdue_150_plus_names.push(deal.deal_name)
              }
            }
          }
        }
      }
    }
  }

  return Array.from(employeeMetricsMap.values())
} 