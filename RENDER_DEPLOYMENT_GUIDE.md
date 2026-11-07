# Deploying GymGo to Render (Render.com)

GymGo is pre-configured for deployment to **Render** as a full-stack Node.js Web Service. Both the backend API and frontend Single Page Application (SPA) are served from a single unified service.

---

## Architecture on Render

```
                   Render Web Service (Free Tier / Paid)
                   ┌──────────────────────────────────────────────┐
                   │  Port: process.env.PORT (e.g. 10000)         │
                   │  Host: 0.0.0.0                               │
                   │                                              │  
HTTP Requests ───► │  Express.js Server (backend/server.js)       │
                   ├──────────────────────┬───────────────────────┤
                   │  Frontend SPA Static │  REST APIs            │
                   │  /css, /js, index    │  /api/auth, /api/gyms │
                   │  /api/health (200 OK)│  /api/bookings, etc.  │
                   └──────────────────────┴───────────┬───────────┘
                                                      │
                       Dual Storage Engine (backend/db.js)
                       ├── Mode A: MongoDB Atlas (Cloud Persistent)
                       │   Set MONGODB_URI in Render dashboard
                       │   Data persists forever across spins/restarts
                       │
                       └── Mode B: Local / Self-Healing Storage (Zero Setup)
                           No MONGODB_URI required
                           Works out-of-the-box on deploy
```

---

## Option 1: 1-Click Blueprint Deploy (Fastest)

GymGo includes a `render.yaml` blueprint file in the repository root.

1. Push this project to your GitHub or GitLab repository.
2. Go to your [Render Dashboard](https://dashboard.render.com/).
3. Click **New +** in the top navigation and select **Blueprint**.
4. Connect your GitHub repository.
5. Render will automatically detect `render.yaml`:
   - Service Name: `gymgo`
   - Runtime: `Node`
   - Build Command: `npm install`
   - Start Command: `npm start`
   - Health Check Path: `/api/health`
6. Click **Apply**. Render will build and deploy your app. You will receive a live URL:
   `https://gymgo.onrender.com`

---

## Option 2: Manual Web Service Deploy

If you prefer to configure the Web Service manually:

1. Push your repository to GitHub.
2. In the Render Dashboard, click **New +** ➔ **Web Service**.
3. Choose **Build and deploy from a Git repository** and connect your repo.
4. Fill in the following fields:
   - **Name**: `gymgo` (or your preferred name)
   - **Region**: Choose the region closest to your users (e.g., Singapore, Frankfurt, Oregon)
   - **Branch**: `main` (or `master`)
   - **Runtime**: `Node`
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Instance Type**: `Free`
5. Expand **Advanced** and set **Health Check Path**:
   - `/api/health`
6. Click **Create Web Service**.

---

## Enabling Permanent Cloud Persistence (MongoDB Atlas)

On Render's Free tier, the local filesystem resets whenever a container spins down after inactivity. To persist all user sign-ups, workouts, bookings, and passport stamps permanently:

1. Create a free account at [MongoDB Atlas](https://www.mongodb.com/cloud/atlas).
2. Create a free shared cluster (**M0 Free**).
3. Under **Database Access**, create a user (e.g., username `gymgo_admin`, password `your_password`).
4. Under **Network Access**, add IP `0.0.0.0/0` (allow access from anywhere, standard for cloud hosts like Render).
5. Click **Connect** ➔ **Drivers** ➔ Copy the connection string:
   ```
   mongodb+srv://gymgo_admin:<password>@cluster0.abcde.mongodb.net/gymgo?retryWrites=true&w=majority
   ```
6. In your Render Web Service dashboard:
   - Go to **Environment** tab.
   - Add environment variable:
     - **Key**: `MONGODB_URI`
     - **Value**: Your copied connection string (with your real password).
   - Click **Save Changes**.
7. Render will automatically redeploy. On startup, GymGo will log:
   `✅ Connected to MongoDB Atlas! Cloud persistence active for GymGo.`
   All collections are synced to the cloud.

---

## Environment Variables Reference

| Variable | Required? | Default | Description |
|---|---|---|---|
| `PORT` | Auto (Render) | `10000` / `3000` | Port assigned by Render automatically |
| `NODE_ENV` | Optional | `production` | Environment mode |
| `MONGODB_URI` | Optional | (local file) | MongoDB Atlas connection string for cloud persistence |
| `JWT_SECRET` | Optional | Generated | Secret for session tokens and signatures |
| `GEMINI_API_KEY` | Optional | (built-in AI logic) | Google Gemini API key for AI fitness coaching |
| `RAZORPAY_KEY_ID` | Optional | (UPI fallback) | Razorpay payment gateway key |
| `RAZORPAY_KEY_SECRET` | Optional | (UPI fallback) | Razorpay secret key |

---

## Verifying Deployment Health

Once deployed on Render, visit:
- **App URL**: `https://<your-service>.onrender.com`
- **Health Check**: `https://<your-service>.onrender.com/api/health`

Expected health check response:
```json
{
  "status": "healthy",
  "uptime": 124,
  "timestamp": "2026-10-20T17:40:00.000Z",
  "env": "production",
  "port": 10000,
  "database": {
    "mode": "mongodb_cloud",
    "connected": true,
    "mongoConfigured": true
  }
}
```
