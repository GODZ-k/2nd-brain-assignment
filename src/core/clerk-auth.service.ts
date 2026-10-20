import { createHash } from 'node:crypto';
import type { RequestHandler, Router } from 'express';
import { getOAuthProtectedResourceMetadataUrl, mcpAuthMetadataRouter, requireBearerAuth } from '@modelcontextprotocol/express';
import type { OAuthTokenVerifier } from '@modelcontextprotocol/express';
import { OAuthError, OAuthErrorCode } from '@modelcontextprotocol/server';
import type { AuthInfo, OAuthMetadata } from '@modelcontextprotocol/server';
import { CallerContext, UserRole } from '@/types';
import { TtlCache } from '@/utils/cache';
import type { ClerkConfig, ClerkVerifyResponse } from '@/types/clerk.types';
import { ID_PATTERN, CACHE_TTL_MS, VALID_ROLES } from "@/config/clerk.config"
import { loadConfig } from '@/config/env';

const env = loadConfig()

export class ClerkAuthService {
    private readonly tokenCache = new TtlCache<AuthInfo>();
    private readonly userCache = new TtlCache<{  role: unknown; callerId: unknown}>();
    private readonly clerkHeaders: Record<string, string>;
    private oauthMetadata!: OAuthMetadata;
    private gateMiddleware!: RequestHandler;
    private metadataMiddleware!: Router;

    constructor(private readonly config: ClerkConfig) {
        this.clerkHeaders = { Authorization: `Bearer ${config.secretKey}`, 'Content-Type': 'application/json' };
    }

    async initialize(): Promise<void> {
        await this.loadOAuthMetadata();

        this.gateMiddleware = this.createBearerAuthMiddleware();

        this.metadataMiddleware = this.createMetadataRouter();
    }

    // Returns the Express middleware that protects /mcp.
    get gate(): RequestHandler {
        return this.gateMiddleware;
    }

    // Returns the OAuth metadata router.
    get metadataRouter(): Router {
        return this.metadataMiddleware;
    }

    // Load OAuth Metadata configuration
    private async loadOAuthMetadata(): Promise<void> {
        const metadataUrl =
            `${this.config.frontendApi}/.well-known/oauth-authorization-server`;

        const response = await fetch(
            metadataUrl,
            {
                signal: AbortSignal.timeout(8000),
            },
        );

        if (!response.ok) {
            throw new Error(
                `Could not load ${metadataUrl} ` +
                `(HTTP ${response.status}). ` +
                `Check CLERK_PUBLISHABLE_KEY.`,
            );
        }

        this.oauthMetadata =
            (await response.json()) as OAuthMetadata;

        if (!this.oauthMetadata.registration_endpoint) {
            console.warn(
                '[MCP auth] Clerk metadata has no registration_endpoint. ' +
                'Enable Dynamic Client Registration in Clerk if required by the MCP client.',
            );
        }
    }

    // MCP Authentication middleware
    private createBearerAuthMiddleware(): RequestHandler {
        const verifier: OAuthTokenVerifier = { verifyAccessToken: (token: string) => this.verifyAccessToken(token) };

        return requireBearerAuth({
            verifier,
            resourceMetadataUrl: getOAuthProtectedResourceMetadataUrl(this.config.mcpUrl),
        });
    }

    // Creates the OAuth metadata router.
    private createMetadataRouter(): Router {
        return mcpAuthMetadataRouter({
            oauthMetadata: this.oauthMetadata,
            resourceServerUrl: this.config.mcpUrl,
            scopesSupported: [
                'profile',
                'email',
            ],
        });
    }

