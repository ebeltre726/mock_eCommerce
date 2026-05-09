// email.service.js
//
// Driver pattern — swap EMAIL_DRIVER without touching call sites:
//
//   EMAIL_DRIVER=emailjs   (default) — calls EmailJS REST API from the backend.
//                                      Use while SES is in sandbox mode.
//
//   EMAIL_DRIVER=ses       (production) — calls AWS SES directly.
//                                         Switch once AWS approves your
//                                         Sandbox → Production SES request.
//
// Migration checklist (emailjs → ses):
//   1. Set EMAIL_DRIVER=ses
//   2. Set SES_FROM_ADDRESS=<verified sender identity, e.g. no-reply@furnitria.com>
//   3. Set SES_CONTACT_TO_ADDRESS=<inbox that receives contact form submissions>
//   4. Ensure the Lambda/ECS IAM role has ses:SendEmail on your verified identity
//   5. Remove EMAILJS_* vars from SSM / environment
//   6. Delete the sendViaEmailJS() block below (optional cleanup)
//
// EmailJS template requirements:
//   EMAILJS_TEMPLATE_SUBSCRIBED   — variables: {{to_email}}, {{to_name}}
//   EMAILJS_TEMPLATE_UNSUBSCRIBED — variables: {{to_email}}, {{to_name}}
//   EMAILJS_TEMPLATE_CONTACT      — variables: {{from_name}}, {{from_email}}, {{message}}

import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses';
import logger from '../utils/logger.js';

const DRIVER = process.env.EMAIL_DRIVER ?? 'emailjs';

function escHtml(str) {
    return String(str ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#x27;');
}

// ── EmailJS driver ───────────────────────────────────────────────────────────

async function sendViaEmailJS(templateId, templateParams) {
    const serviceId  = process.env.EMAILJS_SERVICE_ID;
    const publicKey  = process.env.EMAILJS_PUBLIC_KEY;
    const privateKey = process.env.EMAILJS_PRIVATE_KEY;

    if (!serviceId || !publicKey) {
        logger.warn('[email] EmailJS is not configured — skipping send (set EMAILJS_SERVICE_ID + EMAILJS_PUBLIC_KEY)');
        return;
    }
    if (!templateId) {
        logger.warn('[email] EmailJS template ID is missing — skipping send (check EMAILJS_TEMPLATE_* env vars)');
        return;
    }

    const body = { service_id: serviceId, template_id: templateId, user_id: publicKey, template_params: templateParams };
    if (privateKey) body.accessToken = privateKey;

    const res = await fetch('https://api.emailjs.com/api/v1.0/email/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });

    if (!res.ok) {
        const text = await res.text();
        throw new Error(`EmailJS ${res.status}: ${text}`);
    }
}

// ── SES driver ───────────────────────────────────────────────────────────────

const sesClient = new SESClient({ region: process.env.AWS_REGION ?? 'us-east-1' });

async function sendViaSES({ to, subject, html, text }) {
    const from = process.env.SES_FROM_ADDRESS;
    if (!from) throw new Error('FATAL: SES_FROM_ADDRESS is not set');

    await sesClient.send(new SendEmailCommand({
        Source: from,
        Destination: { ToAddresses: [to] },
        Message: {
            Subject: { Data: subject, Charset: 'UTF-8' },
            Body: {
                Html: { Data: html,  Charset: 'UTF-8' },
                Text: { Data: text,  Charset: 'UTF-8' },
            },
        },
    }));
}

// ── Public API ───────────────────────────────────────────────────────────────

export async function sendNewsletterSubscribed({ email, firstName }) {
    const name = escHtml(firstName ?? 'there');

    if (DRIVER === 'ses') {
        return sendViaSES({
            to:      email,
            subject: 'Welcome to the Furnitria Newsletter',
            html:    `<p>Hi ${name},</p><p>You're now subscribed to the Furnitria newsletter. Expect the latest products, curated deals, and home inspiration straight to your inbox.</p><p>You can update your topic preferences any time in your account settings.</p>`,
            text:    `Hi ${name},\n\nYou're now subscribed to the Furnitria newsletter.\n\nExpect the latest products, curated deals, and home inspiration straight to your inbox.\n\nYou can update your topic preferences any time in your account settings.`,
        });
    }

    // EmailJS: template must expose {{to_email}} and {{to_name}} variables
    return sendViaEmailJS(process.env.EMAILJS_TEMPLATE_SUBSCRIBED, {
        to_email: email,
        to_name:  name,
    });
}

export async function sendNewsletterUnsubscribed({ email, firstName }) {
    const name = escHtml(firstName ?? 'there');

    if (DRIVER === 'ses') {
        return sendViaSES({
            to:      email,
            subject: "You've unsubscribed from Furnitria updates",
            html:    `<p>Hi ${name},</p><p>You've been successfully unsubscribed from the Furnitria newsletter. You won't receive any more marketing emails from us.</p><p>Changed your mind? You can re-subscribe any time from your account settings.</p>`,
            text:    `Hi ${name},\n\nYou've been successfully unsubscribed from the Furnitria newsletter.\n\nChanged your mind? You can re-subscribe any time from your account settings.`,
        });
    }

    // EmailJS: template must expose {{to_email}} and {{to_name}} variables
    return sendViaEmailJS(process.env.EMAILJS_TEMPLATE_UNSUBSCRIBED, {
        to_email: email,
        to_name:  name,
    });
}

export async function sendContactNotification({ firstName, lastName, email, emailMessage }) {
    const fromName = `${firstName} ${lastName}`;

    if (DRIVER === 'ses') {
        const to = process.env.SES_CONTACT_TO_ADDRESS;
        if (!to) throw new Error('FATAL: SES_CONTACT_TO_ADDRESS is not set');
        const safeFromName = escHtml(fromName);
        const safeEmail    = escHtml(email);
        const safeMessage  = escHtml(emailMessage);
        return sendViaSES({
            to,
            subject: `[Furnitria] New contact message from ${fromName}`,
            html:    `<p><strong>From:</strong> ${safeFromName} &lt;${safeEmail}&gt;</p><p><strong>Message:</strong></p><p>${safeMessage}</p>`,
            text:    `From: ${fromName} <${email}>\n\nMessage:\n${emailMessage}`,
        });
    }

    // EmailJS: template must expose {{from_name}}, {{from_email}}, {{message}} variables
    return sendViaEmailJS(process.env.EMAILJS_TEMPLATE_CONTACT, {
        from_name:  fromName,
        from_email: email,
        message:    emailMessage,
    });
}
