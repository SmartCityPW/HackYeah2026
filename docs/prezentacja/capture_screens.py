#!/usr/bin/env python3
"""Robi zrzuty ekranu aplikacji do prezentacji (assets/map-desktop.png, map-phone.png, ngo-card.png, place-card.png).

Wymaga uruchomionej aplikacji (frontend na APP_URL, domyślnie http://localhost:4200, i backend z danymi demo: `manage.py seed_demo`)
oraz: pip install playwright && playwright install chromium. Pozycja gracza jest symulowana parametrem `?gps=` (tylko `dev.tools: true`
i `location.allow_simulated: true`, czyli konfiguracja lokalna). Pinezki do kart wybiera po tytule z API, więc identyfikatory nie muszą się zgadzać.
Uruchomienie: python3 capture_screens.py   (zapisuje obok skryptu, w assets/)
"""
import json
import os
import time
import urllib.request
from pathlib import Path

from playwright.sync_api import sync_playwright

HERE = Path(__file__).parent
ASSETS = HERE / "assets"
APP = os.environ.get("APP_URL", "http://localhost:4200").rstrip("/")
ARENA = "50.0676,19.9917"  # domyślna pozycja z prezentacji: plac przed TAURON Areną
DABSKA = "50.0674,19.9882"  # przy ul. Dąbskiej, w zasięgu głosu
LAUNCH_ARGS = ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist", "--enable-webgl"]
HIDE_STOP_TITLES = [t for t in os.environ.get("HIDE_STOP_TITLES", "").split("|") if t]  # np. własne pinezki testowe zasłaniające kadr
MAP_SETTLE_S = 14  # kafelki i modele 3D rysują się programowo, więc czekamy dłużej


def api(path: str, token: str | None = None, method: str = "GET"):
    request = urllib.request.Request(f"{APP}/api/v1{path}", method=method, headers={"Authorization": f"Bearer {token}"} if token else {})
    with urllib.request.urlopen(request, timeout=20) as response:
        return json.load(response)


def stop_id(title_start: str) -> int:
    token = api("/auth/guest", method="POST")["access"]
    found = api("/pokestops?pageSize=200&page=1&bbox=19.7,49.9,20.3,50.2", token)["results"]
    return next(s["id"] for s in found if s["title"].startswith(title_start))


def hide_test_pins(page) -> None:
    for title in HIDE_STOP_TITLES:
        page.evaluate("(t) => document.querySelectorAll('.stop-marker').forEach((el) => el.getAttribute('aria-label') === t && (el.style.visibility = 'hidden'))", title)


def open_page(browser, width: int, height: int, scale: int, query: str):
    context = browser.new_context(viewport={"width": width, "height": height}, device_scale_factor=scale, locale="pl-PL")
    page = context.new_page()
    page.goto(f"{APP}/?{query}", wait_until="networkidle")
    page.wait_for_selector(".user-dot", timeout=60_000)  # pozycja gracza narysowana, czyli mapa gotowa
    time.sleep(MAP_SETTLE_S)
    hide_test_pins(page)
    return context, page


def card(browser, query: str, out: str):
    """Karta pinezki (arkusz u dołu): otwierana parametrem ?stop=ID, zrzut samego arkusza na wąskim ekranie."""
    context, page = open_page(browser, 562, 900, 2, query)
    sheet = page.locator("section.sheet").first
    sheet.wait_for(timeout=30_000)
    # Sam arkusz na przezroczystym tle: bez mapy za ściętym rogiem i bez przycisków nad mapą.
    page.add_style_tag(content=".map, .gps, .level, .fab, nav { visibility: hidden !important; } html, body { background: transparent !important; }")
    time.sleep(1)
    sheet.screenshot(path=str(ASSETS / out), omit_background=True)
    context.close()
    print("ok", out)


def main() -> None:
    arena_stop = stop_id("Konsultacje: parkowanie i ruch wokół Tauron Areny")
    dabska_stop = stop_id("Brak miejsc parkingowych przy ul. Dąbskiej")
    with sync_playwright() as p:
        browser = p.chromium.launch(args=LAUNCH_ARGS)
        context, page = open_page(browser, 1510, 859, 2, f"gps={ARENA}")
        page.screenshot(path=str(ASSETS / "map-desktop.png"))
        context.close()
        print("ok map-desktop.png")
        context, page = open_page(browser, 390, 844, 2, f"gps={ARENA}")
        page.screenshot(path=str(ASSETS / "map-phone.png"))
        context.close()
        print("ok map-phone.png")
        card(browser, f"gps={ARENA}&stop={arena_stop}", "ngo-card.png")
        card(browser, f"gps={DABSKA}&stop={dabska_stop}", "place-card.png")
        browser.close()


if __name__ == "__main__":
    main()
