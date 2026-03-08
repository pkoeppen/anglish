// "use server";

// import type { ServerActionResult } from "@/lib/types/actions";
// import type { OutputTerm } from "@/lib/types/translate";
// import { WordnetPOS } from "@anglish/core";
// import { TranslationFormSchema } from "@/lib/forms";
// import { translateText } from "@/lib/helpers/translate";

// export const TranslationFormSchema = z.object({
//   input: z
//     .string()
//     .min(1, "Input is required")
//     .max(3000, "Input must be less than 3000 characters"),
//   excludePOS: z.array(z.nativeEnum(WordnetPOS)).optional(),
// });

// export async function translate(formData: unknown): Promise<ServerActionResult<OutputTerm[]>> {
//   const parseResult = TranslationFormSchema.safeParse(formData);
//   if (!parseResult.success) {
//     return { success: false, errors: parseResult.error.errors.map(error => error.message) };
//   }

//   const { input, excludePOS } = parseResult.data;

//   const terms = await translateText(input, excludePOS);

//   return { success: true, data: terms };
// }
