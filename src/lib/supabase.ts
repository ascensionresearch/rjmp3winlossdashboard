import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://khsiujplqnvjmatvuest.supabase.co'
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imtoc2l1anBscW52am1hdHZ1ZXN0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTEwNzk3MTQsImV4cCI6MjA2NjY1NTcxNH0.VCzQiV7FG8XdGg6bpeXVPPr5oy-Kg2u-Vj_HpGV1UWM'

export const supabase = createClient(supabaseUrl, supabaseAnonKey) 