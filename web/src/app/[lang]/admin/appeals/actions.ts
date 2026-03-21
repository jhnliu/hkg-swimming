"use server";

import { redirect } from "next/navigation";
import { reviewAppeal } from "@/lib/db";

export async function reviewAppealAction(formData: FormData) {
  const lang = formData.get("lang") as string;
  const key = formData.get("key") as string;
  const id = parseInt(formData.get("id") as string, 10);
  const status = formData.get("status") as "approved" | "rejected";
  const admin_note = (formData.get("admin_note") as string)?.trim() || "";

  if (key !== process.env.ADMIN_KEY) {
    redirect(`/${lang}/admin/appeals?error=unauthorized`);
  }

  if (!id || !["approved", "rejected"].includes(status)) {
    redirect(`/${lang}/admin/appeals?key=${key}&error=invalid`);
  }

  await reviewAppeal(id, status, admin_note);
  redirect(`/${lang}/admin/appeals?key=${key}&reviewed=${id}`);
}
