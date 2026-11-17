# Backend (live location + Digital Tourist ID)

Small Node server (Node 18+). Run `npm install` once, then:

    npm start          # normal
    npm run demo       # adds the demo tamper/restore tools
    npm test           # end-to-end tests (needs the local chain running)

It listens on `:8080` (set `PORT` to change).

## Making it reachable from a phone

Your phone and your contacts must reach this server over **https**.
For a quick demo use a free tunnel, e.g. `cloudflared tunnel --url http://localhost:8080`,
and put the address in `mobile/.env` as `EXPO_PUBLIC_TRACKER_URL=...` (no trailing slash).
For real use deploy it anywhere that runs Node. Free tunnels give a new address each time.

## Environment variables

| Variable | Purpose |
|---|---|
| `PORT` | listen port (default 8080) |
| `PUBLIC_URL` | public address, if the server can't work it out |
| `DATA_FILE`, `IDENTITY_FILE` | where sessions / identities are saved |
| `DATA_KEY` or `KEY_FILE` | 64-hex-char encryption key (else `secret.key` is created) |
| `DEPLOYMENT_FILE` | contract deployment (default `../blockchain/deployment.json`) |
| `CHAIN_RPC_URL`, `CONTRACT_ADDRESS`, `CHAIN_ID` | use a specific chain instead of `deployment.json` |
| `SIGNUP_LIMIT_PER_HOUR` | sign-ups allowed per hour from one address (default 10; raise for a classroom demo) |
| `ISSUER_PRIVATE_KEY` | wallet that writes to the contract (required for non-local chains) |

## API

Live location: `POST /api/sessions`, `PUT /api/sessions/:id/location`, `DELETE /api/sessions/:id`,
`GET /api/sessions/:id`, `GET /t/:id` (the page contacts open).

Digital Tourist ID (owner calls need `Authorization: Bearer <login token>`; no token gives 401, someone else's token gives 404):

| Method | Path | Who |
|---|---|---|
| POST | `/api/auth/signup` `{fullName, email, password, nationality}` | anyone: creates the account **and** the Tourist ID |
| POST | `/api/auth/login` `{email, password}` | anyone: returns a login token |
| POST | `/api/auth/logout` | logged in |
| GET | `/api/auth/me` | logged in |
| GET | `/api/identity/:id` | owner |
| POST | `/api/identity/:id/revoke` | owner |
| GET | `/api/verify/:id` | **public**: is this ID genuine? |
| GET / POST | `/api/identity/:id/records` | owner |
| GET / PUT | `/api/identity/:id/emergency` | owner |
| GET / POST | `/api/identity/:id/grants` | owner |
| DELETE | `/api/identity/:id/grants/:grantId` | owner |
| POST | `/api/emergency/access` `{touristId, code}` | anyone with a valid code |
| GET | `/api/chain` | blockchain status |
| POST | `/api/demo/tamper/:id`, `/api/demo/restore/:id` | demo mode only |

## Security notes

* Passwords are stored only as salted scrypt hashes. Login tokens and access codes are stored only as hashes.
* Wrong password and unknown email give the same answer; 5 wrong passwords lock that login for 10 minutes.
* Logins last 30 days, work on several devices at once, and can be ended individually.
* Record contents are encrypted at rest (AES-256-GCM), tied to their tourist ID.
* Unknown IDs and wrong tokens get the same 404, so IDs can't be probed.
* 5 wrong emergency codes lock that tourist's emergency access for 15 minutes.
* `identities.json`, `sessions.json` and `secret.key` hold private data and are git-ignored.
