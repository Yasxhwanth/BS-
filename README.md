# SmartFactory — Manufacturing Intelligence Platform

A full-stack MERN application for smart manufacturing: real-time sensor telemetry, AI chat, ontology-based knowledge graphs, production analytics, and alert management — all in an IBM Carbon dark-themed UI.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 19, Vite, React Router, ReactFlow |
| Styling | IBM Carbon Design System tokens + Vanilla CSS |
| Icons | `@carbon/icons-react` |
| Backend | Node.js, Express 5 |
| Database | MongoDB via Mongoose (in-memory with `mongodb-memory-server`) |
| Real-time | Socket.IO |
| AI | Google Gemini API (`@google/generative-ai`) with local fallback |
| Data Import | `xlsx` (Excel parsing) |
| Auth | JWT (`jsonwebtoken`) + bcrypt |

---

## Project Structure

```
MINI_PROJECT/
├── server.js                  # Entry point — Express + Socket.IO server
├── geminiService.js           # Gemini AI API wrapper
├── .env                       # Environment variables (not committed)
│
├── db/
│   └── connection.js          # MongoDB connect/disconnect helpers
│
├── middleware/
│   └── auth.js                # JWT protect middleware + token generator
│
├── models/
│   └── index.js               # All Mongoose schemas: User, Ontology, Alert,
│                              #   SensorData, ChatMessage, PlantData
│
├── routes/
│   ├── authRoutes.js          # POST /auth/register, /auth/login, GET /auth/me
│   ├── ontologyRoutes.js      # GET/POST ontology, export, mock data
│   ├── alertRoutes.js         # CRUD alerts, acknowledge/resolve
│   ├── analyticsRoutes.js     # Dashboard KPIs, predictive analytics
│   ├── chatRoutes.js          # AI chat, history, Gemini config
│   └── uploadRoutes.js        # POST /upload/excel → parses KPIs, sensors,
│                              #   alerts, processes; POST /data/reset-demo
│
├── services/
│   ├── aiEngine.js            # Gemini-first AI engine with keyword fallback
│   └── ontologyGenerator.js   # Parses graph → OWL-style JSON-LD, loads mock data
│
├── sockets/
│   └── index.js               # Socket.IO setup — emits live sensor:live every 3s
│
└── client/                    # React frontend (Vite)
    └── src/
        ├── main.jsx           # React root
        ├── App.jsx            # Layout shell, routing, resizable sidebar
        ├── api.js             # Axios instance (JWT interceptor + auto-logout)
        ├── index.css          # Global styles — Carbon dark tokens, components
        │
        ├── Login.jsx          # Auth page (login + register)
        ├── Dashboard.jsx      # KPI tiles, production chart, sensor telemetry
        ├── OntologyBuilder.jsx# Digital Twin Studio — ReactFlow knowledge graph
        ├── Chat.jsx           # AI chat interface (Gemini / fallback)
        ├── Alerts.jsx         # Alert list with severity filtering
        ├── Analytics.jsx      # Deep-dive KPI and process analytics
        └── ontologyUtils.js   # Auto-layout, auto-relationship builder,
                               #   Excel-to-node parser, RELATIONSHIP definitions
```

---

## Key Files Explained

### `server.js`
Entry point. Creates an Express app + HTTP server + Socket.IO instance. Registers all route modules and starts the database connection before listening.

```js
const io = new Server(server, { cors: { origin: '*' } });
app.set('io', io);           // makes io accessible inside route handlers
setupSockets(io);            // starts live sensor simulation
connectDatabase().then(() => server.listen(PORT));
```

### `middleware/auth.js`
JWT-based route protection. Reads `Authorization: Bearer <token>`, verifies it, and attaches `req.user`.

```js
const protect = async (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  const decoded = jwt.verify(token, process.env.JWT_SECRET);
  req.user = await User.findById(decoded.id);
  next();
};
```

### `models/index.js`
All six Mongoose schemas in one file:
- **User** — name, email, hashed password, role, department
- **Ontology** — nodes[], edges[], generatedOntology (OWL-style JSON-LD)
- **Alert** — severity, category, status (active/acknowledged/resolved), AI confidence
- **SensorData** — readings[], thresholds, anomaly tracking
- **ChatMessage** — conversationId, role (user/assistant), content
- **PlantData** — KPI metrics, production trend, process breakdown, live sensors

### `sockets/index.js`
Emits `sensor:live` every 3 seconds to each connected client with randomised Temperature, Vibration, Pressure, and Speed readings.

```js
const sensorInterval = setInterval(() => {
  socket.emit('sensor:live', { timestamp, sensors: [...] });
}, 3000);
```

