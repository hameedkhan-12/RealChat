# 🤖 Corinna AI — AI-Powered Sales Assistant & Lead Generation Platform

[![Next.js](https://img.shields.io/badge/Next.js-14%2B-black?style=for-the-badge&logo=next.js)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0%2B-blue?style=for-the-badge&logo=typescript)](https://www.typescriptlang.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-v4-38B2AC?style=for-the-badge&logo=tailwind-css)](https://tailwindcss.com/)
[![Prisma](https://img.shields.io/badge/Prisma-ORM-2D3748?style=for-the-badge&logo=prisma)](https://www.prisma.io/)
[![OpenAI](https://img.shields.io/badge/OpenAI-GPT--4o--mini-412991?style=for-the-badge&logo=openai)](https://openai.com/)
[![Stripe](https://img.shields.io/badge/Stripe-Payments-635BFF?style=for-the-badge&logo=stripe)](https://stripe.com/)
[![Clerk](https://img.shields.io/badge/Clerk-Auth-6C47FF?style=for-the-badge&logo=clerk)](https://clerk.com/)

**Corinna AI** is an intelligent, multi-tenant conversational sales platform that automates lead capture, customer support, appointment scheduling, and product checkouts directly through an embeddable AI chatbot widget on any website.

---

## 📑 Table of Contents

- [✨ Key Features](#-key-features)
  - [1. AI Sales & Conversational Chatbot](#1-ai-sales--conversational-chatbot)
  - [2. Custom Widget Branding & Theming](#2-custom-widget-branding--theming)
  - [3. Real-Time Live Chat Takeover](#3-real-time-live-chat-takeover)
  - [4. Multi-Domain Architecture](#4-multi-domain-architecture)
  - [5. Knowledge Base & Bot Training](#5-knowledge-base--bot-training)
  - [6. In-Chat E-Commerce & Stripe Payments](#6-in-chat-e-commerce--stripe-payments)
  - [7. Automated Appointment Scheduling](#7-automated-appointment-scheduling)
  - [8. Email Marketing & Lead Campaigns](#8-email-marketing--lead-campaigns)
  - [9. Business Analytics Dashboard](#9-business-analytics-dashboard)
- [🛠️ Tech Stack](#️-tech-stack)
- [📁 Project Structure](#-project-structure)
- [🚀 Getting Started](#-getting-started)
  - [Prerequisites](#prerequisites)
  - [Environment Variables Setup](#environment-variables-setup)
  - [Installation & Setup](#installation--setup)
- [💻 Embedding the Chatbot on Websites](#-embedding-the-chatbot-on-websites)
- [🎨 Customization Guide](#-customization-guide)
- [📜 License](#-license)

---

## ✨ Key Features

### 1. AI Sales & Conversational Chatbot
* **Natural Lead Capture**: Captures customer contact information (emails, names, requirements) organically through natural conversation—no static forms required.
* **Powered by OpenAI `gpt-4o-mini`**: Intelligent sales persona trained to guide prospective buyers, resolve doubts, qualify leads, and recommend relevant products.
* **Smart Intent Routing**: Automatically redirects visitors to booking portals or payment checkout pages based on purchase readiness.
* **File & Image Attachments**: Supports media upload via Uploadcare directly in conversation.

### 2. Custom Widget Branding & Theming
* **Custom Persona & Title**: Configure your chatbot's display name (e.g. *"Sales Representative - Acme Corp"*).
* **White-Label Branding**: Replace default footers with your custom branding (e.g. *"Powered by [Your Brand]"*).
* **Theme Accent Palette**: Choose from preset brand themes (*Warm Orange, Ocean Blue, Emerald, Royal Violet, Crimson, Midnight*) or enter any custom HEX color.
* **Text Contrast Toggle**: Choose between dark and light bubble text for optimal readability.
* **Custom Bot Avatar**: Upload your brand logo; automatically displayed in the floating launcher button, chat window header, and assistant response bubbles.
* **Live Interactive Preview**: View changes in real time in your domain settings dashboard before saving.

### 3. Real-Time Live Chat Takeover
* **Seamless Human Handoff**: When a visitor requests a human agent or enters an escalated state, the bot marks the room for live mode (`realtime`).
* **Instant WebSocket Sync**: Powered by Pusher for low-latency live messaging between support operators and site visitors.
* **Operator Console**: Support teams can view active chat rooms, see live typing status, and message clients directly from the **Conversations** panel.

### 4. Multi-Domain Architecture
* **Single Dashboard, Multiple Brands**: Create and manage multiple business domains from a unified account.
* **Isolated Configuration**: Each domain gets its own bot persona, knowledge base FAQ, products, customer leads, and styling.
* **Instant Embed Snippet**: Generates a zero-dependency snippet ready to paste into any website's `<head>`.

### 5. Knowledge Base & Bot Training
* **Help Desk (FAQ) System**: Provide custom question-and-answer pairs to give your bot domain-specific knowledge.
* **Lead Qualification Filters**: Train the chatbot to ask qualification questions to gather specific prospect details.

### 6. In-Chat E-Commerce & Stripe Payments
* **Product Catalog**: Add products with pricing, descriptions, and media uploads.
* **Stripe Connect Integration**: Connect your Stripe account to receive direct payouts.
* **Customer Checkout Portal**: Customers receive instant links to complete secure payments at `/portal/[domainid]/payment/[customerid]`.

### 7. Automated Appointment Scheduling
* **Self-Service Calendar Booking**: Visitors can select convenient dates and booking slots directly via the customer appointment portal.
* **Appointment Tracking**: Track daily agendas, upcoming meetings, and customer booking details in the **Appointments** dashboard.

### 8. Email Marketing & Lead Campaigns
* **Customer Segmentation**: Filter leads captured by individual domains.
* **Campaign Manager**: Design and send bulk marketing email campaigns with customizable templates.
* **Transactional Emailing**: Built-in Nodemailer integration for campaign dispatch and alerts.

### 9. Business Analytics Dashboard
* **Revenue & Pipeline Metrics**: Real-time insights into Potential Clients, Pipeline Value, Total Sales, and Appointments.
* **Plan Usage Monitoring**: Track your subscription tier, domain counts, and AI credit balances.
* **Stripe Transaction History**: View recent payments, statement descriptors, and transaction amounts.

---

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| **Framework** | [Next.js](https://nextjs.org/) (App Router, Server Actions) |
| **Language** | [TypeScript](https://www.typescriptlang.org/) |
| **Styling** | [Tailwind CSS v4](https://tailwindcss.com/), `tw-animate-css`, [shadcn/ui](https://ui.shadcn.com/) |
| **Typography** | [Plus Jakarta Sans](https://fontsource.org/fonts/plus-jakarta-sans) via `@fontsource` |
| **Database & ORM** | PostgreSQL ([Neon](https://neon.tech/)), [Prisma ORM](https://www.prisma.io/) |
| **Authentication** | [Clerk](https://clerk.com/) (Multi-step onboarding, OTP email verification) |
| **AI Engine** | [OpenAI API](https://platform.openai.com/) (`gpt-4o-mini`) |
| **Realtime WebSockets** | [Pusher Channels](https://pusher.com/) |
| **Payments & Billing** | [Stripe](https://stripe.com/) & Stripe Connect |
| **Media & File Storage** | [Uploadcare](https://uploadcare.com/) |
| **Email Service** | [Nodemailer](https://nodemailer.com/) |

---

## 📁 Project Structure

```text
corinna-ai/
├── prisma/
│   ├── schema.prisma           # Prisma database schema (User, Domain, ChatBot, Billings, etc.)
│   └── migrations/             # Database migration history
├── public/
│   └── images/                 # App logos, UI previews, and static assets
├── src/
│   ├── actions/                # Next.js Server Actions
│   │   ├── appointment/        # Booking and appointment queries
│   │   ├── auth/               # User registration, OTP login, and sync
│   │   ├── bot/                # OpenAI assistant completions & chatbot logic
│   │   ├── conversation/       # Real-time chatroom and message queries
│   │   ├── dashboard/          # Metrics, pipeline values, and transactions
│   │   ├── mail/               # Email campaigns and marketing dispatch
│   │   ├── payments/           # Stripe subscription and checkout actions
│   │   └── settings/           # Domain, chatbot styling, FAQ, and product actions
│   ├── app/
│   │   ├── (dashboard)/        # Protected dashboard routes
│   │   │   ├── appointment/    # Bookings calendar & today's agenda
│   │   │   ├── conversation/   # Real-time live operator messenger
│   │   │   ├── dashboard/      # Metrics, pipeline, and transactions
│   │   │   ├── email-marketing/# Bulk campaign management
│   │   │   ├── integration/    # Stripe Connect integrations
│   │   │   └── settings/       # Account & domain chatbot customizations
│   │   ├── api/stripe/         # Stripe webhook & connect endpoints
│   │   ├── auth/               # Custom Clerk sign-in & multi-step sign-up
│   │   ├── blogs/              # Marketing blog pages
│   │   ├── chatbot/            # Standalone public embeddable chatbot widget
│   │   ├── portal/             # Customer-facing payment & appointment booking portal
│   │   ├── layout.tsx          # Root layout (ClerkProvider, ThemeProvider, Fontsource)
│   │   └── page.tsx            # Landing page
│   ├── components/             # Reusable React & shadcn components
│   │   ├── appointment/        # Calendar and booking cards
│   │   ├── chatbot/            # Widget window, bubble, trigger, and tabs
│   │   ├── conversations/      # Realtime messenger chat window
│   │   ├── dashboard/          # Metric cards and plan usage meters
│   │   ├── forms/              # Settings, authentication, and product forms
│   │   ├── sidebar/            # Responsive expandable navigation menu
│   │   └── ui/                 # Core UI library (Button, Card, Input, Dialog, etc.)
│   ├── context/                # React Contexts (Auth, Sidebar, Realtime Chat)
│   ├── hooks/                  # Custom React hooks (Chatbot, Sidebar, Settings, Auth)
│   ├── lib/                    # Utilities, Pusher clients, and helpers
│   ├── schemas/                # Zod validation schemas
│   └── middleware.ts           # Clerk route protection middleware
├── package.json
└── README.md
```

---

## 🚀 Getting Started

### Prerequisites

Make sure you have the following installed on your machine:
* [Node.js](https://nodejs.org/) (v18.x or v20.x recommended)
* [pnpm](https://pnpm.io/) (`npm install -g pnpm`)
* A [PostgreSQL](https://www.postgresql.org/) database (or a free cloud database like [Neon](https://neon.tech/))

---

### Environment Variables Setup

Create a `.env` file in the root directory and configure the following credentials:

```env
# Database
DATABASE_URL="postgresql://<user>:<password>@<host>/<database>?sslmode=require"

# OpenAI
OPEN_AI_KEY="sk-proj-..."

# Clerk Authentication
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY="pk_test_..."
CLERK_SECRET_KEY="sk_test_..."
NEXT_PUBLIC_CLERK_SIGN_IN_URL="/auth/sign-in"
NEXT_PUBLIC_CLERK_SIGN_UP_URL="/auth/sign-up"

# Stripe
STRIPE_SECRET="sk_test_..."
NEXT_PUBLIC_STRIPE_PUBLISH_KEY="pk_test_..."

# Pusher Realtime
NEXT_PUBLIC_PUSHER_APP_KEY="..."
NEXT_PUBLIC_PUSHER_APP_ID="..."
NEXT_PUBLIC_PUSHER_APP_SECRET="..."
NEXT_PUBLIC_PUSHER_APP_CLUSTOR="..."

# Uploadcare (Media Uploads)
NEXT_PUBLIC_UPLOAD_CARE_PUBLIC_KEY="..."
UPLOAD_CARE_SECRET_KEY="..."

# Nodemailer (Email Marketing)
NODE_MAILER_EMAIL="your-email@gmail.com"
NODE_MAILER_GMAIL_APP_PASSWORD="your-app-password"
```

---

### Installation & Setup

1. **Clone the repository**:
   ```bash
   git clone https://github.com/your-username/corinna-ai.git
   cd corinna-ai
   ```

2. **Install dependencies**:
   ```bash
   pnpm install
   ```

3. **Generate Prisma Client & Sync Database**:
   ```bash
   npx prisma generate
   npx prisma db push
   ```

4. **Start the local development server**:
   ```bash
   pnpm run dev
   ```

5. Open your browser and navigate to [http://localhost:3000](http://localhost:3000).

---

## 💻 Embedding the Chatbot on Websites

To embed Corinna AI on any website:

1. Log into your dashboard and navigate to **Settings > [Your Domain]**.
2. Copy the generated snippet from the **Code Snippet** card:

```html
<script>
  const iframe = document.createElement("iframe");
  
  const iframeStyles = (styleString) => {
    const style = document.createElement('style');
    style.textContent = styleString;
    document.head.append(style);
  };
  
  iframeStyles(`
    .chat-frame {
      position: fixed;
      bottom: 50px;
      right: 50px;
      border: none;
      z-index: 999999;
    }
  `);
  
  iframe.src = "https://your-domain.com/chatbot";
  iframe.classList.add('chat-frame');
  document.body.appendChild(iframe);
  
  window.addEventListener("message", (e) => {
    if (e.origin !== "https://your-domain.com") return null;
    let dimensions = JSON.parse(e.data);
    iframe.width = dimensions.width;
    iframe.height = dimensions.height;
    iframe.contentWindow.postMessage("YOUR_DOMAIN_ID", "https://your-domain.com/");
  });
</script>
```

3. Paste the code into the `<head>` or before the closing `</body>` tag of your site.

---

## 🎨 Customization Guide

In the dashboard under **Settings > [Your Domain]**, you can personalize:

| Customization | Description |
|---|---|
| **Bot Icon / Logo** | Upload your brand avatar. Appears in launcher, header, and chat bubbles. |
| **Welcome Message** | Greeting automatically dispatched when a customer opens the chat. |
| **Assistant Title** | Name displayed in the widget header (e.g., *"Acme Sales Rep"*). |
| **Custom Branding** | White-label footer text (e.g., *"Powered by Acme"*). |
| **Theme Color** | Accent color for the floating launcher button, chat bubbles, and buttons. |
| **Text Contrast** | Select light (`#FFFFFF`) or dark (`#000000`) user bubble text. |
| **Help Desk** | Train the bot with domain-specific FAQs to answer buyer questions. |
| **Products** | Add products and prices for in-chat lead closing and payment generation. |

---

## 📜 License

This project is provided for educational and portfolio demonstration purposes. For commercial licensing, please refer to the original licensing terms provided by [Web Prodigies](https://webprodigies.com/codelicense).
