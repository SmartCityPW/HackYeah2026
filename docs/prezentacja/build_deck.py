#!/usr/bin/env python3
"""Buduje prezentację finalną Smart City Go! (10 slajdów, PDF 16:9, wektorowy tekst).

Zależności: pip install reportlab pillow
Czcionka: Plus Jakarta Sans (SIL OFL), statyczne pliki w fonts/. Inną rodzinę wskazuje FONT_FAMILY (pliki <rodzina>-<Waga>.ttf).
Uruchomienie: python3 build_deck.py   (wynik: SmartCityGo-HackYeah2026.pdf obok skryptu)
Assety (zrzuty ekranu aplikacji, logo) są w assets/.
"""
import math
import re
from pathlib import Path

from PIL import Image, ImageDraw
from reportlab.lib.colors import Color, HexColor, white
from reportlab.lib.styles import ParagraphStyle
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen import canvas
from reportlab.platypus import Paragraph

HERE = Path(__file__).parent
ASSETS, FONTS, CACHE = HERE / "assets", HERE / "fonts", HERE / ".cache"
OUT = HERE / "SmartCityGo-HackYeah2026.pdf"
CACHE.mkdir(exist_ok=True)
W, H = 1280, 720

# Paleta HackYeah (docs/paleta-hackyeah.pdf) + odcienie pochodne
PLUM, PLUM_DK, MIST, LAV, PINK, INDIGO = (HexColor(h) for h in ("#4F345A", "#2E1D38", "#F5EFFF", "#CDC1FF", "#EA638C", "#7371FC"))
INK = HexColor("#2B1E33")
MUTED = HexColor("#6C5B78")

FONT_FAMILY = "PlusJakartaSans"
for name, weight in (("Sans", "Regular"), ("Sans-Medium", "Medium"), ("Sans-SemiBold", "SemiBold"), ("Sans-Bold", "Bold"), ("Sans-ExtraBold", "ExtraBold")):
    pdfmetrics.registerFont(TTFont(name, str(FONTS / f"{FONT_FAMILY}-{weight}.ttf")))
pdfmetrics.registerFontFamily("Sans", normal="Sans", bold="Sans-Bold", italic="Sans", boldItalic="Sans-Bold")


def alpha(color, a):
    return Color(color.red, color.green, color.blue, alpha=a)


# ---------- prymitywy ----------
def rrect(c, x, y, w, h, r, fill=None, stroke=None, lw=1.2):
    if fill is not None:
        c.setFillColor(fill)
    if stroke is not None:
        c.setStrokeColor(stroke)
        c.setLineWidth(lw)
    c.roundRect(x, y, w, h, r, stroke=1 if stroke is not None else 0, fill=1 if fill is not None else 0)


def shadow(c, x, y, w, h, r, spread=22, strength=0.10, dy=10, color=PLUM):
    for i in range(spread, 0, -2):
        c.setFillColor(alpha(color, strength * (1 - i / spread) ** 1.6 / 3))
        c.roundRect(x - i / 2, y - dy - i / 2, w + i, h + i, r + i / 2, stroke=0, fill=1)


def card(c, x, y, w, h, r=22, fill=white, stroke=None, lift=True):
    if lift:
        shadow(c, x, y, w, h, r)
    rrect(c, x, y, w, h, r, fill=fill, stroke=stroke)


def gradient(c, x, y, w, h, c1, c2, angle="v", r=0):
    c.saveState()
    p = c.beginPath()
    p.roundRect(x, y, w, h, r) if r else p.rect(x, y, w, h)
    c.clipPath(p, stroke=0, fill=0)
    if angle == "v":
        c.linearGradient(x, y + h, x, y, (c1, c2))
    elif angle == "h":
        c.linearGradient(x, y, x + w, y, (c1, c2))
    else:
        c.linearGradient(x, y + h, x + w, y, (c1, c2))
    c.restoreState()


def blob(c, cx, cy, r, color, a):
    c.setFillColor(alpha(color, a))
    c.circle(cx, cy, r, stroke=0, fill=1)


def text(c, s, x, y, font="Sans", size=16, color=INK, anchor="l"):
    c.setFont(font, size)
    c.setFillColor(color)
    {"l": c.drawString, "c": c.drawCentredString, "r": c.drawRightString}[anchor](x, y, s)


def para(c, html, x, top, w, size=18, leading=None, color=INK, font="Sans", align=0, draw=True):
    """Akapit z <b>…</b> i <br/>; `top` to odległość od góry slajdu. Zwraca wysokość."""
    html = re.sub(r"(?:(?<=\s)|^)([zwioauZWIOAU]) (?=\S)", "\\1\u00a0", html)  # polska typografia: bez jednoliterowych spójników na końcu wiersza
    style = ParagraphStyle("p", fontName=font, fontSize=size, leading=leading or size * 1.38, textColor=color, alignment=align)
    p = Paragraph(html, style)
    _, ph = p.wrap(w, 10_000)
    if draw:
        p.drawOn(c, x, H - top - ph)
    return ph


def pill(c, label, x, top, fill, color=white, size=13, font="Sans-Bold", padx=14, h=30, stroke=None):
    w = pdfmetrics.stringWidth(label, font, size) + 2 * padx
    rrect(c, x, H - top - h, w, h, h / 2, fill=fill, stroke=stroke)
    text(c, label, x + padx, H - top - h / 2 - size * 0.34, font, size, color)
    return w


def eyebrow(c, label, x, top, color=PINK):
    c.setFillColor(color)
    c.roundRect(x, H - top - 4, 28, 4, 2, stroke=0, fill=1)
    text(c, label, x + 40, H - top - 5, "Sans-Bold", 14, color)


def picture(c, path, x, top, w=None, h=None, r=22, border=True, ay=0.0):
    """Zrzut w zaokrąglonej ramce w oryginalnych proporcjach: podaj `w` albo `h`, drugi wymiar się wylicza. Zwraca (w, h)."""
    iw, ih = Image.open(path).size
    w, h = (w, w * ih / iw) if w else (h * iw / ih, h)
    y = H - top - h
    card(c, x, y, w, h, r=r)
    c.saveState()
    p = c.beginPath()
    p.roundRect(x, y, w, h, r)
    c.clipPath(p, stroke=0, fill=0)
    c.drawImage(str(path), x, y, w, h, mask="auto")
    c.restoreState()
    if border:
        rrect(c, x, y, w, h, r, stroke=alpha(PLUM, 0.14), lw=1.5)
    return w, h


