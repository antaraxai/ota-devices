import { Resend } from 'resend';

const resend = new Resend('re_9Yc3kN8P_MbHNyUhCckWtztViY9vk46n7');

async function sendTestEmail() {
  try {
    const { data, error } = await resend.emails.send({
      from: 'Antara <onboarding@resend.dev>',
      to: 'alizulfaqar@reka.re',
      subject: 'Test Email from Antara',
      html: `
        <div>
          <h2>Test Email</h2>
          <p>This is a test email from Antara to verify the email notification system.</p>
          <p>If you received this email, it means the email notification system is working correctly.</p>
        </div>
      `,
    });

    if (error) {
      console.error('Failed to send email:', error);
      return;
    }

    console.log('Test email sent successfully! Email ID:', data.id);
  } catch (error) {
    console.error('Error sending test email:', error);
  }
}

sendTestEmail();