    // verify OAuth Access token using clerk
    private async verifyAccessToken(token: string): Promise<AuthInfo> {
        const cacheKey = createHash('sha256').update(token).digest('hex');

        const cached = this.tokenCache.get(cacheKey);

        if (cached) return cached

        const invalidToken = () => new OAuthError(OAuthErrorCode.InvalidToken, 'Invalid or expired access token');

        let responseBody: ClerkVerifyResponse;

        try {
            const response = await fetch(`${env.CLERK_API}/oauth_applications/access_tokens/verify`, {
                method: 'POST',
                headers: this.clerkHeaders,
                body: JSON.stringify({
                    access_token: token,
                }),
                signal: AbortSignal.timeout(8000),
            },
            );

            if (!response.ok) {
                if (response.status === 401 || response.status === 403 || response.status >= 500) {
                    console.error(`[MCP auth] Clerk token verification returned HTTP ${response.status}`);
                }

                throw invalidToken();
            }

            responseBody = (await response.json()) as ClerkVerifyResponse;
        } catch (error) {
            if (error instanceof OAuthError) throw error

            console.error('[MCP auth] Clerk token verification failed', error);

            throw invalidToken();
        }

        if (typeof responseBody.subject !== 'string' || responseBody.revoked === true || responseBody.expired === true) throw invalidToken();

        const nowSeconds = Math.floor(Date.now() / 1000);

        let expiresAt = nowSeconds + 60;

        if (typeof responseBody.expiration === 'number') {
            expiresAt = responseBody.expiration > 1e11 ? Math.floor(responseBody.expiration / 1000) : responseBody.expiration;
        }

        if (expiresAt <= nowSeconds) throw invalidToken();

        const authInfo: AuthInfo = {
            token,
            clientId: String(responseBody.client_id ?? 'unknown'),
            scopes: Array.isArray(responseBody.scopes) ? responseBody.scopes : [],
            expiresAt,
            extra: { userId: responseBody.subject },
        };

        const cacheTtl = Math.min(CACHE_TTL_MS, (expiresAt - nowSeconds) * 1000);

        this.tokenCache.set(cacheKey, authInfo, cacheTtl);

        return authInfo;
    }

    // Converts an authenticated Clerk user into your application's CallerContext.
    async resolveContext(auth: AuthInfo | undefined): Promise<CallerContext | null> {
        const userId = auth?.extra?.userId;

        if (typeof userId !== 'string') return null;

        const metadata = await this.getUserMetadata(userId);

        if (!metadata) return null;

        const role = metadata.role;

        if (typeof role !== 'string' || !VALID_ROLES.includes(role as UserRole)) return null;


        // Admin does not need a database caller ID.
        if (role === 'admin') return { role: 'admin', callerId: 'admin' };

        // Merchant and customer must be associated with exactly one record.
        if (typeof metadata.callerId !== 'string' || !ID_PATTERN.test(metadata.callerId)) return null;

        return {
            role: role as UserRole,
            callerId: metadata.callerId,
        };
    }

    // Loads role/caller information from Clerk.    
    private async getUserMetadata(userId: string): Promise<{ role: unknown; callerId: unknown; } | null> {
        const cached = this.userCache.get(userId);

        if (cached) return cached;

        const response = await fetch(`${env.CLERK_API}/v1/users/${encodeURIComponent(userId)}`, {
            headers: this.clerkHeaders,
            signal: AbortSignal.timeout(8000)
        },
        );

        if (!response.ok) {
            console.error(
                `[MCP auth] Clerk user lookup returned HTTP ${response.status}`,
            );

            return null;
        }

        const user = (await response.json()) as {
            public_metadata?: {
                role?: unknown;
                callerId?: unknown;
            };
        };

        const metadata = {
            role: user.public_metadata?.role,
            callerId: user.public_metadata?.callerId,
        };

        this.userCache.set(userId, metadata, CACHE_TTL_MS);

        return metadata;
    }
}

export function createClerkAuthService(): ClerkAuthService {
  const service = new ClerkAuthService({
    secretKey: env.CLERK_SECRET_KEY!,
    frontendApi: env.CLERK_FRONTEND_API!,
    mcpUrl: new URL(env.MCP_PUBLIC_URL!)
  });

  return service;
}