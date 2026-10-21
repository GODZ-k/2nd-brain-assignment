# Access-Controlled Knowledge Graph MCP Server

A generic, access-controlled Knowledge Graph exposed through the **Model Context Protocol (MCP)**.

The system ingests unstructured PDF documents, extracts entities and relationships using an LLM, stores them as a knowledge graph in PostgreSQL, and exposes controlled graph operations through MCP.

Access control is enforced by the application during entity access and graph traversal. The LLM is responsible for **knowledge extraction**, not authorization decisions.

---

## Architecture

```text
                         PDF Document
                              │
                              ▼
                    ┌───────────────────┐
                    │  Document Parser  │
                    └─────────┬─────────┘
                              │
                              ▼
                    ┌───────────────────┐
                    │  Document Chunker │
                    └─────────┬─────────┘
                              │
                              ▼
                    ┌───────────────────┐
                    │ Knowledge Extractor│
                    │       (LLM)       │
                    └─────────┬─────────┘
                              │
                    Entities + Relations
                              │
                              ▼
                    ┌───────────────────┐
                    │ KnowledgeIngestor │
                    └─────────┬─────────┘
                              │
                              ▼
                 ┌──────────────────────────┐
                 │       PostgreSQL         │
                 │                          │
                 │  Documents               │
                 │  DocumentChunks          │
                 │  Entities                │
                 │  GraphRelations          │
                 │  AuditLogs               │
                 └────────────┬─────────────┘
                              │
                              ▼
                    ┌───────────────────┐
                    │ Graph Repository  │
                    └─────────┬─────────┘
                              │
                              ▼
                    ┌───────────────────┐
                    │  Graph Traversal  │
                    └─────────┬─────────┘
                              │
                              ▼
                    ┌───────────────────┐
                    │ Graph Access      │
                    │ Policy            │
                    └─────────┬─────────┘
                              │
                              ▼
                    ┌───────────────────┐
                    │ Knowledge Graph   │
                    │ Service           │
                    └─────────┬─────────┘
                              │
                              ▼
                    ┌───────────────────┐
                    │    MCP Server     │
                    └─────────┬─────────┘
                              │
                              ▼
                    ┌───────────────────┐
                    │   Claude Desktop  │
                    └───────────────────┘
```

---

# Features

- Generic domain-independent knowledge graph
- PDF document ingestion
- Document parsing and chunking
- LLM-based entity extraction
- LLM-based relationship extraction
- Stable semantic entity IDs
- PostgreSQL persistence
- Prisma ORM
- Knowledge graph traversal
- Access-controlled graph traversal
- Entity-level access control
- Field-level access control
- MCP server integration
- Claude Desktop integration
- Audit logging
- TypeScript
- Automated tests

---

# Technology Stack

| Technology | Purpose |
|---|---|
| Node.js | Runtime |
| TypeScript | Application language |
| PostgreSQL | Persistent graph storage |
| Prisma | Database ORM |
| Zod | Schema validation |
| Vercel AI SDK | LLM integration |
| Groq | LLM provider |
| MCP | Model Context Protocol |
| Claude Desktop | MCP client |
| Vitest | Testing |

---

# Project Structure

```text
src/
├── audit/
│   └── audit.service.ts
│
├── config/
│   ├── identify.ts
│   └── prisma.ts
│   └── env.ts
│
├── core/
│   └── knowledge-graph.service.ts
|   └── audit.service.ts
|    
│── controllers/
│   └── mcp.controller.ts
|
├── graph/
│   ├── access.policy.ts
│   ├── graph.traversal.ts
│   └── knowledge.repository.ts
│
├── ingestion/
│   ├── document.chunker.ts
│   ├── document.ingestion.ts
│   ├── document.parser.ts
│   ├── document.repository.ts
│   ├── knowledge.extractor.ts
│   ├── knowledge.ingestor.ts
│   ├── prompts.ts
│   └── types.ts
│
├── mcp/
│   ├── server.ts
│   └── tools.ts
|
├── middleware/
│   ├── ath.middleware.ts
|
├── types/
│   └── index.ts
│
└── ...
```

---

# Knowledge Graph Model

The graph is intentionally domain-independent.

