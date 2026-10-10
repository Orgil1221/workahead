"""WorkAhead midterm poster 1080x1350 — app design vibe: paper/ink, accent stamp, mono data."""
from PIL import Image, ImageDraw, ImageFont, ImageFilter
import qrcode

W, H = 1080, 1350
PAPER = (247, 243, 234)
INK = (33, 29, 23)
SOFT = (92, 86, 72)
FAINT = (151, 144, 126)
RULE = (216, 208, 189)
ACCENT = (160, 49, 35)
BLUE = (39, 66, 124)
OK = (46, 107, 63)


def font(path, size, var=None):
    f = ImageFont.truetype(path, size)
    if var is not None:
        try:
            f.set_variation_by_axes(var)
        except Exception:
            pass
    return f


SERIF = 'poster/fonts/PlayfairDisplay.ttf'
SANS = 'poster/fonts/Inter.ttf'
MONO = 'poster/fonts/PlexMono.ttf'

f_brand = font(SERIF, 44, [700])
f_kicker = font(MONO, 30)
f_head = font(SERIF, 148, [800])
f_head_sm = font(SERIF, 120, [800])
f_feat = font(MONO, 33)
f_badge = font(SANS, 34, [16, 600])
f_cta = font(SERIF, 54, [700])
f_sub = font(SANS, 32, [16, 400])

img = Image.new('RGB', (W, H), PAPER)

# --- aurora blobs (small canvas, blur, upscale) ---
blobs = Image.new('RGB', (W // 4, H // 4), PAPER)
bd = ImageDraw.Draw(blobs)
bd.ellipse([-60, -70, 180, 120], fill=(225, 214, 235))    # blue-ish top-left
bd.ellipse([150, 60, 330, 260], fill=(238, 205, 195))     # red-ish mid-right
bd.ellipse([-40, 220, 160, 360], fill=(214, 228, 208))    # green-ish bottom-left
blobs = blobs.filter(ImageFilter.GaussianBlur(18)).resize((W, H), Image.LANCZOS)
img = Image.blend(img, blobs, 0.55)
d = ImageDraw.Draw(img)

CX = W // 2


def centered(y, text, f, fill=INK):
    bb = d.textbbox((0, 0), text, font=f)
    d.text(((W - (bb[2] - bb[0])) / 2 - bb[0], y), text, font=f, fill=fill)


def left(x, y, text, f, fill=INK):
    d.text((x, y), text, font=f, fill=fill)
    bb = d.textbbox((x, y), text, font=f)
    return bb[2]


# --- top brand row ---
d.text((72, 64), 'Work', font=f_brand, fill=INK)
bw = d.textbbox((72, 64), 'Work', font=f_brand)[2]
d.text((bw + 2, 64), '·', font=f_brand, fill=ACCENT)
dotw = d.textbbox((bw + 2, 64), '·', font=f_brand)[2]
d.text((dotw + 2, 64), 'Ahead', font=f_brand, fill=INK)

# --- stamp (top-right, rotated) ---
stamp = Image.new('RGBA', (220, 220), (0, 0, 0, 0))
sd = ImageDraw.Draw(stamp)
sd.ellipse([8, 8, 212, 212], outline=ACCENT + (255,), width=7)
sf = font(SERIF, 64, [700])
sd.text((110, 108), 'W·A', font=sf, fill=ACCENT + (255,), anchor='mm')
stamp = stamp.rotate(11, expand=True, resample=Image.BICUBIC)
img.paste(stamp, (W - 72 - stamp.width, 56), stamp)
d = ImageDraw.Draw(img)

# --- kicker pill ---
kick = 'ЯВЦЫН ШАЛГАЛТ • МУИС'
kb = d.textbbox((0, 0), kick, font=f_kicker)
kw = kb[2] - kb[0] + 56
x0 = (W - kw) // 2
d.rounded_rectangle([x0, 268, x0 + kw, 268 + 64], radius=32, outline=RULE, width=2)
d.text((x0 + 28, 268 + 12), kick, font=f_kicker, fill=SOFT)

# --- headline ---
centered(380, 'Явцын', f_head)
centered(540, 'шалгалт', f_head)
# 'хаяанд' ink + 'ирлээ' accent on one line (auto-fit to margins)
t1, t2 = 'хаяанд ', 'ирлээ'
size = 120
while size > 80:
    fh = font(SERIF, size, [800])
    b1 = d.textbbox((0, 0), t1, font=fh)
    b2 = d.textbbox((0, 0), t2, font=fh)
    total = (b1[2] - b1[0]) + (b2[2] - b2[0])
    if total <= W - 160:
        break
    size -= 6
x = (W - total) // 2
d.text((x, 700), t1, font=fh, fill=INK)
d.text((x + (b1[2] - b1[0]), 700), t2, font=fh, fill=ACCENT)

# --- dashed rule ---
ry = 890
for sx in range(140, W - 140, 26):
    d.line([sx, ry, sx + 13, ry], fill=RULE, width=3)

# --- features (mono) ---
feats = ['Бодит шалгалтын асуултууд', 'AI үнэлгээ + иж бүрэн шийдэл']
y = 915
for t in feats:
    bb = d.textbbox((0, 0), '•  ' + t, font=f_feat)
    d.text(((W - (bb[2] - bb[0])) / 2 - bb[0], y), '•  ' + t, font=f_feat, fill=SOFT)
    y += 62

# --- payment badges ---
labels = ['QPay', 'SocialPay']
widths = [d.textbbox((0, 0), t, font=f_badge)[2] + 64 for t in labels]
gap = 20
sx = (W - sum(widths) - gap) // 2
by = 1045
for t, wdt in zip(labels, widths):
    d.rounded_rectangle([sx, by, sx + wdt, by + 62], radius=31, outline=RULE, width=2)
    bb = d.textbbox((0, 0), t, font=f_badge)
    d.text((sx + (wdt - (bb[2] - bb[0])) / 2 - bb[0], by + 10), t, font=f_badge, fill=BLUE)
    sx += wdt + gap

# --- CTA: QR + site ---
qr = qrcode.QRCode(box_size=8, border=2)
qr.add_data('https://workahead.me')
qr.make(fit=True)
qimg = qr.make_image(fill_color='#211d17', back_color='#f7f3ea').convert('RGB')
qimg = qimg.resize((150, 150), Image.NEAREST)
img.paste(qimg, (CX - 260, 1150))

d.text((CX - 80, 1150), 'workahead.me', font=f_cta, fill=INK)
d.text((CX - 80, 1150 + 72), 'QR уншуулж бэлтгэлээ эхлээрэй', font=f_sub, fill=FAINT)

img.save('poster/workahead-midterm-1080x1350.png')
print('saved poster/workahead-midterm-1080x1350.png', img.size)
