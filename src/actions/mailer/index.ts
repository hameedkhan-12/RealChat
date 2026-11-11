'use server'

import nodemailer from 'nodemailer'

type MailInput = {
  to: string | string[]
  subject: string
  text?: string
  html?: string
}

export const sendMail = async ({ to, subject, text, html }: MailInput) => {
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: Number(process.env.SMTP_PORT || 465),
    secure: process.env.SMTP_SECURE !== 'false',
    auth: {
      user: process.env.SMTP_USER || process.env.NODE_MAILER_EMAIL,
      pass: process.env.SMTP_PASS || process.env.NODE_MAILER_GMAIL_APP_PASSWORD,
    },
  })

  await transporter.sendMail({
    from: process.env.SMTP_FROM || process.env.NODE_MAILER_EMAIL,
    to,
    subject,
    text,
    html,
  })
}

export const onMailer = async (email: string) => {
  await sendMail({
    to: email,
    subject: 'Live support request',
    text: 'A visitor on your website requested to speak with a person.',
  })
}
