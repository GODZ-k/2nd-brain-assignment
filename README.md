# Access-Controlled Financial Knowledge Graph over MCP (Model Context Protocol)

> **Financial Knowledge Graph & Access Control System**  
> *Stack: TypeScript, PostgreSQL, Prisma ORM, Model Context Protocol (`@modelcontextprotocol/sdk`), Vitest, Zod*  
> *Architecture: Absolute path imports (`@/*`), Source-level RBAC gating, Idempotent Data Pipeline*

---

## 1. Core Principle & Architecture

In agentic AI systems, **the LLM (Claude) must never be the security boundary**. If the model is prompted to "not disclose another customer's data", a prompt injection or adversarial jailbreak can bypass that instruction.

In this system:
1. **Access control is enforced at the data repository layer**: Before data is returned to the MCP tool or context, the caller's role and identity filter or block the query.
2. **Deterministic source-level isolation**:
   - `customer`: Can only view their own profile and their own transactions.
   - `merchant`: Can only view their own store transactions and customers who have purchased at their store.
   - `admin`: Can view all customers, merchants, and transactions.
3. **Immutability of session identity**: The caller identity and role are bound at process startup (`--role=... --caller=...` or environment variables). Claude has no access or tools to alter its own execution context or elevate privileges.

---

## 2. Graph & Data Model

The schema in [`prisma/schema.prisma`](file:///c:/Users/tanma/OneDrive/Desktop/2nd-brain-assignment/prisma/schema.prisma) is streamlined and robust:

```mermaid
erDiagram
    CUSTOMER ||--o{ TRANSACTION : places
    MERCHANT ||--o{ TRANSACTION : processes

    CUSTOMER {
        string id PK
        string name
        string email UK
        string phone
        datetime createdAt
    }

    MERCHANT {
        string id PK
        string businessName
        string category
        string email
        datetime createdAt
    }

    TRANSACTION {
        string id PK
        string customerId FK
        string merchantId FK
        float amount
        string currency
        string status
        datetime createdAt
    }
```

---

## 3. Access Matrix: Role-Based Gating

Enforced inside [`src/graph/repository.ts`](file:///c:/Users/tanma/OneDrive/Desktop/2nd-brain-assignment/src/graph/repository.ts):

| Operation / Tool | Admin | Merchant (`merch_xxx`) | Customer (`cust_xxx`) |
| :--- | :---: | :---: | :---: |
| `get_customer(id)` | Any customer | Only if customer bought at their store | Only own profile (`id == callerId`) |
| `get_merchant(id)` | Any merchant | Any merchant | Public info only |
| `get_transaction(id)` | Any transaction | Only if `merchantId == callerId` | Only if `customerId == callerId` |
| `list_transactions(filters)` | All transactions (optional `customerId`, `merchantId`, `status`) | Own store (optional `customerId`, `status`) | Own txns (optional `status`) |
| `list_customers()` | All customers | Customers who transacted at store | Restricted (own profile only via `get_customer`) |
| `whoami()` | Returns `{ role, callerId }` | Returns `{ role, callerId }` | Returns `{ role, callerId }` |

---

## 4. MCP Tools Implemented

The MCP server in [`src/mcp/server.ts`](file:///c:/Users/tanma/OneDrive/Desktop/2nd-brain-assignment/src/mcp/server.ts) exposes 6 core tools over `stdio`:

1. `get_customer`: Look up customer profile (subject to RBAC).
2. `get_merchant`: Look up merchant details.
3. `get_transaction`: Retrieve transaction by ID (subject to RBAC).
4. `list_transactions`: List transactions with optional filters (`status`, `customerId`, `merchantId`). Status is applied inside the caller's RBAC scope.
5. `list_customers`: List accessible customers.
6. `whoami`: Inspect current active MCP session credentials.

---

## 5. Absolute Path Imports

All source and test files use absolute path aliases (`@/...` mapped to `src/*` in `tsconfig.json` and `vitest.config.ts`):

- `@/graph/client`
- `@/graph/repository`
- `@/ingestion/validator`
- `@/data/generator`
- `@/config/env`
- `@/mcp/server`
- `@/types`

---

## 6. Quickstart & Verification

### Step 1: Configure Environment
Copy `.env.example` to `.env` and set your PostgreSQL connection string:
```bash
DATABASE_URL="postgresql://user:password@host/database?sslmode=require"
MCP_ROLE="admin"
MCP_CALLER_ID="admin"
```

### Step 2: Push Database Schema & Generate Prisma Client
```bash
npx prisma generate
npx prisma db push
```

### Step 3: Generate Synthetic Data & Ingest
```bash
# Generates 10 merchants, 20 customers, 80 transactions in data/raw/
npm run data:generate

# Ingests with Zod validation and idempotent upserts
npm run data:ingest
```

### Step 4: Run Automated Tests
```bash
npm test
```
Tests cover:
- Role-based gating against the seeded Postgres database (deny/allow on get + list)
- Zod schema validation (email formats, positive amounts, status enums)
- Synthetic data generator counts
- `list_transactions` status filter (scoped per role)

### Step 5: Start MCP Server

You can launch the server in any of the 3 persona contexts:

```bash
# Admin persona (unrestricted)
npm run start:admin

# Merchant persona (bound to store merch_001)
npm run start:merchant

# Customer persona (bound to customer cust_001)
npm run start:customer
```

---

## 7. Connecting to Claude Desktop

Do not paste `DATABASE_URL` into chat or into a committed file. Generate the Desktop config from `.env`:

```bash
npm run claude:config
```

That merges three MCP servers into `claude_desktop_config.json` (Windows: `%APPDATA%\Claude\claude_desktop_config.json`):

- `financial-graph-admin` — `--role=admin`
- `financial-graph-merchant` — `--role=merchant --caller=merch_001`
- `financial-graph-customer` — `--role=customer --caller=cust_001`

Restart Claude Desktop, then pick a server. Identity is the process you attached, not the Claude account. Ask “Who am I in this session?” (`whoami`) to confirm.
