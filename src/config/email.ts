// Email configuration
export const emailConfig = {
  resendApiKey: import.meta.env.VITE_RESEND_API_KEY,
  defaultFromEmail: import.meta.env.VITE_DEFAULT_FROM_EMAIL || 'Antara <onboarding@resend.dev>',
  defaultToEmail: import.meta.env.VITE_DEFAULT_TO_EMAIL || 'alizulfaqar@reka.re'
};