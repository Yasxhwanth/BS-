# SmartFactory — Manufacturing Intelligence Platform

A full-stack MERN application for smart manufacturing: digital twin knowledge graphs, real-time telemetry streaming, predictive AI intelligence, production analytics, and automated incident management — all built with strict adherence to the **IBM Carbon Design System**.

---

## Architecture Overview

```
                      ┌──────────────────────────────────────────────┐
                      │              React 19 Frontend               │
                      │  IBM Carbon Design System · IBM Plex Fonts   │
                      │     Dark / Light Mode · ReactFlow 11         │
                      └───────┬───────────────────────────────▲──────┘
                              │ HTTP Requests (Axios + JWT)   │ WebSockets (Socket.IO)
                              ▼                               │ (sensor:live, dashboard:updated)
                      ┌───────────────────────────────────────┴──────┐
                      │             Node.js Express 5 API            │
                      │        JWT Authentication & Protected API     │
                      └───────┬──────────────┬────────────────┬──────┘
                              │              │                │
            ┌─────────────────┴─┐   ┌────────┴────────┐  ┌───┴──────────────────┐
            │ In-Memory MongoDB │   │ Google Gemini AI│  │ Digital Twin Engine  │
            │   (Mongoose ODM)  │   │  (Flash / Pro)  │  │ OWL JSON-LD Generator│
            └───────────────────┘   └─────────────────┘  └──────────────────────┘
```

---

## Tech Stack

| Layer | Technology | Description |
| :--- | :--- | :--- |
| **Frontend** | React 19, Vite 8, React Router 7 | Fast modular Single Page Application |
| **Graph Visualization** | ReactFlow (`reactflow`) | Interactive Digital Twin knowledge graph |
| **Design System** | IBM Carbon Design System tokens + Vanilla CSS | Zero border-radius (`0px`), flat tiles, left accent strips |
| **Typography** | `IBM Plex Sans`, `IBM Plex Mono` | Industrial technical typography |
| **Icons** | `@carbon/icons-react` | Official IBM Carbon SVG icons |
| **Backend** | Node.js, Express 5 | RESTful JSON APIs and WebSocket server |
| **Database** | MongoDB via Mongoose | Zero-config in-memory database (`mongodb-memory-server`) |
| **Real-time** | Socket.IO | 3s telemetry feed and real-time dashboard events |
| **AI Engine** | Google Gemini API (`@google/generative-ai`) | Manufacturing Copilot with deterministic local fallback |
| **Data Import** | `xlsx` | Multi-sheet Excel & CSV parsing for plant metrics and graph nodes |
| **Security** | JWT (`jsonwebtoken`) + `bcrypt` | Secure authentication with auto-logout on token expiry |

---

## IBM Carbon Design System Principles

This application strictly implements IBM Carbon Design principles:
* **Zero Border Radius (`0px`)**: All tiles, buttons, inputs, tags, and progress bars use square corners.
* **Flat Surfaces**: No drop shadows or decorative gradients on content cards. Elevation is established with sharp `1px solid var(--border-subtle)` borders and high-contrast backgrounds.
* **Left Vertical Accent Strips**: 3px or 4px solid color indicators on the left edge of KPI tiles, alerts, and process cards to convey status and categories.
* **Industrial Typography**:
  * Body & headers: `IBM Plex Sans`
  * Numerical data, KPIs, code, and telemetry: `IBM Plex Mono`
  * Section subheaders: 11px uppercase with `0.8px` letter tracking
* **Theme Support**: Seamless Dark Mode (Carbon `g100` / `g90`) and Light Mode (Carbon `white` / `g10`) toggled from the global navigation and persisted in `localStorage`.

---

## Digital Twin & Dashboard Connectivity

The Digital Twin knowledge graph is interconnected with the Dashboard and Analytics engine:

```
[Digital Twin Studio] ──(Save / Import)──► [Ontology DB Model]
                                                   │
             ┌─────────────────────────────────────┴─────────────────────────────────────┐
             ▼                                     ▼                                     ▼
     [Dashboard KPIs]                      [Live Telemetry]                     [Automated Alerts]
• Twin Nodes Count (30)             • Sensor nodes stream live values     • Node anomalies trigger alerts
• Semantic Links Count (40)           every 3s via Socket.IO                with { nodeId, nodeLabel }
• Process cycle times & health      • Color-coded nominal/warning/crit    • Feeds Critical Alert counters
```

1. **Live Twin KPIs**: The Dashboard queries `Ontology.findOne({ createdBy: user._id })` dynamically:
   - **`Twin Nodes`**: Live count of ontology nodes (default 30).
   - **`Links`**: Live count of semantic relationships (default 40).
