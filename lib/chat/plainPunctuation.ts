/**
 * Chat replies never use em dashes or en dashes. The instructions ask the model not to
 * write them; this makes sure none reach the screen when it does anyway.
 */
export const CHAT_PUNCTUATION_RULE =
  "WRITING STYLE: Never use em dashes or en dashes anywhere in a reply. Use a comma, a period or a colon instead. Put each list item on its own line; never run a list together inside a sentence.";

export function plainPunctuation(text: string): string {
  return text
    // Number ranges keep a plain hyphen: 2019–2021, 10–15%.
    .replace(/(\d)\s*[–—]\s*(\d)/g, "$1-$2")
    // A dash that opens a line is a list bullet.
    .replace(/^(\s*)[–—]\s+/gm, "$1- ")
    // Everything else was joining two clauses.
    .replace(/\s*[–—]+\s*/g, ", ")
    .replace(/,\s*,/g, ",")
    .replace(/,\s*([.!?:;])/g, "$1");
}
