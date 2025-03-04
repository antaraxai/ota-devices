import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface NotificationPayload {
  userId: string
  websiteName: string
  websiteUrl: string
  oldStatus: string
  newStatus: string
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    const resendApiKey = Deno.env.get('RESEND_API_KEY')

    if (!supabaseUrl || !serviceRoleKey || !resendApiKey) {
      throw new Error('Missing environment variables. Please check SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, and RESEND_API_KEY.')
    }

    const supabaseClient = createClient(supabaseUrl, serviceRoleKey)

    // Get the JWT token from the Authorization header
    const authHeader = req.headers.get('Authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new Error('Missing or invalid Authorization header')
    }
    const token = authHeader.split(' ')[1]

    // Verify the JWT token and get the user
    const { data: { user: authUser }, error: authError } = await supabaseClient.auth.getUser(token)
    if (authError || !authUser) {
      throw new Error('Invalid authentication token')
    }

    const { websiteName, websiteUrl, oldStatus, newStatus } = await req.json() as Omit<NotificationPayload, 'userId'>
    const userId = authUser.id

    // Get user's email using auth API
    const { data: { user }, error: userError } = await supabaseClient.auth.admin.getUserById(userId)

    if (userError || !user?.email) {
      throw new Error('Failed to get user email')
    }

    // Send email using Resend API directly
    const emailResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${resendApiKey}`,
      },
      body: JSON.stringify({
        from: 'Antara <onboarding@resend.dev>',
        to: user.email,
        subject: `Status Change: ${websiteName}`,
        html: `
          <div>
            <h2>Website Status Change Notification</h2>
            <p>The status of <strong>${websiteName}</strong> (<a href="${websiteUrl}">${websiteUrl}</a>) has changed.</p>
            <p>Status change: <strong>${oldStatus}</strong> → <strong>${newStatus}</strong></p>
          </div>
        `,
      }),
    })

    const emailData = await emailResponse.json()

    if (!emailResponse.ok) {
      console.error('Failed to send email:', emailData)
      throw new Error('Failed to send email notification')
    }

    console.log('Status change notification sent successfully! Email ID:', emailData.id)

    // Store notification in database
    const { error: dbError } = await supabaseClient
      .from('notifications')
      .insert([{
        user_id: userId,
        type: 'status_change',
        title: `Status Change: ${websiteName}`,
        content: `The status of ${websiteName} (${websiteUrl}) has changed from ${oldStatus} to ${newStatus}.`,
        email: user.email,
        email_sent: true,
        email_id: emailData.id,
      }])

    if (dbError) {
      console.error('Failed to store notification:', dbError)
    }

    return new Response(JSON.stringify({ success: true, emailId: emailData.id }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })
  } catch (error) {
    console.error('Error processing request:', error)

    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    })
  }
})