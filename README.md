# OrderTogether

A real-time collaborative restaurant ordering web app that helps groups coordinate their orders seamlessly.

## Features

- Create and join dining sessions with unique, human-readable codes
- Real-time collaborative order list
- Add, edit, and remove items from the shared order
- See who ordered what in real-time
- Easy-to-share session URLs

## Tech Stack

- Frontend: React with TypeScript
- Backend: Node.js with Express
- Real-time Communication: WebSocket
- UI Framework: Chakra UI

<br>

## Run Locally On Host

### Backend
```bash
cd backend
npm install
npm start
```

### Frontend
```bash
cd frontend
npm install
npm start
```

The app will be available at http://localhost:3000, and the backend will run on http://localhost:5001.

<br>

## Run Locally with Docker Compose and HTTPS / WSS

### Generate Self-Signed SSL Certificates (from project root)
```bash
mkcert -key-file certs/localhost-key.pem -cert-file certs/localhost.pem 'localhost'
```

### Start Up Docker Containers (from project root)
```bash
docker compose -f dev-docker-compose.yml up --build
```

<br>


