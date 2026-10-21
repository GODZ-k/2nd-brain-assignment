import { DocumentIngestionService } from '../src/ingestion/document.ingestion';
import { DocumentRepository } from '../src/ingestion/document.repository';
import { KnowledgeExtractor } from '../src/ingestion/knowledge.extractor';
import { KnowledgeIngestor } from '../src/ingestion/knowledge.ingestor';
import { KnowledgeGraphRepository } from '../src/graph/knowledge.repository';

async function main() {
  const filePath = process.argv[2];

  console.log('Received filepath:', filePath);

  if (!filePath) {
    throw new Error(
      'Usage: npm run ingest:pdf -- ./data/sample.pdf',
    );
  }

  const documentRepository =
    new DocumentRepository();

  const knowledgeExtractor =
    new KnowledgeExtractor();

  const graphRepository =
    new KnowledgeGraphRepository();

  const knowledgeIngestor =
    new KnowledgeIngestor(
      graphRepository,
    );

  const ingestService =
    new DocumentIngestionService(
      documentRepository,
      knowledgeExtractor,
      knowledgeIngestor,
    );

  const result =
    await ingestService.ingestPdf(filePath);

  console.log(
    JSON.stringify(result, null, 2),
  );
}

main().catch((error) => {
  console.error(
    'PDF ingestion failed:',
    error,
  );

  process.exit(1);
});