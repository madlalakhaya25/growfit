export interface AssistantTurn {
  role: "user" | "model";
  text: string;
}

type Content = { role: "user" | "model"; parts: { text: string }[] };

const ack = (teamName: string) =>
  `Understood. I have the ${teamName} squad in front of me and will use their real data.`;

/**
 * The cacheable prefix: the stable brief as a user turn plus the model's
 * acknowledgement, so the cached contents end on a model turn and the request
 * that follows can begin with a user turn (Gemini needs strict alternation
 * across the cache boundary too).
 */
export function stablePrefixContents(stableBrief: string, teamName: string): Content[] {
  return [
    { role: "user", parts: [{ text: `Here is the squad roster. Use it for every answer.\n\n${stableBrief}` }] },
    { role: "model", parts: [{ text: ack(teamName) }] },
  ];
}

/**
 * Everything that follows the prefix. With a context cache the prefix is
 * referenced by name and only the volatile brief is sent; without one
 * (`cached: false`) the prefix goes inline and the result is the same
 * conversation the model saw before caching existed.
 */
export function assistantContents(input: {
  stableBrief: string;
  volatileBrief: string;
  teamName: string;
  history: readonly AssistantTurn[];
  question: string;
  cached: boolean;
}): Content[] {
  const volatile: Content[] = [
    { role: "user", parts: [{ text: `Here is the current squad status. It is more recent than anything said earlier.\n\n${input.volatileBrief}` }] },
    { role: "model", parts: [{ text: "Understood — I'll use the current status." }] },
  ];
  return [
    ...(input.cached ? [] : stablePrefixContents(input.stableBrief, input.teamName)),
    ...volatile,
    ...input.history.map((m) => ({ role: m.role, parts: [{ text: m.text }] })),
    { role: "user", parts: [{ text: input.question }] },
  ];
}
