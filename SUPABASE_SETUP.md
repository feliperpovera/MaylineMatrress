# Supabase Setup

This project is ready to use Supabase for:

- portal authentication with email + password
- questionnaire storage in Postgres
- private questionnaire dashboard reads for authenticated users
- **contact form submissions storage (read at /admin)** -- see "Contact form
  storage" below. This is the important one: without it, submissions from
  the bottom "Send Us a Message" form only live in a local file on the
  server that is wiped on every deploy.

## 1. Add your project keys

Open [supabase-config.js](/Users/feliperestrepo/Desktop/Antigravity/MaylinMattress/supabase-config.js) and replace:

- `YOUR_SUPABASE_URL`
- `YOUR_SUPABASE_ANON_KEY`

## 2. Create the questionnaires table

In the Supabase SQL editor, run the SQL from:

- [supabase-setup.sql](/Users/feliperestrepo/Desktop/Antigravity/MaylinMattress/supabase-setup.sql)

## 3. Create the new portal user securely

Recommended:

1. Open `Supabase Dashboard`
2. Go to `Authentication`
3. Go to `Users`
4. Click `Add user`
5. Create the new user with email and password

This is the safe approach for a private portal.

## 4. Portal login

After creating the user in Supabase Auth, open:

- `http://localhost:4173/portal.html`

Then sign in with that email and password.

## Optional: public sign-up

You can enable browser sign-up by changing `allowPortalSignup` to `true` in [supabase-config.js](/Users/feliperestrepo/Desktop/Antigravity/MaylinMattress/supabase-config.js).

This is not recommended for a private portal unless you control who can access the page and your auth settings.

## Contact form storage (the `/admin` panel)

The bottom "Send Us a Message" form is handled entirely server-side
(`server.js`), separately from the Supabase client setup above. It needs two
**server** environment variables, not the browser config file:

1. In your Supabase project: `Settings` > `API`. Copy the `Project URL` and
   the `service_role` secret key (NOT the `anon` key -- the service role key
   must never be exposed to the browser, which is exactly why this lives in
   server.js and not supabase-config.js).
2. In the Supabase SQL editor, run
   [supabase-setup-contact.sql](/Users/feliperestrepo/Desktop/Antigravity/MaylinMattress/supabase-setup-contact.sql)
   to create the `contact_submissions` table.
3. In Hostinger hPanel, open the site > `Deployments` > `Settings and
   redeploy` > `Environment Variables`, and add:
   - `SUPABASE_URL` -- the Project URL from step 1
   - `SUPABASE_SERVICE_ROLE_KEY` -- the service_role key from step 1
4. Redeploy (or push to `main`). Once both variables are present, `server.js`
   automatically writes and reads submissions from Supabase instead of the
   local file, and `/admin` keeps working exactly as before -- same login,
   same UI.

Without these two variables, `server.js` falls back to the old local-file
behavior (works, but does not survive a redeploy) and logs a warning on
startup.
