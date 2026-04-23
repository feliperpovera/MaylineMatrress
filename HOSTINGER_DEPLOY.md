# Hostinger Deploy

This project is prepared as a static upload for Hostinger.

## Build the Hostinger bundle

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
