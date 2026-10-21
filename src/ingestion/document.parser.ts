import * as fs from 'node:fs/promises';
import { PDFParse } from 'pdf-parse';
import * as crypto from "node:crypto"
import { ParsedDocument } from '@/types';

export class DocumentParser {
  static async parsePdf(filePath: string): Promise<ParsedDocument> {
    console.log("pdf parsing started");

    // 1. Read the file into a buffer
    const buffer = await fs.readFile(filePath);
    const hash = crypto.createHash('sha256').update(buffer).digest('hex')

    console.log("buffer loaded");

    // 2. Parse the PDF using the PDFParse class API
    const parser = new PDFParse({ data: buffer });
    const data = await parser.getText();
    const info = await parser.getInfo();
    console.log("pdf parsed successfully");

    // 3. Extract the text and page count from the result object
    const text = data.text;
    const pages = info.total;
    await parser.destroy();

    return {
      text: text,
      pageCount: pages,
      contentHash:hash
    };
  }
}
