
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
  sourceText: z.string().min(20, { message: "Source text must be at least 20 characters." }).describe('The source text or topic to generate a quiz question from.'),
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
    imageDescriptionForGeneration: z.string().optional().describe("If an image would be beneficial for this option, provide a concise text description (max 15 words) suitable for an image generation model. Example: 'A detailed diagram of a plant cell'. If no image is needed, omit this field."),
});

const PromptOutputSchema = z.object({
  question: z.string().describe('The generated quiz question.'),
  options: z.array(PromptOutputOptionSchema).describe('An array of multiple-choice options, potentially with image descriptions.'),
  suggestedDifficulty: z.enum(['1', '2', '3']).describe('The suggested difficulty level (1, 2, or 3).'),
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
  prompt: `Based on the following source text, generate one multiple-choice quiz question.

Source Text:
{{{sourceText}}}

The question should have {{{numberOfOptions}}} answer options.
One option must be clearly correct, and the others should be plausible but incorrect distractors.

For each answer option, decide if an image would be significantly helpful to understanding or visualizing the option.
If an image IS helpful for an option, provide a concise text description for that image in a field named 'imageDescriptionForGeneration'. This description should be suitable for an image generation model and be a maximum of 15 words (e.g., "A diagram of a plant cell with labels", "A photo of a red delicious apple").
If an image IS NOT helpful or not applicable for an option, omit the 'imageDescriptionForGeneration' field for that option.

The output should include the question, the array of options (each with 'text', 'isCorrect', and optionally 'imageDescriptionForGeneration' fields), and a suggestedDifficulty ('1' for easy, '2' for medium, '3' for hard).

Ensure exactly one option has isCorrect set to true.
Present the difficulty as a string: "1", "2", or "3".
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
            model: 'googleai/gemini-2.0-flash-exp',
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
    if (!processedOptions.some(opt => opt.isCorrect) && processedOptions.length > 0) {
        processedOptions[0].isCorrect = true;
    } else if (processedOptions.filter(opt => opt.isCorrect).length > 1) {
        let foundCorrect = false;
        for (const opt of processedOptions) {
            if (opt.isCorrect) {
                if (foundCorrect) opt.isCorrect = false;
                else foundCorrect = true;
            }
        }
    }
     // If still no correct option after processing (e.g., all were marked false by LLM and then image gen failed for the one auto-marked true),
     // ensure the first one is correct.
    if (!processedOptions.some(opt => opt.isCorrect) && processedOptions.length > 0) {
        processedOptions[0].isCorrect = true;
    }


    return {
        question: textOutput.question,
        options: processedOptions,
        suggestedDifficulty: textOutput.suggestedDifficulty || "1",
    };
  }
);
