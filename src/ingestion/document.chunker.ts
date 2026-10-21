import { TextChunk } from "@/types";

export class DocumentChunker {
    static chunk(text: string, chunkSize = 1500): TextChunk[] {
        const chunks: TextChunk[] = [];

        for (let i = 0; i < text.length; i += chunkSize) {
            chunks.push({ index: chunks.length, content: text.slice(i, i + chunkSize) });
        }

        return chunks;
    }
}