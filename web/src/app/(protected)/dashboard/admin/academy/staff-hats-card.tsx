"use client";
import { useTransition } from "react";
import { toast } from "sonner";
import { setStaffHat } from "@/app/actions/staff-hats";
import { HAT_LABELS, STAFF_HATS } from "@/lib/staff-hats";
import type { StaffMember } from "@/lib/staff-hats-data";

function HatBox({ person, hat }: Readonly<{ person: StaffMember; hat: (typeof STAFF_HATS)[number] }>) {
  const [pending, startTransition] = useTransition();
  const on = person.hats.includes(hat);
  return (
    <label className="flex items-center gap-2 text-sm">
      <input
        type="checkbox"
        className="size-4"
        checked={on}
        disabled={pending}
        onChange={(e) =>
          startTransition(async () => {
            const res = await setStaffHat(person.id, hat, e.target.checked);
            if (res?.error) toast.error(res.error);
          })
        }
      />
      {HAT_LABELS[hat]}
    </label>
  );
}

export function StaffHatsCard({ staff }: Readonly<{ staff: StaffMember[] }>) {
  if (staff.length === 0) return <p className="rounded-md bg-muted px-3 py-2 text-sm">No coaches or admins yet.</p>;
  return (
    <ul className="space-y-3">
      {staff.map((person) => (
        <li key={person.id} className="rounded-lg border border-border p-4">
          <p className="text-sm font-semibold">
            {person.name} <span className="font-normal text-muted-foreground">({person.role})</span>
          </p>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            {STAFF_HATS.map((hat) => <HatBox key={hat} person={person} hat={hat} />)}
          </div>
        </li>
      ))}
    </ul>
  );
}