It does not require a fixed set of entities such as:

```text
Customer
Merchant
Transaction
```

Instead, the LLM determines entity types from the supplied document.

Examples include:

```text
Person
Organization
Company
Project
Product
Location
Transaction
Event
Document
```

The graph is represented as:

```text
Entity
   │
   │ GraphRelation
   ▼
Entity
```

For example:

```text
John Doe
   │
   ├── WORKS_FOR ──────► Acme Corporation
   │
   └── LIVES_IN ───────► Dehradun
```

Another document could produce a completely different graph.

---

# Document Ingestion

Documents are processed through the following pipeline:

```text
PDF
 ↓
Parse text
 ↓
Generate document ID
 ↓
Store document
 ↓
Split into chunks
 ↓
Store chunks
 ↓
LLM extraction
 ↓
Extract entities
 ↓
Extract relations
 ↓
Normalize entity IDs
 ↓
Persist graph
```

The ingestion service coordinates the process.

Conceptually:

```ts
const parsed = await DocumentParser.parsePdf(filePath);

const chunks = DocumentChunker.chunk(
  parsed.text,
  4000,
);

const knowledge =
  await knowledgeExtractor.extract(chunk.content);

await knowledgeIngestor.ingest(
  knowledge,
  documentId,
);
```

---

# Knowledge Extraction

The LLM receives document text and extracts a structured graph.

The extraction schema contains:

```text
entities
relations
```

An entity contains:

```text
id
type
name
properties
```

A relation contains:

```text
id
sourceId
targetId
relationType
properties
```

Entity IDs are generated using stable semantic identifiers.

For example:

```text
person-john-doe
organization-acme-corporation
location-dehradun
```

Relations can then reference those entity IDs.

---

# Important Security Boundary

The LLM is **not the authorization authority**.

The LLM performs:

```text
Unstructured text
       ↓
Knowledge extraction
       ↓
Entities + Relations
```

It does not determine:

```text
Who is allowed to read the data?
```

Authorization is handled by the application.

The authorization flow is:

```text
Authenticated Caller
        │
        ▼
   CallerContext
        │
        ▼
 GraphAccessPolicy
        │
        ▼
 GraphTraversal
        │
        ▼
Authorized Graph
```

This prevents the LLM from being responsible for security decisions.

---

# Access Control

Access control is implemented through `GraphAccessPolicy`.

A graph entity contains an access policy that can describe visibility and applicable roles/ownership according to the current authorization model.

Conceptually:

```json
{
  "visibility": "restricted",
  "roles": ["analyst"],
  "ownerId": ""
}
```

A public entity can be represented as:

```json
{
  "visibility": "public",
  "roles": [],
  "ownerId": ""
}
```

The application evaluates the policy against the authenticated caller.

---

# Deny by Default

The authorization system follows a deny-by-default approach.

If the caller does not satisfy the policy, the entity is not returned.

Conceptually:

```text
Entity
  │
  ▼
GraphAccessPolicy
  │
  ├── Allowed ──► Return entity
  │
  └── Denied ───► Do not expose entity
```

This is especially important during graph traversal because authorization must prevent indirect access to restricted nodes.

---

# Graph Traversal

The graph is not treated as a simple relational lookup.

Traversal follows graph relationships:

```text
Entity A
   │
   └── relation ──► Entity B
                       │
                       └── relation ──► Entity C
```

Traversal is controlled by `maxDepth`.

For example:

```text
A → B → C → D
```

With:

```text
maxDepth = 1
```

the traversal should only reach:

```text
A → B
```

With:

```text
maxDepth = 2
```

it can reach:

```text
A → B → C
```

---

# Authorization During Traversal

Authorization is not only applied to the initial entity.

Traversal must respect access policies while moving through the graph.

Conceptually:

```text
Start Entity
     │
     ▼
Check Entity Access
     │
     ▼
Check Relationship
     │
     ▼
Check Target Entity
     │
     ├── Allowed ──► Continue traversal
     │
     └── Denied ───► Stop that path
```

This prevents a caller from reaching a restricted entity simply because it is connected to an entity they are allowed to access.

---

# Knowledge Graph Service

`KnowledgeGraphService` provides the application-level interface to the graph.