def screen(c, path, x, y, w, h, r=30, ay=0.0):
    """Zrzut ekranu telefonu przycięty do ramki (cover), używany tylko w makiecie telefonu."""
    im = Image.open(path).convert("RGB")
    iw, ih = im.size
    nh = int(iw * h / w)
    im = im.crop((0, int((ih - nh) * ay), iw, int((ih - nh) * ay) + nh))
    out = CACHE / f"{Path(path).stem}-screen.png"
    im.save(out)
    c.saveState()
    p = c.beginPath()
    p.roundRect(x, y, w, h, r)
    c.clipPath(p, stroke=0, fill=0)
    c.drawImage(str(out), x, y, w, h)
    c.restoreState()


def phone(c, path, cx, cy, w, rot=0, ay=0.0):
    """Zrzut ekranu w ramce telefonu; (cx, cy) = środek, `rot` w stopniach."""
    inner_h = w / 0.462
    bez = 9
    c.saveState()
    c.translate(cx, cy)
    c.rotate(rot)
    x, y = -w / 2 - bez, -inner_h / 2 - bez
    shadow(c, x, y, w + 2 * bez, inner_h + 2 * bez, 38, spread=44, strength=0.5, dy=18)
    rrect(c, x, y, w + 2 * bez, inner_h + 2 * bez, 38, fill=HexColor("#1B1124"))
    screen(c, path, -w / 2, -inner_h / 2, w, inner_h, r=30, ay=ay)
    rrect(c, -22, inner_h / 2 - 16, 44, 9, 4.5, fill=HexColor("#1B1124"))
    c.restoreState()


def logo_badge(c, x, top, h=84, pad=14):
    im = Image.open(ASSETS / "logo.png")
    w = h * im.width / im.height
    card(c, x, H - top - h - 2 * pad, w + 2 * pad, h + 2 * pad, 22, lift=True)
    c.drawImage(str(ASSETS / "logo.png"), x + pad, H - top - h - pad, w, h, mask="auto")
    return w + 2 * pad


# ---------- ikony (wektorowe, w kółku) ----------
def map_pin(c, x, y, color, r=10):
    """Pinezka z czubkiem w punkcie (x, y)."""
    c.setFillColor(color)
    p = c.beginPath()
    p.moveTo(x, y)
    p.lineTo(x - r * 0.86, y + r * 1.55)
    p.lineTo(x + r * 0.86, y + r * 1.55)
    p.close()
    c.drawPath(p, stroke=0, fill=1)
    c.circle(x, y + r * 2.2, r, stroke=0, fill=1)
    c.setFillColor(white)
    c.circle(x, y + r * 2.2, r * 0.4, stroke=0, fill=1)


def range_diagram(c, x, top, w, h):
    """Schemat kółka interakcji 50 m: gracz w środku, punkt w kółku (można działać) i punkt poza nim (trzeba podejść)."""
    y = Y(top, h)
    gradient(c, x, y, w, h, PLUM, PLUM_DK, "d", r=26)
    c.saveState()
    clip = c.beginPath()
    clip.roundRect(x, y, w, h, 26)
    c.clipPath(clip, stroke=0, fill=0)
    c.setStrokeColor(alpha(white, 0.07))
    c.setLineWidth(1)
    for gx in range(int(x), int(x + w), 32):
        c.line(gx, y, gx, y + h)
    for gy in range(int(y), int(y + h), 32):
        c.line(x, gy, x + w, gy)
    c.restoreState()

    cx, cy, r = x + 132, y + h / 2, 90
    c.setFillColor(alpha(PINK, 0.22))
    c.circle(cx, cy, r, stroke=0, fill=1)
    c.setStrokeColor(PINK)
    c.setLineWidth(2.5)
    c.setDash(7, 5)
    c.circle(cx, cy, r, stroke=1, fill=0)
    c.setDash()
    c.setStrokeColor(white)
    c.setLineWidth(1.8)
    c.line(cx + 12, cy, cx + r, cy)
    c.line(cx + r, cy - 5, cx + r, cy + 5)
    text(c, "50 m", cx + r / 2 + 6, cy + 8, "Sans-ExtraBold", 14, white, "c")
    map_pin(c, cx - 38, cy + 14, PINK)
    map_pin(c, x + 48, y + 30, alpha(LAV, 0.65))
    c.setFillColor(alpha(white, 0.25))
    c.circle(cx, cy, 17, stroke=0, fill=1)
    c.setFillColor(white)
    c.circle(cx, cy, 9, stroke=0, fill=1)
    c.setFillColor(INDIGO)
    c.circle(cx, cy, 5, stroke=0, fill=1)

    tx = x + 262
    para(c, "Musisz być na miejscu", tx, top + 34, w - 262 - 22, size=17, color=white, font="Sans-Bold", leading=22)
    para(c, "Głos, ankieta i walka działają tylko w kółku 50 m wokół punktu. Serwer sprawdza też dokładność GPS i tempo ruchu.", tx, top + 66, w - 262 - 22, size=13, color=LAV, leading=18)
    map_pin(c, tx + 7, Y(top + 188), PINK, r=7)
    text(c, "w kółku: możesz działać", tx + 24, Y(top + 188) + 6, "Sans-Medium", 12.5, white)
    map_pin(c, tx + 7, Y(top + 218), alpha(LAV, 0.65), r=7)
    text(c, "poza kółkiem: podejdź bliżej", tx + 24, Y(top + 218) + 6, "Sans-Medium", 12.5, LAV)


