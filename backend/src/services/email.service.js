// email.service.js
//
// Transactional email via AWS SES.
//
// Required environment variables:
//   SES_FROM_ADDRESS       — verified sender identity (e.g. noreply@furnitria.com)
//   SES_CONTACT_TO_ADDRESS — inbox that receives contact form submissions
//
// IAM: the Lambda execution role must have ses:SendEmail on the verified identity ARN.
// Sandbox note: in SES sandbox mode both FROM and TO addresses must be verified.
//   - FROM is covered by the domain identity in modules/ses.
//   - TO for contact notifications is covered by the aws_ses_email_identity resource.
//   - TO for newsletter emails must be a verified address while in sandbox.

import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses';
import logger from '../utils/logger.js';

const sesClient = new SESClient({ region: process.env.AWS_REGION ?? 'us-east-1' });

function escHtml(str) {
    return String(str ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#x27;');
}

async function send({ to, subject, html, text }) {
    const from = process.env.SES_FROM_ADDRESS;
    if (!from) {
        logger.warn('[email] SES_FROM_ADDRESS is not set — skipping send');
        return;
    }

    await sesClient.send(new SendEmailCommand({
        Source: from,
        Destination: { ToAddresses: [to] },
        Message: {
            Subject: { Data: subject,  Charset: 'UTF-8' },
            Body: {
                Html: { Data: html, Charset: 'UTF-8' },
                Text: { Data: text, Charset: 'UTF-8' },
            },
        },
    }));
}

// ── Public API ───────────────────────────────────────────────────────────────

export async function sendNewsletterSubscribed({ email, firstName }) {
    const name = escHtml(firstName ?? 'there');
    return send({
        to:      email,
        subject: 'Welcome to the Furnitria Newsletter',
        html:    `<p>Hi ${name},</p><p>You're now subscribed to the Furnitria newsletter. Expect the latest products, curated deals, and home inspiration straight to your inbox.</p><p>You can update your topic preferences any time in your account settings.</p>`,
        text:    `Hi ${name},\n\nYou're now subscribed to the Furnitria newsletter.\n\nExpect the latest products, curated deals, and home inspiration straight to your inbox.\n\nYou can update your topic preferences any time in your account settings.`,
    });
}

export async function sendNewsletterUnsubscribed({ email, firstName }) {
    const name = escHtml(firstName ?? 'there');
    return send({
        to:      email,
        subject: "You've unsubscribed from Furnitria updates",
        html:    `<p>Hi ${name},</p><p>You've been successfully unsubscribed from the Furnitria newsletter. You won't receive any more marketing emails from us.</p><p>Changed your mind? You can re-subscribe any time from your account settings.</p>`,
        text:    `Hi ${name},\n\nYou've been successfully unsubscribed from the Furnitria newsletter.\n\nChanged your mind? You can re-subscribe any time from your account settings.`,
    });
}

export async function sendContactNotification({ firstName, lastName, email, emailMessage }) {
    const to = process.env.SES_CONTACT_TO_ADDRESS;
    if (!to) {
        logger.warn('[email] SES_CONTACT_TO_ADDRESS is not set — skipping send');
        return;
    }

    const safeFromName = escHtml(`${firstName} ${lastName}`);
    const safeEmail    = escHtml(email);
    const safeMessage  = escHtml(emailMessage);

    return send({
        to,
        subject: `[Furnitria] New contact message from ${firstName} ${lastName}`,
        html:    `<p><strong>From:</strong> ${safeFromName} &lt;${safeEmail}&gt;</p><p><strong>Message:</strong></p><p>${safeMessage}</p>`,
        text:    `From: ${firstName} ${lastName} <${email}>\n\nMessage:\n${emailMessage}`,
    });
}
