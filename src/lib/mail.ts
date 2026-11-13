import 'server-only'
import nodemailer, { type Transporter } from 'nodemailer'
import { getEnv } from '@/env'

let transporter: Transporter | undefined
function getTransporter(): Transporter {
  if (transporter) return transporter
  const env = getEnv()
  transporter = nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: Number(env.SMTP_PORT ?? 465),
    secure: env.SMTP_SECURE !== 'false',
    auth: { user: env.SMTP_USER, pass: env.SMTP_PASS },
  })
  return transporter
}

export function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!))
}

export type MailInput = {
  to: string | string[]
  subject: string
  text: string
  html?: string
  attachments?: { filename: string; content: string; contentType: string }[]
}

/** Throws on failure. Callers decide whether to ignore (but must log). */
export async function sendMail(m: MailInput) {
  const env = getEnv()
  await getTransporter().sendMail({
    from: env.SMTP_FROM,
    to: m.to,
    subject: m.subject.replace(/[\r\n]+/g, ' ').slice(0, 200),
    text: m.text,
    html: m.html,
    attachments: m.attachments,
  })
}
