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
// GEMINI_MODEL_LITE — short, templated explainers with no planning or squad
//                     decisions riding on the answer; falls back to
//                     GEMINI_MODEL when unset

/** Default model for text generation. */
export const AI_MODEL = process.env.GEMINI_MODEL ?? "gemini-3.6-flash";

/**
 * Model used for reading PDFs and images. Kept separate because document
 * understanding benefits from a stronger model than plain text generation.
 */
export const AI_MODEL_DOC = process.env.GEMINI_MODEL_DOC ?? AI_MODEL;

/**
 * Cheaper model for "explain this" calls: a fixed-structure definition
 * (a position's role, a tactical concept) that doesn't weigh real squad
 * data or make a selection/planning call. A full match plan or lineup pick
 * has a child's game time riding on it and stays on AI_MODEL; an explainer
 * doesn't, so it shouldn't cost the same. Falls back to AI_MODEL when unset,
 * so nothing changes until this is actually configured.
 */
export const AI_MODEL_LITE = process.env.GEMINI_MODEL_LITE ?? AI_MODEL;
