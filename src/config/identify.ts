import { UserRole } from "@/types";
import { loadConfig } from "./env";


interface Identity {
    token: string;
    role: UserRole;
    callerId: string;
}

export function loadIdentity(): Identity {
    const env = loadConfig()
    const candidates: { token: string; role: UserRole; callerId: string } =  { token: env.MCP_TOKEN, role: env.MCP_ROLE as UserRole, callerId: env.MCP_CALLER_ID }
    return candidates
}
