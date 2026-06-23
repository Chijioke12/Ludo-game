#!/usr/bin/env python3
"""
Full premium Ludo asset pack:
  - tokens, dice, star, home badges, arrows  (gameplay pieces)
  - board cells, colored path cells, home quadrants, center home (board)
  - play/pause/settings/sound/restart/back buttons (UI)
  - crown, trophy, confetti, win banner (win screen)
Packs everything into one PNG + matching TexturePacker-style JSON atlas.
"""

import json
import math
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

SS = 4

PLAYERS = {
    "red":    {"light": (255, 150, 140), "base": (220, 45, 55),  "dark": (120, 10, 18)},
    "green":  {"light": (165, 235, 180), "base": (35, 158, 92),  "dark": (8, 80, 42)},
    "yellow": {"light": (255, 230, 150), "base": (240, 175, 25), "dark": (150, 95, 0)},
    "blue":   {"light": (160, 195, 255), "base": (40, 105, 215), "dark": (12, 45, 120)},
}
GOLD = {"light": (255, 244, 200), "base": (235, 185, 70), "dark": (140, 95, 15)}
CREAM = {"light": (255, 255, 252), "base": (250, 244, 230), "dark": (210, 198, 175)}
UI = {"light": (150, 165, 235), "base": (78, 92, 175), "dark": (28, 32, 78)}
PURPLE = {"light": (220, 175, 255), "base": (140, 70, 200), "dark": (60, 20, 100)}

# ---------------------------------------------------------------- utilities

def lerp(a, b, t):
    return a + (b - a) * t

def radial_shaded_disc(diameter, palette, light_offset=(-0.35, -0.40)):
    d = diameter
    r = d / 2.0
    y, x = np.mgrid[0:d, 0:d].astype(np.float32)
    cx, cy = r, r
    lx, ly = cx + light_offset[0] * d, cy + light_offset[1] * d

    dist_center = np.sqrt((x - cx) ** 2 + (y - cy) ** 2)
    mask = dist_center <= (r - 0.5)

    dist_light = np.sqrt((x - lx) ** 2 + (y - ly) ** 2)
    max_d = np.sqrt((d) ** 2 + (d) ** 2) * 0.62
    t = np.clip(dist_light / max_d, 0, 1)

    light = np.array(palette["light"], dtype=np.float32)
    base = np.array(palette["base"], dtype=np.float32)
    dark = np.array(palette["dark"], dtype=np.float32)

    img = np.zeros((d, d, 4), dtype=np.float32)
    t1 = np.clip(t / 0.45, 0, 1)
    t2 = np.clip((t - 0.45) / 0.55, 0, 1)
    for c in range(3):
        seg1 = lerp(light[c], base[c], t1)
        seg2 = lerp(base[c], dark[c], t2)
        mixed = np.where(t < 0.45, seg1, seg2)
        img[:, :, c] = mixed

    img[:, :, 3] = np.where(mask, 255, 0)

    edge_t = np.clip((dist_center - (r * 0.78)) / (r * 0.22), 0, 1)
    rim_dark = dark * 0.55
    for c in range(3):
        img[:, :, c] = np.where(mask, lerp(img[:, :, c], rim_dark[c], edge_t * 0.5), img[:, :, c])

    return Image.fromarray(np.clip(img, 0, 255).astype(np.uint8), mode="RGBA")

def flat_gradient_rect(w, h, palette, light_offset=(-0.4, -0.4)):
    """Rectangular version of the shaded gradient (same math, square aspect-corrected)."""
    big = radial_shaded_disc(max(w, h) * 2, palette, light_offset)
    big = big.resize((max(w, h) * 2, max(w, h) * 2))
    left = (big.width - w) // 2
    top = (big.height - h) // 2
    return big.crop((left, top, left + w, top + h))

def add_specular(im, center_ratio=(0.32, 0.30), radius_ratio=0.22, strength=235):
    w, h = im.size
    spec = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    sd = ImageDraw.Draw(spec)
    cx, cy = w * center_ratio[0], h * center_ratio[1]
    rad = max(w, h) * radius_ratio
    sd.ellipse([cx - rad, cy - rad * 0.7, cx + rad, cy + rad * 0.7], fill=(255, 255, 255, strength))
    spec = spec.filter(ImageFilter.GaussianBlur(radius=max(w, h) * 0.045))
    return Image.alpha_composite(im, spec)

def soft_shadow(w, h, scale_x=0.9, scale_y=0.32, alpha=110, blur=0.10, cy_ratio=0.80):
    sh = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    dr = ImageDraw.Draw(sh)
    sw, sh_ = w * scale_x, h * scale_y
    cx, cy = w / 2, h * cy_ratio
    dr.ellipse([cx - sw / 2, cy - sh_ / 2, cx + sw / 2, cy + sh_ / 2], fill=(10, 8, 5, alpha))
    sh = sh.filter(ImageFilter.GaussianBlur(radius=max(w, h) * blur))
    return sh

def downsample(im, w, h):
    return im.resize((w, h), Image.LANCZOS)

def rot_pt(cx, cy, x, y, deg):
    a = math.radians(deg)
    dx, dy = x - cx, y - cy
    return (cx + dx * math.cos(a) - dy * math.sin(a), cy + dx * math.sin(a) + dy * math.cos(a))

# ================================================================= GAMEPLAY PIECES (unchanged designs)

