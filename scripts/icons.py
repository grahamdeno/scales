#!/usr/bin/env python3
"""Scales 2.2 icons: the beam and point, in the app's three colours. Run from the repo root.

Three designs, each ground, beam and point a different one of the colours:
  Pistachio: pistachio ground, ink beam, bone point       (the main icon in Light mode)
  Plum:      plum ground, bone beam, pistachio point      (the main icon in Dark mode)
  Bone:      bone ground, plum beam, pistachio point
The main icon (Automatic) follows the Home Screen: Pistachio in Light, Plum in Dark, grey in Tinted.
Writes the iPhone icons (Icon Composer .icon and asset-catalog 1024 px fallbacks), the web app icons and the website icons.
"""
import json, os, shutil
from PIL import Image

A = "ios/App/AppIcon.icon/Assets/"
BEAM = Image.open(A + "beam.png").copy(); POINT = Image.open(A + "point.png").copy()
PIST, INK, PLUM, BONE = "#B9C9A3", "#2A1E2E", "#3B2240", "#F1E9D8"
DESIGNS = {"Pistachio": (PIST, INK, BONE), "Plum": (PLUM, BONE, PIST), "Bone": (BONE, PLUM, PIST)}

def rgb(h): h = h.lstrip("#"); return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))
def srgb(h): return "srgb:" + ",".join("%.5f" % (c / 255) for c in rgb(h)) + ",1.00000"

def render(name, size=1024, scale=1.0):
    bg, beam, point = DESIGNS[name]
    art = Image.new("RGBA", (1024, 1024), (0, 0, 0, 0))
    art.paste(rgb(beam) + (255,), (0, 0), BEAM.split()[3]); art.paste(rgb(point) + (255,), (0, 0), POINT.split()[3])
    if scale != 1.0:  # maskable: keep the mark inside the safe circle
        s = int(1024 * scale); small = art.resize((s, s), Image.LANCZOS)
        art = Image.new("RGBA", (1024, 1024), (0, 0, 0, 0)); art.paste(small, ((1024 - s) // 2, (1024 - s) // 2))
    im = Image.new("RGBA", (1024, 1024), rgb(bg) + (255,)); im.alpha_composite(art)
    return im.convert("RGB").resize((size, size), Image.LANCZOS)

def layer(name, image, light, dark=None):
    spec = [{"value": {"solid": srgb(light)}}]
    if dark: spec.append({"appearance": "dark", "value": {"solid": srgb(dark)}})
    spec.append({"appearance": "tinted", "value": {"solid": "srgb:1.00000,1.00000,1.00000,1.00000" if name == "Beam" else "srgb:0.62000,0.62000,0.62000,1.00000"}})
    return {"name": name, "layers": [{"image-name": image, "name": name, "glass": False, "fill-specializations": spec}],
            "shadow": {"kind": "none", "opacity": 0.5}, "specular": False, "translucency": {"enabled": False, "value": 0.5}}

def icon_json(light, dark=None):
    fill = [{"value": {"solid": srgb(DESIGNS[light][0])}}]
    if dark: fill.append({"appearance": "dark", "value": {"solid": srgb(DESIGNS[dark][0])}})
    return {"fill-specializations": fill,
            "groups": [layer("Point", "point.png", DESIGNS[light][2], dark and DESIGNS[dark][2]),
                       layer("Beam", "beam.png", DESIGNS[light][1], dark and DESIGNS[dark][1])],
            "supported-platforms": {"squares": "shared"}}

CONTENTS = {"images": [{"filename": "icon-1024.png", "idiom": "universal", "platform": "ios", "size": "1024x1024"}],
            "info": {"author": "xcode", "version": 1}}

def write_ios(asset, light, dark=None):
    d = "ios/App/%s.icon" % asset
    os.makedirs(d + "/Assets", exist_ok=True)
    BEAM.save(d + "/Assets/beam.png"); POINT.save(d + "/Assets/point.png")
    json.dump(icon_json(light, dark), open(d + "/icon.json", "w"), indent=2)
    c = "ios/App/Assets.xcassets/%s.appiconset" % asset
    os.makedirs(c, exist_ok=True)
    render(light).save(c + "/icon-1024.png"); json.dump(CONTENTS, open(c + "/Contents.json", "w"), indent=2)

for old in ("Light", "Black", "Paper", "Glass"):
    for p in ("ios/App/AppIcon-%s.icon" % old, "ios/App/Assets.xcassets/AppIcon-%s.appiconset" % old):
        if os.path.exists(p): shutil.rmtree(p)
write_ios("AppIcon", "Pistachio", "Plum")
# A fixed icon keeps its own colors in Dark too (2.6.0); without a dark look iOS darkened it itself.
for n in DESIGNS: write_ios("AppIcon-" + n, n, n)

# Web app and website: the Pistachio icon.
render("Pistachio", 180).save("icons/apple-touch-icon.png")
render("Pistachio", 32).save("icons/favicon-32.png"); render("Pistachio", 64).save("icons/favicon-64.png")
render("Pistachio", 192).save("icons/icon-192.png"); render("Pistachio", 512).save("icons/icon-512.png")
render("Pistachio", 512, 0.78).save("icons/icon-maskable-512.png")
render("Pistachio", 180).save("site/apple-touch-icon.png"); render("Pistachio", 64).save("site/favicon.png")
render("Pistachio", 512).save("site/img/icon.png")
render("Pistachio", 64).save("site/favicon.ico", sizes=[(16, 16), (32, 32), (48, 48), (64, 64)])
# Previews for Settings (the page shows which icon is on).
os.makedirs("icons/pick", exist_ok=True)
for n in DESIGNS: render(n, 120).save("icons/pick/%s.png" % n.lower())
# Automatic: Pistachio and Plum, split on the diagonal, for the choice that follows Light and Dark.
a, b = render("Pistachio", 120), render("Plum", 120)
m = Image.new("L", (120, 120), 0); m.putdata([255 if x + y > 120 else 0 for y in range(120) for x in range(120)])
a.paste(b, (0, 0), m); a.save("icons/pick/auto.png")
print("icons written")
