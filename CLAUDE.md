# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Grafono** is a comprehensive patient management system for speech therapy professionals (Fonoaudiologia), built with Next.js 16 and deployed on Vercel. The application manages patient records, appointments, assessments, financial tracking, and provides AI-assisted features for clinical documentation.

## Key Technologies

- **Framework**: Next.js 16.1.1 (App Router, serverless architecture)
- **Database**: PostgreSQL with Prisma ORM
- **Authentication**: NextAuth.js v4 with credentials provider (bcrypt hashed passwords)
- **UI**: Tailwind CSS 4 + shadcn/ui components (Radix UI primitives)
- **State Management**: Zustand + TanStack Query
- **AI Integration**: Google Generative AI SDK
- **Forms**: React Hook Form + Zod validation

## Development Commands

```bash
# Development
npm run dev                    # Start dev server at localhost:3000

# Database
npm run db:push               # Push schema changes to database
npm run db:generate           # Generate Prisma client
npm run db:migrate            # Create and apply migrations
npm run db:reset              # Reset database (WARNING: deletes all data)

# Production
npm run build                 # Build for production (includes prisma db push)
npm run start                 # Start production server
npm run lint                  # Run ESLint

# Note: postinstall script auto-runs prisma generate after npm install
```

## Project Architecture

### Route Structure

The app uses Next.js App Router with route groups:

- **`(app)/`** - Protected application routes (requires authentication)
  - `/dashboard` - Main dashboard with metrics
  - `/pacientes` - Patient management (Kanban board + table view)
  - `/agenda` - Appointment scheduling
  - `/financeiro` - Financial management
    - `/adimplencia` - Payment compliance tracking
  - `/avaliacoes` - Clinical assessments
  - `/exames` - Patient exams
  - `/relatorios` - Clinical reports
  - `/modelos` - Document templates
  - `/metricas` - Analytics and metrics
  - `/configuracoes` - Professional settings
  - `/calculadora` - Clinical calculators

- **`(site)/`** - Public-facing pages
  - `/landing` - Landing page
  - `/sobre` - About page
  - `/blog` - Blog with MDX support

- **`/portal`** - Patient portal (separate auth context)
- **`/login`** - Login page

### Server Actions Pattern

All database operations use Next.js Server Actions located in `src/app/actions/`:

- `patient.ts` - Patient CRUD operations
- `appointment.ts` - Appointment management
- `finance.ts` - Transaction handling
- `assessment.ts` - Clinical assessments
- `exam.ts` - Exam records
- `report.ts` - Clinical reports
- `evolution.ts` - Patient evolution notes
- `template.ts` - Document templates
- `reminders.ts` - Reminder system
- `ai.ts` - AI-powered features
- `dashboard.ts` - Dashboard data aggregation
- `settings.ts` - User settings

**Pattern**: Each action file exports async functions marked with `"use server"`. Always use these instead of direct Prisma calls in client components.

### Authentication Flow

Authentication is handled by NextAuth.js with a custom credentials provider:

1. Auth configuration: `src/lib/auth.ts`
2. API route: `src/app/api/auth/[...nextauth]/route.ts`
3. Middleware protection: `src/middleware.ts`
4. Login page: `src/app/login/page.tsx`

**Session management**: JWT strategy with session data stored in tokens. User ID, name, and email are available in session callbacks.

**Password setup**: New users need passwords set manually via SQL (see `INSTRUCOES_ACESSAR_LOGIN.md`).

**Required environment variables**:
- `NEXTAUTH_SECRET` - Random string for JWT encryption
- `NEXTAUTH_URL` - App URL (auto-configured on Vercel)
- `DATABASE_URL` - PostgreSQL connection string
- `GOOGLE_GENERATIVE_AI_API_KEY` - Required for AI features

### Database Schema Overview

Key models and their relationships (see `prisma/schema.prisma`):

**Core entities**:
- `User` - Professionals and patients (role-based)
- `Patient` - Patient records with CRM fields
- `Appointment` - Scheduled sessions
- `Transaction` - Income/expense tracking
- `Evolution` - Session notes with speech-to-text support

**Clinical data**:
- `Assessment` - Initial/progress evaluations
- `Exam` - External exam results
- `Report` - Generated clinical reports
- `Goal` - Treatment objectives
- `Exercise` - Home exercises

**System features**:
- `Template` - Reusable document templates (atestados, encaminhamentos)
- `Reminder` - Task/deadline tracking
- `Notification` - User notifications
- `AvailabilityConfig` - Professional schedule configuration
- `PatientKnowledgeBase` - AI-indexed patient history

**Important fields**:
- Patient status: Lead, Avaliação, Em Terapia, Em Espera, Alta, Arquivado
- Financial source: PARTICULAR, CONVENIO
- Transaction flow: INCOME, EXPENSE
- Reevaluation intervals: 3_MONTHS, 6_MONTHS, 1_YEAR, NONE

