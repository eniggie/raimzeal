"""
RAIMZEAL App Store Screenshots Generator
Sizes:
  iPhone 6.9"  → 1320 × 2868  → screenshots/iphone69/
  iPhone 6.5"  → 1284 × 2778  → screenshots/iphone65/
  iPad 13"     → 2048 × 2732  → screenshots/ipad13/
Features: Workout, Ovia AI, Nutrition, Community, Progress
"""
from PIL import Image, ImageDraw, ImageFont
import os

LOGO_PATH = "artifacts/raimzeal-mobile/assets/images/logo.png"
FONT_DIR  = "/usr/share/fonts/truetype/dejavu"

# Brand colours
BG      = (10,  10,  11)
CARD    = (17,  17,  19)
MUTED   = (34,  34,  37)
BORDER  = (29,  29,  32)
PRIMARY = (46,  139, 87)
GOLD    = (201, 168, 76)
ACCENT  = (139, 49,  199)
TEXT    = (250, 250, 250)
SUB     = (135, 135, 146)
SUCCESS = (33,  196, 93)

# ── Font helper ───────────────────────────────────────────────────────────────

def fnt(size, bold=False):
    name = "DejaVuSans-Bold.ttf" if bold else "DejaVuSans.ttf"
    return ImageFont.truetype(os.path.join(FONT_DIR, name), size)

# ── Drawing primitives ────────────────────────────────────────────────────────

def rrect(draw, xy, r, fill=None, outline=None, width=2):
    if fill:    draw.rounded_rectangle(xy, radius=r, fill=fill)
    if outline: draw.rounded_rectangle(xy, radius=r, outline=outline, width=width)

