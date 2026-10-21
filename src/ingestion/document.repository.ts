import { getPrismaClient } from '@/config/prisma';

export class DocumentRepository {
  private readonly prisma = getPrismaClient()

    constructor(){}

    async createDocument(data: { id: string; name: string; sourceType: string; contentHash: string; }) {
        return this.prisma.document.create({
            data,
        });
    }

    async createChunk(data: { id: string; documentId: string; content: string; chunkIndex: number; }) {
        return this.prisma.documentChunk.create({
            data,
        });
    }
}