### Database Access

Always use the singleton Prisma client from `src/lib/db.ts`:

```typescript
import { db } from "@/lib/db";
```

**Never** instantiate new PrismaClient instances. The singleton pattern prevents connection exhaustion in serverless environments.

### Component Organization

- `src/components/ui/` - shadcn/ui primitives (do not modify directly)
- `src/components/` - Shared application components
- `src/app/(app)/[route]/_components/` - Route-specific components (use underscore prefix)

**Convention**: Page-specific components live in `_components` subdirectories within their route folders.

### AI Features

The app uses Google's Generative AI for:
- Clinical note summarization
- Document generation from templates
- Patient history context analysis

AI logic is centralized in `src/app/actions/ai.ts`. Always use server actions for AI calls to protect API keys.

### Financial System

The financial module supports:
- Income tracking (PARTICULAR/CONVENIO)
- Expense management (FIXED/VARIABLE)
- Monthly compliance reports
- Transaction status: pago, pendente, atrasado, aguardando_repasse

**Reference IDs**: Use format `MONTHLY_MMM_YYYY` for recurring monthly payments or `APT_[id]` for appointment-linked transactions.

### WhatsApp Integration

WhatsApp messaging helper in `src/lib/whatsapp.ts` generates `wa.me` links for:
- Payment reminders
- Appointment confirmations
- General patient communication

## Build Configuration

**Next.js config** (`next.config.ts`):
- TypeScript build errors are ignored (`ignoreBuildErrors: true`)
- React Strict Mode disabled
- Turbopack enabled for development

**Build process** (`package.json` build script):
1. `prisma db push --accept-data-loss` - Sync schema to database
2. `prisma generate` - Generate Prisma client
3. `next build` - Build Next.js app

**Deployment**: Optimized for Vercel serverless deployment. The app was migrated from a custom server architecture (Socket.IO removed).

## Important Notes

### TypeScript Configuration
- Path alias `@/*` maps to `src/*`
- `noImplicitAny: false` - implicit any is allowed
- `jsx: "react-jsx"` - uses new JSX transform

### Vercel Deployment
- Build command includes Prisma schema push
- Uses PostgreSQL (migrated from SQLite)
- No WebSocket support (previously used Socket.IO, now removed)
- All environment variables must be set in Vercel dashboard

### Patient Management
- Kanban board uses `@dnd-kit` for drag-and-drop
- Patient status updates trigger automatic notifications
- Reevaluation reminders are calculated based on `reevaluationInterval`

### Security
- All passwords are bcrypt-hashed before storage
- Middleware protects: `/dashboard`, `/agenda`, `/pacientes`, `/financeiro`, `/configuracoes`, `/relatorios`, `/metricas`, `/modelos`
- **Note**: `/avaliacoes`, `/exames`, `/calculadora` routes exist but are NOT protected by middleware
- API routes under `/api/auth` are public for NextAuth flow

### Known Constraints
- Build ignores TypeScript errors (fix gradually, don't add new errors)
- React Strict Mode disabled (may cause double-rendering issues when re-enabled)
- Database uses `db push` instead of migrations in production build

## Local Development with Production Database (Neon)

O banco de dados é PostgreSQL hospedado no Neon. Para rodar scripts localmente contra o banco de produção:

```bash
# 1. Linkar projeto Vercel (apenas primeira vez)
vercel link --yes --project gra-fono

# 2. Puxar variáveis de ambiente
vercel env pull .env.local

# 3. IMPORTANTE: Atualizar .env com DATABASE_URL do Neon
# O .env pode ter URL antiga do SQLite. Copiar a DATABASE_URL do .env.local:
DATABASE_URL=$(grep "DATABASE_URL" .env.local) && sed -i '' "s|DATABASE_URL=.*|$DATABASE_URL|" .env

# 4. Rodar scripts de seed
npx tsx scripts/seed-patients.ts
```

**Scripts de seed disponíveis**:
- `scripts/seed-patients.ts` - Adiciona pacientes e transações mensais

**Estrutura de dados para novos pacientes**:
```typescript
{
  name: "Nome do Paciente",
  responsibleName: "Nome do Responsável", // Salvo em motherName
  timesPerWeek: 2,                         // Salvo em observations
  type: "Intervenção",                     // Salvo em observations
  paymentDueDay: 5,                        // Dia do vencimento
  value: 1000,                             // negotiatedValue + Transaction
}
```

## File Locations Reference

**Authentication**: `src/lib/auth.ts`, `src/middleware.ts`
**Database client**: `src/lib/db.ts`
**Server actions**: `src/app/actions/*.ts`
**UI components**: `src/components/ui/*.tsx`
**Prisma schema**: `prisma/schema.prisma`
**Seed scripts**: `scripts/*.ts`
**Environment variables**: `.env` (production DATABASE_URL), `.env.local` (pulled from Vercel)