It currently exposes operations for:

```text
getEntity()
searchEntities()
query()
```

The service coordinates:

```text
KnowledgeGraphRepository
GraphAccessPolicy
GraphTraversal
AuditService
```

The MCP layer does not directly access Prisma.

Instead:

```text
MCP
 ↓
KnowledgeGraphService
 ↓
Graph Repository
 ↓
Prisma
 ↓
PostgreSQL
```

This keeps authorization and business logic outside the MCP transport layer.

---

# MCP Server

The project exposes the knowledge graph through MCP.

The currently available tools are:

## `whoami`

Returns the identity associated with the current MCP session.

Example:

```json
{
  "role": "admin",
  "callerId": "..."
}
```

---

## `search_entities`

Searches entities by name and optionally by type.

Example:

```text
Search the knowledge graph for John.
```

Conceptually:

```json
{
  "query": "John",
  "type": "Person"
}
```

Only entities that the caller is authorized to read are returned.

---

## `get_entity`

Retrieves an entity by its graph ID.

Example:

```text
Get entity person-john-doe.
```

The service checks the entity access policy before returning it.

---

## `traverse_graph`

Traverses the graph starting from an entity.

Example:

```text
Traverse the graph from person-john-doe with depth 2.
```

The MCP tool accepts:

```json
{
  "entityId": "person-john-doe",
  "maxDepth": 2
}
```

Authorization is enforced by the underlying graph traversal layer.

---

# Audit Logging

All important graph access operations are audited.

The `AuditService` records information such as:

```text
callerId
callerRole
action
resourceType
resourceId
decision
reason
toolName
requestId
fields
metadata
timestamp
```

Example:

```text
callerRole     analyst
action         READ
resourceType   Entity
resourceId     person-john-doe
decision       ALLOWED
toolName       get_entity
```

A denied request can be recorded as:

```text
callerRole     analyst
action         READ
resourceType   Entity
resourceId     restricted-project
decision       DENIED
reason         Entity access policy denied access
toolName       get_entity
```

Audit records are persisted in PostgreSQL.

---

# Field-Level Access Control

The system also supports field-level access control.

The purpose is to avoid returning fields that the caller should not see even when the entity itself is readable.

Conceptually:

```text
Entity
 ├── id             ✓
 ├── name           ✓
 ├── publicProperty ✓
 └── sensitiveData  ✗
```

The response should contain only fields the caller is authorized to receive.

---

# Database

PostgreSQL is used as the persistent storage layer.

Prisma manages database access.

The database contains the core graph concepts:

```text
Document
DocumentChunk
Entity
GraphRelation
AuditLog
```

The graph itself is represented by:

```text
Entity
   ↓
GraphRelation
   ↓
Entity
```

This is different from simply storing application-specific foreign-key relationships.

---

# Environment Variables

Create a `.env` file based on your project's environment configuration.

Example:

```env
DATABASE_URL="postgresql://USER:PASSWORD@HOST:5432/DATABASE"

GROQ_API_KEY="your-groq-api-key"
```

Do not commit secrets to Git.

---

# Installation 
Clone the repository:

```bash
git clone https://github.com/GODZ-k/2nd-brain-assignment
cd 2nd-brain-assignment
```
## Method 1

Run the bash script to setup the entire project:

```bash
bash ./scripts/setup.sh
```
make sure the file have execute permission


## Method 2

Install dependencies:

```bash
npm install
```

Generate Prisma Client:

```bash
npx prisma generate
```

Apply the database schema:

```bash
npx prisma db push
```

Or use your project's migration workflow if migrations are configured.

---

# Running PostgreSQL

Make sure PostgreSQL is running and that `DATABASE_URL` points to the correct database.

Verify Prisma connectivity:

```bash
npx prisma studio
```

Prisma Studio can be used to inspect:

```text
Documents
DocumentChunks
Entities
GraphRelations
AuditLogs
```

---

# Ingesting a PDF

The project contains an ingestion entry point that accepts a PDF path.

Example:

```bash
npm run ingest:pdf -- ./data/raw/financial_knowledge_graph_sample.pdf
```

The ingestion process will:

