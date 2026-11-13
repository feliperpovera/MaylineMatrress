#!/usr/bin/env python3
"""Envía a IndexNow (Bing, Yandex, Seznam, Naver) todas las URLs del sitemap del sitio.
Uso: python3 indexnow.py <host> <sitemap_url> <key>   (la clave debe estar publicada en https://<host>/<key>.txt)"""
import json, re, sys, urllib.request

host, sitemap, key = sys.argv[1:4]
UA = {"User-Agent": "Mozilla/5.0 (compatible; RevUp-IndexNow/1.0)"}


def get(u):
    return urllib.request.urlopen(urllib.request.Request(u, headers=UA), timeout=30).read().decode("utf-8", "replace")


def locs(u):
    xml = get(u)
    found = re.findall(r"<loc>\s*([^<\s]+)\s*</loc>", xml)
    if "<sitemapindex" in xml:  # índice de sitemaps: bajar cada hijo
        return [x for child in found for x in locs(child)]
    return found


urls = sorted({u for u in locs(sitemap) if re.match(rf"https?://{re.escape(host)}/", u)})[:10000]
assert get(f"https://{host}/{key}.txt").strip() == key, "la clave no está publicada en el sitio"
body = json.dumps({"host": host, "key": key, "keyLocation": f"https://{host}/{key}.txt", "urlList": urls}).encode()
req = urllib.request.Request("https://api.indexnow.org/indexnow", data=body, method="POST",
                             headers={**UA, "Content-Type": "application/json; charset=utf-8"})
with urllib.request.urlopen(req, timeout=30) as r:
    print(f"IndexNow {r.status}: {len(urls)} URLs de {host}")
