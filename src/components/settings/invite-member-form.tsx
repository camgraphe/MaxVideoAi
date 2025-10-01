"use client";

import { useFormState, useFormStatus } from "react-dom";
import { inviteMemberAction } from "@/app/(dashboard)/settings/members/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const initialState = { error: null as string | null, success: false };

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} className="w-full sm:w-auto">
      {pending ? "Sending invite…" : "Send invitation"}
    </Button>
  );
}

export function InviteMemberForm() {
  const [state, formAction] = useFormState(async (prevState: typeof initialState, formData: FormData) => {
    const result = await inviteMemberAction(prevState, formData);
    if (result?.error) {
      return { error: result.error, success: false };
    }
    return { error: null, success: true };
  }, initialState);

  return (
    <form action={formAction} className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-[2fr_1fr]">
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input id="email" name="email" type="email" placeholder="teammate@example.com" required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="role">Role</Label>
          <Select name="role" defaultValue="member">
            <SelectTrigger id="role">
              <SelectValue placeholder="Select role" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="member">Member</SelectItem>
              <SelectItem value="admin">Admin</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-muted-foreground">
          Members can launch renders. Admins can invite teammates and manage billing. Owners can transfer or delete the workspace.
        </p>
        <SubmitButton />
      </div>
      {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
      {state.success ? <p className="text-sm text-emerald-600">Invitation sent.</p> : null}
    </form>
  );
}