1. Parse the PDF.
2. Create a document record.
3. Split the document into chunks.
4. Extract entities and relations.
5. Normalize entity IDs.
6. Persist entities.
7. Persist relationships.

Example result:

```json
{
  "documentId": "...",
  "pageCount": 4,
  "chunks": 3
}
```

---

# Inspecting the Graph

Open Prisma Studio:

```bash
npx prisma studio
```

Inspect the `Entity` table.

You should see records similar to:

```text
id: person-john-doe
type: Person
name: John Doe
```

And the relationship table should contain edges such as:

```text
sourceId: person-john-doe
relationType: WORKS_FOR
targetId: organization-acme
```

---

# Running Tests

Run the project's test suite:

```bash
npm test
```

For a TypeScript check:

```bash
npx tsc --noEmit
```

The tests cover the graph and authorization behavior implemented in the project.

---

# Claude Desktop / MCP

The MCP server can be connected to an MCP-compatible client such as Claude Desktop.

The MCP server exposes:

```text
whoami
search_entities
get_entity
traverse_graph
```

After configuring the server in Claude Desktop, restart Claude Desktop and verify that the MCP server appears as connected.

The exact configuration depends on the local MCP server entry point and transport used by the project.

---

# MCP Demo

Once Claude is connected, try the following prompts.

## 1. Check identity

```text
Who am I?
```

Claude should invoke:

```text
whoami
```

---

## 2. Search the graph

```text
Search the knowledge graph for John.
```

Claude should invoke:

```text
search_entities
```

---

## 3. Get an entity

Take an ID returned from the search:

```text
Get the entity with ID person-john-doe.
```

Claude should invoke:

```text
get_entity
```

---

## 4. Traverse the graph

```text
Traverse the graph starting from person-john-doe with a maximum depth of 2.
```

Claude should invoke:

```text
traverse_graph
```

The returned graph should contain only entities and relationships accessible to the current caller.

---

# Security Testing

The security model should be tested through the same MCP interface used by Claude.

## Test: Authorized Entity

Request an entity that the current caller can access.

Expected:

```text
Entity returned
```

Audit log:

```text
decision = ALLOWED
```

---

## Test: Unauthorized Entity

Request an entity whose policy denies the current caller.

Expected:

```text
Entity not returned
```

Audit log:

```text
decision = DENIED
```

The entity's protected properties must not be exposed.

---

## Test: Unauthorized Traversal

Consider:

```text
Entity A
   │
   └── relation ──► Restricted Entity B
```

If the caller can read A but cannot read B:

```text
traverse(A)
```

must not expose B.

Expected:

```text
A
```

rather than:

```text
A → B
```

This verifies that access control is enforced during graph traversal and not only during direct entity lookup.

---

## Test: Traversal Depth

For:

```text
A → B → C → D
```

with:

```text
maxDepth = 1
```

the traversal should not return C or D.

With:

```text
maxDepth = 2
```

the traversal may reach C but not D.

---

## Test: Invalid Entity

Request:

```text
Get entity does-not-exist.
```

The server should return a controlled response and remain operational.

---

# Audit Verification

After performing MCP operations, inspect the audit table.

Example SQL:

```sql
SELECT
  "callerId",
  "callerRole",
  action,
  "resourceType",
  "resourceId",
  decision,
  reason,
  "toolName",
  "createdAt"
FROM "AuditLog"
ORDER BY "createdAt" DESC
LIMIT 20;
```

You should see records corresponding to MCP operations.

For example:

```text
READ   Entity          ALLOWED
LIST   Entity          ALLOWED
READ   Entity          DENIED
READ   KnowledgeGraph  ALLOWED
```

---

# Design Decisions

## Why a Knowledge Graph?

A graph provides a natural representation of entities and semantic relationships.

Instead of querying only predefined relational paths, the system can traverse dynamically extracted relationships.

Example:

```text
Person
  ↓
WORKS_FOR
  ↓
Organization
  ↓
LOCATED_IN
  ↓
Location
```

This enables multi-hop exploration of unstructured information.

---

## Why Generic Entities?

The extraction engine is domain-independent.

The system does not hard-code:

```text
Customer
Merchant
Transaction
```

as the only possible graph types.

Instead, the document determines the entities and relationships.

