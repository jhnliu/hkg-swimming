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
  const gender_current =
    (formData.get("gender_current") as string)?.trim() || "";
  const gender_correct =
    (formData.get("gender_correct") as string)?.trim() || "";
  let requested_change =
    (formData.get("requested_change") as string)?.trim() || "";

  // For gender corrections, prepend the gender info to the requested change
  if (appeal_type === "gender_correction" && gender_current && gender_correct) {
    const genderInfo = `Gender: ${gender_current} → ${gender_correct}`;
    requested_change = requested_change
      ? `${genderInfo}\n${requested_change}`
      : genderInfo;
  }

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
