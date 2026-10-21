import type { ExtractedKnowledge } from '@/types';
import { loadConfig } from '@/config/env';
import { knowledgeSchema } from '@/types/validations';
import { getPrompt, instructions } from './prompt';

const env = loadConfig();

export class KnowledgeExtractor {

  async extract(text: string): Promise<ExtractedKnowledge> {

    const [
      { createGroq },
      { generateText, Output },
    ] = await Promise.all([
      import('@ai-sdk/groq'),
      import('ai'),
    ]);

    const groq = createGroq({
      baseURL: 'https://api.groq.com/openai/v1',
      apiKey: env.GROQ_API_KEY,
    });

    const result =
      await generateText({
        model: groq(env.GROQ_MODEL),
        output: Output.object({
          schema: knowledgeSchema,
        }),
        instructions,
        prompt: getPrompt(text),
        maxOutputTokens: 4096,
      });

    if (!result.output) {
      throw new Error('Knowledge extraction returned no structured output');
    }
    const knowledge: ExtractedKnowledge = {
      entities: result.output.entities,
      relations: result.output.relations.map((relation) => ({
        ...relation,
        id: relation.id
      })),
    };

    return knowledge
  }
}