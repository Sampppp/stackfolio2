# Production Guide for Stackfolio2 on a Home Server

This document walks you through deploying **Stackfolio2** (PocketBase backend + Vite/React frontend) on a home server using Docker, **Nginx** as a reverse proxy, and a **cloudflared** tunnel to expose the service securely over the internet.

---

## Prerequisites

| Requirement | Why we need it |
|-------------|----------------|
| **Docker & Docker‑Compose** | Runs the backend and frontend containers in isolation.
| **Nginx** (installed on the host) | Terminates TLS, forwards traffic to the Docker containers, and serves the built frontend assets.
| **cloudflared** (Cloudflare Tunnel client) | Provides a public HTTPS endpoint without opening ports on your router.
| **Domain name** managed in Cloudflare | Allows you to create a DNS‑record that points to the tunnel.
| **Git** (optional) | To clone the repository.

> **Tip:** All commands below assume you are logged in as a user with `sudo` privileges.

---

## 1. Clone the Repository & Prepare the Environment

```bash
# Choose a location for the project, e.g. /opt/stackfolio2
sudo mkdir -p /opt/stackfolio2 && sudo chown $(whoami):$(whoami) /opt/stackfolio2
cd /opt/stackfolio2

# Clone the repo (replace with your fork if you plan to modify)
git clone https://github.com/your‑username/stackfolio2.git .

# (Optional) Create a .env file for secrets – it will be ignored by git
cat > .env <<EOF
PB_ADMIN_EMAIL=admin@example.com
PB_ADMIN_PASSWORD=SuperSecret123!
EOF
```

---

## 2. Build Production Images

The existing `Dockerfile`s already support production builds. For the frontend we will build the static assets and then let Nginx serve them.

```bash
# Build backend image (PocketBase)
docker compose build backend

# Build frontend image (Vite) – this will produce a `dist/` folder inside the container.
docker compose build frontend

# Extract the built static files from the frontend container
docker create --name tmp_frontend stackfolio2_frontend
docker cp tmp_frontend:/app/dist ./frontend/dist
docker rm tmp_frontend
```

> **Note:** The `frontend/dist` directory now contains the production‑ready static site.

---

## 3. Set Up Nginx as a Reverse Proxy (with Automatic HTTPS via Let’s Encrypt)

### 3.1 Install Nginx and Certbot

```bash
sudo apt update && sudo apt install -y nginx certbot python3-certbot-nginx
```

### 3.2 Create a basic Nginx configuration (HTTP only for now)

Create a new site file, e.g. `/etc/nginx/sites-available/stackfolio2.conf`:

```nginx
server {
    listen 80;
    server_name stackfolio2.example.com;   # replace with your domain

    # ---- Frontend (static files) ----
    location / {
        root /opt/stackfolio2/frontend/dist;
        try_files $uri $uri/ /index.html;
    }

    # ---- Backend API (PocketBase) ----
    location /api/ {
        proxy_pass http://localhost:8090/;   # backend container port on host
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # PocketBase admin UI lives under /_/
    location /_/ {
        proxy_pass http://localhost:8090/_/;
        proxy_set_header Host $host;
    }
}
```

Enable the site and test the config:

```bash
sudo ln -s /etc/nginx/sites-available/stackfolio2.conf /etc/nginx/sites-enabled/
sudo nginx -t   # verify config
sudo systemctl reload nginx
```

### 3.3 Obtain a Let’s Encrypt certificate automatically

Run Certbot with the Nginx plugin – it will obtain a certificate and modify the
configuration to listen on port **443** with TLS termination.

```bash
sudo certbot --nginx -d stackfolio2.example.com
```

During the interactive prompt, choose **Redirect HTTP to HTTPS**. Certbot will:
1. Request a certificate from Let’s Encrypt.
2. Replace the `listen 80;` block with a `listen 443 ssl;` block that references
   the newly created certificate files (`/etc/letsencrypt/live/…/fullchain.pem`
   and `privkey.pem`).
3. Add a small HTTP‑to‑HTTPS redirect server block.

You can verify the final configuration with:

```bash
sudo nginx -t
sudo systemctl reload nginx
```

### 3.4 Automatic renewal

Let’s Encrypt certificates are valid for 90 days. Certbot installs a systemd
timer that runs `certbot renew` twice daily. To test the renewal process:

```bash
sudo certbot renew --dry-run
```

If the dry‑run succeeds, the timer will keep your certificates up‑to‑date and
reload Nginx automatically.

---

## 4. Deploy the Docker Stack

```bash
docker compose up -d
```

The containers will start:
* **backend** listening on host port **8090** (only reachable locally – Nginx proxies it).
* **frontend** container is no longer needed for serving; we extracted the static files.

---