def render_token(color_key, final=128):
    d = final * SS
    canvas = Image.new("RGBA", (d, d), (0, 0, 0, 0))
    canvas = Image.alpha_composite(canvas, soft_shadow(d, d, 0.62, 0.16, 120, 0.05))

    base_h, base_w = d * 0.30, d * 0.70
    base_disc = radial_shaded_disc(int(base_w), PLAYERS[color_key], (-0.25, -0.55)).resize((int(base_w), int(base_h)), Image.LANCZOS)
    bx, by = int((d - base_w) / 2), int(d * 0.62)
    canvas.alpha_composite(base_disc, (bx, by))

    trim = Image.new("RGBA", (int(base_w), int(base_h)), (0, 0, 0, 0))
    ImageDraw.Draw(trim).ellipse([0, 0, base_w - 1, base_h - 1], outline=(235, 195, 90, 230), width=max(2, int(d * 0.012)))
    canvas.alpha_composite(trim, (bx, by))

    sphere_d = d * 0.62
    sphere = add_specular(radial_shaded_disc(int(sphere_d), PLAYERS[color_key]), strength=230)
    sx, sy = int((d - sphere_d) / 2), int(d * 0.16)
    canvas.alpha_composite(sphere, (sx, sy))

    outline = Image.new("RGBA", (int(sphere_d), int(sphere_d)), (0, 0, 0, 0))
    ImageDraw.Draw(outline).ellipse([1, 1, sphere_d - 2, sphere_d - 2], outline=(0, 0, 0, 90), width=max(2, int(d * 0.01)))
    canvas.alpha_composite(outline, (sx, sy))
    return downsample(canvas, final, final)

PIP_LAYOUT = {
    1: [(0.5, 0.5)],
    2: [(0.27, 0.27), (0.73, 0.73)],
    3: [(0.27, 0.27), (0.5, 0.5), (0.73, 0.73)],
    4: [(0.27, 0.27), (0.73, 0.27), (0.27, 0.73), (0.73, 0.73)],
    5: [(0.27, 0.27), (0.73, 0.27), (0.5, 0.5), (0.27, 0.73), (0.73, 0.73)],
    6: [(0.27, 0.22), (0.73, 0.22), (0.27, 0.5), (0.73, 0.5), (0.27, 0.78), (0.73, 0.78)],
}

def render_die(n, final=96):
    d = final * SS
    canvas = Image.new("RGBA", (d, d), (0, 0, 0, 0))
    canvas = Image.alpha_composite(canvas, soft_shadow(d, d, 0.78, 0.18, 110, 0.06))
    pad = d * 0.08
    box = [pad, pad, d - pad, d - pad]
    radius = d * 0.16
    face = Image.new("RGBA", (d, d), (0, 0, 0, 0))
    ImageDraw.Draw(face).rounded_rectangle(box, radius=radius, fill=(255, 255, 255, 255))
    grad = radial_shaded_disc(d, CREAM, (-0.3, -0.35))
    tinted = Image.composite(grad, Image.new("RGBA", (d, d), (0, 0, 0, 0)), face.split()[3])
    canvas.alpha_composite(tinted)
    border = Image.new("RGBA", (d, d), (0, 0, 0, 0))
    ImageDraw.Draw(border).rounded_rectangle(box, radius=radius, outline=(220, 175, 70, 255), width=max(2, int(d * 0.018)))
    canvas.alpha_composite(border)
    sheen = Image.new("RGBA", (d, d), (0, 0, 0, 0))
    ImageDraw.Draw(sheen).ellipse([d * 0.10, d * 0.06, d * 0.55, d * 0.30], fill=(255, 255, 255, 110))
    sheen = sheen.filter(ImageFilter.GaussianBlur(d * 0.04))
    mask = Image.new("L", (d, d), 0)
    ImageDraw.Draw(mask).rounded_rectangle(box, radius=radius, fill=255)
    canvas = Image.composite(Image.alpha_composite(canvas, sheen), canvas, mask)
    pip_r = d * 0.085
    pipd = ImageDraw.Draw(canvas)
    for (px, py) in PIP_LAYOUT[n]:
        cx, cy = px * d, py * d
        pipd.ellipse([cx - pip_r, cy - pip_r, cx + pip_r, cy + pip_r], fill=(40, 28, 20, 255))
        hl_r = pip_r * 0.35
        pipd.ellipse([cx - hl_r - pip_r * 0.25, cy - hl_r - pip_r * 0.3, cx + hl_r - pip_r * 0.25, cy + hl_r - pip_r * 0.3], fill=(255, 255, 255, 130))
    return downsample(canvas, final, final)

def star_points(cx, cy, r_out, r_in, n=5, rot=-90):
    pts = []
    for i in range(n * 2):
        ang = math.radians(rot) + i * math.pi / n
        r = r_out if i % 2 == 0 else r_in
        pts.append((cx + r * math.cos(ang), cy + r * math.sin(ang)))
    return pts

