# Railway Deployment Guide for TyreShop Pro

This guide walks you through deploying TyreShop Pro backend to Railway with PostgreSQL.

## Prerequisites

1. [Railway account](https://railway.app) (free tier available)
2. [GitHub account](https://github.com)
3. Your TyreShop Pro code pushed to a GitHub repository

## Step 1: Prepare Your Repository

1. Commit all your changes to git:
```bash
git add .
git commit -m "Prepare for Railway deployment"
git push origin main
```

## Step 2: Create Railway Project

1. Go to [railway.app](https://railway.app) and log in
2. Click "New Project"
3. Select "Deploy from GitHub repo"
4. Choose your TyreShop Pro repository
5. Click "Add Variables"

## Step 3: Add PostgreSQL Database

1. In your Railway project dashboard, click "New"
2. Select "Database" → "Add PostgreSQL"
3. Railway will automatically create the database and set `DATABASE_URL` for you

## Step 4: Configure Environment Variables

Add these variables in Railway Dashboard (Variables tab):

```
DATABASE_URL=${{Postgres.DATABASE_URL}}  # Auto-generated
JWT_SECRET=your_super_secret_jwt_key_here_min_32_chars
JWT_EXPIRES_IN=7d
NODE_ENV=production
PORT=4000
APP_BASE_URL=https://your-app-name.up.railway.app  # Will get this after deploy
SHOP_NAME=SRI MAHALAKSHMI TYRES & Wash
SHOP_PHONE=9000909817
SHOP_ADDRESS=Your full shop address here
SHOP_GSTIN=YOUR_GSTIN_HERE
```

**Note:** Replace `your-app-name` with your actual Railway app name after first deploy.

## Step 5: Deploy!

1. Railway will automatically deploy your app
2. Wait for the deployment to complete
3. Copy the generated URL (e.g., `https://tyreshop-pro.up.railway.app`)
4. Update `APP_BASE_URL` variable with this URL

## Step 6: Run Database Migration (Transfer Data from SQLite)

If you have existing data in SQLite that you want to migrate:

### Option A: Using Railway CLI (Recommended)

1. Install Railway CLI:
```bash
npm install -g @railway/cli
```

2. Login and link your project:
```bash
railway login
railway link
```

3. Run migration locally (with Railway database):
```bash
cd backend
railway run node src/db/migrate-to-postgres.js
```

### Option B: Direct Migration Script

1. Get your DATABASE_URL from Railway dashboard
2. Run locally:
```bash
cd backend
export DATABASE_URL=postgresql://...
export SQLITE_DB_PATH=./data/tyreshop.db
node src/db/migrate-to-postgres.js
```

## Step 7: Test Your Deployment

1. Visit `https://your-app.up.railway.app/health`
2. You should see: `{"status":"ok"}`

## Step 8: Deploy Frontend

For the web frontend, deploy to Vercel:

1. Push your web code to the same repo (or create a separate frontend repo)
2. Go to [vercel.com](https://vercel.com)
3. Import your project
4. Add environment variable:
   - Name: `VITE_BASE_URL`
   - Value: `https://your-backend.up.railway.app`
5. Deploy!

## Troubleshooting

### Database Connection Issues
- Check that `DATABASE_URL` is set correctly
- Ensure PostgreSQL addon is provisioned
- Check Railway logs for connection errors

### CORS Errors
- Update CORS in `app.js` to allow your frontend domain
- Or set `origin: '*'` for testing

### Migration Errors
- Ensure your local SQLite database exists at `./data/tyreshop.db`
- Check that all UUIDs in SQLite are valid
- Some data might need manual cleanup

## Cost Estimation (Railway)

- **Free Tier**: $5 credit/month (about 500 hours runtime)
- **PostgreSQL**: Included in free tier (0.5GB storage)
- **Paid Plans**: Start at $5/month

For a small tyre shop, the free tier should be sufficient initially.

## Files Created/Modified

- `backend/src/db/postgres.js` - PostgreSQL connection module
- `backend/src/db/postgres_schema.sql` - Database schema
- `backend/src/db/migrate-to-postgres.js` - Data migration script
- `backend/railway.toml` - Railway configuration
- `backend/nixpacks.toml` - Build configuration
- `backend/.env.example` - Updated with PostgreSQL settings

## Support

For Railway-specific issues, check:
- [Railway Documentation](https://docs.railway.app)
- [Railway Discord](https://discord.gg/railway)

For app issues, refer to the main README.
