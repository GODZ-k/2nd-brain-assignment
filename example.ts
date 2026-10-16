// "mcpServers": {
//  "financial-graph-admin": {
//  "command": "C:/Program Files/nodejs/node.exe",
//  "args": [
//  "C:/Users/tanma/OneDrive/Desktop/2nd-brain-assignment/node_modules/tsx/dist/cli.mjs",
//  "--tsconfig",
//  "C:/Users/tanma/OneDrive/Desktop/2nd-brain-assignment/tsconfig.json",
//  "C:/Users/tanma/OneDrive/Desktop/2nd-brain-assignment/src/index.ts",
// "--role=admin"
//         ],
// "env": {
//  "DATABASE_URL": "postgresql://neondb_owner:npg_gSx19JDpeNjF@ep-solitary-math-b4j6hvv5-pooler.c-6.us-east-2.aws.neon.tech/neondb?sslmode=require&channel_binding=require",
//  "MCP_ROLE": "admin",
//  "MCP_CALLER_ID": "admin",
//  "DOTENV_CONFIG_QUIET": "true"

//         }
//     },
//  "financial-graph-customer": {
//  "command": "C:/Program Files/nodejs/node.exe",
//  "args": [
// "C:/Users/tanma/OneDrive/Desktop/2nd-brain-assignment/node_modules/tsx/dist/cli.mjs",
//  "--tsconfig",
// "C:/Users/tanma/OneDrive/Desktop/2nd-brain-assignment/tsconfig.json",
//  "C:/Users/tanma/OneDrive/Desktop/2nd-brain-assignment/src/index.ts",
// "--role=customer",
// "--caller=cust_001"
//       ],
//  "env": {
//  "DATABASE_URL": "postgresql://neondb_owner:npg_gSx19JDpeNjF@ep-solitary-math-b4j6hvv5-pooler.c-6.us-east-2.aws.neon.tech/neondb?sslmode=require&channel_binding=require",
//  "MCP_ROLE": "customer",
//  "MCP_CALLER_ID": "cust_001",
//  "DOTENV_CONFIG_QUIET": "true"

//         }

//     },
// "financial-graph-merchant": {
//  "command": "C:/Program Files/nodejs/node.exe",
//  "args": [
//  "C:/Users/tanma/OneDrive/Desktop/2nd-brain-assignment/node_modules/tsx/dist/cli.mjs",
//  "--tsconfig",
//  "C:/Users/tanma/OneDrive/Desktop/2nd-brain-assignment/tsconfig.json",
//  "C:/Users/tanma/OneDrive/Desktop/2nd-brain-assignment/src/index.ts",
//  "--role=merchant",
//  "--caller=merch_001"
//       ],
//  "env": {
//  "DATABASE_URL": "postgresql://neondb_owner:npg_gSx19JDpeNjF@ep-solitary-math-b4j6hvv5-pooler.c-6.us-east-2.aws.neon.tech/neondb?sslmode=require&channel_binding=require",
// "MCP_ROLE": "merchant",
//  "MCP_CALLER_ID": "merch_001",
//  "DOTENV_CONFIG_QUIET": "true"

//         }

//     }

// },



//  mcp remote ---

// "mcpServers":{
//            "financial-graph-http-customer": {
//      "command": "npx",
//      "args": [
//        "-y", "mcp-remote",
//        "http://127.0.0.1:8000/mcp",
//        "--header", "Authorization:${AUTH}"
//      ],
//      "env": { "AUTH": "Bearer <customer token>" }
//    }
// }

