/** A stand-in for @google/genai (its ESM build can't load under Jest): the
 * schema `Type` enum and a client whose generateContent is `generate`. Used as
 * jest.mock("@google/genai", () => require("@/test-utils/genai-mock").genaiMock(mockGenerate)). */
export function genaiMock(generate: (...a: unknown[]) => unknown) {
  return {
    Type: { OBJECT: "OBJECT", ARRAY: "ARRAY", STRING: "STRING", NUMBER: "NUMBER", BOOLEAN: "BOOLEAN" },
    GoogleGenAI: class { models = { generateContent: (...a: unknown[]) => generate(...a) }; },
  };
}
