
'use server';
/**
 * @fileOverview An AI flow to generate quiz questions, potentially with images for options.
 *
 * - generateQuizQuestion - A function that handles quiz question generation.
 * - GenerateQuizInput - The input type for the generateQuizQuestion function.
 * - GenerateQuizOutput - The return type for the generateQuizQuestion function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';
import {nanoid} from 'nanoid';

const GenerateQuizInputSchema = z.object({
  sourceText: z.string().min(20, { message: "Source text must be at least 20 characters." }).describe('The source text or topic to generate a quiz question from. The AI will base its question and options strictly on this text.'),
  numberOfOptions: z.number().min(2).max(5).default(4).describe('The number of multiple-choice options to generate.'),
});
export type GenerateQuizInput = z.infer<typeof GenerateQuizInputSchema>;

// Schema for the final output options (as expected by the client)
const FinalQuizOptionSchema = z.object({
    id: z.string().default(() => nanoid()),
    text: z.string().describe('The text of the answer option.'),
    isCorrect: z.boolean().describe('Whether this option is the correct answer.'),
    image: z.string().optional().describe("A data URI of a generated image for this option, if applicable. Expected format: 'data:image/png;base64,<encoded_data>'."),
});

// Schema for the output structure of the main text-generating prompt
// This includes a description for image generation if an image is desired for an option.
const PromptOutputOptionSchema = z.object({
    id: z.string().default(() => nanoid()),
    text: z.string().describe('The text of the answer option.'),
    isCorrect: z.boolean().describe('Whether this option is the correct answer.'),
    imageDescriptionForGeneration: z.string().optional().describe("If an image would be significantly beneficial for visualizing or understanding this option, provide a concise (max 15 words) text description suitable for an image generation model (e.g., 'A detailed diagram of a plant cell', 'Photo of a red apple'). The description must be directly illustrative of the option's text. If no image is needed or applicable, omit this field."),
});

const PromptOutputSchema = z.object({
  question: z.string().describe('The generated quiz question, derived directly from the source text.'),
  options: z.array(PromptOutputOptionSchema).describe('An array of multiple-choice options. One must be correct based on the source text, others plausible but clearly incorrect distractors based on the source text.'),
  suggestedDifficulty: z.enum(['1', '2', '3']).describe('The suggested difficulty level (1 for easy, 2 for medium, 3 for hard), based on the complexity of the question relative to the source text.'),
});


// Schema for the final output of the flow (as expected by the client)
const GenerateQuizOutputSchema = z.object({
  question: z.string().describe('The generated quiz question.'),
  options: z.array(FinalQuizOptionSchema).describe('An array of multiple-choice options, potentially with generated images.'),
  suggestedDifficulty: z.enum(['1', '2', '3']).describe('The suggested difficulty level (1, 2, or 3).'),
});
export type GenerateQuizOutput = z.infer<typeof GenerateQuizOutputSchema>;


export async function generateQuizQuestion(input: GenerateQuizInput): Promise<GenerateQuizOutput> {
  return quizGeneratorFlow(input);
}

const quizTextPrompt = ai.definePrompt({
  name: 'quizGeneratorTextPrompt',
  input: {schema: GenerateQuizInputSchema},
  output: {schema: PromptOutputSchema}, // Uses the intermediate schema with imageDescriptionForGeneration
  config: {
    safetySettings: [
      {
        category: 'HARM_CATEGORY_HATE_SPEECH',
        threshold: 'BLOCK_MEDIUM_AND_ABOVE',
      },
      {
        category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT',
        threshold: 'BLOCK_MEDIUM_AND_ABOVE',
      },
      {
        category: 'HARM_CATEGORY_HARASSMENT',
        threshold: 'BLOCK_MEDIUM_AND_ABOVE',
      },
      {
        category: 'HARM_CATEGORY_DANGEROUS_CONTENT',
        threshold: 'BLOCK_MEDIUM_AND_ABOVE',
      },
    ],
  },
  prompt: `You are an expert quiz designer. Your task is to generate ONE multiple-choice quiz question based *strictly and solely* on the provided Source Text.

Source Text:
{{{sourceText}}}

The question must have {{{numberOfOptions}}} answer options.
One option must be clearly and verifiably correct based *only* on the information present in the Source Text.
The other options should be plausible distractors but demonstrably incorrect according to the Source Text. Avoid options that are too obviously wrong or unrelated.

For each answer option, critically assess if an image would be significantly beneficial to understanding or visualizing the option.
- If an image IS helpful for an option, provide a concise text description for that image in a field named 'imageDescriptionForGeneration'. This description must be highly relevant to the option's text, suitable for an image generation model, and a maximum of 15 words (e.g., "A diagram of a plant cell with labels", "A photo of a red delicious apple", "Map showing the location of ancient Rome").
- If an image IS NOT helpful, not significantly beneficial, or not applicable for an option, you MUST omit the 'imageDescriptionForGeneration' field for that option. Do not invent image descriptions if they don't add clear value.

The output should include:
1.  The 'question' itself, directly derived from the Source Text.
2.  An array of 'options', each with 'text', 'isCorrect' (boolean), and optionally 'imageDescriptionForGeneration' fields.
3.  A 'suggestedDifficulty' ('1' for easy, '2' for medium, '3' for hard), reflecting the question's complexity relative to the Source Text.

Key Constraints:
- Ensure exactly one option has 'isCorrect' set to true.
- All textual content (question, options) must be directly supported by or inferable from the provided Source Text. Do not introduce outside information.
- Present the difficulty as a string: "1", "2", or "3".
`,
});

const quizGeneratorFlow = ai.defineFlow(
  {
    name: 'quizGeneratorFlow',
    inputSchema: GenerateQuizInputSchema,
    outputSchema: GenerateQuizOutputSchema, // Flow's final output uses FinalQuizOptionSchema
  },
  async (input) => {
    // 1. Generate text content for the quiz, including image descriptions
    const {output: textOutput} = await quizTextPrompt(input);
    if (!textOutput) {
      throw new Error('AI failed to generate quiz text content.');
    }

    // 2. Process options: generate images if descriptions are provided
    const processedOptions: GenerateQuizOutput['options'] = [];
    for (const promptOption of textOutput.options) {
      let imageUrl: string | undefined = undefined;
      if (promptOption.imageDescriptionForGeneration && promptOption.imageDescriptionForGeneration.trim() !== "") {
        try {
          console.log(`Generating image for: ${promptOption.imageDescriptionForGeneration}`);
          const {media} = await ai.generate({
            model: 'googleai/gemini-2.0-flash-exp', // Explicitly use image generation model
            prompt: promptOption.imageDescriptionForGeneration,
            config: {
              responseModalities: ['TEXT', 'IMAGE'],
            },
          });
          imageUrl = media?.url;
          console.log(`Image generated: ${imageUrl ? 'Success' : 'Failed or no media URL'}`);
        } catch (imgError) {
          console.error(`Failed to generate image for option '${promptOption.text}':`, imgError);
          // Continue without image for this option
        }
      }
      processedOptions.push({
        id: promptOption.id || nanoid(),
        text: promptOption.text,
        isCorrect: promptOption.isCorrect,
        image: imageUrl,
      });
    }

    // Ensure options have unique IDs and at least one correct answer logic (fallback)
    // This also ensures only one option is correct if the LLM makes a mistake.
    let correctOptionFound = false;
    const finalOptions = processedOptions.map(opt => {
        if (opt.isCorrect) {
            if (correctOptionFound) {
                return {...opt, isCorrect: false}; // Only one correct answer allowed
            }
            correctOptionFound = true;
        }
        return opt;
    });

    if (!correctOptionFound && finalOptions.length > 0) {
        finalOptions[0].isCorrect = true; // Fallback: mark first option as correct if none are
    }


    return {
        question: textOutput.question,
        options: finalOptions,
        suggestedDifficulty: textOutput.suggestedDifficulty || "1",
    };
  }
);