## 5. Secure the PocketBase Admin Account

1. Open the admin UI via the tunnel URL (see step 6) – it will forward to `http://localhost:8090/_/`.
2. Log in with the temporary credentials created by the migration:
   * **Email:** `temp.email@gmail.com`
   * **Password:** `temp.password`
3. In the admin UI, create a new admin user with a strong password.
4. Delete the temporary user.
5. (Optional) Remove the temporary‑user creation code from `backend/pb_migrations/170000000_init_photos.js` and rely on the environment variables defined in `.env`.

---

## 6. Install & Configure cloudflared Tunnel

### 6.1 Install cloudflared

```bash
# Debian/Ubuntu example
wget -q https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb
sudo dpkg -i cloudflared-linux-amd64.deb
```

### 6.2 Authenticate with Cloudflare

```bash
cloudflared tunnel login
```

This opens a browser window – log in to your Cloudflare account and authorize.

### 6.3 Create a Tunnel

```bash
cloudflared tunnel create stackfolio2-tunnel
```

Take note of the generated **Tunnel UUID** – you’ll need it for the config.

### 6.4 Create a Tunnel Configuration

Create a YAML file at `~/.cloudflared/config.yml` (or `/etc/cloudflared/config.yml` for system‑wide):

```yaml
tunnel: <TUNNEL-UUID>
credentials-file: /home/$(whoami)/.cloudflared/<TUNNEL-UUID>.json

ingress:
  - hostname: stackfolio2.example.com   # your domain/sub‑domain
    service: https://localhost  # forwards to Nginx which listens on 443
  - service: http_status:404
```

Replace `<TUNNEL-UUID>` with the value from the previous step and `stackfolio2.example.com` with your actual domain.

### 6.5 Add a DNS Record in Cloudflare

In the Cloudflare dashboard, go to **DNS** → **Add Record**:
* **Type:** CNAME
* **Name:** `stackfolio2` (or whatever sub‑domain you chose)
* **Target:** `@` (or the tunnel’s automatic CNAME `stackfolio2-tunnel.cfargotunnel.com` – Cloudflare will fill this after you run the tunnel).

### 6.6 Run the Tunnel as a Service

```bash
# Create a systemd service (optional but recommended)
sudo tee /etc/systemd/system/cloudflared.service > /dev/null <<'EOF'
[Unit]
Description=cloudflared tunnel
After=network-online.target
Wants=network-online.target

[Service]
Type=exec
ExecStart=/usr/local/bin/cloudflared tunnel run stackfolio2-tunnel
Restart=on-failure
User=$(whoami)
Group=$(whoami)

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl enable cloudflared
sudo systemctl start cloudflared
```

You should now see a **CNAME** entry in Cloudflare pointing to `...cfargotunnel.com`. The tunnel will forward HTTPS traffic to your home server’s Nginx, which in turn proxies to the Docker containers.

---

## 7. Verify the Deployment

1. Open a browser and navigate to `https://stackfolio2.example.com`.
2. The frontend should load, and API calls will be proxied to PocketBase.
3. Access the admin UI at `https://stackfolio2.example.com/_/` and confirm you can log in with the new admin account.

---

## 8. Maintenance & Updates

* **Updating the app** – Pull new changes, rebuild the frontend `dist/`, and restart the Docker stack:
  ```bash
  git pull && docker compose build backend frontend && docker compose up -d
  ```
* **Renewing the tunnel** – The tunnel runs as a systemd service; it will reconnect automatically if the connection drops.
* **Backups** – Periodically back up the Docker volume `pb_data`:
  ```bash
  docker run --rm -v stackfolio2_pb_data:/data -v $(pwd):/backup alpine tar czf /backup/pb_data_$(date +%F).tar.gz /data
  ```

---

## 9. Troubleshooting

| Symptom | Likely Cause | Fix |
|---------|--------------|-----|
| Nginx returns 502 | Backend container not reachable on 8090 | `docker compose ps` – ensure `backend` is up; check firewall rules. |
| Cloudflare tunnel shows *offline* | Service not running or wrong credentials | `sudo systemctl status cloudflared` – restart if needed; verify `config.yml`. |
| Static assets not loading | Wrong `root` path in Nginx config | Ensure `root` points to the absolute path of `frontend/dist`. |

---

## 10. Optional Enhancements

* **Automatic HTTPS with Let’s Encrypt** – If you prefer Nginx to handle TLS directly, obtain a cert with Certbot and point the tunnel to `http://localhost` (port 80) instead of 443.
* **Failover** – Run a second instance of the stack on another machine and configure Cloudflare Load Balancing.
* **Monitoring** – Add Prometheus + Grafana containers to monitor container health and resource usage.

---

**Enjoy your self‑hosted photo gallery!**
