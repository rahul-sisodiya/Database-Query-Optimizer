# 🗄️ Database Query Optimizer

Ever wondered why your MongoDB queries are running slow? This tool helps you figure that out — and fix it. The Database Query Optimizer lets you submit queries through a simple browser interface, analyzes what's going wrong under the hood, and tells you exactly how to make things faster.

Think of it as your personal MongoDB performance coach.

> **Similar to:** MongoDB Atlas Advisor / SQL Server Query Store

---

## 📋 Table of Contents

- [What is this?](#what-is-this)
- [What can it do?](#what-can-it-do)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Getting Started](#getting-started)
  - [Prerequisites](#prerequisites)
  - [Installation](#installation)
  - [Environment Setup](#environment-setup)
  - [Running the App](#running-the-app)
- [How It Works](#how-it-works)
- [System Components](#system-components)
- [API Endpoints](#api-endpoints)
- [How it compares to other tools](#how-it-compares-to-other-tools)
- [Contributing](#contributing)
- [License](#license)

---

## 🔍 What is this?

Slow database queries are one of the most common performance problems in any application. But figuring out _why_ a query is slow — and what to actually do about it — can be frustrating and time-consuming.

That's exactly what this project solves.

The **Database Query Optimizer** connects to your MongoDB database, runs your queries, and gives you a clear picture of what's happening behind the scenes. It spots missing indexes, scans through MongoDB's own logs for historically slow queries, runs benchmarks to test potential fixes before you apply them, and even tracks all your index changes with Git so nothing gets lost.

It's built with Node.js and Express on the backend, a clean HTML/JS frontend, and uses MongoDB itself to remember query patterns over time.

---

## ✨ What can it do?

- 📝 **Simple query interface** — No complex setup. Just type your MongoDB query in the browser and hit submit.
- 🐌 **Catches slow queries** — Reads through MongoDB logs and flags queries that are taking too long.
- 🔎 **Finds missing indexes** — Tells you which fields need indexes so your queries stop scanning millions of documents unnecessarily.
- 📦 **Remembers query patterns** — Saves recurring query shapes and their stats so you can spot trends over time.
- 🧪 **Tests fixes before you apply them** — Shell scripts benchmark proposed indexes first, so you know the improvement is worth it before touching production.
- 📜 **Keeps a history of your indexes** — Every index creation or change is tracked through Git. No more "who added that index and when?"
- 📊 **Shows you CPU and I/O usage** — Uses Unix profiling tools to give you system-level metrics for each query run.
- ⚡ **Caches query plans** — Stores execution plans so repeated queries don't have to be re-analyzed. And if indexes change, the cache is automatically cleared.

---

## 🛠️ Tech Stack

Here's what's running under the hood:

| Layer          | Technology                    | What it does                                             |
| -------------- | ----------------------------- | -------------------------------------------------------- |
| **Frontend**   | HTML, CSS, Vanilla JavaScript | The browser interface where you write and submit queries |
| **Backend**    | Node.js + Express 5           | The API server and query analysis engine                 |
| **Database**   | MongoDB (Node.js driver v7)   | Stores query patterns, index data, and execution results |
| **Scripting**  | Bash Shell Scripts            | Runs benchmarks to test proposed indexes                 |
| **Versioning** | Git                           | Keeps a history of every index change                    |
| **Profiling**  | Unix profiling tools          | Measures CPU and I/O usage per query                     |
| **Config**     | dotenv                        | Keeps your database credentials safe and out of the code |

---

## 📁 Project Structure

Here's how the project is laid out:

```
MONGO-OPTIMIZER/
│
├── backend/
│   ├── config/              # How we connect to MongoDB
│   ├── controllers/         # What happens when a request comes in
│   ├── routes/              # Which URL maps to which controller
│   ├── services/            # The brain — query analysis, index detection,
│   │                        #   benchmarking, caching, profiling
│   ├── utils/               # Handy helper functions used across the app
│   ├── node_modules/
│   ├── package.json
│   ├── package-lock.json
│   └── server.js            # Where the app starts
│
├── frontend/
│   └── index.html           # The browser UI
│
├── .env                     # Your secret config (DB URL, port, etc.)
├── .gitignore
├── package.json
└── readme.md
```

Each folder has a clear, single job:

| Folder         | What it's responsible for                                                           |
| -------------- | ----------------------------------------------------------------------------------- |
| `config/`      | Opens and manages the MongoDB connection                                            |
| `controllers/` | Handles incoming requests and sends back responses                                  |
| `routes/`      | Connects URLs to the right controller                                               |
| `services/`    | Does the actual heavy lifting — analyzing queries, finding issues, suggesting fixes |
| `utils/`       | Shared tools like log parsers, error handlers, and script runners                   |

---

## 🚀 Getting Started

### Prerequisites

Before you start, make sure you have:

- [Node.js](https://nodejs.org/) (v16 or higher)
- [npm](https://www.npmjs.com/)
- A MongoDB database — either [running locally](https://www.mongodb.com/try/download/community) or on [MongoDB Atlas](https://www.mongodb.com/atlas)
- A Unix/Linux/macOS system (needed for shell scripts and profiling tools)
- Git installed

### Installation

**1. Clone the repo:**

```bash
git clone https://github.com/rahul-sisodiya/Database-Query-Optimizer.git
cd Database-Query-Optimizer
```

**2. Install the root dependencies:**

```bash
npm install
```

**3. Install backend dependencies:**

```bash
cd backend
npm install
cd ..
```

### Environment Setup

Create a `.env` file in the root folder and add your MongoDB connection details:

```env
MONGODB_URI=mongodb://localhost:27017/your-database-name
PORT=3000
```

> ⚠️ Keep this file private. It's already in `.gitignore`, so it won't accidentally get pushed to GitHub.

### Running the App

Start everything up with:

```bash
npm start
```

Then open your browser and go to:

```
http://localhost:3000
```

That's it — you're in.

---

## ⚙️ How It Works

When you submit a query, here's what happens step by step:

```
┌──────────────────────────────────────────────┐
│               You (Browser)                  │
│     Type a MongoDB query and hit submit      │
│            frontend/index.html               │
└─────────────────────┬────────────────────────┘
                      │  HTTP POST /api/query
                      ▼
┌──────────────────────────────────────────────┐
│           backend/routes/                    │
│     Figures out which controller handles it  │
└─────────────────────┬────────────────────────┘
                      │
                      ▼
┌──────────────────────────────────────────────┐
│         backend/controllers/                 │
│   Checks the input, passes it to services    │
└─────────────────────┬────────────────────────┘
                      │
                      ▼
┌──────────────────────────────────────────────┐
│          backend/services/                   │
│  (this is where the real work happens)       │
│                                              │
│  Step 1: Check the Query Plan Cache          │
│     → Already seen this query? Return fast.  │
│     → Never seen it? Keep going.             │
│                                              │
│  Step 2: Run the query with explain()        │
│     → Is it doing a full collection scan?    │
│     → Are there missing indexes?             │
│                                              │
│  Step 3: Check the MongoDB slow query logs   │
│     → Has this query been slow before?       │
│                                              │
│  Step 4: Run benchmark scripts               │
│     → Would adding an index actually help?   │
│     → By how much?                           │
│                                              │
│  Step 5: Collect CPU and I/O metrics         │
│     → How hard is the system working?        │
│                                              │
│  Step 6: Save the query pattern to MongoDB   │
│     → Build up a history of query behavior   │
│                                              │
│  Step 7: Cache the query plan                │
│     → Next time this runs, it'll be faster   │
│     → Cache clears if indexes change         │
└─────────────────────┬────────────────────────┘
                      │  JSON response sent back
                      ▼
┌──────────────────────────────────────────────┐
│               You (Browser)                  │
│   See results, suggestions, and metrics      │
└──────────────────────────────────────────────┘
```

---

## 🧩 System Components

The app is made up of several focused components, each doing one thing well:

| Component                 | Powered by        | What it does                                                     |
| ------------------------- | ----------------- | ---------------------------------------------------------------- |
| **Query Analysis API**    | Express.js        | The front door — accepts query requests and returns results      |
| **Slow Query Analyzer**   | Node.js           | Digs through MongoDB logs to find queries that took too long     |
| **Index Detector**        | Node.js + MongoDB | Uses `explain()` to find where indexes are missing               |
| **Query Pattern Store**   | MongoDB           | Remembers query shapes and stats so you can track them over time |
| **Index Benchmarker**     | Bash Scripts      | Tests proposed indexes in a safe way before you commit to them   |
| **Index History Tracker** | Git               | Every index change is committed and traceable                    |
| **CPU/I/O Profiler**      | Unix tools        | Shows how much system resources each query actually uses         |
| **Query Plan Cache**      | Memory / MongoDB  | Speeds up repeated queries; refreshes itself when indexes change |

---

## 📡 API Endpoints

| Method | Endpoint        | What it does                                |
| ------ | --------------- | ------------------------------------------- |
| `POST` | `/api/query`    | Submit a query to be analyzed and optimized |
| `GET`  | `/api/patterns` | See stored query patterns and their history |
| `GET`  | `/api/indexes`  | View current indexes on a collection        |
| `GET`  | `/api/health`   | Check if the server is up and running       |

### Example — Submitting a Query

```json
POST /api/query
Content-Type: application/json

{
  "collection": "users",
  "query": { "age": { "$gt": 25 } }
}
```

### What you get back

```json
{
  "results": [...],
  "executionStats": {
    "executionTimeMillis": 145,
    "totalDocsExamined": 50000,
    "totalDocsReturned": 312,
    "stage": "COLLSCAN"
  },
  "planCached": false,
  "cpuMetrics": {
    "userTime": "0.012s",
    "systemTime": "0.003s"
  },
  "suggestions": [
    "⚠️  Full collection scan detected. 50,000 documents scanned just to return 312.",
    "💡 Add an index on 'age': db.users.createIndex({ age: 1 })",
    "📊 Benchmark estimates this reduces the scan by 99.4% — from 50,000 docs down to 312."
  ]
}
```

---

## 🔁 How it compares to other tools

| Feature                           | This Project | MongoDB Atlas Advisor | SQL Server Query Store |
| --------------------------------- | :----------: | :-------------------: | :--------------------: |
| Query performance analysis        |      ✅      |          ✅           |           ✅           |
| Missing index detection           |      ✅      |          ✅           |           ✅           |
| Query plan caching                |      ✅      |          ✅           |           ✅           |
| Benchmark indexes before applying |      ✅      |          ❌           |           ❌           |
| Git-tracked index history         |      ✅      |          ❌           |           ❌           |
| Unix CPU/I/O profiling            |      ✅      |          ❌           |           ❌           |
| Self-hosted & open source         |      ✅      |          ❌           |           ❌           |
| MongoDB log parsing               |      ✅      |          ✅           |           ❌           |

---

## 🤝 Contributing

Want to improve this? Contributions are very welcome.

1. Fork the repo
2. Create your branch: `git checkout -b feature/your-idea`
3. Commit your changes: `git commit -m "Add your idea"`
4. Push it: `git push origin feature/your-idea`
5. Open a Pull Request and describe what you did

Please keep your code clean and add comments where things aren't obvious. That's it!

---

## 📄 License

This project is licensed under the **ISC License**.

---

> Built by [rahul-sisodiya](https://github.com/rahul-sisodiya)