def render_star(final=96, glow=True):
    d = final * SS
    canvas = Image.new("RGBA", (d, d), (0, 0, 0, 0))
    cx = cy = d / 2
    if glow:
        g = Image.new("RGBA", (d, d), (0, 0, 0, 0))
        ImageDraw.Draw(g).ellipse([cx - d * 0.42, cy - d * 0.42, cx + d * 0.42, cy + d * 0.42], fill=(255, 225, 120, 90))
        g = g.filter(ImageFilter.GaussianBlur(d * 0.08))
        canvas = Image.alpha_composite(canvas, g)
    pts = star_points(cx, cy, d * 0.40, d * 0.40 * 0.42)
    mask = Image.new("L", (d, d), 0)
    ImageDraw.Draw(mask).polygon(pts, fill=255)
    grad = radial_shaded_disc(d, GOLD, (-0.3, -0.4))
    star_img = Image.new("RGBA", (d, d), (0, 0, 0, 0))
    star_img.paste(grad, (0, 0), mask)
    canvas = Image.alpha_composite(canvas, star_img)
    outline = Image.new("RGBA", (d, d), (0, 0, 0, 0))
    ImageDraw.Draw(outline).polygon(pts, outline=(120, 80, 10, 220), width=max(2, int(d * 0.012)))
    canvas = Image.alpha_composite(canvas, outline)
    canvas = add_specular(canvas, (0.40, 0.36), 0.14, 200)
    return downsample(canvas, final, final)

def render_home(color_key, final=96):
    d = final * SS
    canvas = Image.new("RGBA", (d, d), (0, 0, 0, 0))
    canvas = Image.alpha_composite(canvas, soft_shadow(d, d, 0.6, 0.14, 100, 0.05))
    cx = d / 2
    top, bottom = d * 0.14, d * 0.86
    w = d * 0.62
    left, right = cx - w / 2, cx + w / 2
    mid = d * 0.58
    points = [(left, top), (right, top), (right, mid), (cx, bottom), (left, mid)]
    mask = Image.new("L", (d, d), 0)
    ImageDraw.Draw(mask).polygon(points, fill=255)
    mask = mask.filter(ImageFilter.GaussianBlur(d * 0.004))
    grad = radial_shaded_disc(d, PLAYERS[color_key], (-0.3, -0.4))
    shield = Image.new("RGBA", (d, d), (0, 0, 0, 0))
    shield.paste(grad, (0, 0), mask)
    canvas = Image.alpha_composite(canvas, shield)
    border = Image.new("RGBA", (d, d), (0, 0, 0, 0))
    ImageDraw.Draw(border).polygon(points, outline=(235, 200, 110, 240), width=max(2, int(d * 0.016)))
    canvas = Image.alpha_composite(canvas, border)
    hd = ImageDraw.Draw(canvas)
    hw, hh = d * 0.30, d * 0.22
    hx, hy = cx - hw / 2, d * 0.40
    hd.rectangle([hx, hy + hh * 0.35, hx + hw, hy + hh], fill=(255, 255, 255, 235))
    hd.polygon([(hx - hw * 0.12, hy + hh * 0.38), (cx, hy - hh * 0.35), (hx + hw * 1.12, hy + hh * 0.38)], fill=(255, 255, 255, 235))
    canvas = add_specular(canvas, (0.36, 0.30), 0.16, 160)
    return downsample(canvas, final, final)

def render_arrow(color_key, final=96, palette=None):
    palette = palette or PLAYERS[color_key]
    d = final * SS
    canvas = Image.new("RGBA", (d, d), (0, 0, 0, 0))
    canvas = Image.alpha_composite(canvas, soft_shadow(d, d, 0.6, 0.14, 90, 0.05))
    cy = d / 2
    shaft_h, shaft_w, head_w = d * 0.22, d * 0.38, d * 0.34
    left = d * 0.16
    points = [
        (left, cy - shaft_h / 2), (left + shaft_w, cy - shaft_h / 2),
        (left + shaft_w, cy - shaft_h * 1.4), (left + shaft_w + head_w, cy),
        (left + shaft_w, cy + shaft_h * 1.4), (left + shaft_w, cy + shaft_h / 2),
        (left, cy + shaft_h / 2),
    ]
    mask = Image.new("L", (d, d), 0)
    ImageDraw.Draw(mask).polygon(points, fill=255)
    grad = radial_shaded_disc(d, palette, (-0.3, -0.4))
    arrow_img = Image.new("RGBA", (d, d), (0, 0, 0, 0))
    arrow_img.paste(grad, (0, 0), mask)
    canvas = Image.alpha_composite(canvas, arrow_img)
    border = Image.new("RGBA", (d, d), (0, 0, 0, 0))
    ImageDraw.Draw(border).polygon(points, outline=(255, 255, 255, 160), width=max(2, int(d * 0.012)))
    canvas = Image.alpha_composite(canvas, border)
    canvas = add_specular(canvas, (0.30, 0.32), 0.14, 150)
    return downsample(canvas, final, final)

# ================================================================= BOARD

