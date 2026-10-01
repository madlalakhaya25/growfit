import { AgentStream } from "@/components/ai/agent-stream";

const STARTERS = [
  "Which players are missing registration documents?",
  "Who is below the 75% attendance threshold?",
  "What fixtures are coming up across the academy?",
];

export default function AdminAgentPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Agent</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Ask about the whole academy. It looks things up as it answers and links to the players it mentions.
          It can only read; it never changes anything.
        </p>
      </div>
      <AgentStream page="agent" starters={STARTERS} />
    </div>
  );
}
