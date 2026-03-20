"use server";

import { redirect } from "next/navigation";
import { submitFeedback } from "@/lib/db";

export async function submitFeedbackAction(formData: FormData) {
  const lang = formData.get("lang") as string;
  const name = (formData.get("name") as string)?.trim() || "Anonymous";
  const category = (formData.get("category") as string) || "feedback";
  const title = (formData.get("title") as string)?.trim();
  const description = (formData.get("description") as string)?.trim();

  if (!title || !description) {
    redirect(`/${lang}/feedback?error=missing`);
  }

  await submitFeedback({ name, category, title, description });
  redirect(`/${lang}/feedback?submitted=1`);
}
