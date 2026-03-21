"use server";

import { redirect } from "next/navigation";
import { submitAppeal } from "@/lib/db";

export async function submitAppealAction(formData: FormData) {
  const lang = formData.get("lang") as string;
  const appeal_type =
    (formData.get("appeal_type") as string)?.trim() || "correction";
  const submitter_name =
    (formData.get("submitter_name") as string)?.trim() || "Anonymous";
  const submitter_email =
    (formData.get("submitter_email") as string)?.trim() || "";
  const swimmer_name =
    (formData.get("swimmer_name") as string)?.trim() || "";
  const swimmer_id = (formData.get("swimmer_id") as string)?.trim() || "";
  const competition_name =
    (formData.get("competition_name") as string)?.trim() || "";
  const event_description =
    (formData.get("event_description") as string)?.trim() || "";
  const recorded_time =
    (formData.get("recorded_time") as string)?.trim() || "";
  const reason = (formData.get("reason") as string)?.trim() || "";
  const requested_change =
    (formData.get("requested_change") as string)?.trim() || "";

  if (!swimmer_name || !reason || !requested_change) {
    redirect(`/${lang}/appeals?error=missing`);
  }

  await submitAppeal({
    appeal_type,
    submitter_name,
    submitter_email,
    swimmer_name,
    swimmer_id,
    competition_name,
    event_description,
    recorded_time,
    reason,
    requested_change,
  });
  redirect(`/${lang}/appeals?submitted=1`);
}
