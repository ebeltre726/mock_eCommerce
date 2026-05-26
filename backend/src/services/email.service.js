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

export async function sendOrderShipped({ email, firstName, orderId }) {
    const name = escHtml(firstName ?? 'there');
    const id   = escHtml(orderId);
    return send({
        to:      email,
        subject: `Your Furnitria order #${orderId} has shipped!`,
        html:    `<p>Hi ${name},</p><p>Great news — your order <strong>#${id}</strong> is on its way. You can track the status in your account under <em>Order History</em>.</p><p>Thank you for shopping with Furnitria.</p>`,
        text:    `Hi ${name},\n\nYour order #${orderId} has shipped! Check your account Order History for updates.\n\nThank you for shopping with Furnitria.`,
    });
}

export async function sendOrderDelivered({ email, firstName, orderId }) {
    const name = escHtml(firstName ?? 'there');
    const id   = escHtml(orderId);
    return send({
        to:      email,
        subject: `Your Furnitria order #${orderId} has been delivered`,
        html:    `<p>Hi ${name},</p><p>Your order <strong>#${id}</strong> has been delivered. We hope you love your new furniture!</p><p>If anything is wrong, you can initiate a return from your account page within 30 days.</p>`,
        text:    `Hi ${name},\n\nYour order #${orderId} has been delivered. We hope you love it!\n\nIf anything is wrong, you can start a return from your account within 30 days.`,
    });
}

export async function sendRefundProcessed({ email, firstName, orderId, refundAmount }) {
    const name   = escHtml(firstName ?? 'there');
    const id     = escHtml(orderId);
    const amount = escHtml(String(refundAmount));
    return send({
        to:      email,
        subject: `Your Furnitria refund of $${refundAmount} has been processed`,
        html:    `<p>Hi ${name},</p><p>Your refund of <strong>$${amount}</strong> for order <strong>#${id}</strong> has been processed and will appear on your original payment method within 5–10 business days.</p>`,
        text:    `Hi ${name},\n\nYour refund of $${refundAmount} for order #${orderId} has been processed. Allow 5–10 business days for it to appear on your statement.`,
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
