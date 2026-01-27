# Grafono - Fonoaudiologia Infantil

## Project Overview

This is a Next.js 15 application for Grafono, a specialized pediatric speech therapy practice led by Graciele Costa. The site serves as a professional platform to showcase services, approach, and expertise in pediatric speech therapy, while also providing educational content through a blog and facilitating contact through a newsletter and WhatsApp integration.

The application is built using a modern tech stack including TypeScript, Tailwind CSS, and shadcn/ui components. It features a custom server implementation with Socket.IO for potential real-time communication, Prisma for database interactions (with SQLite), and a comprehensive set of UI components and utilities.

The main objectives of the application are:
- Provide an informative and engaging landing page for potential clients.
- Showcase the professional's services, specializations, and approach.
- Offer a blog section for sharing valuable content related to pediatric speech therapy.
- Facilitate contact and newsletter signups.
- Include a dedicated 'About' page detailing the professional's background.

## Technology Stack

- **Framework**: Next.js 15 (App Router)
- **Language**: TypeScript 5
- **Styling**: Tailwind CSS 4
- **UI Components**: shadcn/ui, Radix UI primitives, Lucide React icons
- **State Management**: React Hooks (useState, custom hooks)
- **Forms**: React Hook Form, Zod (for validation)
- **Data Fetching**: Axios
- **Database**: Prisma ORM with SQLite
- **Real-time Communication**: Socket.IO
- **Content**: MDX, Markdown
- **Deployment**: Standalone server deployment via `server.ts`
- **Other Libraries**: Framer Motion (animations), Date-fns (date utilities), Recharts (charts), React Markdown, React Syntax Highlighter

## Project Structure

```
.
├── README.md
├── README-BLOG.md
├── package.json
├── next.config.ts
├── server.ts
├── prisma/
│   └── schema.prisma
├── src/
│   ├── app/                 # Next.js App Router pages
│   │   ├── layout.tsx       # Root layout with metadata
│   │   ├── page.tsx         # Main landing page
│   │   └── ...              # Other pages like 'sobre' (about)
│   ├── components/          # Reusable React components
│   │   ├── ui/              # shadcn/ui components
│   │   └── BlogCarousel.tsx # Specific component for blog posts
│   ├── lib/                 # Utility functions and configurations
│   │   ├── blog.ts          # Blog post utilities
│   │   ├── socket.ts        # Socket.IO setup
│   │   └── utils.ts         # General utility functions
│   └── content/             # Markdown/MDX blog content
├── public/                  # Static assets
├── components.json          # shadcn/ui configuration
├── tailwind.config.ts       # Tailwind CSS configuration
└── tsconfig.json            # TypeScript configuration
```

## Building and Running

### Development

The project uses `nodemon` to watch for file changes and automatically restart the server during development. The development server is started with:

```bash
npm run dev
```

This command executes `nodemon --exec "npx tsx server.ts" --watch server.ts --watch src --ext ts,tsx,js,jsx`, which watches `server.ts` and `src` directories for changes and restarts the custom Next.js server defined in `server.ts`.

### Production

To build the application for production:

```bash
npm run build
```

To start the production server:

```bash
npm start
```

This command runs `NODE_ENV=production tsx server.ts`, which starts the custom server in production mode.

### Database

The project uses Prisma ORM with SQLite. Several scripts are available in `package.json`:

- `npm run db:generate`: Generates Prisma client.
- `npm run db:push`: Pushes the Prisma schema state to the database.
- `npm run db:migrate`: Creates and applies a new migration.
- `npm run db:reset`: Resets the database.

Note: The database URL is configured via the `DATABASE_URL` environment variable, likely defined in a `.env` file (not present in the provided directory listing).

## Development Conventions

- **Component Structure**: UI components are primarily built using shadcn/ui, which are located in `src/components/ui/`. Custom components are placed in `src/components/`.
- **Styling**: Tailwind CSS is used for styling, with utility classes applied directly in the JSX.
- **Routing**: Uses Next.js App Router. Pages are defined in the `src/app/` directory.
- **Data Management**: Uses React Hooks for local state management on the client side. Prisma ORM is used for database interactions on the server side.
- **Real-time Communication**: Socket.IO is integrated via a custom server (`server.ts`) and a setup function (`src/lib/socket.ts`). Currently, it implements a basic echo server.
- **Content Management**: Blog content is managed as Markdown files in the `src/content/blog/` directory. A `getAllPosts` function in `src/lib/blog.ts` reads and processes these files.
- **UI/UX**: Emphasis on a modern, responsive design with gradients, cards, and interactive elements. Icons from Lucide React are used extensively.
- **Configuration Files**: Configuration for tools like Tailwind CSS (`tailwind.config.ts`), Next.js (`next.config.ts`), and shadcn/ui (`components.json`) are maintained.

## Key Features

- **Landing Page**: A comprehensive landing page (`src/app/page.tsx`) featuring sections for hero, about, services, approach, testimonials, blog, and newsletter signup.
- **Blog**: A blog section with a carousel component to display posts, sourcing content from Markdown files.
- **Contact & Newsletter**: Forms for newsletter signup and contact information display.
- **Social Media Integration**: Links to Instagram and WhatsApp for direct communication.
- **About Page**: A dedicated page (`src/app/sobre/page.tsx` - content not provided but referenced) for detailed information about the professional.
- **Responsive Design**: The application is designed to be fully responsive across different device sizes.
- **Custom Server**: A custom Next.js server (`server.ts`) that integrates Socket.IO, allowing for potential real-time features.