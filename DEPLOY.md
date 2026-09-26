# Deploying KrishiMitra AI on a VPS (Docker)

This setup runs two containers: the FastAPI app, which also serves the React web app and PWA, and Caddy. Caddy sits in front of the app and handles HTTPS automatically with Let's Encrypt.

```
Internet ──443──▶ caddy ──▶ api:8000  (FastAPI API + React app at /app)
```

| File | Purpose |
|---|---|
| `Dockerfile.prod` | Builds the React app, then a CPU-only Python image that runs as a non-root user. The embedding model is built into the image. |
| `docker-compose.prod.yml` | Production stack: the api and caddy services |
| `deploy/Caddyfile` | Reverse proxy, TLS, 20 MB upload limit, security headers |
| `deploy/entrypoint.sh` | Seeds the knowledge base on first boot |
| `.env.production.example` | Template for `.env` on the server |
| `.dockerignore` | Keeps secrets, venvs, and runtime data out of the image |

## 1. VPS requirements

- Ubuntu 22.04 or 24.04 (any Linux with Docker works)
- **At least 4 GB RAM** (8 GB recommended) and **15 GB disk**. The embedding model and torch together take about 3 GB.
- A domain, or a subdomain, with an **A record pointing at the VPS IP**
- Ports **80** and **443** open

## 2. Install Docker

```bash
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker $USER && newgrp docker
```

If the VPS has only 4 GB of RAM, add swap:

```bash
sudo fallocate -l 4G /swapfile && sudo chmod 600 /swapfile
sudo mkswap /swapfile && sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```

Firewall:

```bash
sudo ufw allow OpenSSH && sudo ufw allow 80 && sudo ufw allow 443/tcp && sudo ufw allow 443/udp
sudo ufw enable
```

## 3. Get the code and configure

```bash
git clone https://github.com/AllwynGeorgeA/KrishiMitraAI_RAG.git
cd KrishiMitraAI_RAG
cp .env.production.example .env
nano .env        # set DOMAIN, ACME_EMAIL, OPENAI_API_KEY
```

`OPENAI_API_KEY` is optional. Without it, the app falls back to its extractive answer builder.

## 4. Launch

```bash
docker compose -f docker-compose.prod.yml up -d --build
docker compose -f docker-compose.prod.yml logs -f api
```

The first build takes about 10–15 minutes. On first boot, the API seeds the vector store and knowledge graph from `data/raw/vikaspedia_documents.json`, which takes a few minutes. Wait for Uvicorn's "Application startup complete" line in the logs.

Then open **https://YOUR_DOMAIN**. It redirects to the React app at `/app/`. On a phone, use "Add to Home Screen" to install the PWA.

Health check: `curl https://YOUR_DOMAIN/health`

## 5. Day-to-day operations

| Task | Command |
|---|---|
| Update to latest code | `git pull && docker compose -f docker-compose.prod.yml up -d --build` |
| View logs | `docker compose -f docker-compose.prod.yml logs -f` |
| Restart | `docker compose -f docker-compose.prod.yml restart api` |
| Re-seed the knowledge base | `docker compose -f docker-compose.prod.yml exec api python scripts/demo_seed.py` |
| Stop | `docker compose -f docker-compose.prod.yml down` |
| Clean old images | `docker image prune -f` |

All data lives in the `krishimitra-data` Docker volume: vector store, knowledge graph, uploads, and `conversations.db`. It survives rebuilds.

Backup:

```bash
docker run --rm -v krishimitraai_rag_krishimitra-data:/data -v $PWD:/backup alpine \
  tar czf /backup/krishimitra-data-$(date +%F).tgz -C /data .
```

The volume name is prefixed with the project folder name. Check it with `docker volume ls`.

To wipe the data and re-seed from scratch: `docker compose -f docker-compose.prod.yml down -v`. This also deletes the Caddy certificates.

## Notes and caveats

- **No authentication.** Conversation history is one shared SQLite file, so every visitor sees the same history. See the README. Before sharing the URL publicly, consider adding Caddy `basic_auth` in `deploy/Caddyfile`.
- The crawler (Playwright/Chromium) is **not** installed in the production image. Run crawls locally, commit `data/raw/vikaspedia_documents.json`, and re-seed.
- Testing without a domain: in `deploy/Caddyfile`, replace `{$DOMAIN}` with `:80` and browse to `http://VPS_IP`. The PWA install needs HTTPS, so it won't work this way.
