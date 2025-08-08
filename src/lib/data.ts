import { supabase } from './supabase'
import { Meeting, Contact, Company, Deal, EmployeeMetrics, TimePeriod, DealTooltipItem } from '@/types/database'
import { startOfYear, startOfMonth, parseISO, differenceInDays, addMonths, parse } from 'date-fns'

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

export async function getP3Meetings(timePeriod: TimePeriod = 'all_time', selectedMonth?: string): Promise<Meeting[]> {
  console.log(`Fetching P3 meetings for time period: ${timePeriod}`)
  
  return retryWithBackoff(async () => {
    // First, let's get all meetings to see what we have
    const allMeetingsQuery = supabase
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

    // Now try the P3 query - simplified to just check call_and_meeting_type
    let query = supabase
      .from('Meetings')
      .select('*')
      .eq('call_and_meeting_type', 'P3 - Proposal')

    // Apply time filtering
    if (timePeriod !== 'all_time') {
      const now = new Date()
      let startDate: Date
      let endDateExclusive: Date | null = null

      if (timePeriod === 'year_to_date') {
        startDate = startOfYear(now)
      } else {
        if (selectedMonth) {
          // selectedMonth is in 'YYYY-MM'
          const parsed = parse(selectedMonth, 'yyyy-MM', now)
          startDate = startOfMonth(parsed)
          endDateExclusive = addMonths(startDate, 1)
        } else {
          startDate = startOfMonth(now)
        }
      }

      query = query.gte('create_date', startDate.toISOString())
      if (endDateExclusive) {
        query = query.lt('create_date', endDateExclusive.toISOString())
      }
      console.log(`Applied time filter: >= ${startDate.toISOString()}`)
      if (endDateExclusive) console.log(`Applied time filter: < ${endDateExclusive.toISOString()}`)
    }

    console.log('Executing P3 meetings query...')
    const { data, error } = await query

    if (error) {
      console.error('Error fetching P3 meetings:', error)
      console.error('Error details:', JSON.stringify(error, null, 2))
      throw error // Throw to trigger retry
    }

    console.log(`Successfully fetched ${data?.length || 0} P3 meetings`)
    
    // Log P3 meetings found
    if (data && data.length > 0) {
      console.log(`Found ${data.length} P3 meetings`)
      console.log('Sample P3 meetings:')
      data.slice(0, 3).forEach((meeting, index) => {
        console.log(`  P3 Meeting ${index + 1}:`, {
          id: meeting.id,
          call_and_meeting_type: meeting.call_and_meeting_type,
          activity_assigned_to: meeting.activity_assigned_to,
          create_date: meeting.create_date
        })
      })
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

export async function getEmployeeMetrics(timePeriod: TimePeriod = 'all_time', selectedMonth?: string): Promise<EmployeeMetrics[]> {
  // Get P3 meetings
  const meetings = await getP3Meetings(timePeriod, selectedMonth)
  console.log(`Found ${meetings.length} P3 meetings`)

  // Collect all unique company UUIDs from meetings (direct company links only)
  const directCompanyIds = new Set<string>()
  meetings.forEach(meeting => {
    if (meeting.Companies_fk_Companies) {
      meeting.Companies_fk_Companies.forEach(id => directCompanyIds.add(id))
    }
  })

  // Collect all unique deal UUIDs from meetings (direct deal links)
  const directDealIds = new Set<string>()
  meetings.forEach(meeting => {
    if (meeting.Deals_fk_Deals) {
      meeting.Deals_fk_Deals.forEach(id => directDealIds.add(id))
    }
  })
  // Combine all company UUIDs (direct only)
  const allCompanyIds = new Set([...directCompanyIds])
  const allCompanyIdsArray = Array.from(allCompanyIds)

  // 7. Batch fetch all companies
  const companies: Company[] = []
  if (allCompanyIdsArray.length > 0) {
    const batchSize = 100
    for (let i = 0; i < allCompanyIdsArray.length; i += batchSize) {
      const batch = allCompanyIdsArray.slice(i, i + batchSize)
      const { data, error } = await supabase
        .from('Companies')
        .select('whalesync_postgres_id, Companies_fk_Companies, company_name')
        .in('whalesync_postgres_id', batch)
      if (error) continue
      if (data) companies.push(...data)
    }
  }
  const companyMap = new Map(companies.map(c => [c.whalesync_postgres_id, c]))

  // 8. Use only the meeting's direct company IDs for deal lookup (no related-company expansion)
  const companyIdsWithRelationsArray = Array.from(allCompanyIds)

  // 9. Fetch deals by direct deal IDs and by company IDs (qualifying deal types only)
  const deals: Deal[] = []
  const normalize = (s?: string) => (s ?? '').toString().trim().toLowerCase()
  const validDealTypeSet = new Set(['monthly service', 'recurring special service'])
  const isValidDealType = (t?: string) => validDealTypeSet.has(normalize(t))

  // 9a. Direct deals by ID (from meetings)
  if (directDealIds.size > 0) {
    const dealIdsArray = Array.from(directDealIds)
    const batchSize = 100
    for (let i = 0; i < dealIdsArray.length; i += batchSize) {
      const batch = dealIdsArray.slice(i, i + batchSize)
      const { data, error } = await supabase
        .from('Deals')
        .select('whalesync_postgres_id, companies, deal_stage, amount, deal_type, create_date, deal_name')
        .in('whalesync_postgres_id', batch)
      if (!error && data) deals.push(...data)
    }
  }

  // 9b. Deals by company linkage (includes related companies)
  if (companyIdsWithRelationsArray.length > 0) {
    const batchSize = 100
    for (let i = 0; i < companyIdsWithRelationsArray.length; i += batchSize) {
      const batch = companyIdsWithRelationsArray.slice(i, i + batchSize)
      // Overlap on array column
       const { data: overlapData, error: overlapError } = await supabase
        .from('Deals')
        .select('whalesync_postgres_id, Companies_fk_Companies, Contacts_fk_Contacts, companies, deal_stage, amount, deal_type, create_date, deal_name')
        .overlaps('Companies_fk_Companies', batch)
       if (!overlapError && overlapData) deals.push(...(overlapData as Deal[]))
      // Scalar companies column (fallback)
       const { data: scalarData, error: scalarError } = await supabase
        .from('Deals')
        .select('whalesync_postgres_id, Companies_fk_Companies, Contacts_fk_Contacts, companies, deal_stage, amount, deal_type, create_date, deal_name')
        .in('companies', batch)
       if (!scalarError && scalarData) deals.push(...(scalarData as Deal[]))
    }
  }

  // (Removed) Deals by contact linkage per updated requirements

  // 10. Build deal maps
  const dealMap = new Map(deals.map(d => [d.whalesync_postgres_id, d]))
  const dealsByCompanyId = new Map<string, string[]>()
  for (const deal of dealMap.values()) {
    if (Array.isArray(deal.Companies_fk_Companies)) {
      for (const cid of deal.Companies_fk_Companies) {
        if (!dealsByCompanyId.has(cid)) dealsByCompanyId.set(cid, [])
        dealsByCompanyId.get(cid)!.push(deal.whalesync_postgres_id)
      }
    }
  }

  // DEBUG: List companies that have multiple qualifying monthly deals
  try {
    console.log('\n=== MULTIPLE MONTHLY DEALS BY COMPANY (QUALIFYING TYPES) ===')
    let multiCount = 0
    for (const [companyId, dealIds] of dealsByCompanyId.entries()) {
      const uniqueIds = Array.from(new Set(dealIds))
      const qualifyingDeals = uniqueIds
        .map(id => dealMap.get(id))
        .filter(d => d && isValidDealType(d.deal_type)) as typeof deals
      if (qualifyingDeals.length > 1) {
        multiCount++
        const company = companyMap.get(companyId)
         const companyName = (company as Company | undefined)?.company_name || companyId
        console.log(`\nCompany: ${companyName} (${companyId}) - ${qualifyingDeals.length} monthly deals`)
        for (const d of qualifyingDeals) {
          console.log(`  - ${d.whalesync_postgres_id}: name='${d.deal_name || ''}', type='${d.deal_type || ''}', stage='${d.deal_stage || ''}', create_date='${d.create_date || ''}', amount='${d.amount ?? ''}'`)
        }
      }
    }
    if (multiCount === 0) {
      console.log('No companies with multiple qualifying monthly deals found in this dataset.')
    }
    console.log('=== END MULTIPLE MONTHLY DEALS DEBUG ===\n')
  } catch (e) {
    console.log('Multiple-monthly-deals debug failed:', e)
  }

  // 11. Map everything in-memory to aggregate per employee
  const employeeMetricsMap = new Map<string, EmployeeMetrics>()
  const now = new Date()
  // Track all counted deals globally to dedupe by UUID
  const countedDealIds = new Set<string>()
  // Track deals included per employee (for debug deltas)
  const employeeIncludedDeals = new Map<string, Set<string>>()
  // Track meetings per employee (for debug old-logic reconstruction)
  const employeeMeetings = new Map<string, Meeting[]>()
  
  // DEBUG: Track meetings that don't result in deals
  const meetingsWithoutDeals = new Map<string, Array<{
    meetingId: string,
    meetingDate: string,
    reason: string,
    contacts: string[],
    companies: string[],
    companyNames: string[],
    directDeals: string[]
  }>>()

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
        deals_in_play_under_150_details: [],
        deals_overdue_150_plus_details: [],
        deals_won_names: [],
        deals_lost_names: [],
      })
    }
    employeeMetricsMap.get(assignee)!.meeting_count++
    if (!employeeMeetings.has(assignee)) employeeMeetings.set(assignee, [])
    employeeMeetings.get(assignee)!.push(meeting)

    let meetingResultedInDeal = false
    const dealsFound: string[] = []
    const metrics = employeeMetricsMap.get(assignee)!

    // Process deals linked directly to the meeting (Priority 1)
    if (meeting.Deals_fk_Deals && meeting.Deals_fk_Deals.length > 0) {
       console.log(`Meeting ${meeting.id || (meeting as unknown as { whalesync_postgres_id?: string }).whalesync_postgres_id}: Using Priority 1 - Direct deals (${meeting.Deals_fk_Deals.length} deals)`) 
      const meetingCompanies = new Set<string>(meeting.Companies_fk_Companies || [])
      let directIds = Array.from(new Set(meeting.Deals_fk_Deals))
      // If multiple direct deals, include only those associated to the meeting's companies
      if (directIds.length > 1 && meetingCompanies.size > 0) {
        directIds = directIds.filter(id => {
          const d = dealMap.get(id)
          if (!d) return false
          const matchesScalar = !!d.companies && meetingCompanies.has(d.companies)
          const matchesArray = Array.isArray(d.Companies_fk_Companies) && d.Companies_fk_Companies.some(cid => meetingCompanies.has(cid))
          return matchesScalar || matchesArray
        })
      }
      for (const dealId of directIds) {
        if (!dealId) continue
        const deal = dealMap.get(dealId)
        if (!deal) continue
        if (!isValidDealType(deal.deal_type)) continue
        meetingResultedInDeal = true
        dealsFound.push(dealId)
        if (countedDealIds.has(dealId)) continue
        countedDealIds.add(dealId)
        if (!employeeIncludedDeals.has(assignee)) employeeIncludedDeals.set(assignee, new Set())
        employeeIncludedDeals.get(assignee)!.add(dealId)
        const isAnnualized = timePeriod === 'all_time' || timePeriod === 'year_to_date'
        const dealValue = isAnnualized ? (deal.amount ?? 0) * 12 : (deal.amount ?? 0)
        // Meeting-level category flags (ensures counts sum to meetings)
        if (deal.deal_stage === 'Closed Won') {
          metrics.deals_won_amount += dealValue
          metrics.deals_won_count++
          if (deal.deal_name) metrics.deals_won_names.push(deal.deal_name)
        } else if (deal.deal_stage === 'Closed Lost') {
          metrics.deals_lost_amount += dealValue
          metrics.deals_lost_count++
          if (deal.deal_name) metrics.deals_lost_names.push(deal.deal_name)
        } else if (deal.create_date) {
          const daysSinceCreation = differenceInDays(now, parseISO(deal.create_date))
          if (daysSinceCreation < 150) {
            metrics.deals_in_play_under_150_amount += dealValue
            metrics.deals_in_play_under_150_count++
            if (deal.deal_name) metrics.deals_in_play_under_150_names.push(deal.deal_name)
            if (deal.deal_name) (metrics.deals_in_play_under_150_details as DealTooltipItem[]).push({ name: deal.deal_name, stage: deal.deal_stage })
          } else {
            metrics.deals_overdue_150_plus_amount += dealValue
            metrics.deals_overdue_150_plus_count++
            if (deal.deal_name) metrics.deals_overdue_150_plus_names.push(deal.deal_name)
            if (deal.deal_name) (metrics.deals_overdue_150_plus_details as DealTooltipItem[]).push({ name: deal.deal_name, stage: deal.deal_stage })
          }
        }
      }
    }

    // Process company-linked deals (Priority 2)
    if (meeting.Companies_fk_Companies && meeting.Companies_fk_Companies.length > 0) {
         console.log(`Meeting ${meeting.id || (meeting as unknown as { whalesync_postgres_id?: string }).whalesync_postgres_id}: Using Priority 2 - Company-linked deals (${meeting.Companies_fk_Companies.length} companies)`) 
      for (const companyId of meeting.Companies_fk_Companies) {
        const allDealIds = new Set<string>()
        const pushDealsForCompany = (cid: string) => {
          const ids = dealsByCompanyId.get(cid)
          if (ids) ids.forEach(id => allDealIds.add(id))
        }
        pushDealsForCompany(companyId)
        // Do not expand to related companies per updated requirement
        for (const dealId of allDealIds) {
          if (!dealId) continue
          const deal = dealMap.get(dealId)
          if (!deal) continue
          if (!isValidDealType(deal.deal_type)) continue
          meetingResultedInDeal = true
          dealsFound.push(dealId)
          if (countedDealIds.has(dealId)) continue
          countedDealIds.add(dealId)
          if (!employeeIncludedDeals.has(assignee)) employeeIncludedDeals.set(assignee, new Set())
          employeeIncludedDeals.get(assignee)!.add(dealId)
          const isAnnualized = timePeriod === 'all_time' || timePeriod === 'year_to_date'
          const dealValue = isAnnualized ? (deal.amount ?? 0) * 12 : (deal.amount ?? 0)
          // Meeting-level category flags (ensures counts sum to meetings)
          if (deal.deal_stage === 'Closed Won') {
            metrics.deals_won_amount += dealValue
            metrics.deals_won_count++
            if (deal.deal_name) metrics.deals_won_names.push(deal.deal_name)
          } else if (deal.deal_stage === 'Closed Lost') {
            metrics.deals_lost_amount += dealValue
            metrics.deals_lost_count++
            if (deal.deal_name) metrics.deals_lost_names.push(deal.deal_name)
          } else if (deal.create_date) {
            const daysSinceCreation = differenceInDays(now, parseISO(deal.create_date))
            if (daysSinceCreation < 150) {
              metrics.deals_in_play_under_150_amount += dealValue
              metrics.deals_in_play_under_150_count++
              if (deal.deal_name) metrics.deals_in_play_under_150_names.push(deal.deal_name)
              if (deal.deal_name) (metrics.deals_in_play_under_150_details as DealTooltipItem[]).push({ name: deal.deal_name, stage: deal.deal_stage })
            } else {
              metrics.deals_overdue_150_plus_amount += dealValue
              metrics.deals_overdue_150_plus_count++
              if (deal.deal_name) metrics.deals_overdue_150_plus_names.push(deal.deal_name)
              if (deal.deal_name) (metrics.deals_overdue_150_plus_details as DealTooltipItem[]).push({ name: deal.deal_name, stage: deal.deal_stage })
            }
          }
        }
      }
    }

    // (Removed) Contact-linked deals per updated requirements

    // If nothing was found at all
    if (!meetingResultedInDeal) {
      console.log(`Meeting ${meeting.id || (meeting as Partial<Meeting> & { whalesync_postgres_id?: string }).whalesync_postgres_id}: No deals found (no qualifying direct/company/contact deals)`) 
    }

    // DEBUG: Print meeting and deal UUIDs per classification; especially helpful for MTD overdue cases
    try {
      const meetingDebugId = (meeting as Partial<Meeting> & { whalesync_postgres_id?: string }).id || (meeting as { whalesync_postgres_id?: string }).whalesync_postgres_id || 'Unknown'
      const uniqueDealIds = Array.from(new Set(dealsFound))
      console.log(`MEETING_CLASSIFY: employee='${assignee}' meeting_id='${meetingDebugId}' meeting_date='${meeting.create_date || ''}' deals=[${uniqueDealIds.join(', ')}]`)
      if ((timePeriod === 'month_to_date') && uniqueDealIds.length > 0) {
        console.log(`MEETING_CLASSIFY_MTD_DETAIL: employee='${assignee}' selected_month='${selectedMonth || ''}' meeting_id='${meetingDebugId}' deals=[${uniqueDealIds.join(', ')}]`)
      }
      if (uniqueDealIds.length > 0) { // Only log if there were deals found
        if (uniqueDealIds.some(id => dealMap.get(id)?.deal_stage === 'Closed Lost')) {
          console.log(`MEETING_CLASSIFY_LOST_DETAIL: employee='${assignee}' time_period='${timePeriod}' meeting_id='${meetingDebugId}' deals=[${uniqueDealIds.join(', ')}]`)
        } else if (uniqueDealIds.some(id => dealMap.get(id)?.deal_stage === 'Closed Won')) {
          console.log(`MEETING_CLASSIFY_WON_DETAIL: employee='${assignee}' time_period='${timePeriod}' meeting_id='${meetingDebugId}' deals=[${uniqueDealIds.join(', ')}]`)
        } else if (uniqueDealIds.some(id => dealMap.get(id)?.deal_stage === 'In Play')) {
          console.log(`MEETING_CLASSIFY_IN_PLAY_DETAIL: employee='${assignee}' time_period='${timePeriod}' meeting_id='${meetingDebugId}' deals=[${uniqueDealIds.join(', ')}]`)
        } else if (uniqueDealIds.some(id => dealMap.get(id)?.deal_stage === 'Overdue')) {
          console.log(`MEETING_CLASSIFY_OVERDUE_DETAIL: employee='${assignee}' time_period='${timePeriod}' meeting_id='${meetingDebugId}' deals=[${uniqueDealIds.join(', ')}]`)
        }
      }
    } catch {}

    // Track meetings that didn't result in deals
    if (!meetingResultedInDeal) {
      if (!meetingsWithoutDeals.has(assignee)) {
        meetingsWithoutDeals.set(assignee, [])
      }
      
      let reason = 'No deals found'
      if (meeting.Deals_fk_Deals && meeting.Deals_fk_Deals.length > 0) {
        const foundAny = (meeting.Deals_fk_Deals || []).some(id => dealMap.has(id))
        const foundValid = (meeting.Deals_fk_Deals || []).some(id => {
          const d = dealMap.get(id)
          return d && isValidDealType(d.deal_type)
        })
        if (!foundAny) {
          reason = 'Direct deals referenced but not found by ID in Deals table'
        } else if (!foundValid) {
          reason = 'Direct deals found but none are qualifying monthly/recurring special types'
        } else {
          reason = 'Direct deals found but were globally de-duplicated elsewhere'
        }
        // Extra debug listing
        console.log(`  Direct deals detail for meeting ${(meeting as Partial<Meeting> & { whalesync_postgres_id?: string }).id || (meeting as { whalesync_postgres_id?: string }).whalesync_postgres_id}:`)
        for (const id of meeting.Deals_fk_Deals) {
          const d = dealMap.get(id)
          const qualifies = d ? isValidDealType(d.deal_type) : false
          console.log(`    - ${id}: ${d ? `type='${d.deal_type}' name='${d.deal_name || ''}' qualifies=${qualifies}` : 'NOT FOUND'}`)
        }
      } else if (meeting.Companies_fk_Companies && meeting.Companies_fk_Companies.length > 0) {
        reason = 'Companies linked but no valid deals found'
      } else {
        reason = 'No contacts, companies, or direct deals linked'
      }
      
      // Get company names for this meeting
      const companyNames: string[] = []
      
      // Check direct company links
      if (meeting.Companies_fk_Companies) {
        for (const companyId of meeting.Companies_fk_Companies) {
          const company = companyMap.get(companyId)
          if (company) {
            // Use the correct field name 'company_name' from the Companies table
             const companyName = (company as Company | undefined)?.company_name || companyId
            companyNames.push(companyName)
          }
        }
      }
      
      // (Removed) company names derived through contacts per updated requirements
      
      meetingsWithoutDeals.get(assignee)!.push({
        meetingId: (meeting as Partial<Meeting> & { whalesync_postgres_id?: string }).id || (meeting as { whalesync_postgres_id?: string }).whalesync_postgres_id || 'Unknown',
        meetingDate: meeting.create_date || 'Unknown',
        reason,
        contacts: meeting.Contacts_fk_Contacts || [],
        companies: meeting.Companies_fk_Companies || [],
        companyNames,
        directDeals: meeting.Deals_fk_Deals || []
      })
    }
  }

  // DEBUG: Log meetings without deals for each employee
  console.log('\n=== MEETINGS WITHOUT DEALS DEBUG ===')
  for (const [employee, meetingsList] of meetingsWithoutDeals.entries()) {
    if (meetingsList.length > 0) {
      console.log(`\n${employee}: ${meetingsList.length} meetings without deals`)
      meetingsList.forEach((meeting, index) => {
        console.log(`  ${index + 1}. Meeting ID: ${meeting.meetingId}`)
        console.log(`     Date: ${meeting.meetingDate}`)
        console.log(`     Companies: ${meeting.companyNames.length > 0 ? meeting.companyNames.join(', ') : 'None'}`)
        console.log(`     Reason: ${meeting.reason}`)
        console.log(`     Contacts: ${meeting.contacts.length > 0 ? meeting.contacts.join(', ') : 'None'}`)
        console.log(`     Company UUIDs: ${meeting.companies.length > 0 ? meeting.companies.join(', ') : 'None'}`)
        console.log(`     Direct Deals: ${meeting.directDeals.length > 0 ? meeting.directDeals.join(', ') : 'None'}`)
      })
    }
  }
  
  // Summary statistics
  const totalMeetingsWithoutDeals = Array.from(meetingsWithoutDeals.values()).reduce((sum, meetings) => sum + meetings.length, 0)
  console.log(`\nTotal meetings without deals: ${totalMeetingsWithoutDeals} out of ${meetings.length} total P3 meetings`)
  console.log(`Conversion rate: ${((meetings.length - totalMeetingsWithoutDeals) / meetings.length * 100).toFixed(1)}%`)
  console.log('=== END DEBUG ===\n')

  // DEBUG: Identify deals removed for specific employees compared to old logic
  try {
    const targetEmployees = Array.from(employeeMeetings.keys()).filter(name => /rob/i.test(name))
    for (const emp of targetEmployees) {
      const meetingsForEmp = employeeMeetings.get(emp) || []
      const newIncluded = new Set(employeeIncludedDeals.get(emp) || [])

      // Old logic reconstruction candidates
      const oldCandidateIds = new Set<string>()
      const relatedCompanyIds = new Set<string>()
      const contactIds = new Set<string>()

      for (const m of meetingsForEmp) {
        // Direct deals (no company filter under old logic)
        if (m.Deals_fk_Deals) {
          for (const id of m.Deals_fk_Deals) {
            const d = dealMap.get(id)
            if (d && isValidDealType(d.deal_type)) oldCandidateIds.add(id)
          }
        }
        // Related companies expansion
        if (m.Companies_fk_Companies) {
          for (const cid of m.Companies_fk_Companies) {
            const comp = companyMap.get(cid)
            if (comp && Array.isArray(comp.Companies_fk_Companies)) {
              for (const rc of comp.Companies_fk_Companies) relatedCompanyIds.add(rc)
            }
          }
        }
        // Contacts path
        if ((m as Partial<Meeting>).Contacts_fk_Contacts && Array.isArray((m as Partial<Meeting>).Contacts_fk_Contacts)) {
          for (const pid of (m as Partial<Meeting>).Contacts_fk_Contacts!) contactIds.add(pid)
        }
      }

      // Fetch deals by related companies (batch)
      if (relatedCompanyIds.size > 0) {
        const rel = Array.from(relatedCompanyIds)
        const batchSize = 100
        for (let i = 0; i < rel.length; i += batchSize) {
          const batch = rel.slice(i, i + batchSize)
          const { data: overlapData } = await supabase
            .from('Deals')
            .select('whalesync_postgres_id, Companies_fk_Companies, companies, deal_type')
            .overlaps('Companies_fk_Companies', batch)
          const { data: scalarData } = await supabase
            .from('Deals')
            .select('whalesync_postgres_id, Companies_fk_Companies, companies, deal_type')
            .in('companies', batch)
           const combined = [
            ...((overlapData as Deal[]) || []),
            ...((scalarData as Deal[]) || []),
          ] as Deal[]
          for (const d of combined) {
            if (d && isValidDealType(d.deal_type)) oldCandidateIds.add(d.whalesync_postgres_id)
          }
        }
      }

      // Fetch deals by contacts (batch)
      if (contactIds.size > 0) {
        const p = Array.from(contactIds)
        const batchSize = 100
        for (let i = 0; i < p.length; i += batchSize) {
          const batch = p.slice(i, i + batchSize)
          const { data } = await supabase
            .from('Deals')
            .select('whalesync_postgres_id, Contacts_fk_Contacts, deal_type')
            .overlaps('Contacts_fk_Contacts', batch)
          for (const d of ((data as Deal[]) || []) as Deal[]) {
            if (d && isValidDealType(d.deal_type)) oldCandidateIds.add(d.whalesync_postgres_id)
          }
        }
      }

      // Removed = old - new
      const removed = Array.from(oldCandidateIds).filter(id => !newIncluded.has(id))
      if (removed.length > 0) {
        console.log(`\nREMOVED_DEALS_FOR_EMPLOYEE '${emp}': ${removed.length} deals`) 
        for (const id of removed) {
          const d = dealMap.get(id)
          console.log(`  - ${id}: name='${d?.deal_name || ''}', companies='${(d as Deal | undefined)?.companies || ''}', type='${d?.deal_type || ''}', stage='${d?.deal_stage || ''}', create_date='${d?.create_date || ''}', amount='${d?.amount ?? ''}'`)
        }
      } else {
        console.log(`\nREMOVED_DEALS_FOR_EMPLOYEE '${emp}': none`)
      }
    }
  } catch (e) {
    console.log('Delta debug failed:', e)
  }

  // 12. Compute deals owned by each employee whose companies have NO P3 meetings in the selected period
  try {
    // Build P3 company set (from meetings' direct company links only)
    const p3CompanySet = new Set<string>()
    for (const meeting of meetings) {
      if (meeting.Companies_fk_Companies) {
        for (const cid of meeting.Companies_fk_Companies) p3CompanySet.add(cid)
      }
    }

    const owners = Array.from(employeeMetricsMap.keys())
    if (owners.length > 0) {
      const ownerToNoP3Deals = new Map<string, { name: string; stage?: string; create_date?: string }[]>()

      // Time filter boundaries aligned with getP3Meetings
      const nowLocal = new Date()
      let startDateFilter: Date | undefined
      let endDateExclusiveFilter: Date | undefined
      if (timePeriod !== 'all_time') {
        if (timePeriod === 'year_to_date') {
          startDateFilter = startOfYear(nowLocal)
        } else {
          const base = selectedMonth ? parse(selectedMonth, 'yyyy-MM', nowLocal) : startOfMonth(nowLocal)
          startDateFilter = startOfMonth(base)
          endDateExclusiveFilter = addMonths(startDateFilter, 1)
        }
      }

      const batchSizeOwners = 50
      for (let i = 0; i < owners.length; i += batchSizeOwners) {
        const ownerBatch = owners.slice(i, i + batchSizeOwners)
        let query = supabase
          .from('Deals')
          .select('whalesync_postgres_id, deal_name, deal_owner, companies, Companies_fk_Companies, deal_type, deal_stage, create_date')
          .in('deal_owner', ownerBatch)
          .in('deal_type', ['Monthly Service', 'Recurring Special Service'])
        if (startDateFilter) query = query.gte('create_date', startDateFilter.toISOString())
        if (endDateExclusiveFilter) query = query.lt('create_date', endDateExclusiveFilter.toISOString())
        const { data, error } = await query
        if (error) continue
        for (const d of (data || []) as Deal[]) {
          const owner = d.deal_owner as string | undefined
          if (!owner) continue
          const companyIds = new Set<string>()
          if (d.companies) companyIds.add(d.companies)
          if (Array.isArray(d.Companies_fk_Companies)) {
            for (const cid of d.Companies_fk_Companies) companyIds.add(cid)
          }
          if (companyIds.size === 0) continue
          // If none of the company's ids appear in P3 set, count it
          const intersects = Array.from(companyIds).some(cid => p3CompanySet.has(cid))
          if (!intersects) {
            if (!ownerToNoP3Deals.has(owner)) ownerToNoP3Deals.set(owner, [])
            ownerToNoP3Deals.get(owner)!.push({ name: d.deal_name || d.whalesync_postgres_id, stage: d.deal_stage, create_date: d.create_date })
          }
        }
      }

      for (const [owner, metrics] of employeeMetricsMap.entries()) {
        const list = ownerToNoP3Deals.get(owner) || []
        metrics.deals_without_p3_count = list.length
        metrics.deals_without_p3_names = list.map(x => x.name)
        // Map to detailed items with classification (won/lost/in_play/overdue)
        const classify = (stage?: string, createDate?: string): 'won' | 'lost' | 'in_play' | 'overdue' => {
          if (stage === 'Closed Won') return 'won'
          if (stage === 'Closed Lost') return 'lost'
          if (createDate) {
            try {
              const age = differenceInDays(now, parseISO(createDate))
              if (age >= 150) return 'overdue'
            } catch {}
          }
          return 'in_play'
        }
        metrics.deals_without_p3_details = list.map(x => ({ name: x.name, stage: x.stage, classification: classify(x.stage, x.create_date) }))
      }
    }
  } catch (e) {
    console.log('Compute deals without P3 failed:', e)
  }

  return Array.from(employeeMetricsMap.values())
} 