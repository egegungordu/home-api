# Home API (Bun + Hono)

TEPCO Electric Usage Data Collector - A Raspberry Pi-hosted service to automatically collect daily electric usage data from TEPCO's API using headless browser authentication.

## Features

- **Browser Authentication**: Uses Playwright to handle TEPCO login and extract bearer tokens
- **Smart Data Collection**: Implements upsert logic to handle intraday data changes
- **SQLite Storage**: Local database with proper data finality tracking
- **REST API**: Endpoints for data access and collection management
- **Automated Scheduling**: Cron jobs for regular data collection

## Quick Start

### 1. Install Dependencies

```sh
bun install
```

### 2. Install Browser

```sh
bunx playwright install chromium
```

### 3. Set Environment Variables

Create a `.env` file with your TEPCO credentials:

```bash
TEPCO_USERNAME=your_tepco_email
TEPCO_PASSWORD=your_tepco_password
DB_PATH=./data/tepco.db
PORT=3000
LOG_LEVEL=info
```

### 4. Run Database Migrations

```sh
bun run migrate
```

### 5. Start Development Server

```sh
bun run dev
```

The server will be available at `http://localhost:3000`

## API Endpoints

### Health Check

```text
GET /api/health
```

### Electric Usage Data

```text
GET  /api/electric/daily/:date           # Single day usage (YYYYMMDD)
GET  /api/electric/daily/range/:from/:to # Date range
GET  /api/electric/monthly/:yearMonth    # Monthly aggregate (YYYYMM)
```

### Collection Management

```text
POST /api/electric/collect/yesterday    # Collect yesterday's finalized data
POST /api/electric/collect/backfill     # Backfill missing dates
```

## Testing Authentication

Test the complete authentication and data collection flow:

```sh
TEPCO_USERNAME=your_email TEPCO_PASSWORD=your_password bun run test-auth.ts
```

## Data Collection Strategy

The service implements a simplified data collection strategy based on TEPCO's API behavior:

**Key Insight**: TEPCO only provides finalized data for completed days, not intraday updates.

1. **Daily Collection**: Collect yesterday's finalized data at 1:00 AM daily
2. **Weekly Backfill**: Check for any missing dates in the last 30 days
3. **Historical Backfill**: Monthly check for missing dates
4. **Token Management**: Automatic refresh every 6 hours

This approach is more reliable and efficient since:

- No need for complex finality tracking
- All data is final by definition
- Single daily collection instead of multiple attempts
- Reduced API calls and browser automation

## Database Schema

- `daily_usage`: Electric usage records with finality tracking
- `auth_sessions`: Stored bearer tokens and session data
- `collection_logs`: Execution logs for collection jobs

## Development

### Scripts

- `bun run dev` - Start development server with hot reload
- `bun run start` - Start production server
- `bun run migrate` - Run database migrations
- `bun run collect` - Manual data collection
- `bun run test` - Run tests
- `bun run build` - Build for production

### Project Structure

```
src/
├── app.ts              # Main Hono application
├── types/              # TypeScript type definitions
├── config/             # Configuration management
├── auth/               # Browser authentication
├── collectors/         # Data collection from TEPCO API
├── database/           # Database operations and migrations
├── routes/             # API endpoint definitions
├── scheduler/          # Cron job definitions
└── utils/              # Logging and utilities
```

## Production Deployment

### On Raspberry Pi

1. Build the application:

   ```sh
   bun run build
   ```

2. Set up PM2 or systemd for process management

3. Configure environment variables for production

4. Set up cron jobs for automated collection

### Environment Variables

| Variable           | Description                  | Default            |
| ------------------ | ---------------------------- | ------------------ |
| `TEPCO_USERNAME`   | TEPCO login email            | Required           |
| `TEPCO_PASSWORD`   | TEPCO login password         | Required           |
| `DB_PATH`          | SQLite database path         | `./data/tepco.db`  |
| `PORT`             | Server port                  | `3000`             |
| `LOG_LEVEL`        | Logging level                | `info`             |
| `BROWSER_HEADLESS` | Run browser in headless mode | `false` (reliable) |

**Note**: TEPCO's site has sophisticated bot detection, so we default to non-headless mode for reliability. Set `BROWSER_HEADLESS=true` only if you're certain it works in your environment.

## Troubleshooting

### Browser Issues

- Ensure Chromium is installed: `bunx playwright install chromium`
- Check if running in headless environment (Raspberry Pi)
- Verify network connectivity to TEPCO domains

### Authentication Issues

- Verify TEPCO credentials are correct
- Check if TEPCO has changed their login flow
- Monitor browser console for errors

### Data Collection Issues

- Verify bearer token is valid and not expired
- Check TEPCO API endpoint availability
- Review collection logs for specific error details

## License

MIT License - see LICENSE file for details.
