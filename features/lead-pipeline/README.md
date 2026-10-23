# Lead Pipeline

The lead board is available without logging in. Status history attributes updates to `DEFAULT_ACTOR_NAME`, or to `Tư vấn viên` if that environment variable is not set.

```powershell
$env:DEFAULT_ACTOR_NAME = "Admissions advisor"
npm run dev
```

Without authentication, anyone who can reach the application can view and update leads. Do not expose this development setup to an untrusted network.