def render_cell(final=96, tint=None, label_star=False):
    d = final * SS
    canvas = Image.new("RGBA", (d, d), (0, 0, 0, 0))
    pad = d * 0.04
    box = [pad, pad, d - pad, d - pad]
    radius = d * 0.10
    palette = tint if tint else CREAM
    grad = radial_shaded_disc(d, palette, (-0.35, -0.4))
    mask = Image.new("L", (d, d), 0)
    ImageDraw.Draw(mask).rounded_rectangle(box, radius=radius, fill=255)
    tile = Image.new("RGBA", (d, d), (0, 0, 0, 0))
    tile.paste(grad, (0, 0), mask)
    canvas = Image.alpha_composite(canvas, tile)
    inner = Image.new("RGBA", (d, d), (0, 0, 0, 0))
    ImageDraw.Draw(inner).rounded_rectangle([pad * 2.4, pad * 2.4, d - pad * 2.4, d - pad * 2.4], radius=radius * 0.7,
                                             outline=(255, 255, 255, 90), width=max(2, int(d * 0.012)))
    canvas = Image.alpha_composite(canvas, inner)
    border = Image.new("RGBA", (d, d), (0, 0, 0, 0))
    ImageDraw.Draw(border).rounded_rectangle(box, radius=radius, outline=(120, 100, 70, 160), width=max(2, int(d * 0.012)))
    canvas = Image.alpha_composite(canvas, border)
    if label_star:
        cx = cy = d / 2
        pts = star_points(cx, cy, d * 0.24, d * 0.24 * 0.42)
        smask = Image.new("L", (d, d), 0)
        ImageDraw.Draw(smask).polygon(pts, fill=255)
        sgrad = radial_shaded_disc(d, GOLD, (-0.3, -0.4))
        simg = Image.new("RGBA", (d, d), (0, 0, 0, 0))
        simg.paste(sgrad, (0, 0), smask)
        canvas = Image.alpha_composite(canvas, simg)
        sout = Image.new("RGBA", (d, d), (0, 0, 0, 0))
        ImageDraw.Draw(sout).polygon(pts, outline=(120, 80, 10, 200), width=max(2, int(d * 0.01)))
        canvas = Image.alpha_composite(canvas, sout)
    return downsample(canvas, final, final)

def render_home_quadrant(color_key, final=192):
    d = final * SS
    canvas = Image.new("RGBA", (d, d), (0, 0, 0, 0))
    canvas = Image.alpha_composite(canvas, soft_shadow(d, d, 0.85, 0.14, 90, 0.04, cy_ratio=0.92))
    pad = d * 0.04
    radius = d * 0.10
    outer_box = [pad, pad, d - pad, d - pad]
    grad = radial_shaded_disc(d, PLAYERS[color_key], (-0.3, -0.4))
    mask = Image.new("L", (d, d), 0)
    ImageDraw.Draw(mask).rounded_rectangle(outer_box, radius=radius, fill=255)
    panel = Image.new("RGBA", (d, d), (0, 0, 0, 0))
    panel.paste(grad, (0, 0), mask)
    canvas = Image.alpha_composite(canvas, panel)
    border = Image.new("RGBA", (d, d), (0, 0, 0, 0))
    ImageDraw.Draw(border).rounded_rectangle(outer_box, radius=radius, outline=(255, 220, 140, 230), width=max(3, int(d * 0.012)))
    canvas = Image.alpha_composite(canvas, border)

    inset = d * 0.20
    yard_box = [inset, inset, d - inset, d - inset]
    yard_grad = radial_shaded_disc(d, CREAM, (-0.3, -0.35))
    ymask = Image.new("L", (d, d), 0)
    ImageDraw.Draw(ymask).rounded_rectangle(yard_box, radius=radius * 0.8, fill=255)
    yard = Image.new("RGBA", (d, d), (0, 0, 0, 0))
    yard.paste(yard_grad, (0, 0), ymask)
    canvas = Image.alpha_composite(canvas, yard)
    yborder = Image.new("RGBA", (d, d), (0, 0, 0, 0))
    ImageDraw.Draw(yborder).rounded_rectangle(yard_box, radius=radius * 0.8, outline=(150, 130, 100, 180), width=max(2, int(d * 0.008)))
    canvas = Image.alpha_composite(canvas, yborder)

    slot_r = d * 0.085
    cx0, cy0 = d * 0.40, d * 0.40
    cx1, cy1 = d * 0.60, d * 0.60
    for (sx, sy) in [(cx0, cy0), (cx1, cy0), (cx0, cy1), (cx1, cy1)]:
        slot = add_specular(radial_shaded_disc(int(slot_r * 2), PLAYERS[color_key]), strength=200)
        canvas.alpha_composite(slot, (int(sx - slot_r), int(sy - slot_r)))
    return downsample(canvas, final, final)

