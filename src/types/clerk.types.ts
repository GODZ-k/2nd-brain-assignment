import { AuthInfo } from "@modelcontextprotocol/server";
import { RequestHandler, Router } from "express";
import { CallerContext } from ".";

export interface ClerkVerifyResponse {
  subject?: string;
  client_id?: string;
  scopes?: string[];
  revoked?: boolean;
  expired?: boolean;
  expiration?: number;
}

export interface ClerkConfig {
  secretKey: string;
  frontendApi: string;
  mcpUrl: URL;
}

export interface ClerkAuth {
  metadataRouter: Router;
  gate: RequestHandler;
  resolveContext: (
    auth: AuthInfo | undefined,
  ) => Promise<CallerContext | null>;
}