import { supabase } from './supabase'
import { Meeting, Contact, Company, Deal, EmployeeMetrics, TimePeriod } from '@/types/database'
import { startOfYear, startOfMonth, parseISO, differenceInDays } from 'date-fns'

// Retry mechanism for temporary connectivity issues
async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  baseDelay: number = 1000
): Promise<T> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn()
    } catch (error) {
      if (attempt === maxRetries) {
        throw error
      }
      
      const delay = baseDelay * Math.pow(2, attempt)
      console.log(`Attempt ${attempt + 1} failed, retrying in ${delay}ms...`)
      await new Promise(resolve => setTimeout(resolve, delay))
    }
  }
  throw new Error('Max retries exceeded')
}

export async function getP3Meetings(timePeriod: TimePeriod = 'all_time'): Promise<Meeting[]> {
  console.log(`Fetching P3 meetings for time period: ${timePeriod}`)
  
  return retryWithBackoff(async () => {
    // First, let's get all meetings to see what we have
    let allMeetingsQuery = supabase
      .from('Meetings')
      .select('*')
      .limit(100)

    console.log('First, checking all meetings...')
    const { data: allMeetings, error: allError } = await allMeetingsQuery

    if (allError) {
      console.error('Error fetching all meetings:', allError)
      throw allError
    }

    console.log(`Found ${allMeetings?.length || 0} total meetings`)
    
    // Log some sample meetings to see their structure
    if (allMeetings && allMeetings.length > 0) {
      console.log('Sample meetings:')
      allMeetings.slice(0, 3).forEach((meeting, index) => {
        console.log(`  Meeting ${index + 1}:`, meeting)
      })
    }

    // Now try the P3 query
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
      console.log(`Applied time filter: >= ${startDate.toISOString()}`)
    }

    console.log('Executing P3 meetings query...')
    const { data, error } = await query

    if (error) {
      console.error('Error fetching P3 meetings:', error)
      console.error('Error details:', JSON.stringify(error, null, 2))
      throw error // Throw to trigger retry
    }

    console.log(`Successfully fetched ${data?.length || 0} P3 meetings`)
    
    // If no P3 meetings found, let's try a broader search
    if (!data || data.length === 0) {
      console.log('No P3 meetings found, trying broader search...')
      
      // Try searching for any meeting with "P3" in the name
      const { data: broaderData, error: broaderError } = await supabase
        .from('Meetings')
        .select('*')
        .or('meeting_outcome.ilike.%P3%,call_and_meeting_type.ilike.%P3%')
        .limit(50)

      if (broaderError) {
        console.error('Broader search error:', broaderError)
      } else {
        console.log(`Broader search found ${broaderData?.length || 0} meetings with "P3"`)
        if (broaderData && broaderData.length > 0) {
          console.log('Sample broader results:')
          broaderData.slice(0, 3).forEach((meeting, index) => {
            console.log(`  Meeting ${index + 1}:`, meeting)
          })
        }
      }
    }

    return data || []
  })
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

  // 1. Collect all unique contact UUIDs from meetings (for fallback)
  const contactIds = new Set<string>()
  meetings.forEach(meeting => {
    if (meeting.Contacts_fk_Contacts) {
      meeting.Contacts_fk_Contacts.forEach(id => contactIds.add(id))
    }
  })
  const contactIdsArray = Array.from(contactIds)

  // 2. Collect all unique company UUIDs from meetings (new direct company links)
  const directCompanyIds = new Set<string>()
  meetings.forEach(meeting => {
    if (meeting.Companies_fk_Companies) {
      meeting.Companies_fk_Companies.forEach(id => directCompanyIds.add(id))
    }
  })

  // 3. Collect all unique deal UUIDs from meetings (new direct deal links)
  const directDealIds = new Set<string>()
  meetings.forEach(meeting => {
    if (meeting.Deals_fk_Deals) {
      meeting.Deals_fk_Deals.forEach(id => directDealIds.add(id))
    }
  })

  // 4. Batch fetch all contacts (for fallback)
  const contacts: Contact[] = []
  if (contactIdsArray.length > 0) {
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
  }
  const contactMap = new Map(contacts.map(c => [c.whalesync_postgres_id, c]))

  // 5. Collect all unique company UUIDs from contacts (for fallback)
  const fallbackCompanyIds = new Set<string>()
  contacts.forEach(contact => {
    if (contact.companies) fallbackCompanyIds.add(contact.companies)
  })

  // 6. Combine all company UUIDs (direct + fallback)
  const allCompanyIds = new Set([...directCompanyIds, ...fallbackCompanyIds])
  const allCompanyIdsArray = Array.from(allCompanyIds)

  // 7. Batch fetch all companies
  const companies: Company[] = []
  if (allCompanyIdsArray.length > 0) {
    const batchSize = 100
    for (let i = 0; i < allCompanyIdsArray.length; i += batchSize) {
      const batch = allCompanyIdsArray.slice(i, i + batchSize)
      const { data, error } = await supabase
        .from('Companies')
        .select('whalesync_postgres_id, deals, Companies_fk_Companies')
        .in('whalesync_postgres_id', batch)
      if (error) continue
      if (data) companies.push(...data)
    }
  }
  const companyMap = new Map(companies.map(c => [c.whalesync_postgres_id, c]))

  // 8. Collect all unique deal UUIDs from companies and related companies (for fallback)
  const fallbackDealIds = new Set<string>()
  for (const company of companies) {
    if (company.deals) fallbackDealIds.add(company.deals)
    if (company.Companies_fk_Companies && Array.isArray(company.Companies_fk_Companies)) {
      for (const relatedCompanyId of company.Companies_fk_Companies) {
        const relatedCompany = companyMap.get(relatedCompanyId)
        if (relatedCompany && relatedCompany.deals) fallbackDealIds.add(relatedCompany.deals)
      }
    }
  }

  // 9. Combine all deal UUIDs (direct + fallback)
  const allDealIds = new Set([...directDealIds, ...fallbackDealIds])
  const allDealIdsArray = Array.from(allDealIds)

  // 10. Batch fetch all deals
  const deals: Deal[] = []
  if (allDealIdsArray.length > 0) {
    const batchSize = 100
    for (let i = 0; i < allDealIdsArray.length; i += batchSize) {
      const batch = allDealIdsArray.slice(i, i + batchSize)
      const { data, error } = await supabase
        .from('Deals')
        .select('whalesync_postgres_id, companies, deal_stage, annual_contract_value, amount, deal_type, create_date, deal_name')
        .in('whalesync_postgres_id', batch)
      if (error) continue
      if (data) deals.push(...data)
    }
  }
  const dealMap = new Map(deals.map(d => [d.whalesync_postgres_id, d]))

  // 11. Map everything in-memory to aggregate per employee
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

    // Priority 1: Direct deals from Deals_fk_Deals
    if (meeting.Deals_fk_Deals && meeting.Deals_fk_Deals.length > 0) {
      console.log(`Meeting ${meeting.id}: Using Priority 1 - Direct deals (${meeting.Deals_fk_Deals.length} deals)`)
      for (const dealId of meeting.Deals_fk_Deals) {
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
    // Priority 2: Companies from Companies_fk_Companies, then deals from those companies
    else if (meeting.Companies_fk_Companies && meeting.Companies_fk_Companies.length > 0) {
      console.log(`Meeting ${meeting.id}: Using Priority 2 - Company-linked deals (${meeting.Companies_fk_Companies.length} companies)`)
      for (const companyId of meeting.Companies_fk_Companies) {
        const company = companyMap.get(companyId)
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
    // Priority 3: Fallback to existing contacts > companies > deals process
    else if (meeting.Contacts_fk_Contacts && meeting.Contacts_fk_Contacts.length > 0) {
      console.log(`Meeting ${meeting.id}: Using Priority 3 - Contact-linked deals (${meeting.Contacts_fk_Contacts.length} contacts)`)
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
    } else {
      console.log(`Meeting ${meeting.id}: No deals found (no contacts, companies, or direct deals)`)
    }
  }

  return Array.from(employeeMetricsMap.values())
} 