
'use server';
/**
 * @fileOverview An AI flow to generate quiz questions.
 *
 * - generateQuizQuestion - A function that handles quiz question generation.
 * - GenerateQuizInput - The input type for the generateQuizQuestion function.
 * - GenerateQuizOutput - The return type for the generateQuizQuestion function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';
import {nanoid} from 'nanoid';

const GenerateQuizInputSchema = z.object({
  sourceText: z.string().min(20, { message: "Source text must be at least 20 characters." }).describe('The source text or topic to generate a quiz question from.'),
  numberOfOptions: z.number().min(2).max(5).default(4).describe('The number of multiple-choice options to generate.'),
});
export type GenerateQuizInput = z.infer<typeof GenerateQuizInputSchema>;

const QuizOptionSchema = z.object({
    id: z.string().default(() => nanoid()),
    text: z.string().describe('The text of the answer option.'),
    isCorrect: z.boolean().describe('Whether this option is the correct answer.'),
    image: z.string().optional().describe('An optional image URL for the option.'),
});

const GenerateQuizOutputSchema = z.object({
  question: z.string().describe('The generated quiz question.'),
  options: z.array(QuizOptionSchema).describe('An array of multiple-choice options.'),
  suggestedDifficulty: z.enum(['1', '2', '3']).describe('The suggested difficulty level (1, 2, or 3).'),
});
export type GenerateQuizOutput = z.infer<typeof GenerateQuizOutputSchema>;


export async function generateQuizQuestion(input: GenerateQuizInput): Promise<GenerateQuizOutput> {
  return quizGeneratorFlow(input);
}

const prompt = ai.definePrompt({
  name: 'quizGeneratorPrompt',
  input: {schema: GenerateQuizInputSchema},
  output: {schema: GenerateQuizOutputSchema},
  prompt: `Based on the following source text, generate one multiple-choice quiz question.

Source Text:
{{{sourceText}}}

The question should have {{{numberOfOptions}}} answer options.
One option must be clearly correct, and the others should be plausible but incorrect distractors.
The output should include the question, the array of options (each with 'text' and 'isCorrect' fields), and a suggestedDifficulty ('1' for easy, '2' for medium, '3' for hard).

Ensure exactly one option has isCorrect set to true.
Do not include images in the options.
Present the difficulty as a string: "1", "2", or "3".
`,
});

const quizGeneratorFlow = ai.defineFlow(
  {
    name: 'quizGeneratorFlow',
    inputSchema: GenerateQuizInputSchema,
    outputSchema: GenerateQuizOutputSchema,
  },
  async (input) => {
    const {output} = await prompt(input);
    if (!output) {
      throw new Error('AI failed to generate quiz content.');
    }
    // Ensure options have unique IDs if not provided by LLM, and ensure one is correct
    const processedOptions = output.options.map(opt => ({ ...opt, id: opt.id || nanoid() }));
    if (!processedOptions.some(opt => opt.isCorrect) && processedOptions.length > 0) {
        processedOptions[0].isCorrect = true; // Fallback: mark first as correct if none are
    } else if (processedOptions.filter(opt => opt.isCorrect).length > 1) {
        // Fallback: if multiple correct, keep only the first one
        let foundCorrect = false;
        for (const opt of processedOptions) {
            if (opt.isCorrect) {
                if (foundCorrect) opt.isCorrect = false;
                else foundCorrect = true;
            }
        }
    }

    return {
        ...output,
        options: processedOptions,
        suggestedDifficulty: output.suggestedDifficulty || "1", // Ensure difficulty is always a string "1", "2", or "3"
    };
  }
);
