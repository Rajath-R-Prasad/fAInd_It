# API Reference

Base URL for local development: `http://localhost:8000`

Interactive OpenAPI docs: `http://localhost:8000/docs`

All protected endpoints expect a bearer token:

```http
Authorization: Bearer <access_token>
```

## Authentication

| Method | Path | Auth | Purpose |
|---|---|---|---|
| POST | `/auth/register` | Public | Create a user with `email`, `mobile_number`, and `password` form fields |
| POST | `/auth/token` | Public | OAuth2 password-form login; returns a JWT, user ID, mobile number, and role flags |
| GET | `/auth/me` | User | Return the current user profile, including mobile number |

Registration and login use `application/x-www-form-urlencoded` or multipart form data, not JSON.
`mobile_number` is required at registration and must contain 7 to 15 digits. It is stored as
private contact information and is not returned on public report or match objects.

Login response:

```json
{
  "access_token": "<jwt>",
  "token_type": "bearer",
  "id": "<user-uuid>",
  "email": "user@example.com",
  "mobile_number": "+91 98765 43210",
  "is_superuser": false
}
```

## Health

| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET | `/health` | Public | Return service status and UTC timestamp |

## Reports

| Method | Path | Auth | Purpose |
|---|---|---|---|
| POST | `/reports/` | User | Create a LOST or FOUND report with an image |
| GET | `/reports/` | User | List the current user's active reports; admins see all |
| GET | `/reports/{report_id}` | Owner/Admin | Get one report |
| PUT | `/reports/{report_id}` | Owner/Admin | Update report fields and optionally replace the image |
| DELETE | `/reports/{report_id}` | Owner/Admin | Soft-delete by setting `is_active = false` |
| GET | `/uploads/{report_id}` | Public | Serve the stored report image |

Create/update form fields:

| Field | Required | Notes |
|---|---|---|
| `report_type` | Yes | `LOST` or `FOUND` |
| `title` | Yes | Short item title |
| `description` | No | Free text |
| `category` | No | Example: `Water Bottle`, `Mouse` |
| `color` | No | Example: `Red`, `Black` |
| `location` | No | Campus location |
| `event_date` | No | ISO-8601 datetime |
| `image` | Yes on create | JPEG, PNG, or WebP; maximum `MAX_UPLOAD_SIZE_MB` (default 5 MB) |

Create response includes sanitized embedding status:

```json
{
  "id": "<uuid>",
  "type": "LOST",
  "title": "Lost red water bottle",
  "status": "OPEN",
  "moderation_status": "ACTIVE",
  "image_url": "/uploads/<uuid>",
  "owner_id": "<user-uuid>",
  "embedding_status": {"image": "complete", "text": "complete"}
}
```

Report responses include `owner_id` so the frontend can decide whether to show owner-only
edit and delete actions. The mobile number is never included in report responses.

List filters: `report_type`, `category`, `skip`, `limit`.

## Matching

| Method | Path | Auth | Purpose |
|---|---|---|---|
| POST | `/matches/` | User | Rank opposite-type candidates for all of the user's reports |
| GET | `/reports/{report_id}/matches` | Owner/Admin | Rank top-5 candidates for one report |
| POST | `/reports/{report_id}/matches/refresh` | Owner/Admin | Recompute the same on-demand ranking |
| POST | `/reports/{report_id}/retry-embeddings` | Owner/Admin | Regenerate missing/failed embeddings |

Matching excludes self, same-type reports, inactive reports, non-`OPEN` reports, and
moderated (`FLAGGED`/`REMOVED`) reports. Scores are ranking signals, not probabilities.

Candidate shape:

```json
{
  "report_id": "<uuid>",
  "report": {"id": "<uuid>", "type": "FOUND", "title": "Red bottle found"},
  "scores": {
    "image_similarity": 0.7576,
    "text_similarity": 0.8245,
    "metadata_similarity": 0.96,
    "final_score": 0.8367
  },
  "can_claim": true
}
```

## Claims

| Method | Path | Auth | Purpose |
|---|---|---|---|
| POST | `/claims` | User | Submit a claim for an open FOUND report |
| GET | `/claims/mine` | User | List claims submitted by the current user |
| GET | `/claims/received` | User | List claims received on the user's FOUND reports |
| GET | `/claims/{claim_id}` | Participant/Admin | Get one claim |
| POST | `/claims/{claim_id}/accept` | Found owner/Admin | Accept a pending claim |
| POST | `/claims/{claim_id}/reject` | Found owner/Admin | Reject a pending claim |
| GET | `/claims/` | User/Admin | Combined submitted and received list |

Claim request body:

```json
{
  "found_report_id": "<uuid>",
  "message": "It has a small scratch on the base and a red loop cap."
}
```

Rules:

- Claims can only target active, `OPEN`, `ACTIVE` FOUND reports.
- A user cannot claim their own FOUND report.
- A user cannot have two pending claims for the same report.
- Only the found-report owner or an admin can accept/reject.
- Accepting a claim sets it to `ACCEPTED`, sets the report to `MATCHED`, and rejects other
  pending claims for that report in the same transaction.
- Claim statuses are uppercase: `PENDING`, `ACCEPTED`, `REJECTED`.
- Claim responses include a `contact` object only when the claim is `ACCEPTED` and the viewer
  is the claimant or the found-report owner. Everyone else receives `"contact": null`.

Accepted-claim contact shape:

```json
{
  "contact": {
    "claimant_mobile": "+91 98765 43210",
    "owner_mobile": "+91 91234 56780"
  }
}
```

## Admin

All admin endpoints require `is_superuser = true`.

| Method | Path | Purpose |
|---|---|---|
| GET | `/admin/reports` | List/filter reports by type, category, status, moderation status, and title search |
| POST | `/admin/reports/{report_id}/flag` | Set moderation status to `FLAGGED` |
| POST | `/admin/reports/{report_id}/remove` | Set moderation status to `REMOVED` and soft-delete |
| GET | `/admin/claims` | List claims, optionally filtered by status |

## Evaluation

| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET | `/evaluation/summary` | User | Return the newest PostgreSQL evaluation run or an honest empty state |
| GET | `/evaluation/runs` | Admin | Return metadata for up to 50 recent evaluation runs |
| POST | `/evaluation/run` | Admin | Run the offline evaluation and insert it into `evaluation_runs` |

`POST /evaluation/run` is disabled when `EVALUATION_RUN_ENABLED` is not truthy. The endpoint
does not accept paths or code from the client. Evaluation runs are stored in PostgreSQL, not
in JSON/CSV files.

## Common Status Codes

| Status | Meaning |
|---|---|
| 200 | Success |
| 201 | Resource created |
| 204 | Delete succeeded |
| 400 | Invalid input or invalid state transition |
| 401 | Missing/invalid token |
| 403 | Authenticated but not authorized |
| 404 | Resource not found |
| 409 | Duplicate or conflicting state |
| 500 | Unexpected server/evaluation failure |
