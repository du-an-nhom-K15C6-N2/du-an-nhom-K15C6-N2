# Lead list API

## Run the backend

The API and UI are now integrated in the project without changing the group's main server. Start the DNKN93 module using:

```powershell
$env:LEAD_MANAGER_TOKEN = "a-unique-local-manager-token"
$env:REGULAR_USER_TOKEN = "a-different-local-advisor-token"
node .\features\lead-management-ui\server.js
```

The standalone feature server listens on port `3001` by default. Open `http://localhost:3001/`. It reuses `features/lead-list-search-pagination/data/leads.sqlite`; set `PORT` or `DATABASE_PATH` to override the defaults.

## API

- `GET /api/leads?q=&status=&source=&page=1&pageSize=20` — search, filter and paginate.
- `GET /api/leads/:id` — lead details.
- `POST /api/leads` — create; accepts `fullName`/`name`, `phoneNumber`/`phone`, `programOfInterest`/`program`, `email`, `source`, `status` and `note`.
- `PATCH` or `PUT /api/leads/:id` — update a lead.
- `POST /api/leads/phone-check` — check for a duplicate phone number.
- `DELETE /api/leads/:id` — manager token only.

Phone duplicates return HTTP 409. Pagination defaults to 20 rows and is capped at 100. Run tests from the repository root with `node --test .\features\lead-list-search-pagination\backend\test\lead-management.test.js`.