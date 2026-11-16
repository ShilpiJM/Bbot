# AWS Deployment & Infrastructure Requirements (Max 4 Users)

Yeh guide **Bbot & Visual Studio** application ko AWS par deploy karne ke liye design ki gayi hai. Kyunki traffic **maximum 4 active users** ka hai, isliye expensive multi-tier clusters (jaise EKS, Multi-AZ RDS, ya ALB) ki zaroorat nahi hai. Ek single, robust EC2 instance par sab kuch smoothly aur cost-effectively run ho jayega.

---

## 1. Architecture Overview (Single-Instance Setup)

```
                       [ 4 Team Users (Web Browser) ]
                                    │
                                    │ HTTPS (Port 443)
                                    ▼
                     ┌─────────────────────────────┐
                     │     AWS Elastic IP (EIP)    │
                     └──────────────┬──────────────┘
                                    │
                     ┌──────────────▼──────────────┐
                     │    Nginx Reverse Proxy      │  (SSL via Free Let's Encrypt)
                     │  (Rate Limiting & Security) │
                     └──────────────┬──────────────┘
                                    │ Loopback (127.0.0.1:8000)
                     ┌──────────────▼──────────────┐
                     │   FastAPI Backend (Uvicorn) │
                     │   + Built React SPA Client  │
                     └──────────────┬──────────────┘
                                    │
        ┌───────────────────────────┼───────────────────────────┐
        ▼                           ▼                           ▼
┌───────────────┐           ┌───────────────┐           ┌───────────────┐
│ SQLite DB     │           │ ChromaDB      │           │ LLM Engine    │
│ (Users, Auth, │           │ (Local Vector │           │ (External API │
│  Templates)   │           │  Store)       │           │  or GGUF GPU) │
└───────────────┘           └───────────────┘           └───────────────┘
```

---

## 2. Hardware & EC2 Instance Recommendation

Aapke LLM setup ke hisab se do options hain:

### Option A: External LLM API (Recommended - Cheapest & Fast)
> Agar aap LLM ke liye OpenAI (GPT-4o), Claude 3.5, Azure OpenAI, ya AWS Bedrock API use kar rahe hain:
* **EC2 Instance:** `t3.large` (2 vCPU, 8 GB RAM) ya `t3.xlarge` (4 vCPU, 16 GB RAM)
* **OS:** Ubuntu 22.04 LTS ya 24.04 LTS (64-bit x86)
* **Storage (EBS):** 50 GB General Purpose SSD (`gp3`, 3000 IOPS, 125 MB/s)
* **Estimated AWS Cost:** **~$30 – $60 / month**

### Option B: Local Self-Hosted LLM (On-Premise Privacy)
> Agar server ke andar hi local open-source model (GGUF Qwen 2.5 / Llama 3) GPU par chalana hai:
* **EC2 Instance:** `g4dn.xlarge` (4 vCPU, 16 GB RAM, 1x NVIDIA T4 16GB GPU)
* **OS:** Ubuntu 22.04 LTS (with NVIDIA Drivers + CUDA 12)
* **Storage (EBS):** 80 GB – 100 GB `gp3` (LLM models aur ChromaDB vectors ke liye)
* **Estimated AWS Cost:** **~$150 – $190 / month** (Spot instance me ~$50/month)

---

## 3. Network & Security Settings (AWS VPC & Security Group)

AWS Management Console me ek Security Group banayein (`bbot-security-group`):

| Type | Protocol | Port Range | Source | Purpose |
|---|---|---|---|---|
| **SSH** | TCP | `22` | `My IP` (Aapka Office/Home IP) | Server management (Never open to `0.0.0.0/0`) |
| **HTTP** | TCP | `80` | `0.0.0.0/0` (Anywhere) | Redirect to HTTPS & Let's Encrypt SSL renewal |
| **HTTPS** | TCP | `443` | `0.0.0.0/0` (Anywhere) | Secure web traffic for team users |

> **Important:** Port `8000` (FastAPI backend) ko bahar se **block** rakhein. Nginx internal loopback (`127.0.0.1:8000`) se communicate karega.

---

## 4. Required Software Stack (Single Box)

1. **Operating System:** Ubuntu 22.04 LTS (x86_64)
2. **Python:** Python 3.11 ya 3.12 (`python3-venv`, `python3-pip`, `build-essential`)
3. **Node.js:** Node.js v20 LTS + npm (Frontend static assets build karne ke liye)
4. **Web Server / Reverse Proxy:** Nginx (Stable)
5. **SSL Certificate:** Certbot (`python3-certbot-nginx` - 100% Free Auto-renewing SSL)
6. **Process Manager:** Linux `systemd` (Server reboot ya crash hone par auto-restart)

---

## 5. Step-by-Step Server Setup Commands

