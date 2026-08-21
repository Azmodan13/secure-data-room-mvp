# Authorization and Acceptance Matrix

This document records the security-critical acceptance checks for the Data Room MVP.
Automated checks run in CI/local scripts; scenarios requiring separate browser sessions are
verified manually before release.

## Test identities

- **Owner**: owns the test Data Room and all content created in it.
- **Viewer**: a different registered user who receives explicit read-only grants.
- **Unrelated user**: an authenticated user with no grant to the test resources.
- **Anonymous user**: an incognito browser session with no application session.

Never place real passwords, access tokens, public-link tokens, or signed storage URLs in this
file or in Git history.

## Automated coverage

| Area | Expected guarantee | Status |
| --- | --- | --- |
| Authentication | Protected room, share, and upload endpoints reject missing JWTs with `401` | Automated pass |
| Ownership | Owners can read and mutate their resources | Automated pass |
| Isolation | Unrelated users cannot read another owner's resource | Automated pass |
| Grant inheritance | Room and ancestor-folder grants permit nested reads | Automated pass |
| Direct grants | A file grant permits only that file | Automated pass |
| Public links | Active links allow the target and its subtree; revoked links are denied | Automated pass |
| Public listing | Folder links are scoped to the authorized folder; file links cannot list containers | Automated pass |
| Share administration | Listing and revoking shares requires owner mutation permission | Automated pass |
| Mutation guards | Denied folder creation and rename stop before database mutation | Automated pass |

Run the automated suite from the repository root:

```bash
npm run lint
npm run test
npm run test:e2e --workspace=apps/api -- --runInBand
npm run build
```

## Manual acceptance run

Use one small PDF and create this fixture as the owner:

```text
Acceptance Room
├── Due Diligence
│   ├── Financial
│   │   └── report.pdf
│   └── legal.pdf
└── root.pdf
```

Record the result of each scenario in the final column.

| ID | Actor | Scenario | Expected result | Result |
| --- | --- | --- | --- | --- |
| M1 | Owner | Create the room, nested folders, and upload PDFs | Items appear once; breadcrumbs and counts remain correct | Pass |
| M2 | Owner | Upload a duplicate PDF name | Conflict is explained and the proposed suffix can be accepted or replaced | Pass |
| M3 | Unrelated user | Open a copied private room, folder, file, or view URL | Neutral unavailable/`404`; no names, IDs, sizes, or signed URLs leak | Pass |
| M4 | Unrelated user | Attempt rename, move, delete, upload, and share operations | Every mutation is denied and persisted state is unchanged | Automated pass; manual HTTP mutation pending |
| M5 | Viewer | Receive a Data Room grant and sign in | Shared item notification/list entry appears; the whole subtree is readable | Pass |
| M6 | Viewer | Try create, upload, rename, move, delete, or share | Read-only UI exposes no mutation path; direct requests are denied | Pass in UI; direct HTTP covered by policy tests |
| M7 | Viewer | Receive only a nested-folder grant | That folder and descendants are readable; parent and sibling content are unavailable | Pass |
| M8 | Viewer | Receive only a file grant | Only that PDF can be opened/downloaded; its container cannot be listed | Pass |
| M9 | Anonymous | Open room, folder, and file public links in incognito | Target and allowed descendants are readable without login | Pass |
| M10 | Anonymous | Modify a public URL to request an ancestor or sibling | Neutral unavailable/`404`; no metadata or signed URL leaks | Pass |
| M11 | Owner + Viewer | Revoke a grant while the viewer has the page open, then refresh/open a file | Access becomes unavailable and stale UI does not disclose content | Pass |
| M12 | Owner + Anonymous | Revoke a public link, then refresh it in incognito | Link returns the neutral unavailable state | Pass |
| M13 | Owner + Viewer | Delete a shared folder while the viewer has it open | Owner sees the destructive warning; refresh gives neutral unavailable state | Pass |
| M14 | Owner | Delete a folder subtree | Nested database records disappear and their storage objects are removed | Pass |
| M15 | Owner | Force or simulate one failed upload in a multi-file batch | Per-file result is visible; successful files remain consistent and retry is possible | Pass |
| M16 | Owner | Select multiple files, move them, then delete them | Pending state is visible; list refreshes once without duplicate/stale rows | Pass |
| M17 | All | Repeat core flows at narrow mobile width | Navigation, dialogs, actions, tables/lists, and PDF view remain usable | Pending |

## HTTP and error semantics

| Condition | Expected response |
| --- | --- |
| Missing, expired, or malformed authentication | `401 Unauthorized` |
| Existing resource hidden from an unauthorized caller | Neutral `404 Not Found` |
| Name conflict requiring user choice | `409 Conflict` |
| Valid request that violates a domain rule | `422 Unprocessable Entity` |
| Successful deletion/revocation without a body | `204 No Content` |

For authenticated smoke requests on macOS, copy the complete `Bearer ...` value and use:

```bash
curl -i http://localhost:3001/api/v1/data-rooms \
  -H "Authorization: $(pbpaste)"
```

Use an incognito browser for public-link checks so an existing owner session cannot mask an
authorization bug.

## Accepted MVP limitations

- A signed Supabase Storage URL already issued to a viewer can remain usable until its short
  expiry (currently no more than five minutes) after a grant or public link is revoked.
- Mobile Google OAuth is validated after HTTPS deployment. LAN HTTP testing is not a reliable
  OAuth acceptance environment because provider redirects and secure cookie behavior depend on
  the configured public origin.
- Downloading several selected PDFs as one ZIP is tracked as a stretch task and is not part of
  the core authorization acceptance gate.
