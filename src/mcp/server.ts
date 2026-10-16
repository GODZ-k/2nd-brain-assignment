import { CallToolResult, McpServer } from '@modelcontextprotocol/server';
import { z } from 'zod';
import { CallerContext } from '@/types';
import { GraphRepository } from '@/graph/repository';


async function run(fn: () => Promise<unknown> | unknown): Promise<CallToolResult> {
  try {
    const result = await fn();
    return {
      content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
    };
  } catch (err: unknown) {
    return {
      isError: true,
      content: [
        {
          type: 'text',
          text: JSON.stringify({ error: err instanceof Error ? err.message : String(err) }, null, 2),
        },
      ],
    };
  }
}

export function createMcpServer(context: CallerContext): McpServer {
  const server = new McpServer({
    name: 'financial-graph-mcp',
    version: '1.0.0',
  });

  server.registerTool(
    'get_customer',
    {
      description:
        'Get a customer by ID. Customers can only view their own profile. Merchants can view customers who have bought at their store. Admins can view anyone.',
      inputSchema: z.object({
        customerId: z.string().describe('Customer ID (e.g. cust_001)'),
      }),
    },
    async ({ customerId }) =>
      run(() => GraphRepository.getCustomer(customerId, context)),
  );

  server.registerTool(
    'get_merchant',
    {
      description:
        'Get a merchant by ID. Customers and other merchants see only public info. Merchants see their own full profile. Admins see everything.',
      inputSchema: z.object({
        merchantId: z.string().describe('Merchant ID (e.g. merch_001)'),
      }),
    },
    async ({ merchantId }) =>
      run(() => GraphRepository.getMerchant(merchantId, context)),
  );

  server.registerTool(
    'get_transaction',
    {
      description:
        'Get a single transaction by ID. Customers only see their own. Merchants only see their store transactions. Admins see all.',
      inputSchema: z.object({
        transactionId: z.string().describe('Transaction ID (e.g. txn_001)'),
      }),
    },
    async ({ transactionId }) =>
      run(() => GraphRepository.getTransaction(transactionId, context)),
  );

  server.registerTool(
    'list_transactions',
    {
      description:
        'List transactions. Customers see only their own. Merchants see their store transactions. Admins can filter by customerId or merchantId. All roles can filter by status (COMPLETED, PENDING, DECLINED).',
      inputSchema: z.object({
        customerId: z
          .string()
          .optional()
          .describe('Filter by customer ID (admin/merchant only)'),
        merchantId: z
          .string()
          .optional()
          .describe('Filter by merchant ID (admin only)'),
        status: z
          .enum(['COMPLETED', 'PENDING', 'DECLINED'])
          .optional()
          .describe('Filter by transaction status'),
      }),
    },
    async ({ customerId, merchantId, status }) =>
      run(() =>
        GraphRepository.listTransactions(context, {
          customerId,
          merchantId,
          status,
        }),
      ),
  );

  server.registerTool(
    'list_customers',
    {
      description:
        'List customers. Customers see only themselves. Merchants see customers who bought at their store. Admins see all customers.',
    },
    async () => run(() => GraphRepository.listCustomers(context)),
  );

  server.registerTool(
    'whoami',
    {
      description:
        'Returns the active role and caller ID bound to this MCP session.',
    },
    async () =>
      run(() => ({ role: context.role, callerId: context.callerId })),
  );

  return server;
}