# SOS live-location tracker

Tiny server (no dependencies, Node 18+) that makes the SOS link *live*.
An SMS can only carry a snapshot, so the app sends your position here every
few seconds and your contacts' link shows it on a map until the time you chose
(default 1 hour) runs out or you tap Stop.

## Run it

    cd tracker
    node server.mjs            # listens on :8080 (PORT to change)

Env vars: `PORT`, `PUBLIC_URL` (only needed if the server can't tell its own
public address), `DATA_FILE` (where sessions are saved, default `sessions.json`).

## Point the app at it

In `mobile/.env`:

    EXPO_PUBLIC_TRACKER_URL=https://your-tracker.example.com

It must be reachable from the internet over **https**, because your *contacts*
open the link, not just your phone. For a quick demo: `ngrok http 8080` and use
the https URL. For real use, deploy `server.mjs` anywhere that runs Node
(Render, Railway, Fly, a VPS). Restart the Expo dev server after editing `.env`.

## What it does and doesn't do

- Link = access. The public id is 96 random bits; only the phone holds the
  secret token needed to push or stop. Anyone with the link can watch until it ends.
- Sessions auto-end at the chosen time and are deleted an hour later.
- Capped at 12 h per session, 20 sessions/hour/IP, 60 trail points kept.
- Sessions are saved to a JSON file so a restart doesn't cut them off. On hosts
  with an ephemeral disk they will still be lost on redeploy.
- Single instance only (state is local). Use a database if you need to scale.

## API

| Method | Path | Who |
|---|---|---|
| POST | `/api/sessions` `{lat,lng,accuracy?,durationMin}` | app |
| PUT | `/api/sessions/:id/location` `{lat,lng,accuracy?,ts}` + `Authorization: Bearer <token>` | app |
| DELETE | `/api/sessions/:id` + bearer token | app |
| GET | `/api/sessions/:id` | viewer page |
| GET | `/t/:id` | contact's browser |
