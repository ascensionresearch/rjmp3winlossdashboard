# P3 Proposal Dashboard

A comprehensive dashboard for tracking P3 (Proposal) meetings and their resulting deals performance. This application syncs data from HubSpot to Supabase and provides detailed analytics for sales teams.

## Features

- **Time Period Filtering**: View data for All Time, Year to Date, or Month to Date
- **Summary Cards**: Key metrics including total proposals, top performer, average per employee, and team size
- **Visual Charts**: Bar chart visualization of meeting distribution by employee
- **Detailed Table**: Comprehensive employee performance table with:
  - Meeting counts
  - Deals won/lost with amounts
  - Deals in play (< 150 days)
  - Overdue deals (150+ days)
  - Team averages and percentages

## Data Flow

The application follows this data relationship:
1. **P3 Meetings**: Identified by `meeting_outcome="P3 - Proposal"` OR `call_and_meeting_type="P3 - Proposal"` AND `meeting_outcome="Completed"`
2. **Contacts**: Retrieved from meeting contacts array (`Contacts_fk_Contacts`)
3. **Companies**: Associated with contacts via `company_uuid`
4. **Deals**: Filtered by `deal_type="Monthly Service"` OR `deal_type="Recurring Special Service"`

## Business Rules

- **Annualization**: All Time and YTD amounts are annualized (×12), MTD shows actual amounts
- **Deal Status**: 
  - Won: `deal_status="Closed Won"`
  - Lost: `deal_status="Closed Lost"`
  - In Play: All other statuses, categorized by days since creation
- **Time Calculations**: Based on `create_date` field with 150-day threshold

## Setup

1. **Install Dependencies**:
   ```bash
   npm install
   ```

2. **Environment Variables** (optional - defaults provided):
   ```
   NEXT_PUBLIC_SUPABASE_URL=https://khsiujplqnvjmatvuest.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key_here
   ```

3. **Run Development Server**:
   ```bash
   npm run dev
   ```

4. **Open Browser**: Navigate to [http://localhost:3000](http://localhost:3000)

## Database Schema

The application expects these tables in Supabase:

- `meetings`: P3 meeting data with employee names and contact arrays
- `contacts`: Contact information with company associations
- `companies`: Company data with UUID identifiers
- `deals`: Deal information with status, amounts, and company relationships

## Tech Stack

- **Frontend**: Next.js 15, React, TypeScript
- **Styling**: Tailwind CSS
- **Database**: Supabase
- **Icons**: Lucide React
- **Date Handling**: date-fns

## Development

The application uses:
- App Router for modern Next.js architecture
- Server-side rendering for performance
- TypeScript for type safety
- Responsive design for mobile/desktop compatibility

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request
