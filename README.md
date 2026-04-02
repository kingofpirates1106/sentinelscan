# SentinelScan - Security Threat Scanner

A modern full-stack cybersecurity web application that helps users scan URLs and files for security threats, track scan history, and view security insights. Built with Next.js, Supabase, and VirusTotal API integration.

## Features

### URL Scanner
- Submit URLs for real-time threat analysis
- Risk level indicators (Safe, Suspicious, Malicious)
- VirusTotal threat intelligence
- Scan history tracking
- Guest limit: 3 scans/day | Logged-in: Unlimited

### File Scanner
- Upload files (up to 32MB) for security scanning
- SHA-256 file hashing
- VirusTotal file analysis
- Detailed threat reports
- Guest limit: 3 scans/day | Logged-in: Unlimited

### Dashboard (Logged-in Only)
- Total scan statistics
- URL vs File scan breakdown
- Threats detected counter
- 14-day scan history table
- Real-time status updates

### Security Insights (Logged-in Only)
- Threat distribution charts
- Scan type analytics
- Recent threat tracking
- Historical trend analysis

### Authentication
- Email + password authentication via Supabase
- Secure session management
- Protected routes for dashboard & insights
- Sign up, login, logout flows

## Tech Stack

- **Frontend**: Next.js 16 (App Router) + TypeScript + React 19
- **Styling**: Tailwind CSS (Dark theme)
- **Backend**: Next.js API Routes
- **Database**: Supabase (PostgreSQL)
- **Authentication**: Supabase Auth (Email/Password)
- **Threat Intelligence**: VirusTotal API
- **Visualization**: Recharts

## Project Structure

```
├── app/
│   ├── page.tsx                 # Landing page
│   ├── layout.tsx               # Root layout
│   ├── globals.css              # Global styles
│   ├── auth/
│   │   ├── login/page.tsx       # Login page
│   │   ├── sign-up/page.tsx     # Sign up page
│   │   ├── sign-up-success/page.tsx
│   │   ├── error/page.tsx
│   │   └── logout/route.ts
│   ├── scan-url/page.tsx        # URL scanner UI
│   ├── scan-file/page.tsx       # File scanner UI
│   ├── dashboard/page.tsx       # Dashboard (protected)
│   ├── insights/page.tsx        # Analytics (protected)
│   └── api/
│       ├── scan-url/route.ts    # URL scan API
│       ├── scan-file/route.ts   # File scan API
│       └── scan-status/[id]/route.ts
├── lib/
│   └── supabase/
│       ├── client.ts            # Client-side Supabase
│       ├── server.ts            # Server-side Supabase
│       └── proxy.ts             # Session middleware
├── middleware.ts                # Next.js middleware
├── package.json
├── tailwind.config.ts
└── tsconfig.json
```

## Setup

### Prerequisites
- Node.js 18+
- Supabase account
- VirusTotal API key

### Environment Variables

Create a `.env.local` file:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key_here
NEXT_PUBLIC_DEV_SUPABASE_REDIRECT_URL=http://localhost:3000/dashboard
VIRUSTOTAL_API_KEY=your_api_key_here
```

### Installation

```bash
npm install
```

### Development

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Build & Deploy

```bash
npm run build
npm start
```

Deploy to Vercel:
```bash
vercel
```

## Database Schema

### profiles
- `id` (UUID) - User ID
- `username` (text)
- `email` (text)
- `created_at`, `updated_at` (timestamps)

### scans
- `id` (UUID)
- `user_id` (UUID) - User who performed scan
- `scan_type` (text) - 'url' or 'file'
- `target` (text) - URL or file hash
- `status` (text) - 'pending', 'scanning', 'completed', 'failed'
- `virustotal_id` (text) - VirusTotal analysis ID
- `created_at`, `updated_at` (timestamps)

### scan_results
- `id` (UUID)
- `scan_id` (UUID) - Reference to scan
- `user_id` (UUID)
- `harmless_count`, `malicious_count`, `suspicious_count`, `undetected_count` (integers)
- `threat_level` (text) - 'safe', 'suspicious', 'dangerous', 'unknown'
- `details` (jsonb) - Full VirusTotal response
- `created_at` (timestamp)

## Security Features

- Row Level Security (RLS) on Supabase tables
- Protected routes via middleware
- Server-side authentication checks
- Secure API key handling via environment variables
- CSRF protection via Next.js
- XSS prevention via React escaping

## Performance

- Server-side rendering for faster first paint
- Client-side polling for scan status updates
- Database indexes on commonly queried fields
- Efficient scan history pagination (14-day window)
- Optimized image loading with next/image

## Limits

- **Guest Users**: 3 URL scans + 3 file scans per day
- **File Size**: Maximum 32MB
- **Scan History**: Retained for 14 days (customizable)
- **API Polling**: 30 attempts with 2-second intervals

## Future Enhancements

- Email notifications for scan completions
- Scheduled scanning
- Custom threat level alerts
- Export scan reports as PDF
- Team collaboration features
- API rate limiting per user

## Support

For issues or questions, please check the [VirusTotal API documentation](https://developers.virustotal.com/reference) or [Supabase documentation](https://supabase.com/docs).

## License

MIT