def render_center_home(final=192):
    d = final * SS
    canvas = Image.new("RGBA", (d, d), (0, 0, 0, 0))
    canvas = Image.alpha_composite(canvas, soft_shadow(d, d, 0.85, 0.14, 90, 0.04, cy_ratio=0.92))
    cx = cy = d / 2
    pad = d * 0.04
    radius = d * 0.10
    panel_box = [pad, pad, d - pad, d - pad]
    corners = {
        "red":    [(pad, pad), (d - pad, pad)],
        "blue":   [(d - pad, pad), (d - pad, d - pad)],
        "yellow": [(d - pad, d - pad), (pad, d - pad)],
        "green":  [(pad, d - pad), (pad, pad)],
    }
    tri_layer = Image.new("RGBA", (d, d), (0, 0, 0, 0))
    for color, (p1, p2) in corners.items():
        tri = Image.new("RGBA", (d, d), (0, 0, 0, 0))
        tmask = Image.new("L", (d, d), 0)
        ImageDraw.Draw(tmask).polygon([p1, p2, (cx, cy)], fill=255)
        grad = flat_gradient_rect(d, d, PLAYERS[color], (-0.3, -0.4))
        tri.paste(grad, (0, 0), tmask)
        tri_layer = Image.alpha_composite(tri_layer, tri)

    panel_mask = Image.new("L", (d, d), 0)
    ImageDraw.Draw(panel_mask).rounded_rectangle(panel_box, radius=radius, fill=255)
    clipped = Image.new("RGBA", (d, d), (0, 0, 0, 0))
    clipped.paste(tri_layer, (0, 0), panel_mask)
    canvas = Image.alpha_composite(canvas, clipped)

    border = Image.new("RGBA", (d, d), (0, 0, 0, 0))
    bd = ImageDraw.Draw(border)
    bd.rounded_rectangle(panel_box, radius=radius, outline=(255, 220, 140, 235), width=max(3, int(d * 0.014)))
    bd.line([(pad, pad), (d - pad, d - pad)], fill=(255, 220, 140, 140), width=max(2, int(d * 0.007)))
    bd.line([(d - pad, pad), (pad, d - pad)], fill=(255, 220, 140, 140), width=max(2, int(d * 0.007)))
    canvas = Image.alpha_composite(canvas, border)

    medal_r = d * 0.17
    medal = add_specular(radial_shaded_disc(int(medal_r * 2), GOLD), strength=220)
    canvas.alpha_composite(medal, (int(cx - medal_r), int(cy - medal_r)))
    pts = star_points(cx, cy, medal_r * 0.62, medal_r * 0.62 * 0.42)
    ImageDraw.Draw(canvas).polygon(pts, fill=(255, 250, 230, 255), outline=(150, 100, 20, 220))
    return downsample(canvas, final, final)

# ================================================================= UI BUTTONS

def ui_button_base(d, palette=UI):
    canvas = Image.new("RGBA", (d, d), (0, 0, 0, 0))
    canvas = Image.alpha_composite(canvas, soft_shadow(d, d, 0.72, 0.22, 130, 0.07))
    disc = add_specular(radial_shaded_disc(d, palette), strength=190)
    canvas.alpha_composite(disc, (0, 0))
    ring = Image.new("RGBA", (d, d), (0, 0, 0, 0))
    ImageDraw.Draw(ring).ellipse([d * 0.03, d * 0.03, d * 0.97, d * 0.97], outline=(255, 220, 140, 230), width=max(2, int(d * 0.022)))
    canvas = Image.alpha_composite(canvas, ring)
    return canvas

def render_btn_play(final=128):
    d = final * SS
    canvas = ui_button_base(d)
    cx, cy = d / 2, d / 2
    s = d * 0.22
    pts = [(cx - s * 0.6, cy - s), (cx - s * 0.6, cy + s), (cx + s * 1.1, cy)]
    draw = ImageDraw.Draw(canvas)
    draw.polygon([(x + d * 0.02, y) for x, y in pts], fill=(0, 0, 0, 60))
    draw.polygon(pts, fill=(255, 255, 255, 245))
    return downsample(canvas, final, final)

def render_btn_pause(final=128):
    d = final * SS
    canvas = ui_button_base(d)
    cx, cy = d / 2, d / 2
    bw, bh = d * 0.12, d * 0.40
    gap = d * 0.10
    draw = ImageDraw.Draw(canvas)
    bar1 = [cx - gap - bw, cy - bh / 2, cx - gap, cy + bh / 2]
    bar2 = [cx + gap, cy - bh / 2, cx + gap + bw, cy + bh / 2]
    for b in (bar1, bar2):
        draw.rounded_rectangle(b, radius=bw * 0.3, fill=(255, 255, 255, 245))
    return downsample(canvas, final, final)

def render_btn_settings(final=128):
    d = final * SS
    canvas = ui_button_base(d)
    cx, cy = d / 2, d / 2
    r_out, r_in = d * 0.30, d * 0.22
    pts = star_points(cx, cy, r_out, r_in, n=8, rot=0)
    mask = Image.new("L", (d, d), 0)
    ImageDraw.Draw(mask).polygon(pts, fill=255)
    ImageDraw.Draw(mask).ellipse([cx - d * 0.12, cy - d * 0.12, cx + d * 0.12, cy + d * 0.12], fill=0)
    gear = Image.new("RGBA", (d, d), (0, 0, 0, 0))
    gear.paste((255, 255, 255, 245), (0, 0), mask)
    canvas = Image.alpha_composite(canvas, gear)
    ImageDraw.Draw(canvas).ellipse([cx - d * 0.12, cy - d * 0.12, cx + d * 0.12, cy + d * 0.12], outline=(255, 255, 255, 245), width=max(2, int(d * 0.02)))
    return downsample(canvas, final, final)

def render_btn_sound(final=128, on=True):
    d = final * SS
    canvas = ui_button_base(d)
    cx, cy = d * 0.42, d / 2
    draw = ImageDraw.Draw(canvas)
    body = [(cx - d * 0.18, cy - d * 0.08), (cx - d * 0.06, cy - d * 0.08), (cx + d * 0.10, cy - d * 0.20),
            (cx + d * 0.10, cy + d * 0.20), (cx - d * 0.06, cy + d * 0.08), (cx - d * 0.18, cy + d * 0.08)]
    draw.polygon(body, fill=(255, 255, 255, 245))
    if on:
        for i, r in enumerate([0.07, 0.13, 0.19]):
            bbox = [cx + d * 0.10 - d * r, cy - d * r, cx + d * 0.10 + d * r, cy + d * r]
            draw.arc(bbox, start=-50, end=50, fill=(255, 255, 255, 245), width=max(2, int(d * 0.018)))
    else:
        x0, y0 = cx + d * 0.22, cy - d * 0.14
        x1, y1 = cx + d * 0.38, cy + d * 0.14
        draw.line([x0, y0, x1, y1], fill=(255, 255, 255, 245), width=max(3, int(d * 0.02)))
        draw.line([x0, y1, x1, y0], fill=(255, 255, 255, 245), width=max(3, int(d * 0.02)))
    return downsample(canvas, final, final)

