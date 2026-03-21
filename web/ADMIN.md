# Admin Guide

## Access

All admin pages are protected by the `ADMIN_KEY` environment variable. Append `?key=YOUR_ADMIN_KEY` to any admin URL to authenticate.

## Pages

### Feedback Management

**URL:** `/{lang}/admin/feedback?key=ADMIN_KEY`

Manage user-submitted feedback including bug reports, feature requests, data issues, and general feedback.

**Features:**
- Filter by status using the tabs at the top (all, open, in-progress, resolved, closed)
- Update the status of any feedback item via the dropdown and Save button
- View submission details: category, title, description, submitter name, and timestamp

**Statuses:**
| Status | Meaning |
|---|---|
| open | New, unreviewed feedback (default for new submissions) |
| in-progress | Acknowledged and being worked on |
| resolved | Issue has been addressed |
| closed | No action needed or duplicate |

### Appeals Management

**URL:** `/{lang}/admin/appeals?key=ADMIN_KEY`

Review and approve or reject result correction appeals submitted by users.

**Features:**
- Pending appeals appear at the top with Approve/Reject buttons
- Add an optional admin note when reviewing
- Resolved appeals are listed below for reference

**Statuses:**
| Status | Meaning |
|---|---|
| pending | Awaiting admin review (default for new submissions) |
| approved | Appeal accepted, correction applied |
| rejected | Appeal denied |

## Environment Variables

| Variable | Description |
|---|---|
| `ADMIN_KEY` | Secret key required to access admin pages |
| `DATABASE_URL` | Neon Postgres connection string |
