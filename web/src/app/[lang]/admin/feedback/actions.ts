"use server";

import { redirect } from "next/navigation";
import { updateFeedbackStatus } from "@/lib/db";

export async function updateFeedbackAction(formData: FormData) {
  const lang = formData.get("lang") as string;
  const key = formData.get("key") as string;
  const id = parseInt(formData.get("id") as string, 10);
  const status = formData.get("status") as string;
  const admin_note = (formData.get("admin_note") as string)?.trim() || "";

  if (key !== process.env.ADMIN_KEY) {
    redirect(`/${lang}/admin/feedback?error=unauthorized`);
  }

  const validStatuses = ["open", "in-progress", "resolved", "closed"];
  if (!id || !validStatuses.includes(status)) {
    redirect(`/${lang}/admin/feedback?key=${key}&error=invalid`);
  }

  await updateFeedbackStatus(id, status, admin_note);
  redirect(`/${lang}/admin/feedback?key=${key}&updated=${id}`);
}
