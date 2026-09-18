# Supabase Setup

This project is ready to use Supabase for:

- portal authentication with email + password
- questionnaire storage in Postgres
- private questionnaire dashboard reads for authenticated users

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