### `services/aiEngine.js`
Two-tier AI: first tries Gemini API, falls back to a keyword-matching engine that generates context-aware responses about maintenance, sensors, workers, quality, and production.

### `services/ontologyGenerator.js`
- Converts ReactFlow nodes/edges into OWL-compatible JSON-LD classes
- Serves the 30-node / 40-edge mock manufacturing plant from `mock_ontology_data.json`

### `client/src/api.js`
Axios instance with two interceptors:
1. **Request** — injects `Authorization: Bearer <token>` from `localStorage`
2. **Response** — on `401`, clears storage and redirects to `/login`

### `client/src/OntologyBuilder.jsx` (Digital Twin Studio)
Interactive knowledge graph built on ReactFlow:
- **30 default nodes** auto-loaded on mount (mock manufacturing plant)
- **Floating Node Inspector** — opens only when a node is clicked; has an X close button
- **Auto-Relate** — builds semantic edges (monitors, produces, operated_by, etc.) from node types
- **Drag-drop** from entity palette (Process, Sensor, Material, Worker, Product, Department)
- **Multi-file upload** — Excel sheets parsed into typed nodes with auto-layout

### `client/src/ontologyUtils.js`
Three exported utilities:

| Export | Description |
|---|---|
| `RELATIONSHIPS` | 10 semantic edge types (monitors, feeds_into, produces…) |
| `autoLayoutNodes(nodes)` | Arranges nodes into 6 vertical columns by entity type |
| `buildAutoRelationships(nodes)` | Creates semantically correct edges based on node types and labels |
| `parseExcelRowsToNodes(file, rows, n)` | Detects entity type from filename, maps Excel columns to node data |

---

## Setup & Running

### Prerequisites
- Node.js 18+
- No MongoDB installation needed — uses in-memory MongoDB automatically

### 1. Clone & install
```bash
git clone https://github.com/Yasxhwanth/BS-.git
cd BS-
npm install
cd client && npm install && cd ..
```

### 2. Environment variables
Create `.env` in the project root:
```env
PORT=5000
JWT_SECRET=your_jwt_secret_here
GEMINI_API_KEY=your_gemini_api_key_here   # optional — app works without it
```

### 3. Run (two terminals)
```bash
# Terminal 1 — Backend
node server.js

# Terminal 2 — Frontend
cd client && npm run dev
```

Frontend: `http://localhost:3000`  
Backend API: `http://localhost:5000/api`

---

## API Reference

### Auth
| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/auth/register` | Create account |
| POST | `/api/auth/login` | Login → returns JWT |
| GET | `/api/auth/me` | Get current user |

### Ontology
| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/ontology` | Load saved ontology |
| POST | `/api/ontology/save` | Save nodes + edges, generate OWL |
| GET | `/api/ontology/export` | Export as JSON-LD |
| GET | `/api/ontology/mock` | Load 30-node mock plant |

### Alerts
| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/alerts` | List alerts (filter: `?severity=critical`) |
| PATCH | `/api/alerts/:id/acknowledge` | Mark acknowledged |
| PATCH | `/api/alerts/:id/resolve` | Mark resolved |

### Analytics
| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/analytics/dashboard` | KPIs, production trend, sensors |
| GET | `/api/analytics/predict/:id` | Predictive maintenance score for node |

### Chat
| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/chat` | Send message → AI response |
| GET | `/api/chat/history/:id` | Conversation history |
| POST | `/api/chat/config` | Set Gemini API key at runtime |

### Data
| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/upload/excel` | Upload Excel → parse KPIs, sensors, alerts |
| POST | `/api/data/reset-demo` | Reset user data to defaults |

---

## Socket.IO Events

| Event | Direction | Payload |
|---|---|---|
| `sensor:live` | Server → Client | `{ timestamp, sensors: [{id, label, type, value, unit, status}] }` |
| `dashboard:updated` | Server → Client | `{ fileName, at }` — fired after Excel import |

---

## Features

- **Dashboard** — 8 real-time KPI tiles, dual-bar production chart, live sensor list with status indicators, process efficiency breakdown
- **Digital Twin Studio** — 30-node manufacturing knowledge graph with drag-drop canvas, auto-relationship building, floating node inspector, Excel/JSON import
- **AI Chat** — Google Gemini-powered assistant with ontology context; keyword fallback when API key not set
- **Alerts** — Severity-based filtering (critical / high / medium / low), acknowledge and resolve workflow
- **Analytics** — KPI trends, process efficiency progress bars, OEE breakdown
- **Auth** — JWT login/register, role-based (admin, engineer, operator, analyst)
- **Resizable Sidebar** — Drag to resize, persisted in `localStorage`