### Step 1: System Packages Update & Installation
```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y python3-pip python3-venv build-essential git nginx certbot python3-certbot-nginx curl

# Node.js 20 LTS Install
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
```

### Step 2: Application Code Setup
```bash
# Dedicated directory for application
sudo mkdir -p /opt/chatbot-2
sudo chown -R $USER:$USER /opt/chatbot-2

# Clone repository
git clone https://github.com/itinfraanalyst-spec/Bbot.git /opt/chatbot-2
cd /opt/chatbot-2

# Python Virtual Environment
python3 -m venv venv
source venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt

# Client Build (React SPA)
cd /opt/chatbot-2/client
npm install
npm run build
cd /opt/chatbot-2
```

### Step 3: Environment Variables Setup (`.env`)
Generate strong secrets and configure `/opt/chatbot-2/.env`:

```bash
# JWT Secret generate karein
python3 -c "import secrets; print(secrets.token_hex(32))"
```

Create `.env` file:
```ini
ENVIRONMENT=production
DATABASE_URL=sqlite:////opt/chatbot-2/chatbot.db
CHROMA_DB_PATH=/opt/chatbot-2/chroma_db
DOCUMENTS_DIR=/opt/chatbot-2/documents
JWT_SECRET=<YOUR_GENERATED_64_CHAR_HEX_SECRET>
COOKIE_SECURE=true
ALLOWED_ORIGINS=https://your-domain.com

# LLM Configuration (Choose one)
# For OpenAI / External:
OPENAI_API_KEY=sk-...
DEFAULT_MODEL=gpt-4o

# For Local GGUF (if using g4dn instance):
# MODEL_PATH=/opt/chatbot-2/models/model.gguf
# N_GPU_LAYERS=33
```
Secure permissions:
```bash
chmod 600 /opt/chatbot-2/.env
```

### Step 4: First Admin User Create Karein
```bash
python3 -m scripts.create_admin
# Username aur password enter karein (4 team members ke accounts approve karne ke liye)
```

### Step 5: Systemd Service Configuration
Create `/etc/systemd/system/chatbot.service`:
```ini
[Unit]
Description=Bbot & Visual Studio FastAPI Service
After=network.target

[Service]
User=ubuntu
WorkingDirectory=/opt/chatbot-2
Environment="PATH=/opt/chatbot-2/venv/bin"
ExecStart=/opt/chatbot-2/venv/bin/uvicorn main:app --host 127.0.0.1 --port 8000 --workers 2
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
```

Enable & Start service:
```bash
sudo systemctl daemon-reload
sudo systemctl enable chatbot
sudo systemctl start chatbot
sudo systemctl status chatbot
```

### Step 6: Nginx Reverse Proxy with SSL
Configure `/etc/nginx/sites-available/chatbot`:
```nginx
server {
    listen 80;
    server_name your-domain.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name your-domain.com;

    client_max_body_size 50M;

    location / {
        proxy_pass http://127.0.0.1:8000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 300;
        proxy_connect_timeout 300;
    }
}
```

Enable site & get Free SSL certificate:
```bash
sudo ln -s /etc/nginx/sites-available/chatbot /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx

# SSL Certificate generated in 30 seconds
sudo certbot --nginx -d your-domain.com
```

---

## 6. Monthly Cost Breakdown (For 4 People)

| Component | Specification | Monthly Cost (USD) |
|---|---|---|
| **EC2 Compute** | `t3.large` (2 vCPU, 8 GB RAM) | ~$60 / month |
| **Storage (EBS)** | 50 GB `gp3` SSD | ~$4.00 / month |
| **Elastic IP** | 1 Static IPv4 (Attached to instance) | ~$3.60 / month |
| **Bandwidth (Data Transfer)** | ~10 GB outbound for 4 users | ~$0.90 / month |
| **SSL Certificate** | Let's Encrypt Certbot | **$0.00 (Free)** |
| **Total Estimated Cost** | — | **~$68 / month** (~₹5,700 INR) |

> 💡 **Cost Optimization Tip:** Agar aap AWS **Savings Plans / 1-Year Reserved Instance** lete hain toh EC2 cost **40% kam (~$36/month)** ho jayegi.

---

## 7. Daily Backup & Maintenance (Zero Maintenance)

4 users ke data loss se bachne ke liye AWS me ek simple automated backup rule:
1. **AWS Backup / Lifecycle Manager:**
   * Apne EC2 instance ke EBS volume par **Daily Snapshot** enable karein (Retention: 7 days).
   * Iska monthly cost less than **$1** hota hai aur pura server 1-click me restore ho jata hai.
2. **Log Rotation:**
   * Nginx aur systemd logs automatic rotate hote hain, server storage fill up nahi hoga.