def pbar(img, draw, x, y, w, h, pct, color=PRIMARY, bg=MUTED):
    rrect(draw, [x, y, x+w, y+h], h//2, fill=bg)
    f = max(int(w*pct), h)
    rrect(draw, [x, y, x+f, y+h], h//2, fill=color)

def pill(draw, cx, cy, w, h, text, bg, fg=TEXT, fs=38):
    x0,y0 = cx-w//2, cy-h//2
    rrect(draw, [x0,y0,x0+w,y0+h], h//2, fill=bg)
    draw.text((cx,cy), text, font=fnt(fs,True), fill=fg, anchor="mm")

def alpha_overlay(img, pts, color_rgb, alpha=40):
    ov = Image.new("RGBA", img.size, (0,0,0,0))
    od = ImageDraw.Draw(ov)
    od.polygon(pts, fill=(*color_rgb, alpha))
    img.paste(ov, mask=ov)

# ── Per-size context ──────────────────────────────────────────────────────────

class Ctx:
    """Holds width/height and scaled font/spacing helpers."""
    def __init__(self, W, H, out_dir, label):
        self.W, self.H = W, H
        self.out = out_dir
        self.label = label
        os.makedirs(out_dir, exist_ok=True)
        # scale factor relative to base 1320 width
        self.s = W / 1320

    def sc(self, v):
        """Scale a pixel value."""
        return max(1, int(v * self.s))

    def fnt(self, size, bold=False):
        return fnt(self.sc(size), bold)

    def pad(self):
        return self.sc(60)

    def canvas(self):
        img = Image.new("RGB", (self.W, self.H), BG)
        return img, ImageDraw.Draw(img)

    def logo(self, img, draw, y):
        scale = 0.28 * self.s
        try:
            logo = Image.open(LOGO_PATH).convert("RGBA")
            nw, nh = int(logo.width*scale), int(logo.height*scale)
            logo = logo.resize((nw, nh), Image.LANCZOS)
            img.paste(logo, ((self.W-nw)//2, y), logo)
            return y + nh + self.sc(30)
        except:
            draw.text((self.W//2, y+self.sc(50)), "RAIMZEAL",
                      font=self.fnt(72, True), fill=PRIMARY, anchor="mm")
            return y + self.sc(120)

    def headline(self, draw, y, title, sub, color=TEXT):
        draw.text((self.W//2, y), title,
                  font=self.fnt(88, True), fill=color, anchor="mm")
        draw.text((self.W//2, y+self.sc(110)), sub,
                  font=self.fnt(46), fill=SUB, anchor="mm")
        return y + self.sc(200)

    def bottom_bar(self, draw):
        by = self.H - self.sc(220)
        draw.rectangle([0, by, self.W, self.H], fill=BG)
        rrect(draw, [self.sc(100), by+self.sc(30), self.W-self.sc(100), by+self.sc(120)],
              self.sc(40), fill=PRIMARY)
        draw.text((self.W//2, by+self.sc(75)), "Free Download  •  RAIMZEAL",
                  font=self.fnt(52, True), fill=TEXT, anchor="mm")
        draw.text((self.W//2, by+self.sc(155)), "Fitness · Nutrition · AI-Powered Wellness",
                  font=self.fnt(36), fill=SUB, anchor="mm")

    def stat_card(self, draw, x, y, w, h, label, val, unit="", color=PRIMARY):
        rrect(draw, [x,y,x+w,y+h], self.sc(28), fill=CARD)
        rrect(draw, [x,y,x+w,y+h], self.sc(28), outline=BORDER, width=2)
        draw.text((x+w//2, y+self.sc(38)),  label, font=self.fnt(34),       fill=SUB,   anchor="mm")
        draw.text((x+w//2, y+h//2+self.sc(10)), val, font=self.fnt(72,True), fill=color, anchor="mm")
        if unit:
            draw.text((x+w//2, y+h-self.sc(38)), unit, font=self.fnt(32), fill=SUB, anchor="mm")

# ── Screen builders ───────────────────────────────────────────────────────────

def screen_workout(c: Ctx):
    img, draw = c.canvas()
    y = c.logo(img, draw, y=c.sc(80))
    y = c.headline(draw, y+c.sc(60), "CRUSH YOUR GOALS",
                   "Track every rep, set & personal best", PRIMARY)

    pad = c.pad()
    cw = (c.W - pad*2 - c.sc(30)) // 3
    ch = c.sc(220)
    ry = y + c.sc(40)
    c.stat_card(draw, pad,           ry, cw, ch, "CALORIES", "847",  "kcal", SUCCESS)
    c.stat_card(draw, pad+cw+c.sc(15),  ry, cw, ch, "DURATION", "48",   "min",  GOLD)
    c.stat_card(draw, pad+(cw+c.sc(15))*2, ry, cw, ch, "VOLUME",  "12.4", "tons", PRIMARY)

    wcy = ry + ch + c.sc(40)
    rrect(draw, [pad, wcy, c.W-pad, wcy+c.sc(160)], c.sc(28), fill=CARD)
    rrect(draw, [pad, wcy, c.W-pad, wcy+c.sc(160)], c.sc(28), outline=PRIMARY, width=3)
    draw.text((pad+c.sc(40), wcy+c.sc(40)),  "ACTIVE WORKOUT",
              font=c.fnt(34,True), fill=PRIMARY)
    draw.text((pad+c.sc(40), wcy+c.sc(95)),  "Push Day — Chest & Triceps",
              font=c.fnt(44,True), fill=TEXT)
    pill(draw, c.W-c.sc(180), wcy+c.sc(80), c.sc(180), c.sc(60), "● LIVE",
         (46,139,87,60), SUCCESS, c.sc(36))

    exercises = [
        ("Bench Press",     "4 × 8",  "135 lbs", 0.78, True),
        ("Incline DB Press","3 × 10", "70 lbs",  0.60, True),
        ("Cable Fly",       "3 × 12", "40 lbs",  0.33, False),
        ("Tricep Pushdown", "3 × 15", "55 lbs",  0.00, False),
    ]
    exy = wcy + c.sc(195)
    for name, sets, weight, prog, done in exercises:
        rrect(draw, [pad, exy, c.W-pad, exy+c.sc(110)], c.sc(20),
              fill=(20,20,22) if not done else CARD)
        dot = SUCCESS if done else MUTED
        draw.ellipse([pad+c.sc(24), exy+c.sc(38), pad+c.sc(56), exy+c.sc(70)], fill=dot)
        draw.text((pad+c.sc(80), exy+c.sc(22)), name,
                  font=c.fnt(42,True), fill=TEXT if not done else SUB)
        draw.text((pad+c.sc(80), exy+c.sc(70)), f"{sets}  ·  {weight}",
                  font=c.fnt(34), fill=SUB)
        if prog > 0:
            pbar(img, draw, c.W-c.sc(230), exy+c.sc(85), c.sc(170), c.sc(8), prog,
                 SUCCESS if done else MUTED)
        exy += c.sc(130)

    cy2 = exy + c.sc(50)
    draw.text((pad, cy2), "WEEKLY VOLUME", font=c.fnt(38,True), fill=SUB)
    cy2 += c.sc(55)
    days = ["M","T","W","T","F","S","S"]
    vals = [0.5,0.8,0.3,0.9,0.6,1.0,0.4]
    bar_w  = c.sc(100)
    ch_max = c.sc(280)
    bspc   = (c.W - pad*2) // 7
    for i,(day,v) in enumerate(zip(days,vals)):
        bx = pad + i*bspc + bspc//2 - bar_w//2
        bh = int(ch_max*v)
        by2 = cy2 + ch_max - bh
        rrect(draw, [bx,by2,bx+bar_w,cy2+ch_max], c.sc(12),
              fill=PRIMARY if i<6 else GOLD)
        draw.text((bx+bar_w//2, cy2+ch_max+c.sc(28)), day,
                  font=c.fnt(34), fill=SUB, anchor="mm")

    c.bottom_bar(draw)
    path = f"{c.out}/01_workout.png"
    img.save(path)
    print(f"  ✓ {path}")

def screen_ovia_ai(c: Ctx):
    img, draw = c.canvas()
    y = c.logo(img, draw, y=c.sc(80))
    y = c.headline(draw, y+c.sc(60), "MEET OVIA AI",
                   "Your personal wellness coach, 24/7", ACCENT)

    pad = c.pad()
    chat_y = y + c.sc(30)
    messages = [
        ("user", "I want to lose 10 lbs in 3 months while building muscle"),
        ("ai",   "Great goal! Based on your stats, I recommend a slight caloric\ndeficit (–300 kcal/day) + progressive overload training 4×/week."),
        ("user", "What should I eat before my workout today?"),
        ("ai",   "With your 6 PM session coming up:\n• 40g carbs + 20g protein at 4:30 PM\n• Brown rice, chicken, banana works perfectly.\n• Hydrate with 500 ml water beforehand."),
        ("user", "Can you create a meal plan for tomorrow?"),
        ("ai",   "Done! I've built your personalised plan below ↓"),
    ]
    for role, text in messages:
        is_ai = role == "ai"
        lines  = text.split("\n")
        lh     = c.sc(46)
        msg_h  = max(c.sc(100), len(lines)*lh + c.sc(50))
        msg_w  = c.W - pad*2 - c.sc(80)

        if is_ai:
            draw.ellipse([pad, chat_y+c.sc(10), pad+c.sc(60), chat_y+c.sc(70)], fill=ACCENT)
            draw.text((pad+c.sc(30), chat_y+c.sc(40)), "O",
                      font=c.fnt(34,True), fill=TEXT, anchor="mm")
            bx = pad + c.sc(75)
            bw = msg_w - c.sc(75)
            rrect(draw, [bx,chat_y,bx+bw,chat_y+msg_h], c.sc(24), fill=(25,17,35))
            rrect(draw, [bx,chat_y,bx+bw,chat_y+msg_h], c.sc(24), outline=(80,40,120), width=2)
            tx, ty = bx+c.sc(24), chat_y+c.sc(24)
            for l in lines:
                if l: draw.text((tx,ty), l, font=c.fnt(38), fill=TEXT)
                ty += lh
        else:
            bx, bw = pad+c.sc(80), msg_w-c.sc(75)
            rrect(draw, [bx,chat_y,bx+bw,chat_y+msg_h], c.sc(24), fill=MUTED)
            tx, ty = bx+bw-c.sc(24), chat_y+c.sc(24)
            for l in lines:
                if l: draw.text((tx,ty), l, font=c.fnt(38), fill=TEXT, anchor="ra")
                ty += lh

        chat_y += msg_h + c.sc(28)

    pill_y = chat_y + c.sc(20)
    draw.text((pad, pill_y), "Suggested", font=c.fnt(34), fill=SUB)
    pill_y += c.sc(55)
    px = pad
    for label, col in [("💪 Build Muscle Plan", PRIMARY),
                        ("🥗 Nutrition Audit",   GOLD),
                        ("😴 Recovery Tips",     ACCENT)]:
        tw = int(draw.textlength(label, font=c.fnt(36,True))) + c.sc(60)
        if px + tw > c.W - c.sc(60):
            px = pad; pill_y += c.sc(90)
        rrect(draw, [px, pill_y, px+tw, pill_y+c.sc(72)], c.sc(36),
              fill=(20,20,24), outline=col, width=2)
        draw.text((px+c.sc(30), pill_y+c.sc(36)), label,
                  font=c.fnt(36,True), fill=col, anchor="lm")
        px += tw + c.sc(16)

    c.bottom_bar(draw)
    path = f"{c.out}/02_ovia_ai.png"
    img.save(path)
    print(f"  ✓ {path}")

def screen_nutrition(c: Ctx):
    img, draw = c.canvas()
    y = c.logo(img, draw, y=c.sc(80))
    y = c.headline(draw, y+c.sc(60), "FUEL YOUR BODY",
                   "Smart nutrition tracking & meal planning", GOLD)

    pad = c.pad()
    ro, ri = c.sc(180), c.sc(120)
    rcx, rcy = c.W//2, y + c.sc(220)
    draw.ellipse([rcx-ro,rcy-ro,rcx+ro,rcy+ro], fill=MUTED)
    for col,s,e in [(SUCCESS,0,126),(GOLD,126,288),(ACCENT,288,360)]:
        draw.pieslice([rcx-ro,rcy-ro,rcx+ro,rcy+ro],
                      start=-90+s, end=-90+e, fill=col)
    draw.ellipse([rcx-ri,rcy-ri,rcx+ri,rcy+ri], fill=BG)
    draw.text((rcx,rcy-c.sc(30)), "1,840", font=c.fnt(68,True), fill=TEXT, anchor="mm")
    draw.text((rcx,rcy+c.sc(28)), "/ 2,200 kcal", font=c.fnt(34), fill=SUB, anchor="mm")

    leg_y = rcy + ro + c.sc(40)
    for i,(lbl,g,col) in enumerate([("Protein","142g",SUCCESS),
                                     ("Carbs",  "207g",GOLD),
                                     ("Fat",     "47g",ACCENT)]):
        lw = (c.W-pad*2)//3 - c.sc(20)
        lx = pad + i*((c.W-pad*2)//3)
        rrect(draw, [lx,leg_y,lx+lw,leg_y+c.sc(120)], c.sc(20), fill=CARD)
        draw.rectangle([lx,leg_y,lx+6,leg_y+c.sc(120)], fill=col)
        draw.text((lx+lw//2,leg_y+c.sc(38)), lbl, font=c.fnt(32), fill=SUB, anchor="mm")
        draw.text((lx+lw//2,leg_y+c.sc(82)), g,   font=c.fnt(48,True), fill=col, anchor="mm")

    my = leg_y + c.sc(150)
    draw.text((pad,my), "TODAY'S MEALS", font=c.fnt(38,True), fill=SUB)
    my += c.sc(55)
    for meal,desc,kcal,col in [
        ("Breakfast","Oats + Banana + Whey Shake","487 kcal",SUCCESS),
        ("Lunch",    "Grilled Chicken Rice Bowl",  "612 kcal",GOLD),
        ("Snack",    "Greek Yogurt + Mixed Nuts",  "285 kcal",PRIMARY),
        ("Dinner",   "Salmon + Broccoli + Quinoa", "456 kcal",ACCENT),
    ]:
        rrect(draw, [pad,my,c.W-pad,my+c.sc(100)], c.sc(20), fill=CARD)
        draw.rectangle([pad,my,pad+6,my+c.sc(100)], fill=col)
        draw.text((pad+c.sc(28),my+c.sc(24)), meal, font=c.fnt(34,True), fill=col)
        draw.text((pad+c.sc(28),my+c.sc(65)), desc, font=c.fnt(36), fill=SUB)
        draw.text((c.W-pad-c.sc(20),my+c.sc(50)), kcal,
                  font=c.fnt(38,True), fill=TEXT, anchor="rm")
        my += c.sc(118)

    wy = my + c.sc(30)
    rrect(draw, [pad,wy,c.W-pad,wy+c.sc(100)], c.sc(20), fill=CARD)
    draw.text((pad+c.sc(28),wy+c.sc(30)), "💧  Hydration",
              font=c.fnt(38,True), fill=TEXT)
    draw.text((c.W-pad-c.sc(20),wy+c.sc(30)), "1.8L / 3L",
              font=c.fnt(38,True), fill=PRIMARY, anchor="rm")
    pbar(img, draw, pad+c.sc(28), wy+c.sc(75), c.W-pad*2-c.sc(56), c.sc(14), 0.60, PRIMARY)

    c.bottom_bar(draw)
    path = f"{c.out}/03_nutrition.png"
    img.save(path)
    print(f"  ✓ {path}")

def screen_community(c: Ctx):
    img, draw = c.canvas()
    y = c.logo(img, draw, y=c.sc(80))
    y = c.headline(draw, y+c.sc(60), "STRONGER TOGETHER",
                   "Join a thriving wellness community", GOLD)

    pad = c.pad()
    by  = y + c.sc(20)
    rrect(draw, [pad,by,c.W-pad,by+c.sc(140)], c.sc(28), fill=CARD)
    rrect(draw, [pad,by,c.W-pad,by+c.sc(140)], c.sc(28), outline=PRIMARY, width=2)
    bw = (c.W-pad*2)//3
    for i,(val,lbl) in enumerate([("48.2K","Members"),("12.6K","Posts/Week"),("4.9 ★","Rating")]):
        cx = pad + bw*i + bw//2
        draw.text((cx,by+c.sc(50)),  val, font=c.fnt(56,True), fill=PRIMARY, anchor="mm")
        draw.text((cx,by+c.sc(105)), lbl, font=c.fnt(34),       fill=SUB,    anchor="mm")
        if i<2:
            draw.line([pad+bw*(i+1),by+c.sc(25),pad+bw*(i+1),by+c.sc(115)], fill=BORDER, width=2)

    py = by + c.sc(175)
    draw.text((pad,py), "COMMUNITY FEED", font=c.fnt(38,True), fill=SUB)
    py += c.sc(55)
    for initials,name,text,ago,likes,comments,col in [
        ("DR","Dr. Raimzy",
         "Just hit a new PR! 225 lbs bench after 6 weeks on RAIMZEAL 🔥",
         "2m",284,47,PRIMARY),
        ("JM","Jake M.",
         "Week 3 nutrition check — down 4 lbs, energy through the roof. Ovia AI meal plans are 🐐",
         "18m",156,23,GOLD),
        ("SA","Sofia A.",
         "30-day yoga + strength challenge complete! Before & after inside 💪",
         "1h",412,89,ACCENT),
    ]:
        ph = c.sc(260)
        rrect(draw, [pad,py,c.W-pad,py+ph], c.sc(24), fill=CARD)
        draw.ellipse([pad+c.sc(20),py+c.sc(20),pad+c.sc(80),py+c.sc(80)], fill=col)
        draw.text((pad+c.sc(50),py+c.sc(50)), initials,
                  font=c.fnt(28,True), fill=TEXT, anchor="mm")
        draw.text((pad+c.sc(98),py+c.sc(28)), name, font=c.fnt(38,True), fill=TEXT)
        draw.text((c.W-pad-c.sc(20),py+c.sc(28)), ago,
                  font=c.fnt(32), fill=SUB, anchor="rm")
        words = text.split()
        line,lines2 = "",[]
        for w in words:
            if len(line)+len(w)<52: line+=(" " if line else "")+w
            else: lines2.append(line); line=w
        if line: lines2.append(line)
        ty2 = py+c.sc(85)
        for l in lines2[:3]:
            draw.text((pad+c.sc(20),ty2), l, font=c.fnt(36), fill=TEXT); ty2+=c.sc(48)
        draw.text((pad+c.sc(20),py+ph-c.sc(36)), f"♥ {likes}",
                  font=c.fnt(34,True), fill=col)
        draw.text((pad+c.sc(160),py+ph-c.sc(36)), f"💬 {comments}",
                  font=c.fnt(34), fill=SUB)
        py += ph + c.sc(28)

    ty3 = py + c.sc(10)
    draw.text((pad,ty3), "TRENDING", font=c.fnt(38,True), fill=SUB)
    ty3 += c.sc(55); tx = pad
    for tag in ["#RAIMZEALchallenge","#HealthcareAwareness","#FoodTherapy","#FitnessCommunity","#OviaAI"]:
        tw2 = int(draw.textlength(tag, font=c.fnt(34,True)))+c.sc(40)
        if tx+tw2 > c.W-pad: tx=pad; ty3+=c.sc(68)
        rrect(draw, [tx,ty3,tx+tw2,ty3+c.sc(56)], c.sc(28), fill=MUTED, outline=BORDER, width=2)
        draw.text((tx+c.sc(20),ty3+c.sc(28)), tag,
                  font=c.fnt(34,True), fill=PRIMARY, anchor="lm")
        tx += tw2+c.sc(16)

    c.bottom_bar(draw)
    path = f"{c.out}/04_community.png"
    img.save(path)
    print(f"  ✓ {path}")

def screen_progress(c: Ctx):
    img, draw = c.canvas()
    y = c.logo(img, draw, y=c.sc(80))
    y = c.headline(draw, y+c.sc(60), "SEE YOUR GROWTH",
                   "Visualize every milestone & body change", SUCCESS)

    pad = c.pad()
    cw  = (c.W-pad*2-c.sc(20))//2
    ch  = c.sc(180)
    for i,(lbl,val,delta,col) in enumerate([
        ("Body Weight","183 lbs","↓ 7 lbs",SUCCESS),
        ("Body Fat %", "14.2%",  "↓ 2.8%", PRIMARY),
        ("Muscle Mass","152 lbs","↑ 3 lbs", GOLD),
        ("VO₂ Max",    "48.3",   "↑ 4.1",   ACCENT),
    ]):
        cx = pad + (i%2)*(cw+c.sc(20))
        cy = y + c.sc(20) + (i//2)*(ch+c.sc(20))
        rrect(draw, [cx,cy,cx+cw,cy+ch], c.sc(24), fill=CARD)
        rrect(draw, [cx,cy,cx+cw,cy+ch], c.sc(24), outline=col, width=2)
        draw.text((cx+c.sc(24),cy+c.sc(28)),           lbl,   font=c.fnt(32),       fill=SUB)
        draw.text((cx+c.sc(24),cy+c.sc(80)),           val,   font=c.fnt(60,True),  fill=col)
        draw.text((cx+c.sc(24),cy+ch-c.sc(34)),        delta, font=c.fnt(34,True),  fill=SUCCESS)

    chart_y = y + c.sc(20) + 2*(ch+c.sc(20)) + c.sc(30)
    draw.text((pad,chart_y), "12-WEEK WEIGHT TREND", font=c.fnt(38,True), fill=SUB)
    chart_y += c.sc(50)
    chart_h  = c.sc(300)
    chart_w  = c.W - pad*2
    rrect(draw, [pad,chart_y,c.W-pad,chart_y+chart_h], c.sc(20), fill=CARD)
    for gi in range(5):
        gy = chart_y + int(chart_h*gi/4)
        draw.line([pad+c.sc(20),gy,c.W-pad-c.sc(20),gy], fill=BORDER, width=1)
    weights = [190,189,188,187,187,186,185,184,184,183,183,183]
    wmin,wmax = 181,192
    pts = []
    for i,w in enumerate(weights):
        px = pad+c.sc(20) + i*(chart_w-c.sc(40))//11
        py = chart_y+chart_h-c.sc(20) - int((w-wmin)/(wmax-wmin)*(chart_h-c.sc(40)))
        pts.append((px,py))
    fill_pts = [(pad+c.sc(20),chart_y+chart_h-c.sc(20))]+pts+[(c.W-pad-c.sc(20),chart_y+chart_h-c.sc(20))]
    alpha_overlay(img, fill_pts, PRIMARY, 40)
    draw = ImageDraw.Draw(img)
    for i in range(len(pts)-1):
        draw.line([pts[i],pts[i+1]], fill=PRIMARY, width=c.sc(4))
    for px,py in pts:
        draw.ellipse([px-c.sc(7),py-c.sc(7),px+c.sc(7),py+c.sc(7)], fill=PRIMARY)
    lx,ly = pts[-1]
    draw.ellipse([lx-c.sc(14),ly-c.sc(14),lx+c.sc(14),ly+c.sc(14)], fill=PRIMARY)
    draw.text((lx,ly-c.sc(36)), "183 lbs", font=c.fnt(32,True), fill=PRIMARY, anchor="mm")
    for i in range(0,12,2):
        px = pad+c.sc(20)+i*(chart_w-c.sc(40))//11
        draw.text((px,chart_y+chart_h+c.sc(20)), f"W{i+1}",
                  font=c.fnt(28), fill=SUB, anchor="mm")

    ay = chart_y + chart_h + c.sc(60)
    draw.text((pad,ay), "ACHIEVEMENTS", font=c.fnt(38,True), fill=SUB)
    ay += c.sc(55)
    aw = (c.W-pad*2-c.sc(30))//2
    for i,(icon,title,sub2,col) in enumerate([
        ("🏆","84-Day Streak",     "Consistency King",    GOLD),
        ("💪","First 100 Workouts","Century Club",        PRIMARY),
        ("⚡","PR Breaker",         "10 personal records", ACCENT),
        ("🥗","Clean Month",        "30 days on plan",     SUCCESS),
    ]):
        ax = pad + (i%2)*(aw+c.sc(30))
        ay2 = ay + (i//2)*c.sc(120)
        rrect(draw, [ax,ay2,ax+aw,ay2+c.sc(100)], c.sc(20), fill=CARD)
        draw.text((ax+c.sc(20),ay2+c.sc(50)), icon, font=c.fnt(44), fill=col, anchor="lm")
        draw.text((ax+c.sc(80),ay2+c.sc(28)), title, font=c.fnt(34,True), fill=col)
        draw.text((ax+c.sc(80),ay2+c.sc(66)), sub2,  font=c.fnt(28),      fill=SUB)

    c.bottom_bar(draw)
    path = f"{c.out}/05_progress.png"
    img.save(path)
    print(f"  ✓ {path}")

# ── Main ──────────────────────────────────────────────────────────────────────

SIZES = [
    (1320, 2868, "screenshots/iphone69", "iPhone 6.9\""),
    (1284, 2778, "screenshots/iphone65", "iPhone 6.5\""),
    (2048, 2732, "screenshots/ipad13",   "iPad 13\""),
]

SCREENS = [screen_workout, screen_ovia_ai, screen_nutrition,
           screen_community, screen_progress]

if __name__ == "__main__":
    for W, H, out, label in SIZES:
        print(f"\n→ {label}  {W}×{H}  →  {out}/")
        ctx = Ctx(W, H, out, label)
        for fn in SCREENS:
            fn(ctx)

    print("\n✅ All screenshots generated.")
    print("   screenshots/iphone69/ — upload to iPhone 6.9\" slot")
    print("   screenshots/iphone65/ — upload to iPhone 6.5\" slot")
    print("   screenshots/ipad13/   — upload to iPad 13\" slot")
