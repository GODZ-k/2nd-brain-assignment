# Access-Controlled Financial Knowledge Graph over MCP

A TypeScript-based financial data service that exposes customer, merchant, and transaction data through the **Model Context Protocol (MCP)**. It uses PostgreSQL and Prisma to store the data, and enforces authorization in application code before records or fields are returned to an MCP tool caller.

**Repository:** https://github.com/GODZ-k/2nd-brain-assignment

## Contents

- [Overview](#overview)
- [Key design principles](#key-design-principles)
- [Architecture](#architecture)
- [Data model](#data-model)
- [Roles and access-control matrix](#roles-and-access-control-matrix)
- [MCP tools](#mcp-tools)
- [Prerequisites](#prerequisites)
- [Setup](#setup)
- [Environment variables](#environment-variables)
- [Generate and ingest sample data](#generate-and-ingest-sample-data)
- [Run the server](#run-the-server)
- [Connect to Claude Desktop](#connect-to-claude-desktop)
- [Test the HTTP endpoint](#test-the-http-endpoint)
- [Audit logging and field-level access](#audit-logging-and-field-level-access)
- [Tests and quality checks](#tests-and-quality-checks)
- [Project structure](#project-structure)
- [Security notes](#security-notes)
- [Troubleshooting](#troubleshooting)

## Overview

This project demonstrates how to expose financial records to an AI assistant through MCP while keeping authorization outside the model.

The service models three core entity types:

- **Customer** — a person who can have financial transactions.
- **Merchant** — a business that processes transactions.
- **Transaction** — a relationship between a customer and a merchant, including amount, currency, status, and creation time.

The current data layer uses PostgreSQL tables and Prisma relations to represent the graph. It does not require a dedicated graph database for this implementation.

### Main capabilities

- Role- and identity-based access control for admin, merchant, and customer callers.
- MCP tools for reading customer, merchant, and transaction data.
- Record-level restrictions enforced in the repository/access-control layer.
- Field-level restrictions for sensitive transaction information such as `internalNote`.
- Audit logging for access activity.
- Synthetic data generation and validated, repeatable ingestion.
- Two MCP transports: stdio and stateless Streamable HTTP.
- Automated tests using Vitest.

## Key design principles

### 1. The LLM is not the security boundary

A model prompt that says “do not reveal another customer's data” is not authorization. Prompts can be misunderstood or manipulated. The server must enforce access rules before returning data to the MCP client.

### 2. Authenticate the caller and bind a trusted identity

The caller's role and ID are derived from trusted launch configuration or server-side credentials. They are not accepted as arbitrary tool arguments.

- **stdio:** identity is configured when the MCP server process starts.
- **Streamable HTTP:** identity is derived from the bearer token on the incoming request.

### 3. Authorize before returning records or fields

The repository/access-control layer determines which records a caller can access. Sensitive fields are filtered before the tool result is returned.

### 4. Apply the same policy to every access path

Both single-record tools and list tools must apply the same role restrictions. Filtering only in the LLM prompt or only in the frontend is insufficient.

## Architecture

```mermaid
flowchart TD
    Client["MCP Client / Claude Desktop"]
    Transport["MCP Transport<br/>stdio or Streamable HTTP"]
    Auth["Identity Binding / HTTP Authentication"]
    Tools["MCP Tools"]
    Access["Access-Control Service"]
    Repo["Graph Repository"]
    Audit["Audit Service"]
    Prisma["Prisma Client"]
    DB[("PostgreSQL")]

    Client --> Transport
    Transport --> Auth
    Auth --> Tools
    Tools --> Access
    Access --> Repo
    Access --> Audit
    Repo --> Prisma
    Audit --> Prisma
    Prisma --> DB
```

Conceptually, the request flow is:

1. An MCP client invokes a tool.
2. The server establishes a trusted `CallerContext` containing the caller's role and ID.
3. The access-control logic evaluates whether the caller can access the requested record and which fields may be returned.
4. The repository queries PostgreSQL through Prisma.
5. Sensitive fields are filtered, and access activity is written to the audit log.
6. The MCP tool returns the permitted result or a controlled error.

> The diagram describes the intended request flow. Check the implementation and tests when changing the order or responsibilities of authorization, repository access, and audit writes.

## Data model

The Prisma schema is defined in [`prisma/schema.prisma`](prisma/schema.prisma).

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
        string businessName UK
        string category
        string email UK
        datetime createdAt
    }

    TRANSACTION {
        string id PK
        string customerId FK
        string merchantId FK
        float amount
        string currency
        string status
        string internalNote
        datetime createdAt
    }
```

The `internalNote` field is optional if the current schema declares it as nullable. It is included as an example of a sensitive field that should be visible only to authorized roles.

### Entity relationships

- One customer can have many transactions.
- One merchant can have many transactions.
- Each transaction references one customer and one merchant.

The synthetic dataset generator currently creates **10 merchants, 20 customers, and 80 transactions**. The generator is deterministic where it uses the configured Faker seed, so the generated dataset is suitable for repeatable local demonstrations.

## Roles and access-control matrix

The access rules are enforced server-side. The following summarizes the intended behavior documented for the project; keep this table synchronized with the access-control service and integration tests if policies change.

| Operation | Admin | Merchant | Customer |
|---|---|---|---|
| `get_customer(id)` | Any customer | Customers who transacted with the caller's merchant | Own profile only |
| `get_merchant(id)` | Any merchant, including permitted private fields | Merchant records according to the implemented policy | Public merchant information |
| `get_transaction(id)` | Any transaction | Transactions belonging to the caller's merchant | Transactions belonging to the caller |
| `list_transactions(filters)` | Any transactions, with supported filters | Caller merchant's transactions only; optional supported filters | Caller customer's transactions only; optional supported filters |
| `list_customers()` | All customers | Customers who transacted with the caller's merchant | Restricted to the caller's own profile, where supported |
| `whoami()` | Current role and caller ID | Current role and caller ID | Current role and caller ID |

### Field-level access

Record-level access answers: **“May this caller access this record?”**

Field-level access answers: **“Which properties of this record may this caller see?”**

For example, a caller might be allowed to view a transaction but not its `internalNote`. The server should remove that field from the result rather than relying on the model to ignore it.

The exact allowed fields should be defined centrally in the access-control implementation and verified with tests.

## MCP tools

The MCP server exposes these read-only tools:

| Tool | Purpose |
|---|---|
| `get_customer` | Retrieve a customer profile within the caller's access scope. |
| `get_merchant` | Retrieve merchant details allowed for the caller. |
| `get_transaction` | Retrieve a transaction if the caller is authorized to access it. |
| `list_transactions` | List transactions within the caller's scope, with supported filters. |
| `list_customers` | List customers visible to the caller. |
| `whoami` | Return the identity bound to the current MCP session/request. |

The server validates tool inputs and returns tool errors for failed or denied requests. Authorization must not be bypassed by passing a different customer or merchant ID as a tool argument.

## Prerequisites

Install the following before setting up the project:

- **Node.js 24**
- **npm**
- **PostgreSQL**, either locally or through a hosted provider
- Git

You will also need a PostgreSQL database and credentials with permission to create or update the project's tables.

## Setup

### Option A: Automated setup (recommended)

From the project root, run:

```bash
bash ./scripts/setup.sh
```

The script automates only the steps implemented in `scripts/setup.sh`. Review the script before running it to confirm how it installs dependencies, configures environment files, connects to PostgreSQL, initializes the schema, ingests data, and/or runs tests.

**Prerequisites**
- Node.js 24 and npm
- PostgreSQL running locally or a reachable hosted PostgreSQL database
- A valid `DATABASE_URL` configured as required by the script

After the script completes, run the tests if the script did not already run them:

```bash
npm test
```

If the script does not start an MCP server, start one separately using the commands in [Run the server](#run-the-server).

### Option B: Manual setup

#### 1. Clone the repository

```bash
git clone https://github.com/GODZ-k/2nd-brain-assignment.git
cd 2nd-brain-assignment
```

#### 2. Install dependencies

```bash
npm install
```

#### 3. Configure environment variables

Create a local `.env` file from the example if the repository includes one:

```bash
cp .env.example .env
```

If `.env.example` is not present, create `.env` manually using the variables in the next section and the defaults defined in `src/config/env.ts`.

#### 4. Configure PostgreSQL

Set `DATABASE_URL` in `.env` to your local or hosted PostgreSQL connection string.

Local example (replace the placeholders with your own database details):

```dotenv
DATABASE_URL="postgresql://DB_USER:DB_PASSWORD@localhost:5432/DB_NAME"
```

Hosted PostgreSQL example:

```dotenv
DATABASE_URL="postgresql://DB_USER:DB_PASSWORD@DB_HOST:5432/DB_NAME?sslmode=require"
```

Use the connection string format supplied by your database provider. Do not commit credentials to Git.

#### 5. Generate Prisma Client

```bash
npm run prisma:generate
```

#### 6. Create or update the database schema

For the current quick-start flow, this project uses `prisma db push`:

```bash
npm run prisma:db:push
```

`db push` synchronizes the Prisma schema with the database without creating migration files. For a workflow that tracks schema changes through migrations, review the migration script and use `npm run prisma:db:migrate` in an appropriate development environment.

#### 7. Generate and ingest sample data

```bash
npm run data:generate
npm run data:ingest
```

The generator writes synthetic data to the project's raw-data directory. The ingestion script validates the input and writes the records to PostgreSQL. Run ingestion after the database schema has been initialized.

#### 8. Run the test suite

```bash
npm test
```

Tests require the environment and database setup expected by the test configuration. If a test uses PostgreSQL, ensure the database is reachable and the required schema/data are available before running the suite.

## Environment variables

The following variables are used by the application or described by the current setup. Confirm optionality and defaults in `src/config/env.ts` and the identity configuration before deployment.

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string. |
| `MCP_ROLE` | Default stdio and http role, if supported by the current entry point. |
| `MCP_CALLER_ID` | Default stdio and http caller ID, if supported by the current entry point. |
| `MCP_TOKEN` | Bearer token mapped to the identity for HTTP. |
| `HOST` | HTTP bind host, if configured by the environment loader. |
| `PORT` | HTTP listen port, if configured by the environment loader. |

Generate strong, random tokens rather than using sample values. For example, with Node.js:

```bash
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

Run this separately for each token and keep the values private.

**Important:** Environment variable names and defaults must match the code in `src/config/env.ts`. Do not add unsupported variables to production configuration simply because they appear in documentation.

## Generate and ingest sample data

The project provides npm scripts for the synthetic data pipeline:

```bash
npm run data:generate
npm run data:ingest
```

The generator creates:

- 10 merchants
- 20 customers
- 80 transactions

The ingestion process should be safe to repeat when implemented with upserts, and should validate incoming records before persistence. If the schema or generated data changes, regenerate Prisma Client and synchronize the database schema before ingesting again.

## Run the server

### Streamable HTTP transport

Start the HTTP server:

```bash
npm run start:http
```

The endpoint is mounted at `/mcp`. Its actual host and port are determined by the application configuration and environment variables; check the startup log and `src/config/env.ts` for the configured values.

For HTTP requests, the server maps the bearer token to a role and caller ID. Do not allow the request body or MCP tool arguments to override that trusted identity.

## Connect to Claude Desktop

The project includes a script to generate or update Claude Desktop MCP configuration:

```bash
npm run claude:config -- --transport=http
```

Useful options documented by the project include:

```bash
npm run claude:config -- --check
npm run claude:config -- --transport=stdio
npm run claude:config -- --transport=http
npm run claude:config -- --roles=customer
npm run claude:config -- --dry-run
npm run claude:config -- --remove
```

The exact options supported by the script are defined in `scripts/write-claude-config.ts`. Use `--dry-run` to inspect changes before writing configuration, and `--check` to validate generated entries if supported by the current version.

After updating the configuration:

1. Fully quit Claude Desktop, including its tray/background process.
2. Reopen Claude Desktop.
3. Select the configured MCP server ( make sure you activate the developer option from the navigation ).
4. Call `whoami` to confirm the role and caller ID.
5. Test the role's allowed and denied operations.

For HTTP-backed Claude Desktop entries, the local HTTP server must be running. A local `http://` server is not the same as a publicly reachable HTTPS endpoint; remote/custom connector requirements depend on the client and deployment setup.

## Test the HTTP endpoint

For local testing, replace `PORT` and `<TOKEN>` with the values configured for your server.

Example `curl` request to call `whoami`:

```bash
curl --location 'http://127.0.0.1:3000/mcp' \
  --header 'Content-Type: application/json' \
  --header 'Accept: application/json, text/event-stream' \
  --header 'Authorization: Bearer <TOKEN>' \
  --data '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"whoami","arguments":{}}}'
```

The MCP Streamable HTTP transport may require the `Accept` header shown above. If this request fails, check the configured port, server logs, token configuration, and the MCP SDK's current transport requirements.

Other useful MCP JSON-RPC methods include `initialize` and `tools/list`.

You can also use the MCP Inspector:

```bash
npx @modelcontextprotocol/inspector
```

Configure the Inspector to connect to the running server using the appropriate transport and authentication settings.

## Audit logging and field-level access

### Audit logging

The audit log is intended to capture who attempted to access which resource and whether the operation was allowed or denied. Depending on the operation and implementation, useful audit attributes include:

- Caller ID and caller role
- Action (for example, read or list)
- Resource type and resource ID, when available
- Allow/deny decision and reason
- MCP tool name
- Allowed or denied fields, where recorded
- Timestamp and relevant metadata

Audit records should be written by trusted server-side code, not by the LLM. Avoid writing bearer tokens, passwords, database connection strings, or unnecessary sensitive customer data into audit metadata.

### Field-level access control

The project includes a sensitive transaction field such as `internalNote` to demonstrate that access to a record does not automatically imply access to every field on it.

When updating access policies:

1. Define the allowed fields centrally.
2. Enforce the policy before returning data from MCP tools.
3. Apply the policy to both single-record and list operations.
4. Test that unauthorized fields are absent from the returned payload, not merely hidden in a UI.
5. Audit relevant access attempts according to the project's logging policy.

## Tests and quality checks

Run the automated test suite:

```bash
npm test
```

Run tests in watch mode while developing:

```bash
npm run test:watch
```

Run TypeScript checks:

```bash
npm run type-check
```

Build the project:

```bash
npm run build
```

Run ESLint:

```bash
npm run lint
```

Automatically apply supported lint fixes:

```bash
npm run lint:fix
```

The repository's tests are intended to validate behavior such as:

- Role-based access to individual records and list results
- Scoped transaction filters
- Input validation
- Synthetic dataset generation
- Sensitive-field filtering
- Audit behavior, where covered by the test suite

Use the tests as the source of truth for exact coverage; update this list whenever the suite changes.

## Project structure

The following is a high-level guide to the source layout. File names may evolve; consult the repository for the current implementation.

```text
.
├── prisma/
│   └── schema.prisma
├── scripts/
│   └── write-claude-config.ts
├── src/
│   ├── config/
│   │   ├── env.ts
│   │   └── identify.ts
│   ├── data/
│   │   └── generator.ts
│   ├── graph/
│   │   ├── client.ts
│   │   └── repository.ts
│   ├── ingestion/
│   │   ├── validator.ts
│   │   └── ingest.ts
│   ├── mcp/
│   │   └── server.ts
│   ├── routes/
│   ├── middleware/
│   ├── core/
│   │   ├── access-control.service.ts
│   │   └── audit.service.ts
│   ├── http.ts
│   ├── index.ts
│   └── types.ts
├── tests/
├── .env.example
├── package.json
└── tsconfig.json
```

Some directories in the tree represent logical responsibilities and may have different names in the current repository.

### Path aliases

The project uses TypeScript path aliases such as `@/...` for imports from the source tree, where configured. Ensure the TypeScript, test, and runtime tooling all resolve these aliases consistently.

## Security notes

- Never commit `.env` files, tokens, or database credentials.
- Use strong, distinct bearer tokens for each HTTP role.
- Keep the HTTP server bound to localhost for local development unless remote access is intentionally configured.
- Use HTTPS and appropriate authentication when exposing the server outside a trusted local environment.
- Do not trust caller IDs, roles, customer IDs, or merchant IDs supplied as tool arguments for authorization decisions.
- Keep authorization in trusted server-side code, not in prompts.
- Apply authorization to both record retrieval and list/filter queries.
- Remove unauthorized fields before returning tool results.
- Avoid logging secrets or full sensitive records.
- Treat synthetic sample data as demonstration data, not production financial data.

## Troubleshooting

| Symptom | Things to check |
|---|---|
| Prisma cannot connect to PostgreSQL | Confirm PostgreSQL is running, `DATABASE_URL` is correct, the database exists, and network/SSL settings match the provider. |
| Prisma Client is out of date | Run `npm run prisma:generate` after schema changes. |
| Tables or columns are missing | Run `npm run prisma:db:push` against the intended development database. |
| Ingestion fails | Confirm the database is reachable, schema is synchronized, generated files exist, and validation errors are resolved. |
| Tests fail before reaching the database | Confirm the test environment loads the correct `.env` and PostgreSQL is available when required. |
| HTTP returns `401 Unauthorized` | Check the `Authorization: Bearer ...` header and confirm the token matches the server environment. Restart the server after changing environment values. |
| HTTP returns `405 Method Not Allowed` | Use the supported HTTP method for the configured stateless transport; the MCP endpoint is normally called with `POST`. |
| Claude Desktop reports that the server failed | Run the config script's check option if supported, inspect Claude Desktop logs, and confirm the Node.js executable, working directory, environment, and database are accessible. |
| stdio connection fails or returns malformed output | Ensure application logs go to stderr, not stdout, because stdout is used by the MCP protocol. |
| A role sees data it should not see | Reproduce the case in a test and inspect the central access-control/repository path. Do not try to fix it only through prompt instructions. |

## Development workflow

A typical local development cycle is:

```bash
npm install
npm run prisma:generate
npm run prisma:db:push
npm run data:generate
npm run data:ingest
npm test
npm run type-check
npm run build
```

Then start the transport you want to test:

```bash
npm run start:customer
# or
npm run start:http
```

## License

This project declares the `ISC` license in `package.json`. Review the repository's license file and distribution requirements before reusing or redistributing the code.
