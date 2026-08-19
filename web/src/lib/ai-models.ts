// Gemini model ids, in one place.
//
// These were hardcoded across ten action files, so when Google retired the 2.5
// generation ("no longer available to new users") every AI feature broke and
// each one had to be found by hand. Changing a model is now one edit, or an
// environment variable with no code change at all.
//
// GEMINI_MODEL      — the default for every text feature
// GEMINI_MODEL_DOC  — document and image understanding (PDF import); falls back
//                     to GEMINI_MODEL when unset

/** Default model for text generation. */
export const AI_MODEL = process.env.GEMINI_MODEL ?? "gemini-3.6-flash";

/**
 * Model used for reading PDFs and images. Kept separate because document
 * understanding benefits from a stronger model than plain text generation.
 */
export const AI_MODEL_DOC = process.env.GEMINI_MODEL_DOC ?? AI_MODEL;
