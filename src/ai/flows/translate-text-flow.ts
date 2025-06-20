'use server';
/**
 * @fileOverview A Genkit flow to translate text to a specified target language.
 *
 * - translateText - A function that handles text translation.
 * - TranslateTextInput - The input type for the translateText function.
 * - TranslateTextOutput - The return type for the translateText function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const LANGUAGE_CODE_TO_NAME: Record<string, string> = {
  en: 'English',
  id: 'Indonesian',
  // Add other supported languages here as needed
  // es: 'Spanish',
  // fr: 'French',
  // de: 'German',
  // ja: 'Japanese',
  // ko: 'Korean',
  // pt: 'Portuguese',
  // ru: 'Russian',
  // zh: 'Chinese',
};

const TranslateTextInputSchema = z.object({
  textToTranslate: z.string().min(1, { message: "Text to translate cannot be empty." }).describe('The text string that needs to be translated.'),
  targetLanguageCode: z.string().min(2, {message: "Target language code cannot be empty."}).describe("The ISO 639-1 code for the target language (e.g., 'en' for English, 'id' for Indonesian)."),
});
export type TranslateTextInput = z.infer<typeof TranslateTextInputSchema>;

const TranslateTextOutputSchema = z.object({
  translatedText: z.string().describe('The translated text.'),
});
export type TranslateTextOutput = z.infer<typeof TranslateTextOutputSchema>;

// Internal schema for the prompt, using the full language name
const InternalPromptInputSchema = z.object({
    textToTranslate: z.string(),
    targetLanguageName: z.string(),
});

export async function translateText(input: TranslateTextInput): Promise<TranslateTextOutput> {
  return translateTextFlow(input);
}

const translateTextPrompt = ai.definePrompt({
  name: 'translateTextPrompt',
  input: {schema: InternalPromptInputSchema},
  output: {schema: TranslateTextOutputSchema},
  config: {
    safetySettings: [ // Basic safety settings
      { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
      { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
      { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
      { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
    ],
  },
  prompt: `Translate the following text to {{targetLanguageName}}:\n\nText:\n"""\n{{{textToTranslate}}}\n"""\n\nTranslated Text:`,
});

const translateTextFlow = ai.defineFlow(
  {
    name: 'translateTextFlow',
    inputSchema: TranslateTextInputSchema,
    outputSchema: TranslateTextOutputSchema,
  },
  async (input) => {
    const targetLanguageName = LANGUAGE_CODE_TO_NAME[input.targetLanguageCode.toLowerCase()];
    if (!targetLanguageName) {
      throw new Error(`Unsupported target language code: ${input.targetLanguageCode}. Supported codes are: ${Object.keys(LANGUAGE_CODE_TO_NAME).join(', ')}`);
    }

    const {output} = await translateTextPrompt({
      textToTranslate: input.textToTranslate,
      targetLanguageName: targetLanguageName,
    });

    if (!output || !output.translatedText) {
      throw new Error('AI failed to translate the text or returned an empty translation.');
    }
    return { translatedText: output.translatedText };
  }
);
