import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { getP3Meetings } from '@/lib/data'
import { Meeting, Company, Deal, TimePeriod } from '@/types/database'
// Removed unused date-fns imports

const normalize = (s?: string) => (s ?? '').toString().trim().toLowerCase()
const validDealTypeSet = new Set(['monthly service', 'recurring special service'])
const isValidDealType = (t?: string) => validDealTypeSet.has(normalize(t))

export async function GET(request: Request) {
  try {
    const url = new URL(request.url)
    const employeeQuery = url.searchParams.get('employee') || 'rob'
    const timePeriod = (url.searchParams.get('timePeriod') as TimePeriod) || 'all_time'
    const selectedMonth = url.searchParams.get('selectedMonth') || undefined

    // 1) Fetch meetings (same as dashboard)
    const meetings = await getP3Meetings(timePeriod, selectedMonth)

    // 2) Collect direct company and direct deal IDs
    const directCompanyIds = new Set<string>()
    const directDealIds = new Set<string>()
    for (const m of meetings) {
      if (m.Companies_fk_Companies) m.Companies_fk_Companies.forEach(id => directCompanyIds.add(id))
      if (m.Deals_fk_Deals) m.Deals_fk_Deals.forEach(id => directDealIds.add(id))
    }

    // 3) Batch fetch companies for mapping
    const companies: Company[] = []
    const allCompanyIdsArray = Array.from(directCompanyIds)
    if (allCompanyIdsArray.length > 0) {
      const batchSize = 100
      for (let i = 0; i < allCompanyIdsArray.length; i += batchSize) {
        const batch = allCompanyIdsArray.slice(i, i + batchSize)
        const { data, error } = await supabase
          .from('Companies')
          .select('whalesync_postgres_id, Companies_fk_Companies, company_name')
          .in('whalesync_postgres_id', batch)
        if (!error && data) companies.push(...data)
      }
    }
    const companyMap = new Map(companies.map(c => [c.whalesync_postgres_id, c]))

    // 4) Fetch deals by direct deal IDs and by company IDs
    const deals: Deal[] = []
    if (directDealIds.size > 0) {
      const dealIdsArray = Array.from(directDealIds)
      const batchSize = 100
      for (let i = 0; i < dealIdsArray.length; i += batchSize) {
        const batch = dealIdsArray.slice(i, i + batchSize)
        const { data, error } = await supabase
          .from('Deals')
          .select('whalesync_postgres_id, Companies_fk_Companies, companies, deal_stage, amount, deal_type, create_date, deal_name')
          .in('whalesync_postgres_id', batch)
        if (!error && data) deals.push(...data)
      }
    }
    if (allCompanyIdsArray.length > 0) {
      const batchSize = 100
      for (let i = 0; i < allCompanyIdsArray.length; i += batchSize) {
        const batch = allCompanyIdsArray.slice(i, i + batchSize)
        const { data: overlapData } = await supabase
          .from('Deals')
          .select('whalesync_postgres_id, Companies_fk_Companies, Contacts_fk_Contacts, companies, deal_stage, amount, deal_type, create_date, deal_name')
          .overlaps('Companies_fk_Companies', batch)
        if (overlapData) deals.push(...(overlapData as Deal[]))
        const { data: scalarData } = await supabase
          .from('Deals')
          .select('whalesync_postgres_id, Companies_fk_Companies, Contacts_fk_Contacts, companies, deal_stage, amount, deal_type, create_date, deal_name')
          .in('companies', batch)
        if (scalarData) deals.push(...(scalarData as Deal[]))
      }
    }
    const dealMap = new Map(deals.map(d => [d.whalesync_postgres_id, d]))
    const dealsByCompanyId = new Map<string, string[]>()
    for (const d of dealMap.values()) {
      if (Array.isArray(d.Companies_fk_Companies)) {
        for (const cid of d.Companies_fk_Companies) {
          if (!dealsByCompanyId.has(cid)) dealsByCompanyId.set(cid, [])
          dealsByCompanyId.get(cid)!.push(d.whalesync_postgres_id)
        }
      }
    }

    // 5) Compute NEW included deals per employee using current logic (Priority 1, then 2)
    const employeeIncludedDeals = new Map<string, Set<string>>()
    const employeeMeetings = new Map<string, Meeting[]>()
    for (const meeting of meetings) {
      const assignee = meeting.activity_assigned_to || 'Unassigned'
      if (!employeeMeetings.has(assignee)) employeeMeetings.set(assignee, [])
      employeeMeetings.get(assignee)!.push(meeting)

      const meetingCompanies = new Set<string>(meeting.Companies_fk_Companies || [])
      const addForEmployee = (emp: string, id: string) => {
        if (!employeeIncludedDeals.has(emp)) employeeIncludedDeals.set(emp, new Set())
        employeeIncludedDeals.get(emp)!.add(id)
      }

      // Priority 1: Direct deals filtered to meeting companies when multiple
      if (meeting.Deals_fk_Deals && meeting.Deals_fk_Deals.length > 0) {
        let directIds = Array.from(new Set(meeting.Deals_fk_Deals))
        if (directIds.length > 1 && meetingCompanies.size > 0) {
          directIds = directIds.filter(id => {
            const d = dealMap.get(id)
            if (!d) return false
            const matchesScalar = !!d.companies && meetingCompanies.has(d.companies)
            const matchesArray = Array.isArray(d.Companies_fk_Companies) && d.Companies_fk_Companies.some(cid => meetingCompanies.has(cid))
            return matchesScalar || matchesArray
          })
        }
        for (const id of directIds) {
          const d = dealMap.get(id)
          if (!d) continue
          if (!isValidDealType(d.deal_type)) continue
          addForEmployee(assignee, id)
        }
      }

      // Priority 2: Deals by the meeting's companies (no related expansion)
      if (meeting.Companies_fk_Companies && meeting.Companies_fk_Companies.length > 0) {
        const allIds = new Set<string>()
        for (const cid of meeting.Companies_fk_Companies) {
          const ids = dealsByCompanyId.get(cid)
          if (ids) ids.forEach(id => allIds.add(id))
        }
        for (const id of allIds) {
          const d = dealMap.get(id)
          if (!d) continue
          if (!isValidDealType(d.deal_type)) continue
          addForEmployee(assignee, id)
        }
      }
    }

    // 6) Reconstruct OLD candidate deals and compute removed per target employee(s)
    const targetEmployees = Array.from(employeeMeetings.keys()).filter(name => new RegExp(employeeQuery, 'i').test(name))
    const results: Array<{ employee: string, count: number, deals: Array<{ id: string; name: string | null; companies: string | null; type: string | null; stage: string | null; create_date: string | null; amount: number | null }> }> = []

    for (const emp of targetEmployees) {
      const meetingsForEmp = employeeMeetings.get(emp) || []
      const newIncluded = new Set(employeeIncludedDeals.get(emp) || [])

      const oldCandidateIds = new Set<string>()
      const relatedCompanyIds = new Set<string>()
      const contactIds = new Set<string>()

      for (const m of meetingsForEmp) {
        if (m.Deals_fk_Deals) {
          for (const id of m.Deals_fk_Deals) {
            const d = dealMap.get(id)
            if (d && isValidDealType(d.deal_type)) oldCandidateIds.add(id)
          }
        }
        if (m.Companies_fk_Companies) {
          for (const cid of m.Companies_fk_Companies) {
            const comp = companyMap.get(cid)
            if (comp && Array.isArray(comp.Companies_fk_Companies)) {
              for (const rc of comp.Companies_fk_Companies) relatedCompanyIds.add(rc)
            }
          }
        }
        if ((m as Meeting & { Contacts_fk_Contacts?: string[] }).Contacts_fk_Contacts && Array.isArray((m as Meeting & { Contacts_fk_Contacts?: string[] }).Contacts_fk_Contacts)) {
          for (const pid of (m as Meeting & { Contacts_fk_Contacts?: string[] }).Contacts_fk_Contacts!) contactIds.add(pid)
        }
      }

      if (relatedCompanyIds.size > 0) {
        const rel = Array.from(relatedCompanyIds)
        const batchSize = 100
        for (let i = 0; i < rel.length; i += batchSize) {
          const batch = rel.slice(i, i + batchSize)
          const { data: overlapData } = await supabase
            .from('Deals')
            .select('whalesync_postgres_id, Companies_fk_Companies, companies, deal_type, deal_name, deal_stage, create_date, amount')
            .overlaps('Companies_fk_Companies', batch)
          const { data: scalarData } = await supabase
            .from('Deals')
            .select('whalesync_postgres_id, Companies_fk_Companies, companies, deal_type, deal_name, deal_stage, create_date, amount')
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

      if (contactIds.size > 0) {
        const p = Array.from(contactIds)
        const batchSize = 100
        for (let i = 0; i < p.length; i += batchSize) {
          const batch = p.slice(i, i + batchSize)
          const { data } = await supabase
            .from('Deals')
            .select('whalesync_postgres_id, Contacts_fk_Contacts, deal_type, deal_name, deal_stage, create_date, amount')
            .overlaps('Contacts_fk_Contacts', batch)
          for (const d of ((data as Deal[]) || []) as Deal[]) {
            if (d && isValidDealType(d.deal_type)) oldCandidateIds.add(d.whalesync_postgres_id)
          }
        }
      }

      const removedIds = Array.from(oldCandidateIds).filter(id => !newIncluded.has(id))
        const details = removedIds.map(id => {
          const d = dealMap.get(id)
        return {
          id,
          name: d?.deal_name || null,
            companies: (d as Deal | undefined)?.companies || null,
          type: d?.deal_type || null,
          stage: d?.deal_stage || null,
          create_date: d?.create_date || null,
          amount: d?.amount ?? null,
        }
      })
      results.push({ employee: emp, count: details.length, deals: details })
    }

    return NextResponse.json({ employeeQuery, timePeriod, selectedMonth: selectedMonth || null, results })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 })
  }
}