def render_btn_restart(final=128):
    d = final * SS
    canvas = ui_button_base(d)
    cx, cy = d / 2, d / 2
    r = d * 0.24
    bbox = [cx - r, cy - r, cx + r, cy + r]
    draw = ImageDraw.Draw(canvas)
    draw.arc(bbox, start=-220, end=120, fill=(255, 255, 255, 245), width=max(3, int(d * 0.035)))
    tip_ang = math.radians(120)
    tip = (cx + r * math.cos(tip_ang), cy + r * math.sin(tip_ang))
    a1 = math.radians(120 - 35)
    a2 = math.radians(120 + 35)
    p1 = (tip[0] + d * 0.07 * math.cos(a1 + math.pi / 2), tip[1] + d * 0.07 * math.sin(a1 + math.pi / 2))
    p2 = (tip[0] + d * 0.07 * math.cos(a2 - math.pi), tip[1] + d * 0.07 * math.sin(a2 - math.pi))
    arrow_tip = (tip[0] + d * 0.10 * math.cos(tip_ang + 0.9), tip[1] + d * 0.10 * math.sin(tip_ang + 0.9))
    draw.polygon([tip, p1, arrow_tip], fill=(255, 255, 255, 245))
    return downsample(canvas, final, final)

def render_btn_back(final=128):
    d = final * SS
    canvas = ui_button_base(d)
    cx, cy = d / 2, d / 2
    s = d * 0.20
    pts = [(cx + s * 0.7, cy - s), (cx + s * 0.7, cy + s), (cx - s * 1.0, cy)]
    ImageDraw.Draw(canvas).polygon(pts, fill=(255, 255, 255, 245))
    return downsample(canvas, final, final)

# ================================================================= WIN SCREEN

def render_crown(final=128):
    d = final * SS
    canvas = Image.new("RGBA", (d, d), (0, 0, 0, 0))
    canvas = Image.alpha_composite(canvas, soft_shadow(d, d, 0.7, 0.16, 110, 0.06))
    cx = d / 2
    base_y, top_y, peak_y = d * 0.66, d * 0.40, d * 0.18
    left, right = d * 0.16, d * 0.84
    pts = [
        (left, base_y), (left, top_y), (d * 0.30, d * 0.50), (d * 0.40, peak_y),
        (cx, d * 0.42), (d * 0.60, peak_y), (d * 0.70, d * 0.50), (right, top_y),
        (right, base_y),
    ]
    mask = Image.new("L", (d, d), 0)
    ImageDraw.Draw(mask).polygon(pts, fill=255)
    grad = radial_shaded_disc(d, GOLD, (-0.3, -0.4))
    crown_img = Image.new("RGBA", (d, d), (0, 0, 0, 0))
    crown_img.paste(grad, (0, 0), mask)
    canvas = Image.alpha_composite(canvas, crown_img)
    band = [left, base_y, right, d * 0.78]
    bmask = Image.new("L", (d, d), 0)
    ImageDraw.Draw(bmask).rectangle(band, fill=255)
    band_grad = radial_shaded_disc(d, GOLD, (-0.3, 0.1))
    band_img = Image.new("RGBA", (d, d), (0, 0, 0, 0))
    band_img.paste(band_grad, (0, 0), bmask)
    canvas = Image.alpha_composite(canvas, band_img)
    outline = Image.new("RGBA", (d, d), (0, 0, 0, 0))
    od = ImageDraw.Draw(outline)
    od.polygon(pts, outline=(140, 95, 15, 230), width=max(2, int(d * 0.012)))
    od.rectangle(band, outline=(140, 95, 15, 230), width=max(2, int(d * 0.012)))
    canvas = Image.alpha_composite(canvas, outline)
    gem_colors = [PLAYERS["red"]["base"], PLAYERS["blue"]["base"], PLAYERS["green"]["base"]]
    for gx, col in zip([d * 0.40, cx, d * 0.60], gem_colors):
        gr = d * 0.045
        ImageDraw.Draw(canvas).ellipse([gx - gr, peak_y - gr * 0.4, gx + gr, peak_y + gr * 1.6], fill=col)
    big_gem_r = d * 0.06
    ImageDraw.Draw(canvas).ellipse([cx - big_gem_r, d * 0.68 - big_gem_r, cx + big_gem_r, d * 0.68 + big_gem_r],
                                    fill=PLAYERS["red"]["base"], outline=(255, 255, 255, 200))
    canvas = add_specular(canvas, (0.34, 0.30), 0.16, 150)
    return downsample(canvas, final, final)

