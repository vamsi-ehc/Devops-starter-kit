# Devops-starter-kit
this is a repository to implement the project using topics for Devops, NEXTJS, Jenkins, GitHub actions, Docker, firebase


# Next.js + Docker + GitHub Actions → EC2 (Starter)

This document is a complete, copy-pasteable starter for a small **Next.js ToDo app** plus Docker, `docker-compose`, a GitHub Actions CI/CD workflow that builds and pushes a Docker image, and deployment instructions to an AWS EC2 instance. It is designed to be runnable **locally** and **on EC2** with minimal changes.

---

## What you get here

* A minimal **Next.js** app (pages router) with a tiny client and API routes that provide a CRUD ToDo endpoint. The app persists to a local `data/db.json` file by default (so it works out of the box). Optionally you can replace persistence with Firestore in future.
* `Dockerfile` (multi-stage) for production build.
* `docker-compose.yml` that runs the Next.js app and an `nginx` reverse-proxy.
* `nginx.conf` used by the nginx container to proxy traffic to the app.
* A GitHub Actions workflow (`.github/workflows/ci-deploy.yml`) that builds and pushes an image to Docker Hub and SSHes to EC2 to run `docker-compose pull && docker-compose up -d`.
* Clear step-by-step instructions to run locally and deploy to EC2.

> **Note:** this starter uses a simple file-based database at `data/db.json`. It is intentionally simple for learning and demo purposes. If you want Firestore integration later, the doc explains where to plug it in.

---

## Project layout

```
nextjs-ec2-starter/
├── .github/
│   └── workflows/ci-deploy.yml
├── data/
│   └── db.json
├── docker-compose.yml
├── Dockerfile
├── nginx.conf
├── lib/
│   └── db.js
├── pages/
│   ├── api/
│   │   ├── todos/[id].js
│   │   └── todos/index.js
│   └── index.js
├── package.json
└── README.md
```

---

## 1) Full file contents (copy these into your project)

> **Important:** copy each file exactly into the same path as shown above. After that follow the *Quick start* below.

### `package.json`

```json
{
  "name": "nextjs-ec2-starter",
  "version": "1.0.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start -p 3000",
    "lint": "next lint"
  },
  "dependencies": {
    "next": "13.4.20",
    "react": "18.2.0",
    "react-dom": "18.2.0"
  }
}
```

---

### `data/db.json` (initial)

```json
{
  "todos": []
}
```

---

### `lib/db.js`

```js
import fs from 'fs/promises'
import path from 'path'

const DB_PATH = path.join(process.cwd(), 'data', 'db.json')

async function ensureDB() {
  await fs.mkdir(path.dirname(DB_PATH), { recursive: true })
  try {
    await fs.access(DB_PATH)
  } catch (e) {
    await fs.writeFile(DB_PATH, JSON.stringify({ todos: [] }, null, 2), 'utf8')
  }
}

export async function readDB() {
  await ensureDB()
  const raw = await fs.readFile(DB_PATH, 'utf8')
  return JSON.parse(raw)
}

export async function writeDB(data) {
  await ensureDB()
  await fs.writeFile(DB_PATH, JSON.stringify(data, null, 2), 'utf8')
}
```

---

### `pages/api/todos/index.js` (GET list, POST create)

```js
import { readDB, writeDB } from '../../../lib/db'

export default async function handler(req, res) {
  if (req.method === 'GET') {
    const db = await readDB()
    return res.status(200).json(db.todos)
  }

  if (req.method === 'POST') {
    const { text } = req.body
    if (!text || typeof text !== 'string') return res.status(400).json({ error: 'text required' })

    const db = await readDB()
    const id = Date.now().toString()
    const todo = { id, text, done: false, createdAt: new Date().toISOString() }
    db.todos.push(todo)
    await writeDB(db)
    return res.status(201).json(todo)
  }

  res.setHeader('Allow', 'GET, POST')
  res.status(405).end('Method Not Allowed')
}
```

---

### `pages/api/todos/[id].js` (GET single, PUT update, DELETE)

```js
import { readDB, writeDB } from '../../../../lib/db'

export default async function handler(req, res) {
  const { id } = req.query
  const db = await readDB()
  const idx = db.todos.findIndex((t) => t.id === id)
  if (idx === -1) return res.status(404).json({ error: 'not found' })

  if (req.method === 'GET') {
    return res.status(200).json(db.todos[idx])
  }

  if (req.method === 'PUT') {
    const { text, done } = req.body
    if (text !== undefined) db.todos[idx].text = text
    if (done !== undefined) db.todos[idx].done = !!done
    db.todos[idx].updatedAt = new Date().toISOString()
    await writeDB(db)
    return res.status(200).json(db.todos[idx])
  }

  if (req.method === 'DELETE') {
    const [removed] = db.todos.splice(idx, 1)
    await writeDB(db)
    return res.status(200).json(removed)
  }

  res.setHeader('Allow', 'GET, PUT, DELETE')
  res.status(405).end('Method Not Allowed')
}
```

