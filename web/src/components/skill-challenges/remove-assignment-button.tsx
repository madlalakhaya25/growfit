"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { removeSkillChallengeAssignment } from "@/app/actions/skill-challenges";

export function RemoveAssignmentButton({ assignmentId, name }: Readonly<{ assignmentId: string; name: string }>) {
  const [pending, startTransition] = useTransition();
  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      className="min-h-11"
      disabled={pending}
      aria-label={`Remove ${name}`}
      onClick={() =>
        startTransition(async () => {
          const res = await removeSkillChallengeAssignment(assignmentId);
          if (res?.error) toast.error(res.error);
          else toast.success("Challenge removed. Scores already logged are kept.");
        })
      }
    >
      Remove
    </Button>
  );
}