def render_trophy(final=128):
    d = final * SS
    canvas = Image.new("RGBA", (d, d), (0, 0, 0, 0))
    canvas = Image.alpha_composite(canvas, soft_shadow(d, d, 0.6, 0.14, 110, 0.05))
    cx = d / 2
    cup_top, cup_bot = d * 0.18, d * 0.52
    cup_pts = [(d * 0.30, cup_top), (d * 0.70, cup_top), (d * 0.62, cup_bot), (d * 0.38, cup_bot)]
    mask = Image.new("L", (d, d), 0)
    ImageDraw.Draw(mask).polygon(cup_pts, fill=255)
    grad = radial_shaded_disc(d, GOLD, (-0.3, -0.4))
    cup = Image.new("RGBA", (d, d), (0, 0, 0, 0))
    cup.paste(grad, (0, 0), mask)
    canvas = Image.alpha_composite(canvas, cup)
    draw = ImageDraw.Draw(canvas)
    draw.arc([d * 0.12, cup_top, d * 0.38, cup_top + d * 0.22], start=60, end=300, fill=(200, 150, 40, 255), width=max(3, int(d * 0.03)))
    draw.arc([d * 0.62, cup_top, d * 0.88, cup_top + d * 0.22], start=240, end=120, fill=(200, 150, 40, 255), width=max(3, int(d * 0.03)))
    draw.rectangle([cx - d * 0.035, cup_bot, cx + d * 0.035, d * 0.66], fill=(210, 165, 50, 255))
    draw.polygon([(d * 0.30, d * 0.66), (d * 0.70, d * 0.66), (d * 0.62, d * 0.76), (d * 0.38, d * 0.76)], fill=(190, 145, 40, 255))
    draw.rectangle([d * 0.26, d * 0.76, d * 0.74, d * 0.84], fill=(160, 120, 30, 255))
    outline = Image.new("RGBA", (d, d), (0, 0, 0, 0))
    ImageDraw.Draw(outline).polygon(cup_pts, outline=(140, 95, 15, 230), width=max(2, int(d * 0.012)))
    canvas = Image.alpha_composite(canvas, outline)
    canvas = add_specular(canvas, (0.36, 0.26), 0.14, 170)
    return downsample(canvas, final, final)

CONFETTI_SPECS = [
    ("confetti_1", "rect", PLAYERS["red"]["base"], 25),
    ("confetti_2", "circle", PLAYERS["blue"]["base"], 0),
    ("confetti_3", "triangle", PLAYERS["yellow"]["base"], -15),
    ("confetti_4", "rect", PLAYERS["green"]["base"], -30),
    ("confetti_5", "ribbon", GOLD["base"], 10),
    ("confetti_6", "circle", PURPLE["base"], 0),
]

def render_confetti(shape, color, angle, final=48):
    d = final * SS
    canvas = Image.new("RGBA", (d, d), (0, 0, 0, 0))
    cx, cy = d / 2, d / 2
    light = tuple(min(255, c + 70) for c in color)
    if shape == "rect":
        w, h = d * 0.62, d * 0.30
        pts = [(cx - w / 2, cy - h / 2), (cx + w / 2, cy - h / 2), (cx + w / 2, cy + h / 2), (cx - w / 2, cy + h / 2)]
        pts = [rot_pt(cx, cy, x, y, angle) for x, y in pts]
        ImageDraw.Draw(canvas).polygon(pts, fill=color + (255,))
        ImageDraw.Draw(canvas).line([rot_pt(cx, cy, cx - w / 2, cy - h / 4, angle), rot_pt(cx, cy, cx + w / 2, cy - h / 4, angle)],
                                     fill=light + (180,), width=max(1, int(d * 0.04)))
    elif shape == "circle":
        r = d * 0.26
        ImageDraw.Draw(canvas).ellipse([cx - r, cy - r, cx + r, cy + r], fill=color + (255,))
        ImageDraw.Draw(canvas).ellipse([cx - r * 0.4, cy - r * 0.7, cx + r * 0.1, cy - r * 0.2], fill=light + (160,))
    elif shape == "triangle":
        s = d * 0.32
        pts = [(cx, cy - s), (cx + s, cy + s * 0.8), (cx - s, cy + s * 0.8)]
        pts = [rot_pt(cx, cy, x, y, angle) for x, y in pts]
        ImageDraw.Draw(canvas).polygon(pts, fill=color + (255,))
    elif shape == "ribbon":
        w, h = d * 0.70, d * 0.18
        pts = [(cx - w / 2, cy), (cx - w / 4, cy - h / 2), (cx + w / 4, cy + h / 2), (cx + w / 2, cy),
               (cx + w / 4, cy - h / 2), (cx - w / 4, cy + h / 2)]
        pts = [rot_pt(cx, cy, x, y, angle) for x, y in pts]
        ImageDraw.Draw(canvas).polygon(pts, fill=color + (255,))
    return downsample(canvas, final, final)

