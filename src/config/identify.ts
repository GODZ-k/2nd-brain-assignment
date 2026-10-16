import { UserRole } from "@/types";
import { loadConfig } from "./env";


interface Identity {
    token: string;
    role: UserRole;
    callerId: string;
}

export function loadIdentities(): Identity[] {
    const env = loadConfig()
    const candidates: { token: string; role: UserRole; callerId: string }[] = [
        { token: env.MCP_TOKEN_ADMIN, role: 'admin', callerId: 'admin' },
        {
            token: env.MCP_TOKEN_MERCHANT,
            role: 'merchant',
            callerId: env.MCP_MERCHANT_ID,
        },
        {
            token: env.MCP_TOKEN_CUSTOMER,
            role: 'customer',
            callerId: env.MCP_CUSTOMER_ID,
        },
    ];
    return candidates.filter((c): c is Identity => !!c.token);
}
