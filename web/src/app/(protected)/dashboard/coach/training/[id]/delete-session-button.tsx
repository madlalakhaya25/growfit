"use client";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { deleteTrainingSession } from "@/app/actions/training";

export function DeleteSessionButton({ id }: { id: string }) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function handleDelete() {
    if (!confirm("Delete this training session and all its drills?")) return;
    startTransition(async () => {
      const result = await deleteTrainingSession(id);
      if (result?.error) toast.error(result.error);
      else router.push("/dashboard/coach/training");
    });
  }

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={handleDelete}
      disabled={pending}
      className="text-destructive hover:text-destructive shrink-0"
    >
      <Trash2 className="size-4" aria-hidden="true" />
      <span className="sr-only">Delete session</span>
    </Button>
  );
}