def render_banner(w=320, h=140):
    dw, dh = w * SS, h * SS
    canvas = Image.new("RGBA", (dw, dh), (0, 0, 0, 0))
    canvas = Image.alpha_composite(canvas, soft_shadow(dw, dh, 0.85, 0.30, 110, 0.05))
    notch = dh * 0.32
    body = [(dw * 0.04, dh * 0.18), (dw * 0.96, dh * 0.18), (dw * 0.96, dh * 0.82), (dw * 0.04, dh * 0.82)]
    mask = Image.new("L", (dw, dh), 0)
    ImageDraw.Draw(mask).polygon(body, fill=255)
    grad = flat_gradient_rect(dw, dh, PURPLE, (-0.3, -0.4))
    panel = Image.new("RGBA", (dw, dh), (0, 0, 0, 0))
    panel.paste(grad, (0, 0), mask)
    canvas = Image.alpha_composite(canvas, panel)

    draw = ImageDraw.Draw(canvas)
    tail_w = dw * 0.10
    left_tail = [(dw * 0.04, dh * 0.18), (dw * 0.04 - tail_w, dh * 0.30), (dw * 0.04, dh * 0.5),
                 (dw * 0.04 - tail_w, dh * 0.70), (dw * 0.04, dh * 0.82)]
    right_tail = [(dw * 0.96, dh * 0.18), (dw * 0.96 + tail_w, dh * 0.30), (dw * 0.96, dh * 0.5),
                  (dw * 0.96 + tail_w, dh * 0.70), (dw * 0.96, dh * 0.82)]
    dark = tuple(int(c * 0.6) for c in PURPLE["dark"])
    draw.polygon(left_tail, fill=dark + (255,))
    draw.polygon(right_tail, fill=dark + (255,))

    border = Image.new("RGBA", (dw, dh), (0, 0, 0, 0))
    ImageDraw.Draw(border).polygon(body, outline=(255, 220, 140, 235), width=max(2, int(dh * 0.025)))
    canvas = Image.alpha_composite(canvas, border)
    sheen = Image.new("RGBA", (dw, dh), (0, 0, 0, 0))
    ImageDraw.Draw(sheen).ellipse([dw * 0.05, dh * 0.1, dw * 0.45, dh * 0.4], fill=(255, 255, 255, 70))
    sheen = sheen.filter(ImageFilter.GaussianBlur(dh * 0.06))
    canvas = Image.composite(Image.alpha_composite(canvas, sheen), canvas, mask)
    return downsample(canvas, w, h)

# ================================================================= PACKING

def shelf_pack(sprites, max_width=1100, pad=8):
    items = sorted(sprites.items(), key=lambda kv: kv[1].size[1], reverse=True)
    x, y, row_h = pad, pad, 0
    placements = {}
    for name, img in items:
        w, h = img.size
        if x + w + pad > max_width and x > pad:
            y += row_h + pad
            x = pad
            row_h = 0
        placements[name] = (x, y, img)
        x += w + pad
        row_h = max(row_h, h)
    total_h = y + row_h + pad
    sheet = Image.new("RGBA", (max_width, total_h), (0, 0, 0, 0))
    frames = {}
    for name, (px, py, img) in placements.items():
        sheet.alpha_composite(img, (px, py))
        frames[name] = {"x": px, "y": py, "w": img.size[0], "h": img.size[1]}
    return sheet, frames, total_h

def main():
    sprites = {}

    for c in PLAYERS:
        sprites[f"token_{c}"] = render_token(c, 128)
    for n in range(1, 7):
        sprites[f"dice_face_{n}"] = render_die(n, 96)
    sprites["star_safe"] = render_star(96)
    for c in PLAYERS:
        sprites[f"home_{c}"] = render_home(c, 96)
    for c in PLAYERS:
        sprites[f"arrow_{c}"] = render_arrow(c, 96)

    sprites["cell_plain"] = render_cell(96)
    sprites["cell_safe"] = render_cell(96, label_star=True)
    for c in PLAYERS:
        sprites[f"cell_{c}"] = render_cell(96, tint=PLAYERS[c])
    for c in PLAYERS:
        sprites[f"home_quadrant_{c}"] = render_home_quadrant(c, 192)
    sprites["center_home"] = render_center_home(192)

    sprites["btn_play"] = render_btn_play(128)
    sprites["btn_pause"] = render_btn_pause(128)
    sprites["btn_settings"] = render_btn_settings(128)
    sprites["btn_sound_on"] = render_btn_sound(128, on=True)
    sprites["btn_sound_off"] = render_btn_sound(128, on=False)
    sprites["btn_restart"] = render_btn_restart(128)
    sprites["btn_back"] = render_btn_back(128)

    sprites["crown_gold"] = render_crown(128)
    sprites["trophy_gold"] = render_trophy(128)
    for name, shape, color, angle in CONFETTI_SPECS:
        sprites[name] = render_confetti(shape, color, angle, 48)
    sprites["banner_ribbon"] = render_banner(320, 140)

    sheet, frames, total_h = shelf_pack(sprites, max_width=1100, pad=8)
    sheet.save("/home/claude/ludo_spritesheet.png")
    print("Sheet size:", sheet.size, "frames:", len(frames))

    atlas = {
        "frames": {},
        "meta": {
            "app": "claude-procedural-generator",
            "version": "1.0",
            "image": "ludo_spritesheet.png",
            "format": "RGBA8888",
            "size": {"w": sheet.size[0], "h": sheet.size[1]},
            "scale": "1",
        },
    }
    for name, rect in frames.items():
        atlas["frames"][name] = {
            "frame": {"x": rect["x"], "y": rect["y"], "w": rect["w"], "h": rect["h"]},
            "rotated": False,
            "trimmed": False,
            "spriteSourceSize": {"x": 0, "y": 0, "w": rect["w"], "h": rect["h"]},
            "sourceSize": {"w": rect["w"], "h": rect["h"]},
            "pivot": {"x": 0.5, "y": 0.5},
        }
    with open("/home/claude/ludo_atlas.json", "w") as f:
        json.dump(atlas, f, indent=2)
    print("Wrote atlas with", len(frames), "frames")

if __name__ == "__main__":
    main()