This makes the system reusable across different document types and domains.

---

## Why Authorization Outside the LLM?

An LLM is not a trusted authorization mechanism.

The model can extract information, but security decisions must be made by deterministic application code.

Therefore:

```text
LLM
 ↓
Extract knowledge

Application
 ↓
Authorize access
```

This separation is intentional.

---

## Why Authorization During Traversal?

Checking only the starting node is insufficient.

A caller may have access to:

```text
Entity A
```

but not:

```text
Entity B
```

If:

```text
A → B
```

then traversal must verify B before returning it.

Otherwise the graph itself becomes an authorization bypass.

---

# Current Scope

The current implementation focuses on:

- Generic knowledge graph extraction
- Graph persistence
- Graph traversal
- Access policies
- Field-level access control
- MCP integration
- Audit logging
- Claude Desktop testing

The authorization model currently operates at the graph entity/relation level.

---

# Future Improvements

Potential future improvements include:

- Resource-level authorization
- Relationship-aware authorization
- User/organization ownership rules
- PostgreSQL Row-Level Security
- More granular field policies
- Policy administration UI
- Policy inheritance
- Document-level permissions
- Policy versioning
- More advanced graph query capabilities
- MCP authentication with production identity providers
- Improved audit correlation using request IDs

These are intentionally outside the current core implementation.

---

# Security Considerations

The following principles are used by the current implementation:

1. The LLM does not make authorization decisions.
2. Authorization is evaluated by application code.
3. Access is deny-by-default where the policy does not grant access.
4. Graph traversal checks authorization rather than blindly returning connected nodes.
5. MCP tools do not directly access the database.
6. Audit records are generated for graph access operations.
7. Sensitive fields should not be returned when field-level policy denies them.
8. Authentication identity should come from a trusted MCP authentication mechanism rather than arbitrary tool parameters.

---

# Limitations

This project is designed as an assignment/demo implementation rather than a production financial authorization platform.

In particular:

- Resource-level ownership authorization is not currently implemented.
- PostgreSQL Row-Level Security is not currently used.
- Policy administration is not exposed through a UI.
- The LLM extraction quality depends on the selected model.
- The current graph model stores access policy information alongside graph data.
- Production deployment would require hardened authentication, secret management, monitoring, rate limiting, and additional security controls.

---

# Example End-to-End Flow

A complete request looks like:

```text
User
 │
 │ "Traverse the graph from person-john-doe"
 ▼
Claude
 │
 │ MCP tool call
 ▼
traverse_graph
 │
 ▼
KnowledgeGraphService
 │
 ├──────────────► AuditService
 │
 ▼
GraphTraversal
 │
 ├──────────────► GraphAccessPolicy
 │
 ▼
KnowledgeGraphRepository
 │
 ▼
Prisma
 │
 ▼
PostgreSQL
 │
 ▼
Authorized graph result
 │
 ▼
Claude
 │
 ▼
User
```

---

# Reviewer Quick Start

For a quick evaluation:

```bash
npm install

npx prisma generate

npx prisma db push

npm run ingest:pdf -- ./data/sample.pdf

npm test

npx tsc --noEmit
```

Then:

1. Start the MCP server.
2. Connect it to Claude Desktop.
3. Run `whoami`.
4. Run `search_entities`.
5. Run `get_entity`.
6. Run `traverse_graph`.
7. Test an unauthorized entity.
8. Inspect `AuditLog`.

The most important demonstration is:

```text
Claude
  ↓
MCP
  ↓
GraphTraversal
  ↓
Access Policy
  ↓
Restricted graph data is not returned
```

---

# Summary

This project demonstrates an access-controlled knowledge graph exposed through MCP.

The core design separates responsibilities:

```text
LLM
  → Extract knowledge

Knowledge Graph
  → Represent entities and relationships

Graph Access Policy
  → Decide authorization

Graph Traversal
  → Traverse only authorized graph paths

Knowledge Graph Service
  → Coordinate graph operations

MCP
  → Expose the graph to AI clients

Audit Service
  → Record access decisions
```

The result is a generic knowledge graph that can be queried through an MCP-compatible AI client while keeping authorization decisions inside the trusted application layer.