2. **Real-time WebSocket Sync**: Saving an ontology emits `dashboard:updated` and `ontology:updated` via Socket.IO, triggering an automatic refresh of all dashboard tiles.
3. **Plant Telemetry**: Sensor nodes correlate with the `Plant Telemetry` live panel on the Dashboard, streaming readings with pulsating status dots.
4. **Process Efficiency**: Process nodes correlate with the `Process Efficiency` cards, tracking cycle times, efficiency percentages, and active warnings.
5. **AI Alerts Propagation**: Anomalies detected across ontology entities automatically generate structured alerts containing `source: { nodeId, nodeLabel, nodeType }`.

---

## Core Application Modules

### 1. Dashboard (`client/src/Dashboard.jsx`)
* **8 Carbon KPI Tiles**: OEE, Production Efficiency, Quality Rate, Power Load, MTBF, MTTR, Active Alerts, and Twin Nodes with color accents.
* **Production Output vs Target Chart**: Dual-bar comparison (Output vs Defects) with hover tooltips and dynamic scaling.
* **Plant Telemetry**: Live sensor stream with animated status indicators.
* **Process Efficiency Matrix**: Real-time progress bars for each manufacturing cell.
* **Excel Data Import**: Drag-and-drop or select Excel files to instantly update KPIs, trends, and processes.

### 2. Digital Twin Studio (`client/src/OntologyBuilder.jsx`)
* **Interactive Canvas**: Powered by ReactFlow with smooth panning, zoom controls, and minimap.
* **30 Preloaded Default Nodes**: Ready-to-use plant topology covering 6 entity classes (*Processes, Sensors, Materials, Workers, Products, Departments*).
* **Color-Coded Glowing Edges**:
  - `monitors`: Cyan `#3ddbd9` (animated dashed glow)
  - `feeds_into`: IBM Blue `#0f62fe`
  - `produces`: Green `#42be65`
  - `operated_by`: Yellow `#f1c21b`
  - `belongs_to`: Purple `#be95ff`
  - `requires`: Orange `#ff832b`
  - `inspects`: Green `#42be65` (animated pulse)
* **Floating Node Inspector**: Opens only upon clicking a node; includes entity properties, subtype editor, and an **X** close button.
* **Semantic Auto-Relate**: Automatically infers and creates domain relationships between nodes based on manufacturing rules.
* **OWL JSON-LD Export**: Exports the ontology structure to standard W3C OWL/RDF JSON-LD format.

### 3. Analytics & Predictions (`client/src/Analytics.jsx`)
* **6 Key Production Metrics**: OEE, Efficiency, Quality, MTBF, MTTR, Power Load in `IBM Plex Mono`.
* **Digital Twin Class Distribution**: Real-time progress bars showing the breakdown and percentage share of all 6 entity types.
* **Knowledge Graph Semantic Breakdown**: Counts and percentages of relationship types.
* **AI Predictive Maintenance Matrix**:
  - Process degradation risk classification (*High Risk, Attention, Nominal*).
  - Health Index and Maintenance Urgency meters.
  - Estimated hours to failure horizon.

### 4. AI Assistant Copilot (`client/src/Chat.jsx`)
* **Gemini-Powered Intelligence**: Natural language querying of plant status, equipment degradation, sensor anomalies, and ontology relationships.
* **Hybrid Fallback**: Operates offline using a local deterministic expert system when no API key is supplied.
* **Carbon Chat UI**: Square message tiles, Carbon tag suggestion chips, runtime Gemini configuration modal, and conversation reset.

### 5. Intelligent Alerts Feed (`client/src/Alerts.jsx`)
* **Severity Tiers**: `Critical`, `High`, `Medium`, `Low`, and `Info` with left color bars.
* **Filter Controls**: Filter by status (*Active, Acknowledged, Resolved*) and severity.
* **AI Recommendation Banners**: Actionable suggestions generated for flagged equipment.
* **Direct Node Links**: Identifies the exact twin node where the anomaly occurred.

---

## Project Structure

```
MINI_PROJECT/
├── server.js                  # Modular entry point (Express 5 + Socket.IO)
├── geminiService.js           # Gemini SDK wrapper
├── mock_ontology_data.json    # 30-node, 40-edge reference plant topology
├── .env                       # Environment configuration
│
├── db/
│   └── connection.js          # In-memory MongoDB startup & connection
│
├── middleware/
│   └── auth.js                # JWT protect middleware + token generation
│
├── models/
│   └── index.js               # Schemas: User, Ontology, Alert, SensorData,
│                              #   ChatMessage, PlantData
│
├── routes/
│   ├── authRoutes.js          # Authentication endpoints
│   ├── ontologyRoutes.js      # Ontology CRUD, mock plant, JSON-LD export
│   ├── alertRoutes.js         # Alerts management and lifecycle
│   ├── analyticsRoutes.js     # Dashboard KPIs and node predictive scores
│   ├── chatRoutes.js          # AI Assistant queries and Gemini config
│   └── uploadRoutes.js        # Excel sheet processing & dataset reset
│
├── services/
│   ├── aiEngine.js            # Dual-layer AI engine (Gemini + fallback)
│   └── ontologyGenerator.js   # OWL JSON-LD generator & alert synthesis
│
├── sockets/
│   └── index.js               # Real-time telemetry simulation (every 3s)
│
└── client/                    # React 19 Frontend
    └── src/
        ├── main.jsx           # Application entry point
        ├── App.jsx            # Shell with Carbon header, nav, & light/dark toggle
        ├── api.js             # Axios client with JWT auto-injection
        ├── index.css          # Carbon Design System CSS tokens (dark + light)
        ├── Login.jsx          # Flat Carbon authentication screen
        ├── Dashboard.jsx      # Manufacturing executive dashboard
        ├── OntologyBuilder.jsx# Digital Twin Studio (ReactFlow graph)
        ├── Analytics.jsx      # Predictive maintenance & graph analytics
        ├── Chat.jsx           # AI Assistant Copilot
        ├── Alerts.jsx         # Operations incident feed
        └── ontologyUtils.js   # Graph layout algorithms & semantic helpers
```

