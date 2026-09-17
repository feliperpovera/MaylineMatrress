# Hostinger Deploy

This project is prepared as a static upload for Hostinger.

## Automatic deploy (recommended)

`.github/workflows/deploy-hostinger.yml` builds this same bundle and uploads
it to Hostinger over FTPS on every push to `main`. One-time setup:

1. In hPanel, go to `Files` > `FTP Accounts` and note (or create) an FTP
   account with access to the site's `public_html`.
2. In the GitHub repo, go to `Settings` > `Secrets and variables` > `Actions`
   and add three repository secrets:
   - `HOSTINGER_FTP_SERVER` — the FTP host from hPanel (e.g. `ftp.maylinmattress.com`)
   - `HOSTINGER_FTP_USERNAME` — the FTP username
   - `HOSTINGER_FTP_PASSWORD` — the FTP password
3. Push to `main` (or run the workflow manually from the Actions tab) and
   confirm the `Deploy to Hostinger` run finishes green.

Until those three secrets exist, the workflow runs but fails at the upload
step — nothing breaks, the live site just keeps whatever was last uploaded.
If `maylinmattress.com` is an addon/parked domain rather than the account's
primary domain, edit `server-dir` in the workflow to
`/domains/maylinmattress.com/public_html/`.

## Manual build (fallback)

Optional, set your real Google Tag Manager container first:

```bash
bash scripts/set-gtm-id.sh GTM-XXXXXXX
```

```bash
bash scripts/build-hostinger.sh
```

Output:

- `deploy/hostinger/`
- `deploy/maylin-mattress-hostinger.zip`

## Upload in Hostinger

Recommended path for a simple domain launch:

1. In hPanel, create or open a `Custom PHP/HTML website`.
2. Open `File Manager` for the target domain.
3. Upload the contents of `deploy/hostinger/` or upload `deploy/maylin-mattress-hostinger.zip` and extract it into `public_html`.
4. Confirm that `index.html` is in the root of `public_html`.
5. The package includes both `portal.html` and `portal/index.html`.
6. The included `.htaccess` maps `/portal` to `portal.html` as an extra compatibility layer.
7. `robots.txt` and `sitemap.xml` are included in the root for SEO.

## Connect the domain

If the domain uses Hostinger nameservers:

1. Go to `Websites` and assign the domain to this site.
2. Wait for propagation if the domain was just connected.

If the domain uses external DNS:

1. Point the domain to Hostinger using the DNS instructions in hPanel.
2. Wait for propagation.

## Hostinger references

- Node.js/static hosting options: https://www.hostinger.com/support/1583661-is-node-js-supported-at-hostinger/
- Add a website: https://www.hostinger.com/support/1583214-how-to-add-a-website
- Connect a domain: https://www.hostinger.com/tutorials/how-to-point-domain-to-hostinger

## GTM note

The project ships with the placeholder `GTM-XXXXXXX`.
Replace it with your real container ID before publishing.
