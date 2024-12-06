import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://hdodriygzudamnqqbluy.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imhkb2RyaXlnenVkYW1ucXFibHV5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3MjM3MTEwNjgsImV4cCI6MjAzOTI4NzA2OH0.zDGFdgBFqsgm0wOKWIl9ehyvY8cMvE87-TZhrZyE8IM'

export const supabase = createClient(supabaseUrl, supabaseKey)