---

### `pages/index.js` (client UI)

```jsx
import { useEffect, useState } from 'react'

export default function Home() {
  const [todos, setTodos] = useState([])
  const [text, setText] = useState('')
  const [loading, setLoading] = useState(false)

  async function fetchTodos() {
    setLoading(true)
    try {
      const res = await fetch('/api/todos')
      const data = await res.json()
      setTodos(data)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchTodos()
  }, [])

  async function addTodo(e) {
    e.preventDefault()
    if (!text.trim()) return
    const res = await fetch('/api/todos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text })
    })
    const newTodo = await res.json()
    setTodos((s) => [...s, newTodo])
    setText('')
  }

  async function toggleDone(id, done) {
    const res = await fetch(`/api/todos/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ done: !done })
    })
    const updated = await res.json()
    setTodos((s) => s.map((t) => (t.id === id ? updated : t)))
  }

  async function removeTodo(id) {
    await fetch(`/api/todos/${id}`, { method: 'DELETE' })
    setTodos((s) => s.filter((t) => t.id !== id))
  }

  return (
    <main style={{ fontFamily: 'Arial, sans-serif', maxWidth: 720, margin: '40px auto' }}>
      <h1>Next.js ToDo (demo)</h1>

      <form onSubmit={addTodo} style={{ marginBottom: 20 }}>
        <input
          placeholder="Write a todo and press Enter"
          value={text}
          onChange={(e) => setText(e.target.value)}
          style={{ padding: '8px 12px', width: '70%' }}
        />
        <button style={{ marginLeft: 8, padding: '8px 12px' }} type="submit">
          Add
        </button>
      </form>

      {loading ? (
        <p>Loading...</p>
      ) : (
        <ul style={{ listStyle: 'none', paddingLeft: 0 }}>
          {todos.map((t) => (
            <li key={t.id} style={{ padding: '8px 0', borderBottom: '1px solid #eee' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <input type="checkbox" checked={!!t.done} onChange={() => toggleDone(t.id, t.done)} />
                <span style={{ textDecoration: t.done ? 'line-through' : 'none' }}>{t.text}</span>
                <button style={{ marginLeft: 'auto' }} onClick={() => removeTodo(t.id)}>
                  Delete
                </button>
              </label>
            </li>
          ))}
        </ul>
      )}

      <footer style={{ marginTop: 24, color: '#666' }}>Simple demo — persists to <code>data/db.json</code></footer>
    </main>
  )
}
```

---

### `Dockerfile` (multi-stage)

```dockerfile
# Builder
FROM node:18-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

# Runtime
FROM node:18-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app .
EXPOSE 3000
CMD ["npm", "run", "start"]
```

---

### `nginx.conf` (used by nginx container)

```nginx
server {
  listen 80;
  server_name _;

  location / {
    proxy_pass http://app:3000;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header Host $host;
    proxy_cache_bypass $http_upgrade;
  }
}
```

---

### `docker-compose.yml` (pullable image workflow)

```yaml
version: '3.8'
services:
  app:
    image: YOUR_DOCKERHUB_USER/nextjs-ec2-starter:latest
    restart: always
    volumes:
      - ./data:/app/data
    expose:
      - '3000'
    environment:
      - NODE_ENV=production
  nginx:
    image: nginx:alpine
    restart: always
    depends_on:
      - app
    ports:
      - '80:80'
    volumes:
      - ./nginx.conf:/etc/nginx/conf.d/default.conf:ro
```

> **Note:** when developing locally you can build the image yourself (see Quick start). On EC2 the `app` service above will pull the image pushed by GitHub Actions.

---

### `.github/workflows/ci-deploy.yml` (GitHub Actions)

```yaml
name: Build, Push & Deploy to EC2

on:
  push:
    branches: [ main ]

jobs:
  build-and-push:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Set up QEMU
        uses: docker/setup-qemu-action@v2

      - name: Set up Docker Buildx
        uses: docker/setup-buildx-action@v2

      - name: Login to DockerHub
        uses: docker/login-action@v2
        with:
          username: ${{ secrets.DOCKERHUB_USERNAME }}
          password: ${{ secrets.DOCKERHUB_TOKEN }}

      - name: Build and push
        uses: docker/build-push-action@v4
        with:
          context: .
          push: true
          tags: ${{ secrets.DOCKERHUB_USERNAME }}/nextjs-ec2-starter:latest

  deploy:
    needs: build-and-push
    runs-on: ubuntu-latest
    steps:
      - name: Deploy to EC2 via SSH
        uses: appleboy/ssh-action@v0.1.7
        with:
          host: ${{ secrets.EC2_HOST }}
          username: ${{ secrets.EC2_USER }}
          key: ${{ secrets.EC2_SSH_KEY }}
          port: ${{ secrets.EC2_SSH_PORT }}
          script: |
            set -e
            cd ${DEPLOY_DIR:-/home/${{ secrets.EC2_USER }}/deploy}
            # ensure docker-compose.yml + nginx.conf are present in this folder (place them there once)
            docker-compose pull
            docker-compose up -d --remove-orphans
            docker-compose ps
```

> **Secrets to add in your repo settings** (`Settings` → `Secrets and variables` → `Actions`):
>
> * `DOCKERHUB_USERNAME` — your Docker Hub username
> * `DOCKERHUB_TOKEN` — Docker Hub access token (or password)
> * `EC2_HOST` — your EC2 public IP or domain
> * `EC2_USER` — e.g. `ubuntu` or `ec2-user`
> * `EC2_SSH_KEY` — **the private key** (PEM) that matches a key in `~/.ssh/authorized_keys` on the EC2 user
> * `EC2_SSH_PORT` — usually `22` (optional)
>
> Also ensure the EC2 server contains the `docker-compose.yml` and `nginx.conf` (same versions as in this repo) in the deploy folder (default `/home/<EC2_USER>/deploy`).

---

## 2) Quick start — run locally (5 minutes)

1. Create a folder and copy files from this doc (preserve layout).

2. Install dependencies locally:

```bash
npm install
```

3. Run dev server:

```bash
npm run dev
# Open http://localhost:3000
```

4. Test API manually:

```bash
curl -sS -X GET http://localhost:3000/api/todos | jq
curl -sS -X POST http://localhost:3000/api/todos -H 'Content-Type: application/json' -d '{"text":"hello"}' | jq
```

---

## 3) Build & run with Docker locally (quick)

```bash
# build image
docker build -t yourdockerhubuser/nextjs-ec2-starter:local .

# run (bind port 3000 locally)
docker run -p 3000:3000 -v $(pwd)/data:/app/data yourdockerhubuser/nextjs-ec2-starter:local
# open http://localhost:3000
```

Or use `docker-compose.yml` while iterating locally: edit the `app` service to use `build: .` instead of `image:`.

---

## 4) Prepare your EC2 instance (one-time)

Run these on your laptop (replace values) to SSH into EC2:

```bash
ssh -i ~/mykey.pem ubuntu@EC2_PUBLIC_IP
```

On the EC2 server run:

```bash
# update & install docker + docker-compose
sudo apt update && sudo apt install -y docker.io docker-compose git
sudo systemctl enable --now docker
# allow your user to run docker without sudo (you may need to re-login)
sudo usermod -aG docker $USER
# create deploy dir
mkdir -p ~/deploy
cd ~/deploy
```

Place `docker-compose.yml` and `nginx.conf` (exact copies from the repo) into `~/deploy`. Also create the `data/` folder there for persistence:

```bash
mkdir -p ~/deploy/data
```

Open **Security Group** in AWS console and ensure ingress for **HTTP (80)** and **SSH (22)** at minimum. If you plan on using HTTPS, also open **443**.

---

## 5) Configure GitHub and Deploy (CI/CD)

1. Push this project to a GitHub repo (e.g. `yourname/nextjs-ec2-starter`).
2. Add the repository secrets listed above.
3. Ensure your EC2 `~/deploy/docker-compose.yml` and `nginx.conf` are the same versions you committed (the Action will `ssh` and run `docker-compose pull && docker-compose up -d`).
4. Push to `main`. The `ci-deploy` workflow will:

   * Build and push `yourdockerhubuser/nextjs-ec2-starter:latest` to Docker Hub
   * SSH to EC2 and run `docker-compose pull && docker-compose up -d` in the `DEPLOY_DIR` (default `/home/<EC2_USER>/deploy`).

After the workflow completes, visit your EC2 `http://EC2_PUBLIC_IP`.

---

## 6) Troubleshooting & tips

* **Permission denied for docker**: After `usermod -aG docker`, re-login or run `newgrp docker`.
* **`docker-compose pull` fails**: ensure the Docker Hub image exists and your `DOCKERHUB_*` secrets are correct.
* **Nginx 502**: check `docker-compose ps` and `docker-compose logs app` for app errors. Ensure app listens on `3000`.
* **Persistent data**: the compose mounts `./data` into the container. Keep a backup if you want.
* **HTTPS**: for production, prefer obtaining a certificate. You can run certbot on the host and update nginx config, or use a reverse proxy service.

---

## 7) Next steps / upgrades you can make

* Replace file DB with Firestore or MongoDB.
* Add authentication (Firebase Auth or custom JWT).
* Add unit tests and GitHub Actions test step.
* Add a staging deploy pipeline (different Docker tag & env).

---

If you'd like, I can now:

1. Create a downloadable ZIP of the project files for you.
2. Generate a ready-to-copy `ssh` command and the exact GitHub Actions secrets values example for your repository.
3. Walk you through the EC2 commands live — you paste outputs/errors and I help fix them.

Tell me which of the three you'd like me to do **next** and I'll proceed.