def icon(c, kind, cx, cy, size=46, bg=PINK, fg=white):
    c.setFillColor(bg)
    c.circle(cx, cy, size / 2, stroke=0, fill=1)
    s = size / 46
    c.saveState()
    c.translate(cx, cy)
    c.scale(s, s)
    c.setStrokeColor(fg)
    c.setFillColor(fg)
    c.setLineWidth(3)
    c.setLineCap(1)
    c.setLineJoin(1)
    if kind == "pin":
        p = c.beginPath()
        p.moveTo(0, -12)
        p.curveTo(-12, 2, -10, 12, 0, 12)
        p.curveTo(10, 12, 12, 2, 0, -12)
        c.drawPath(p, stroke=1, fill=0)
        c.circle(0, 5, 3.4, stroke=0, fill=1)
    elif kind == "check":
        p = c.beginPath()
        p.moveTo(-9, 0)
        p.lineTo(-3, -7)
        p.lineTo(10, 8)
        c.drawPath(p, stroke=1, fill=0)
    elif kind == "chat":
        c.roundRect(-12, -7, 24, 17, 6, stroke=1, fill=0)
        p = c.beginPath()
        p.moveTo(-5, -7)
        p.lineTo(-8, -13)
        p.lineTo(1, -7)
        c.drawPath(p, stroke=1, fill=0)
    elif kind == "star":
        p = c.beginPath()
        for i in range(10):
            r = 13 if i % 2 == 0 else 5.5
            a = math.pi / 2 + i * math.pi / 5
            (p.moveTo if i == 0 else p.lineTo)(r * math.cos(a), r * math.sin(a) - 1)
        p.close()
        c.drawPath(p, stroke=0, fill=1)
    elif kind == "bolt":
        p = c.beginPath()
        for i, (px, py) in enumerate([(3, 13), (-9, -1), (-1, -1), (-4, -13), (9, 2), (1, 2)]):
            (p.moveTo if i == 0 else p.lineTo)(px, py)
        p.close()
        c.drawPath(p, stroke=0, fill=1)
    elif kind == "up":
        p = c.beginPath()
        p.moveTo(-10, -6)
        p.lineTo(0, 6)
        p.lineTo(10, -6)
        c.drawPath(p, stroke=1, fill=0)
        c.line(-10, 8, 10, 8)
    elif kind == "people":
        c.circle(-6, 5, 4.5, stroke=1, fill=0)
        c.circle(8, 6, 3.6, stroke=1, fill=0)
        p = c.beginPath()
        p.moveTo(-14, -10)
        p.curveTo(-14, -2, 2, -2, 2, -10)
        c.drawPath(p, stroke=1, fill=0)
        p = c.beginPath()
        p.moveTo(5, -8)
        p.curveTo(5, -3, 14, -3, 14, -8)
        c.drawPath(p, stroke=1, fill=0)
    elif kind == "shield":
        p = c.beginPath()
        p.moveTo(0, 13)
        p.lineTo(-11, 8)
        p.curveTo(-11, -6, -5, -11, 0, -14)
        p.curveTo(5, -11, 11, -6, 11, 8)
        p.close()
        c.drawPath(p, stroke=1, fill=0)
    elif kind == "clock":
        c.circle(0, 0, 11, stroke=1, fill=0)
        c.line(0, 0, 0, 7)
        c.line(0, 0, 6, -3)
    elif kind == "bulb":
        c.circle(0, 3, 8, stroke=1, fill=0)
        c.line(-4, -9, 4, -9)
        c.line(-3, -13, 3, -13)
    elif kind == "spark":
        for scale, ox, oy in ((1.0, -3, -3), (0.5, 9, 9)):
            p = c.beginPath()
            pts = [(0, 13), (3.4, 3.4), (13, 0), (3.4, -3.4), (0, -13), (-3.4, -3.4), (-13, 0), (-3.4, 3.4)]
            for i, (px, py) in enumerate(pts):
                (p.moveTo if i == 0 else p.lineTo)(ox + px * scale, oy + py * scale)
            p.close()
            c.drawPath(p, stroke=0, fill=1)
    elif kind == "flag":
        c.line(-8, -13, -8, 13)
        p = c.beginPath()
        p.moveTo(-8, 12)
        p.lineTo(10, 8)
        p.lineTo(-8, 2)
        p.close()
        c.drawPath(p, stroke=0, fill=1)
    c.restoreState()


# ---------- chrome slajdu ----------
def chrome(c, n, dark=False):
    col = alpha(white, 0.6) if dark else alpha(PLUM, 0.55)
    text(c, "Smart City Go!  ·  HackYeah 2026", 60, 34, "Sans-SemiBold", 12, col)
    text(c, f"{n:02d} / 10", W - 60, 34, "Sans-SemiBold", 12, col, "r")


def bg_light(c, tint=MIST):
    c.setFillColor(tint)
    c.rect(0, 0, W, H, stroke=0, fill=1)


def heading(c, s, x, top, w, size=42, color=INK, leading=None):
    return para(c, s, x, top, w, size=size, leading=leading or size * 1.14, color=color, font="Sans-ExtraBold")


# ---------- slajdy ----------
def Y(top, h=0):
    """Dolna krawędź obiektu o górnej krawędzi `top` (liczonej od góry slajdu) i wysokości `h`."""
    return H - top - h


def slide1(c):
    # tło: nocne miasto z draftu zatopione w fiolecie (najciemniej po lewej, pod tekstem)
    city = Image.open(ASSETS / "city-bg.jpg").convert("RGB").resize((1600, 900))
    plum = Image.new("RGB", city.size, (46, 29, 56))
    mask = Image.linear_gradient("L").rotate(90, expand=True).resize(city.size).point(lambda v: int(60 + v * 0.62))
    Image.composite(plum, city, mask).save(CACHE / "title-bg.jpg", quality=88)
    c.drawImage(str(CACHE / "title-bg.jpg"), 0, 0, W, H)
    blob(c, 1040, 330, 330, INDIGO, 0.22)
    blob(c, 1180, 600, 160, PINK, 0.25)

    logo_badge(c, 60, 52, h=70)
    pill(c, "HACKYEAH 2026  ·  SMART CITY", 60, 196, alpha(white, 0.12), LAV, 13, stroke=alpha(white, 0.25))
    heading(c, "Kiedy ostatnio byłeś/aś na konsultacjach społecznych?", 60, 250, 700, size=56, color=white, leading=64)
    para(c, "Smart City Go! zamienia partycypację społeczną w grę, w którą nastolatki chcą grać. Spacer po mieście, który naprawdę zmienia dzielnicę.",
         60, 478, 600, size=22, color=LAV, leading=31)
    x = 60
    for label, col in (("Gen Alpha  …i nie tylko", PINK), ("Pokémon Go dla Twojego miasta", INDIGO)):
        x += pill(c, label, x, 610, col, white, 14, h=34, padx=16) + 10
    phone(c, ASSETS / "map-phone.png", 1010, 250, 265, rot=-6)


