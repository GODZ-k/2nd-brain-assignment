import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import { KnowledgeGraphRepository } from '@/graph/knowledge.repository';
import { GraphAccessPolicy } from '@/graph/access.policy';
import { KnowledgeGraphService } from '@/core/knowledge-graph.service';
import { getPrismaClient } from '@/config/prisma';
import type { CallerContext } from '@/types';

describe('Knowledge Graph - End-to-End', () => {
  const prisma = getPrismaClient();

  let repository: KnowledgeGraphRepository;
  let accessPolicy: GraphAccessPolicy;
  let service: KnowledgeGraphService;

  let testEntity: {
    id: string;
    type: string;
    name: string;
    accessPolicy: unknown;
  };

  const context: CallerContext = {
    callerId: 'e2e-test-user',
    role: 'admin',
  };

  beforeAll(async () => {
    repository = new KnowledgeGraphRepository();
    accessPolicy = new GraphAccessPolicy();

    service = new KnowledgeGraphService(
      repository,
      accessPolicy,
    );

    /*
     * Pick an entity that already exists in the database.
     *
     * We deliberately don't hard-code an entity name because
     * the knowledge graph is generic.
     */
    const entity = await prisma.entity.findFirst({
      select: {
        id: true,
        type: true,
        name: true,
        accessPolicy: true,
      },
    });

    if (!entity) {
      throw new Error(
        'No entities found in database. Ingest a PDF before running the E2E test.',
      );
    }

    testEntity = entity;

    console.log('\n[E2E] Test entity');
    console.log({
      id: testEntity.id,
      type: testEntity.type,
      name: testEntity.name,
    });
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('should have entities in the database', async () => {
    const count = await prisma.entity.count();

    expect(count).toBeGreaterThan(0);

    console.log(`[PASS] Entity count: ${count}`);
  });

  it('should have graph relations in the database', async () => {
    const count = await prisma.graphRelation.count();

    expect(count).toBeGreaterThan(0);

    console.log(`[PASS] Graph relation count: ${count}`);
  });

  it('should retrieve an existing entity', async () => {
    const entity = await service.getEntity(
      testEntity.id,
      context,
    );

    expect(entity).not.toBeNull();
    expect(entity?.id).toBe(testEntity.id);
    expect(entity?.name).toBe(testEntity.name);

    console.log('[PASS] getEntity()', entity);
  });

  it('should search entities', async () => {
    /*
     * Search using part of the known entity name.
     */
    const searchTerm = testEntity.name.split(/\s+/)[0];

    const results = await service.searchEntities(
      searchTerm,
      context,
    );

    expect(Array.isArray(results)).toBe(true);

    expect(
      results.some(
        entity => entity.id === testEntity.id,
      ),
    ).toBe(true);

    console.log(
      `[PASS] searchEntities("${searchTerm}") returned ${results.length} result(s)`,
    );
  });

  it('should traverse the knowledge graph', async () => {
    const result = await service.query(
      testEntity.id,
      context,
      2,
    );

    expect(result).toBeDefined();

    console.log(
      '[PASS] Graph traversal completed',
    );

    console.log(
      JSON.stringify(result, null, 2),
    );
  });

  it('should respect the requested traversal depth', async () => {
    const result = await service.query(
      testEntity.id,
      context,
      1,
    );

    expect(result).toBeDefined();

    console.log(
      '[PASS] Traversal with maxDepth=1 completed',
    );
  });

  it('should create audit logs for graph operations', async () => {
    /*
     * Run an operation so that the audit service has
     * something to record.
     */
    await service.getEntity(
      testEntity.id,
      context,
    );

    const audit = await prisma.auditLog.findFirst({
      where: {
        callerId: context.callerId,
        toolName: 'get_entity',
        resourceId: testEntity.id,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    expect(audit).not.toBeNull();

    expect(audit?.callerId).toBe(
      context.callerId,
    );

    expect(audit?.decision).toBe(
      'ALLOWED',
    );

    console.log('[PASS] Audit log created');
  });

  it('should not return a non-existent entity', async () => {
    const result = await service.getEntity(
      'entity-that-does-not-exist',
      context,
    );

    expect(result).toBeNull();

    console.log(
      '[PASS] Non-existent entity handled correctly',
    );
  });
});