import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL!);
const CODE_RE = /^[a-z0-9][a-z0-9-]{1,28}[a-z0-9]$/;

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code } = await params;
  const rows = await sql`
    SELECT code, name, swimmer_ids, created_at, updated_at
    FROM teams WHERE code = ${code}
  `;
  if (rows.length === 0) {
    return Response.json({ error: "not_found" }, { status: 404 });
  }
  return Response.json(rows[0]);
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code } = await params;

  if (!CODE_RE.test(code)) {
    return Response.json({ error: "invalid_code" }, { status: 400 });
  }

  const body = await request.json();
  const swimmerIds = body.swimmer_ids;
  const name = body.name || null;

  if (!Array.isArray(swimmerIds) || swimmerIds.length > 50) {
    return Response.json({ error: "invalid_data" }, { status: 400 });
  }

  // Validate all IDs are strings
  if (!swimmerIds.every((id: unknown) => typeof id === "string")) {
    return Response.json({ error: "invalid_data" }, { status: 400 });
  }

  await sql`
    INSERT INTO teams (code, name, swimmer_ids, updated_at)
    VALUES (${code}, ${name}, ${JSON.stringify(swimmerIds)}::jsonb, NOW())
    ON CONFLICT (code) DO UPDATE SET
      name = EXCLUDED.name,
      swimmer_ids = EXCLUDED.swimmer_ids,
      updated_at = NOW()
  `;

  return Response.json({ ok: true });
}
