import { getPrismaClient } from '@/config/prisma';
import { GraphEntity, GraphRelation } from '@/types';
import { Prisma } from '@prisma/client';


export class KnowledgeGraphRepository {
  private readonly prisma = getPrismaClient()
  constructor() { }

  async createEntity(
    entity: GraphEntity,
  ) {
    return this.prisma.entity.create({
      data: {
        id: entity.id,
        type: entity.type,
        name: entity.name,
        properties: entity.properties as Prisma.InputJsonValue,
        accessPolicy: entity.accessPolicy as Prisma.InputJsonValue,
        documentId: entity.documentId,
      },
    });
  }

  async createRelation(
    relation: GraphRelation,
  ) {
    return this.prisma.graphRelation.create({
      data: {
        id: relation.id,
        sourceId: relation.sourceId,
        targetId: relation.targetId,
        relationType: relation.relationType,
        properties:
          relation.properties as Prisma.InputJsonValue,
        accessPolicy: relation.accessPolicy as Prisma.InputJsonValue
      },
    });
  }

  async getEntity(id: string) {
    return this.prisma.entity.findUnique({
      where: { id },
    });
  }

  async searchEntities(
    query: string,
    type?: string,
  ) {
    return this.prisma.entity.findMany({
      where: {
        AND: [
          type
            ? {
              type: {
                equals: type,
                mode: 'insensitive',
              },
            }
            : {},

          {
            name: {
              contains: query,
              mode: 'insensitive',
            },
          },
        ],
      },

      orderBy: {
        name: 'asc',
      },

      take: 50,
    });
  }

  async getRelation(id: string) {
    return this.prisma.graphRelation.findUnique({
      where: { id },
    });
  }

  async findEntity(type: string, name: string) {
    return this.prisma.entity.findFirst({
      where: {
        type,
        name: {
          equals: name,
          mode: 'insensitive',
        },
      },
    });
  }

  async getNeighbors(entityId: string) {
    const outgoing = await this.prisma.graphRelation.findMany({
      where: {
        sourceId: entityId,
      },
      include: {
        target: true,
      },
    });

    const incoming = await this.prisma.graphRelation.findMany({
      where: {
        targetId: entityId,
      },
      include: {
        source: true,
      },
    });

    return {
      outgoing,
      incoming,
    };
  }
}