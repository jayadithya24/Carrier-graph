# Vercel Deployment Guide

## Prerequisites
- GitHub repo with this project pushed.
- Neo4j Aura instance running.
- Vercel account connected to GitHub.

## Step-by-step deployment
1. Open Vercel and click New Project.
2. Import your GitHub repo.
3. Set Root Directory to the repo root (not frontend).
4. In Project Settings -> Environment Variables, add:
   - NEO4J_URI
   - NEO4J_USER
   - NEO4J_PASSWORD
   - NEO4J_DATABASE
   - FRONTEND_URL = https://carrier-graph.vercel.app/
5. In Project Settings -> Build & Output:
   - Framework Preset: Other
   - Build Command: (leave blank)
   - Output Directory: frontend
6. Deploy the project.
7. After deployment, test these URLs:
   - https://carrier-graph.vercel.app/api/
   - https://carrier-graph.vercel.app/api/graph

## Notes
- Backend is served by Vercel serverless functions in api/index.py.
- Frontend calls the backend at /api by default.

## Troubleshooting
- 404 on /api: confirm Root Directory is repo root and redeploy.
- 403 Forbidden: re-check Vercel deployment status and confirm the project is deployed from the correct repo/branch.
- Neo4j connection errors: verify NEO4J_* values in Vercel settings.
