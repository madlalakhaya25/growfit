"use client";
import { useRef, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { friendlyError } from "@/lib/friendly-error";

export function PlayerPhotoUpload({ playerId }: { playerId: string }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [pending, start] = useTransition();
  const router = useRouter();

  async function handleFile(file: File) {
    const supabase = createClient();
    const ext = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
    const path = `${playerId}.${ext}`;

    const { error: uploadErr } = await supabase.storage
      .from("player-photos")
      .upload(path, file, { upsert: true, contentType: file.type });

    if (uploadErr) { toast.error(friendlyError(uploadErr, "Couldn't upload that photo.")); return; }

    const { data: { publicUrl } } = supabase.storage
      .from("player-photos")
      .getPublicUrl(path);

    const { error: updateErr } = await supabase
      .from("players")
      .update({ photo_url: publicUrl })
      .eq("id", playerId);

    if (updateErr) { toast.error(friendlyError(updateErr)); return; }
    router.refresh();
  }

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="sr-only"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (!file) return;
          e.target.value = "";
          start(() => handleFile(file));
        }}
      />
      <Button
        size="sm"
        variant="outline"
        disabled={pending}
        onClick={() => inputRef.current?.click()}
      >
        <Upload className="size-4" aria-hidden="true" />
        {pending ? "Uploading…" : "Upload photo"}
      </Button>
    </>
  );
}
