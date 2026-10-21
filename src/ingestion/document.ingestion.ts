import { randomUUID } from 'node:crypto';
import { DocumentParser } from './document.parser';
import { DocumentChunker } from './document.chunker';
import { DocumentRepository } from './document.repository';
import { KnowledgeExtractor } from './knowledge.extractor';
import { KnowledgeIngestor } from './knowledge.ingestor';
import { accessPolicy } from '@/config/identify';

export class DocumentIngestionService {

  constructor(
    private readonly documentRepository:
      DocumentRepository,

    private readonly knowledgeExtractor:
      KnowledgeExtractor,

    private readonly knowledgeIngestor:
      KnowledgeIngestor,
  ) {}

  async ingestPdf(filePath: string) {

    // Started pdf parsing ---
    console.log("Started pdf parsing")
    const parsed = await DocumentParser.parsePdf(filePath);

    // generated document id ---
    console.log("generated document id")
    const documentId = randomUUID();

    // Inserting document in database ---
    console.log("Inserting document in database")
    await this.documentRepository.createDocument({
      id: documentId,
      name: filePath.split('/').pop() ?? 'document.pdf',
      sourceType: 'PDF',
      contentHash: parsed.contentHash
    });

    // Generating chunks ---
    console.log("Generating chunks")
    const chunks = DocumentChunker.chunk(parsed.text, 2000);

    for (const chunk of chunks) {
      const chunkId = randomUUID();

      // Inserting document chunks in database ---
      console.log("Inserting document chunks in database")
      await this.documentRepository.createChunk({
        id: chunkId,
        documentId,
        content: chunk.content,
        chunkIndex: chunk.index,
      });

      // Extracting knowledge from pdf ---
      console.log("Extracting knowledge from pdf")
      const knowledge = await this.knowledgeExtractor.extract(chunk.content);
      
      // Inserting knowledge in database ---
      console.log("Inserting knowledge in database")
      await this.knowledgeIngestor.ingest(knowledge,documentId,accessPolicy);
    }

    return {
      documentId,
      pageCount: parsed.pageCount,
      chunks: chunks.length,
    };
  }
}