def slide2(c):
    bg_light(c)
    blob(c, 1180, 640, 260, LAV, 0.35)
    blob(c, -20, 60, 190, PINK, 0.10)
    eyebrow(c, "PROBLEM", 60, 62)
    heading(c, "Liczy się głos mieszkańców. Młodych prawie nie słychać.", 60, 100, 860, size=40, leading=46)

    gradient(c, 60, Y(232, 324), 300, 324, PLUM, PLUM_DK, "d", r=28)
    text(c, "~80%", 86, Y(232) - 140, "Sans-ExtraBold", 80, PINK)
    para(c, "osób w wieku <b>12–17 lat</b> nie chce angażować się społecznie¹", 88, 392, 244, size=21, color=white, leading=29)

    items = [("pin", "Inicjatywy nie docierają", "Pomysły miasta nie trafiają do osób, których dotyczą.", PINK),
             ("chat", "Konsultacje są nudne", "Mieszkańcy nie mają okazji (lub chęci), by wyrazić opinię.", INDIGO),
             ("people", "Oferta NGO ginie", "Organizacje mają co zaproponować, ale młodzi o tym nie słyszą.", INDIGO),
             ("clock", "Brakuje miejsc po szkole", "Miasta skupiały się na starszych, a młodzi uciekają w świat wirtualny.", PINK)]
    cw, ch = 408, 120
    for i, (kind, title, body, col) in enumerate(items):
        x, top = 388 + (i % 2) * (cw + 16), 232 + (i // 2) * (ch + 16)
        card(c, x, Y(top, ch), cw, ch, r=22)
        icon(c, kind, x + 14 + 28, Y(top + 38), 48, bg=col)
        text(c, title, x + 84, Y(top + 40), "Sans-Bold", 17.5, INK)
        para(c, body, x + 84, top + 50, cw - 104, size=14.5, color=MUTED, leading=20)
    rrect(c, 388, Y(504, 52), 832, 52, 26, fill=PINK)
    text(c, "A gdyby w te tematy wprowadzić elementy gry?", 804, Y(504 + 33), "Sans-ExtraBold", 20, white, "c")
    para(c, "¹ Na podstawie: Prawa dziecka w Polsce 2024, UNICEF Polska (IBRiS), październik–listopad 2024. Tylko ok. 20% osób w wieku 12–17 lat chce angażować się społecznie.", 60, 636, 900, size=11.5, color=MUTED)
    chrome(c, 2)


def slide3(c):
    gradient(c, 0, 0, W, H, INDIGO, PLUM, "d")
    blob(c, 1100, 120, 300, PINK, 0.20)
    blob(c, 80, 700, 240, white, 0.06)
    eyebrow(c, "ROZWIĄZANIE", 60, 62, LAV)
    heading(c, "Zwiedzaj swoje miasto i miej wpływ na jego rozwój", 60, 100, 580, size=46, color=white, leading=52)
    para(c, "<b>Smart City Go!</b> to aplikacja do partycypacji społecznej nastolatków, inspirowana grą Pokémon Go. "
            "Chodzisz po swojej okolicy, bierzesz udział w wyzwaniach, a Twój głos naprawdę się liczy.", 60, 285, 570, size=21, color=white, leading=30)
    cards = [("people", "Dla Gen Alpha", "…i nie tylko. Formuła, która sprawdzi się u każdego, kto chce mieć wpływ na okolicę."),
             ("pin", "Gra w prawdziwym mieście", "Zbierasz Spryciaki, postacie z miejskich obiektów, i walczysz o lepszą okolicę.")]
    for i, (k, t, b) in enumerate(cards):
        x, top = 60 + i * 296, 430
        rrect(c, x, Y(top, 180), 276, 180, 22, fill=alpha(white, 0.14), stroke=alpha(white, 0.28))
        icon(c, k, x + 40, Y(top + 42), 44, bg=PINK)
        text(c, t, x + 20, Y(top + 104), "Sans-Bold", 18.5, white)
        para(c, b, x + 20, top + 116, 238, size=14.5, color=LAV, leading=19.5)
    w, h = picture(c, ASSETS / "map-desktop.png", 660, 182, w=560, r=26)
    pill(c, "Mapa 3D z punktami spraw miejskich", 686, 166, PLUM, white, 13)
    pwa = "Działa jako aplikacja w telefonie (progressive web app)"
    pill(c, pwa, 1220 - 16 - pdfmetrics.stringWidth(pwa, "Sans-Bold", 13) - 28, 182 + h - 18, PINK, white, 13)
    chrome(c, 3, dark=True)


def route(c, pts, width=16):
    """Wijąca się droga przez punkty (krzywa Catmull-Rom): jasna jezdnia z przerywaną linią środkową i cieniem."""
    segs = []
    ext = [pts[0]] + pts + [pts[-1]]
    for i in range(1, len(ext) - 2):
        p0, p1, p2, p3 = ext[i - 1], ext[i], ext[i + 1], ext[i + 2]
        c1 = (p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6)
        c2 = (p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6)
        segs.append((c1, c2, p2))

    def stroke(color, lw, dash=None, dy=0):
        path = c.beginPath()
        path.moveTo(pts[0][0], Y(pts[0][1]) - dy)
        for c1, c2, p2 in segs:
            path.curveTo(c1[0], Y(c1[1]) - dy, c2[0], Y(c2[1]) - dy, p2[0], Y(p2[1]) - dy)
        c.setStrokeColor(color)
        c.setLineWidth(lw)
        c.setLineCap(1)
        c.setDash(*dash) if dash else c.setDash()
        c.drawPath(path, stroke=1, fill=0)

    stroke(alpha(PLUM, 0.10), width + 6, dy=6)
    stroke(LAV, width)
    stroke(white, 2.6, (9, 9))
    c.setDash()


def trimmed(path):
    """Model przycięty do widocznej zawartości (modele mają różne proporcje, a w kafelku mają wypełniać miejsce)."""
    im = Image.open(path).convert("RGBA")
    out = CACHE / f"{Path(path).stem}-trim.png"
    im.crop(im.getbbox()).save(out)
    return out


def spryciak_tile(c, x, top, w, h, code, name, kind):
    card(c, x, Y(top, h), w, h, r=18, fill=white, lift=False)
    rrect(c, x, Y(top, h), w, h, 18, stroke=alpha(PLUM, 0.10))
    box = w - 24
    img = trimmed(ASSETS / "spryciaki" / f"{code}.png")
    iw, ih = Image.open(img).size
    area = h - 56  # wysokość strefy modelu nad podpisem
    k = min(box / iw, area / ih)
    c.drawImage(str(img), x + (w - iw * k) / 2, Y(top + 10 + (area + ih * k) / 2), iw * k, ih * k, mask="auto")
    size = 11.5
    while pdfmetrics.stringWidth(name, "Sans-Bold", size) > w - 12:
        size -= 0.25
    text(c, name, x + w / 2, Y(top + h - 30), "Sans-Bold", size, INK, "c")
    text(c, kind, x + w / 2, Y(top + h - 15), "Sans-Medium", 10, MUTED, "c")


def gallery(c, top, h):
    """Panel z galerią Spryciaków (modele 3D wyrenderowane przez render_spryciaki.py)."""
    px, pw = 60, 1160
    rrect(c, px, Y(top, h), pw, h, 26, fill=MIST)
    text(c, "Galeria Spryciaków", px + 24, Y(top + 32), "Sans-Bold", 17, PLUM)
    text(c, "Kolejne gatunki dostajesz za udział i za wygrane walki", px + pw - 24, Y(top + 32), "Sans-Medium", 13, MUTED, "r")
    tiles = [("bicycle", "Rower", "Transport"), ("tree", "Drzewo", "Zieleń"), ("fire_hydrant", "Hydrant", "Infrastruktura"),
             ("bench", "Ławka", "Infrastruktura"), ("cone", "Pachołek", "Infrastruktura"), ("potted_tree", "Drzewko w donicy", "Zieleń"),
             ("billboard", "Billboard", "Energia"), ("trash_can", "Kosz na śmieci", "Czystość"), ("floor_hole", "Dziura w chodniku", "Infrastruktura")]
    tw, gap, th = 102, 12, h - 60
    for i, (code, name, kind) in enumerate(tiles):
        spryciak_tile(c, px + 16 + i * (tw + gap), top + 46, tw, th, code, name, kind)
    x = px + 16 + 9 * (tw + gap)
    c.setStrokeColor(PINK)
    c.setLineWidth(1.6)
    c.setDash(5, 4)
    c.roundRect(x, Y(top + 46, th), tw, th, 18, stroke=1, fill=0)
    c.setDash()
    text(c, "+14", x + tw / 2, Y(top + 46 + th / 2), "Sans-ExtraBold", 28, PINK, "c")
    para(c, "kolejnych, w tym rzadkie z wydarzeń", x + 8, top + 46 + th / 2 + 10, tw - 16, size=10.5, color=MUTED, leading=13, align=1)


def duel(c, top, spryciak, enemy, kind, enemy_name, spryciak_name):
    """Pojedynek: Spryciak kontra Miejski Problem tego samego typu (dostaje bonus do mocy)."""
    x, w, h = 640, 580, 150
    card(c, x, Y(top, h), w, h, r=24)
    sx, ex = x + 120, x + w - 120
    c.drawImage(str(trimmed(ASSETS / "spryciaki" / f"{spryciak}.png")), sx - 48, Y(top + 20, 88), 96, 88, mask="auto", preserveAspectRatio=True, anchor="c")
    c.saveState()  # różowa poświata wyróżnia przeciwnika (jak różowa obwódka znacznika wroga w aplikacji)
    c.setFillColor(alpha(PINK, 0.16))
    c.circle(ex, Y(top + 56), 56, stroke=0, fill=1)
    c.restoreState()
    c.drawImage(str(trimmed(ASSETS / "enemies" / f"{enemy}.png")), ex - 46, Y(top + 56) - 35, 92, 70, mask="auto", preserveAspectRatio=True, anchor="c")
    text(c, spryciak_name, sx, Y(top + 122), "Sans-Bold", 15, INK, "c")
    text(c, enemy_name, ex, Y(top + 122), "Sans-Bold", 15, INK, "c")
    c.setFillColor(PINK)
    c.circle(x + w / 2, Y(top + 56), 24, stroke=0, fill=1)
    text(c, "VS", x + w / 2, Y(top + 56) - 5.5, "Sans-ExtraBold", 15, white, "c")
    pill(c, kind, x + w / 2 - (pdfmetrics.stringWidth(kind, "Sans-SemiBold", 11.5) + 24) / 2, top + 100, MIST, PLUM, 11.5, "Sans-SemiBold", h=26, padx=12)


def slide4(c):
    bg_light(c)
    blob(c, 1180, 40, 220, LAV, 0.5)
    blob(c, -40, 420, 160, PINK, 0.08)
    eyebrow(c, "ŚWIAT GRY", 60, 62)
    heading(c, "W mieście zalęgły się Miejskie Problemy. Pomogą Ci Spryciaki.", 60, 96, 560, size=32, leading=38)
    para(c, "Korki, śmieci, smog i beton przybrały w grze postać potworów, które zalęgają się w prawdziwych miejscach. "
            "Walka z nimi to <b>grywalizacja</b>: partycypacja pozwala Ci zbierać Spryciaki i podnosić ich poziomy, a silniejsze Spryciaki pokonują kolejne problemy.",
         60, 190, 560, size=15, color=MUTED, leading=22)
    # definicja
    card(c, 60, Y(318, 130), 560, 130, r=24)
    c.drawImage(str(trimmed(ASSETS / "spryciaki" / "bicycle.png")), 76, Y(318 + 20, 90), 100, 90, mask="auto", preserveAspectRatio=True, anchor="c")
    text(c, "Spryciak", 196, Y(318 + 36), "Sans-ExtraBold", 21, PINK)
    para(c, "Kolekcjonerska postać oparta na elemencie miasta, np. rowerze albo hydrancie. Ma typ, moc i poziom, a rośnie, gdy angażujesz się w sprawy miasta.",
         196, 318 + 48, 400, size=13.5, color=INK, leading=19)
    # pojedynki
    text(c, "Dopasuj Spryciaka do problemu", 640, Y(110), "Sans-Bold", 16, PLUM)
    duel(c, 124, "bicycle", "traffic_jam", "bonus typu", "Korek Komunikacyjny", "Rower")
    duel(c, 288, "trash_can", "trash_beast", "bonus typu", "Śmieciowy Potwór", "Kosz na śmieci")
    gallery(c, 460, 196)
    chrome(c, 4)


def slide5(c):
    bg_light(c, white)
    blob(c, 1250, 700, 250, LAV, 0.35)
    blob(c, -40, 160, 150, PINK, 0.08)
    eyebrow(c, "JAK TO DZIAŁA", 60, 62)
    heading(c, "Od chodnika do wpływu w pięciu krokach", 60, 98, 1000, size=38)

    low, high = 340, 276
    nodes = [(150, low), (380, high), (610, low), (840, high), (1070, low)]
    route(c, [(66, 306)] + nodes + [(1196, 310)])
    c.setFillColor(alpha(INDIGO, 0.25))
    c.circle(66, Y(306), 17, stroke=0, fill=1)
    c.setFillColor(white)
    c.circle(66, Y(306), 10, stroke=0, fill=1)
    c.setFillColor(INDIGO)
    c.circle(66, Y(306), 6, stroke=0, fill=1)
    map_pin(c, 1196, Y(310), PINK, r=11)

    steps = [("pin", "Idź na miejsce", "Punkt na mapie to realna sprawa w Twojej okolicy."),
             ("chat", "Weź udział", "Zagłosuj, skomentuj albo wypełnij ankietę."),
             ("star", "Zdobądź Spryciaka", "Za udział dostajesz kolekcjonerską postać."),
             ("bolt", "Walcz z problemami", "Miejskie Problemy czekają na Twoje Spryciaki."),
             ("up", "Awansuj", "Exp i poziomy rosną razem z Twoim wpływem.")]
    for i, ((nx, ny), (kind, title, body)) in enumerate(zip(nodes, steps)):
        col = PINK if i % 2 == 0 else INDIGO
        shadow(c, nx - 34, Y(ny, 0) - 34, 68, 68, 34, spread=16, strength=0.35, dy=6)
        c.setFillColor(white)
        c.circle(nx, Y(ny), 35, stroke=0, fill=1)
        icon(c, kind, nx, Y(ny), 60, bg=col)
        c.setFillColor(PLUM)
        c.circle(nx + 27, Y(ny - 27), 13, stroke=0, fill=1)
        text(c, str(i + 1), nx + 27, Y(ny - 27) - 4.5, "Sans-ExtraBold", 13, white, "c")
        above = ny == high
        ttop = ny - 38 - 62 if above else ny + 46
        text(c, title, nx, Y(ttop + 16), "Sans-Bold", 16.5, INK, "c")
        para(c, body, nx - 100, ttop + 24, 200, size=13, color=MUTED, leading=17.5, align=1)

    # przykład z gry (dane demo: skwer przy ul. Lema, ankieta fundacji, nagroda: Drzewo)
    top, h = 484, 150
    gradient(c, 60, Y(top, h), 1160, h, PLUM, PLUM_DK, "h", r=28)
    c.drawImage(str(trimmed(ASSETS / "spryciaki" / "tree.png")), 88, Y(top + 22, 106), 110, 106, mask="auto", preserveAspectRatio=True, anchor="c")
    pill(c, "PRZYKŁAD Z GRY", 236, top + 26, PINK, white, 11.5, h=26, padx=12)
    para(c, "Zosia wchodzi na skwer przy ulicy Lema, głosuje za szpalerem lip i wypełnia ankietę fundacji. "
            "W nagrodę dostaje Spryciaka drzewa, który będzie zdobywać exp przy jej kolejnych głosach i walkach.",
         236, top + 64, 900, size=16.5, color=white, leading=24)
    chrome(c, 5)


def slide6(c):
    bg_light(c)
    blob(c, 1150, 100, 280, LAV, 0.5)
    eyebrow(c, "KONSULTACJE I NGO", 60, 62)
    heading(c, "Konsultacje, które chce się wypełnić", 60, 100, 640, size=42, leading=47)
    para(c, "Inicjatywy NGO i konsultacje miasta pojawiają się na mapie jak każdy inny punkt, z opisem, organizatorem i osią czasu zmian.",
         60, 218, 650, size=17, color=MUTED, leading=24)
    pts = [("chat", "Podejdź, żeby zagłosować", "Dopiero na miejscu możesz poprzeć, sprzeciwić się i skomentować."),
           ("star", "Ankieta z niespodzianką", "Po wysłaniu odpowiedzi odkrywasz nowego Spryciaka.")]
    for i, (k, t, b) in enumerate(pts):
        top = 300 + i * 82
        icon(c, k, 84, Y(top + 28), 44, bg=PINK if i == 0 else INDIGO)
        text(c, t, 124, Y(top + 22), "Sans-Bold", 19, INK)
        para(c, b, 124, top + 32, 560, size=15.5, color=MUTED, leading=21)
    # droga zaufanej organizacji (rola z draftu: NGO, urząd dzielnicy/gminy, starostwo)
    text(c, "Konto zaufanej organizacji: NGO, urząd dzielnicy lub gminy, starostwo", 60, Y(484), "Sans-Bold", 14.5, PLUM)
    chain = ["Organizacja zakłada konto", "Administrator IT je weryfikuje", "Publikuje inicjatywy i ankiety", "Mieszkańcy widzą znaczek zaufania"]
    bw, gap = 150, 26
    for i, lab in enumerate(chain):
        x = 60 + i * (bw + gap)
        card(c, x, Y(504, 104), bw, 104, r=18)
        text(c, str(i + 1), x + 16, Y(504 + 34), "Sans-ExtraBold", 20, PINK if i % 2 == 0 else INDIGO)
        para(c, lab, x + 16, 504 + 44, bw - 28, size=13.5, font="Sans-SemiBold", color=INK, leading=17.5)
        if i < 3:
            c.setFillColor(PINK)
            p = c.beginPath()
            ax, ay = x + bw + 7, Y(504 + 52)
            p.moveTo(ax, ay + 6)
            p.lineTo(ax + 11, ay)
            p.lineTo(ax, ay - 6)
            p.close()
            c.drawPath(p, stroke=0, fill=1)
    picture(c, ASSETS / "ngo-card.png", 772, 96, h=540, r=28)
    pill(c, "Inicjatywa NGO w aplikacji", 788, 80, PINK, white, 13)
    chrome(c, 6)


def slide7(c):
    bg_light(c, white)
    blob(c, -30, 640, 220, LAV, 0.45)
    eyebrow(c, "INICJATYWY MIESZKAŃCA", 60, 62)
    picture(c, ASSETS / "place-card.png", 60, 130, w=520, r=26)
    heading(c, "Zgłoś to, co widzisz w swoim mieście", 640, 96, 580, size=36, leading=41)
    para(c, "Możesz zgłosić <b>problem miejski</b> (np. dziurę w chodniku), <b>ciekawe miejsce</b> (np. kawiarnię dla Gen Z) "
            "albo <b>pomysł na zmianę</b> (np. uruchomienie buspasu).", 640, 190, 580, size=17, color=INK, leading=25)
    text(c, "Droga zgłoszenia", 640, Y(298), "Sans-Bold", 14.5, PLUM)
    flow = ["Zgłaszasz", "Moderator AI", "Inni oceniają na miejscu", "Level up Spryciaka"]
    x = 640
    for i, lab in enumerate(flow):
        x += pill(c, lab, x, 312, PINK if i == 3 else INDIGO if i == 1 else PLUM, white, 13.5, "Sans-SemiBold", h=36, padx=12)
        if i < 3:
            text(c, "›", x + 7, Y(312 + 26), "Sans-Bold", 20, PINK, "c")
            x += 14
    para(c, "Gdy zgłoszenie zbierze dużo poparcia innych mieszkańców, autor leveluje Spryciaka.", 640, 360, 580, size=14, color=MUTED, leading=20)

    # moderator AI: kluczowa funkcja, więc dostaje własną, wyraźną kartę
    top, h = 404, 222
    gradient(c, 640, Y(top, h), 580, h, PLUM, PLUM_DK, "d", r=28)
    c.saveState()
    clip = c.beginPath()
    clip.roundRect(640, Y(top, h), 580, h, 28)
    c.clipPath(clip, stroke=0, fill=0)
    c.setFillColor(alpha(PINK, 0.30))
    c.circle(1190, Y(top + 20), 90, stroke=0, fill=1)
    c.restoreState()
    icon(c, "spark", 640 + 56, Y(top + 56), 60, bg=PINK)
    text(c, "Moderator AI", 640 + 104, Y(top + 66), "Sans-ExtraBold", 27, white)
    label = "KLUCZOWA FUNKCJA"
    pill(c, label, 640 + 580 - 24 - pdfmetrics.stringWidth(label, "Sans-Bold", 11.5) - 24, top + 22, white, PLUM, 11.5, h=26, padx=12)
    para(c, "<b>Każde zgłoszenie najpierw sprawdza agent AI, zanim trafi na mapę.</b>", 640 + 28, top + 104, 524, size=18, color=white, leading=25)
    para(c, "Odrzuca wulgaryzmy, spam, dane osobowe i treści niezwiązane z miastem, a także próby manipulowania samym modelem. "
            "Administrator widzi każde odrzucenie.", 640 + 28, top + 162, 524, size=13.5, color=LAV, leading=19)
    chrome(c, 7)


def slide8(c):
    bg_light(c)
    blob(c, 1180, 90, 260, PINK, 0.14)
    blob(c, 40, 680, 220, LAV, 0.5)
    eyebrow(c, "WYDARZENIA I FAJNE MIEJSCA", 60, 62)
    heading(c, "Wydarzenia dla młodych z rzadkim Spryciakiem w nagrodę", 700, 100, 520, size=34, leading=40)
    pts = [("flag", "Organizacje i samorządy zgłaszają wydarzenia", "Edukacyjne i społeczne. Nad punktem na mapie kręci się rzadki Spryciak, a opis, organizator i nagroda są widoczne zawsze."),
           ("clock", "Nagrodę odbierzesz na miejscu i w czasie trwania", "W kółku 50 m wokół punktu, w dniach i godzinach wydarzenia.")]
    y = 270
    for i, (k, t, b) in enumerate(pts):
        icon(c, k, 724, Y(y + 22), 44, bg=PINK if i == 0 else INDIGO)
        h1 = para(c, t, 764, y, 450, size=17.5, color=INK, font="Sans-Bold", leading=22)
        h2 = para(c, b, 764, y + h1 + 4, 450, size=15, color=MUTED, leading=21)
        y += h1 + h2 + 28

    # makieta karty wydarzenia (dane demo z backend/config/seed/demo.yaml)
    x0, w0, top = 70, 520, 92
    card(c, x0, Y(top, 520), w0, 520, r=30)
    gradient(c, x0, Y(top, 140), w0, 140, PINK, INDIGO, "d", r=30)
    rrect(c, x0, Y(top + 120, 20), w0, 20, 0, fill=white)
    text(c, "WYDARZENIE  ·  FUNDACJA ZIELONE MIASTO", x0 + 28, Y(top + 40), "Sans-Bold", 12.5, alpha(white, 0.85))
    text(c, "Piknik rowerowy przy Arenie", x0 + 28, Y(top + 82), "Sans-ExtraBold", 25, white)
    pill(c, "●  Trwa teraz", x0 + 28, top + 140, INDIGO, white, 12.5, h=28)
    para(c, "<b>3 dni, codziennie 8:00–22:00</b><br/>Plac przed TAURON Areną Kraków", x0 + 28, top + 186, 460, size=16, color=INK, leading=23)
    para(c, "Wspólna jazda po nowej drodze rowerowej, dmuchany tor i serwis rowerów. Zapraszamy całe rodziny.", x0 + 28, top + 246, 464, size=14.5, color=MUTED, leading=20)
    rrect(c, x0 + 28, Y(top + 312, 100), w0 - 56, 100, 20, fill=MIST)
    c.saveState()  # alfa poświaty nie może przenieść się na obraz
    c.setFillColor(alpha(HexColor("#E8B83A"), 0.28))
    c.circle(x0 + 92, Y(top + 362), 40, stroke=0, fill=1)
    c.restoreState()
    c.drawImage(str(trimmed(ASSETS / "rare" / "gold_bike.png")), x0 + 48, Y(top + 362 + 32), 88, 64, mask="auto", preserveAspectRatio=True, anchor="c")
    text(c, "NAGRODA ZA UDZIAŁ", x0 + 150, Y(top + 338), "Sans-Bold", 11.5, PINK)
    text(c, "Złoty Rower", x0 + 150, Y(top + 366), "Sans-ExtraBold", 22, INK)
    pill(c, "★ Rzadki", x0 + 150, top + 376, PINK, white, 11.5, h=24, padx=10)
    rrect(c, x0 + 28, Y(top + 436, 54), w0 - 56, 54, 27, fill=PLUM)
    text(c, "Odbierz pokemona", x0 + w0 / 2, Y(top + 436 + 34), "Sans-Bold", 17, white, "c")
    text(c, "Przykład na danych demo", x0 + w0 / 2, Y(top + 520 + 26), "Sans-Medium", 11.5, MUTED, "c")

    # okno odbioru w ciągu dnia (8:00-22:00)
    gx, gw, gtop = 700, 520, 468
    card(c, gx, Y(gtop, 170), gw, 170, r=22)
    text(c, "Kiedy można odebrać nagrodę", gx + 24, Y(gtop + 36), "Sans-Bold", 16, INK)
    bx, bw = gx + 24, gw - 48
    rrect(c, bx, Y(gtop + 62, 26), bw, 26, 13, fill=MIST)
    rrect(c, bx + bw * 8 / 24, Y(gtop + 62, 26), bw * 14 / 24, 26, 13, fill=PINK)
    text(c, "8:00–22:00", bx + bw * 15 / 24, Y(gtop + 62 + 18), "Sans-Bold", 13, white, "c")
    for hour in (0, 8, 16, 24):
        text(c, f"{hour}:00", bx + bw * hour / 24, Y(gtop + 112), "Sans-Medium", 11.5, MUTED, "l" if hour == 0 else "r" if hour == 24 else "c")
    text(c, "Ta sama pora codziennie, przez 3 dni trwania wydarzenia.", gx + 24, Y(gtop + 144), "Sans", 13, MUTED)
    chrome(c, 8)


def slide9(c):
    bg_light(c, white)
    blob(c, 1240, 40, 230, LAV, 0.45)
    blob(c, -40, 700, 200, PINK, 0.10)
    eyebrow(c, "DLACZEGO WARTO", 60, 62)
    heading(c, "Dlaczego Smart City Go! jest warte Twojej uwagi", 60, 100, 520, size=40, leading=47)
    para(c, "Gra, w którą młodzi chcą grać, oddaje miastu to, czego najbardziej mu brakuje: głos pokolenia, które zwykle nie bierze udziału w konsultacjach.",
         60, 236, 500, size=17, color=MUTED, leading=25)
    range_diagram(c, 60, 336, 500, 252)
    items = [("pin", "Opinie z miejsca zdarzenia", "Głos oddasz dopiero na miejscu, a serwer sprawdza pozycję. Miasto dostaje opinie ludzi, którzy naprawdę tam byli.", PINK),
             ("bolt", "Gra, która się nie powtarza", "Każdy gracz ma własnych przeciwników, a rzadkie Spryciaki czekają na wydarzeniach organizatorów.", INDIGO),
             ("people", "Korzyść po obu stronach", "Organizacje i urzędy zbierają głosy oraz odpowiedzi z ankiet. Młodzi dostają nagrody i powód, by wyjść po szkole.", INDIGO),
             ("check", "Gotowe do pilotażu", "Działający prototyp z <b>moderatorem AI</b> oraz panelami organizatora i administratora, uruchamiany jedną komendą.", PINK)]
    cw, chh = 280, 236
    for i, (k, t, b, col) in enumerate(items):
        x, top = 640 + (i % 2) * (cw + 20), 96 + (i // 2) * (chh + 20)
        card(c, x, Y(top, chh), cw, chh, r=24, fill=MIST, lift=False)
        icon(c, k, x + 24 + 24, Y(top + 24 + 24), 48, bg=col)
        para(c, t, x + 24, top + 88, cw - 48, size=17.5, font="Sans-Bold", leading=22)
        para(c, b, x + 24, top + 124, cw - 48, size=13.8, color=MUTED, leading=19.5)
    chrome(c, 9)


def slide10(c):
    gradient(c, 0, 0, W, H, PLUM, INDIGO, "d")
    blob(c, 1150, 640, 320, PINK, 0.22)
    blob(c, 100, 90, 260, white, 0.06)
    eyebrow(c, "POZYTYWNY WPŁYW SPOŁECZNY", 60, 62, LAV)
    heading(c, "Miasto, w którym młodzi mają głos", 60, 100, 900, size=44, color=white)
    pillars = [("up", "Angażowanie młodych", "w rozwój miasta za pomocą grywalizacji."),
               ("people", "Trójstronna komunikacja", "Mieszkańcy, miasto i organizacje rozmawiają ze sobą w jednym miejscu.")]
    w = 566
    for i, (k, t, b) in enumerate(pillars):
        x, top = 60 + i * (w + 28), 210
        rrect(c, x, Y(top, 140), w, 140, 26, fill=alpha(white, 0.12), stroke=alpha(white, 0.28))
        icon(c, k, x + 52, Y(top + 52), 56, bg=PINK)
        text(c, t, x + 100, Y(top + 58), "Sans-Bold", 22, white)
        para(c, b, x + 100, top + 74, w - 130, size=16.5, color=LAV, leading=23)
    logo_badge(c, 60, 430, h=86)
    heading(c, "Każdy głos jest ważny!", 390, 442, 800, size=54, color=white)
    para(c, "Zagraj w swoje miasto.  Smart City Go!  ·  Dziękujemy!", 390, 528, 800, size=22, color=LAV)
    pill(c, "#edukacja_przez_zabawę", 390, 590, PINK, white, 15, h=36, padx=18)
    chrome(c, 10, dark=True)


def main():
    c = canvas.Canvas(str(OUT), pagesize=(W, H))
    c.setTitle("Smart City Go! HackYeah 2026")
    c.setAuthor("Zespół Smart City Go!")
    c.setSubject("Prezentacja finalna: partycypacja społeczna nastolatków w formie gry")
    for fn in (slide1, slide2, slide3, slide4, slide5, slide6, slide7, slide8, slide9, slide10):
        fn(c)
        c.showPage()
    c.save()
    print(f"Zapisano {OUT} ({OUT.stat().st_size / 1e6:.1f} MB)")


if __name__ == "__main__":
    main()
