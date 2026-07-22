#!/usr/bin/env python3
"""
Generate iOS apple-touch-startup-image PNGs.

iOS ignores the web manifest for launch splashes and only honours
<link rel="apple-touch-startup-image" media="..."> tags pointing at a PNG that
exactly matches the device's pixel resolution. We render each one as the app's
splash gradient with the brand logo centred, so the momentary iOS launch image
blends straight into the React SplashScreen overlay that paints right after.

Run from the frontend root:  python3 scripts/gen-ios-splash.py
Outputs PNGs to public/splash/ and prints the <link> tags for AppleSplashLinks.tsx.
"""
import math
import os
import numpy as np
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
LOGO = os.path.join(ROOT, "public", "icons", "icon-512.png")
OUT = os.path.join(ROOT, "public", "splash")
os.makedirs(OUT, exist_ok=True)

# Splash gradient stops (must match .sf-splash in globals.css):
#   linear-gradient(160deg, #eef1ff 0%, #f6f0ff 45%, #ffe6f0 100%)
STOPS = [(0.0, (0xEE, 0xF1, 0xFF)), (0.45, (0xF6, 0xF0, 0xFF)), (1.0, (0xFF, 0xE6, 0xF0))]


def lerp(a, b, t):
    return tuple(round(a[i] + (b[i] - a[i]) * t) for i in range(3))


def color_at(t):
    for i in range(len(STOPS) - 1):
        t0, c0 = STOPS[i]
        t1, c1 = STOPS[i + 1]
        if t0 <= t <= t1:
            return lerp(c0, c1, (t - t0) / (t1 - t0))
    return STOPS[-1][1]


def gradient(w, h):
    """Vectorised 160deg diagonal gradient projected onto the CSS axis."""
    ang = math.radians(160)
    dx, dy = math.sin(ang), -math.cos(ang)
    xs = np.arange(w).reshape(1, w)
    ys = np.arange(h).reshape(h, 1)
    proj = xs * dx + ys * dy
    t = (proj - proj.min()) / (proj.max() - proj.min())  # (h, w) in [0,1]

    ts = np.array([s[0] for s in STOPS])
    cs = np.array([s[1] for s in STOPS], dtype=float)  # (n, 3)
    out = np.empty((h, w, 3), dtype=float)
    for ch in range(3):
        out[:, :, ch] = np.interp(t, ts, cs[:, ch])
    return Image.fromarray(out.round().astype("uint8"), "RGB")


logo_src = Image.open(LOGO).convert("RGBA")

# device pixel resolutions, media dims (css px), dpr, orientation
DEVICES = [
    ("1290x2796", 1290, 2796, 430, 932, 3, "portrait"),
    ("1179x2556", 1179, 2556, 393, 852, 3, "portrait"),
    ("1170x2532", 1170, 2532, 390, 844, 3, "portrait"),
    ("1284x2778", 1284, 2778, 428, 926, 3, "portrait"),
    ("1125x2436", 1125, 2436, 375, 812, 3, "portrait"),
    ("1242x2688", 1242, 2688, 414, 896, 3, "portrait"),
    ("828x1792", 828, 1792, 414, 896, 2, "portrait"),
    ("1242x2208", 1242, 2208, 414, 736, 3, "portrait"),
    ("750x1334", 750, 1334, 375, 667, 2, "portrait"),
    ("640x1136", 640, 1136, 320, 568, 2, "portrait"),
    # A couple of common iPads (portrait).
    ("1536x2048", 1536, 2048, 768, 1024, 2, "portrait"),
    ("1668x2388", 1668, 2388, 834, 1194, 2, "portrait"),
]

links = []
for name, w, h, cw, ch, dpr, orient in DEVICES:
    bg = gradient(w, h)
    # Logo sized to the shorter edge, with generous breathing room.
    size = round(min(w, h) * 0.30)
    logo = logo_src.resize((size, size), Image.LANCZOS)
    bg.paste(logo, ((w - size) // 2, (h - size) // 2), logo)
    fname = f"apple-splash-{name}.png"
    bg.save(os.path.join(OUT, fname), "PNG")
    media = (
        f"(device-width: {cw}px) and (device-height: {ch}px) "
        f"and (-webkit-device-pixel-ratio: {dpr}) and (orientation: {orient})"
    )
    links.append(f'      <link rel="apple-touch-startup-image" media="{media}" href="/splash/{fname}" />')
    print(f"wrote {fname}  ({w}x{h})")

print("\n--- paste into AppleSplashLinks.tsx ---")
print("\n".join(links))