---

## Setup & Running

### Prerequisites
* **Node.js 18+**
* No external MongoDB service required (runs automatically in-memory).

### 1. Installation
```bash
# Clone the repository
git clone git@github.com:Yasxhwanth/BS-.git
cd BS-

# Install backend dependencies
npm install

# Install frontend dependencies
cd client && npm install && cd ..
```

### 2. Environment Setup
Create a `.env` file in the project root:
```env
PORT=5000
JWT_SECRET=super_secret_manufacturing_jwt_key_2026
GEMINI_API_KEY=your_gemini_api_key_here    # Optional: falls back to local engine if omitted
```

### 3. Running Locally
Run backend and frontend concurrently in two terminals:

```bash
# Terminal 1 — Backend (Port 5000)
node server.js

# Terminal 2 — Frontend (Port 3000)
cd client
npm run dev
```

* **Frontend**: `http://localhost:3000`
* **Backend API**: `http://localhost:5000/api`
* **Default Demo Credentials**: `admin@company.com` / `password123`

---

## API Reference

### Authentication (`/api/auth`)
| Method | Endpoint | Description | Auth Required |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/auth/register` | Create a new user account | No |
| `POST` | `/api/auth/login` | Authenticate user and receive JWT token | No |
| `GET` | `/api/auth/me` | Fetch currently authenticated user profile | Yes |

### Digital Twin & Ontology (`/api/ontology`)
| Method | Endpoint | Description | Auth Required |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/ontology` | Retrieve user's saved ontology graph | Yes |
| `POST` | `/api/ontology/save` | Persist nodes & edges, compile OWL JSON-LD | Yes |
| `GET` | `/api/ontology/export` | Download W3C OWL-compliant JSON-LD document | Yes |
| `GET` | `/api/ontology/mock` | Load 30-node, 40-edge manufacturing plant | Yes |

### Analytics & Predictions (`/api/analytics`)
| Method | Endpoint | Description | Auth Required |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/analytics/dashboard` | Comprehensive plant KPIs, trends, and telemetry | Yes |
| `GET` | `/api/analytics/predict/:nodeId`| Predictive degradation forecast for specific node | Yes |

### AI Assistant (`/api/chat`)
| Method | Endpoint | Description | Auth Required |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/chat` | Send prompt to AI Copilot (with plant context) | Yes |
| `GET` | `/api/chat/history/:id` | Fetch conversation transcript | Yes |
| `GET` | `/api/chat/status` | Check Gemini API connection status | Yes |
| `POST` | `/api/chat/config` | Update Gemini API Key and model selection | Yes |

### Operations & Alerts (`/api/alerts`)
| Method | Endpoint | Description | Auth Required |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/alerts` | List incidents with optional `?severity=` and `?status=` | Yes |
| `PATCH`| `/api/alerts/:id/acknowledge`| Move alert to acknowledged state | Yes |
| `PATCH`| `/api/alerts/:id/resolve` | Mark alert as resolved | Yes |

### Data Management (`/api/upload`, `/api/data`)
| Method | Endpoint | Description | Auth Required |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/upload/excel` | Parse and ingest Excel manufacturing workbook | Yes |
| `POST` | `/api/data/reset-demo` | Restore original demo dataset | Yes |

---

## WebSocket Events (Socket.IO)

| Event Name | Direction | Payload Structure | Trigger |
| :--- | :--- | :--- | :--- |
| `sensor:live` | Server → Client | `{ timestamp, sensors: [{ id, label, type, value, unit, status }] }` | Emitted every 3 seconds |
| `dashboard:updated` | Server → Client | `{ timestamp }` | Fired when new Excel data is imported or ontology is saved |
| `ontology:updated` | Server → Client | `{ ontologyId, meta }` | Fired when a digital twin is saved |
| `alert:updated` | Server → Client | `{ _id, status, resolvedAt }` | Fired when an alert is acknowledged or resolved |
