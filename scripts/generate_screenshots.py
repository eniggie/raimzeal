"""
RAIMZEAL App Store Screenshots Generator
Produces 5 screenshots at 1320x2868px (iPhone 6.9" required size)
Features: Workout, Ovia AI, Nutrition, Community, Progress
"""
from PIL import Image, ImageDraw, ImageFont, ImageFilter
import os
import math

# ── Constants ──────────────────────────────────────────────────────────────────
W, H = 1320, 2868
OUT_DIR = "screenshots"
LOGO_PATH = "artifacts/raimzeal-mobile/assets/images/logo.png"

# Brand colours
BG       = (10, 10, 11)
CARD     = (17, 17, 19)
MUTED    = (34, 34, 37)
BORDER   = (29, 29, 32)
PRIMARY  = (46, 139, 87)     # emerald green
GOLD     = (201, 168, 76)    # antique gold
ACCENT   = (139, 49, 199)    # purple
TEXT     = (250, 250, 250)
SUBTEXT  = (135, 135, 146)
SUCCESS  = (33, 196, 93)
WARNING  = (245, 159, 10)

# Fonts
FONT_DIR = "/usr/share/fonts/truetype/dejavu"
def font(size, bold=False):
    name = "DejaVuSans-Bold.ttf" if bold else "DejaVuSans.ttf"
    return ImageFont.truetype(os.path.join(FONT_DIR, name), size)

os.makedirs(OUT_DIR, exist_ok=True)

# ── Helpers ────────────────────────────────────────────────────────────────────

def new_canvas():
    img = Image.new("RGB", (W, H), BG)
    draw = ImageDraw.Draw(img)
    return img, draw

def draw_rounded_rect(draw, xy, radius, fill=None, outline=None, width=2):
    x0, y0, x1, y1 = xy
    r = radius
    if fill:
        draw.rounded_rectangle([x0, y0, x1, y1], radius=r, fill=fill)
    if outline:
        draw.rounded_rectangle([x0, y0, x1, y1], radius=r, outline=outline, width=width)

def draw_logo(img, draw, y=90, scale=0.28):
    try:
        logo = Image.open(LOGO_PATH).convert("RGBA")
        nw = int(logo.width * scale)
        nh = int(logo.height * scale)
        logo = logo.resize((nw, nh), Image.LANCZOS)
        x = (W - nw) // 2
        img.paste(logo, (x, y), logo)
        return y + nh + 30
    except Exception as e:
        # Fallback: draw text logo
        f = font(72, bold=True)
        draw.text((W//2, y + 50), "RAIMZEAL", font=f, fill=PRIMARY, anchor="mm")
        return y + 120

def draw_headline(draw, y, title, subtitle, title_color=TEXT):
    f_title = font(88, bold=True)
    f_sub   = font(46)
    draw.text((W//2, y), title, font=f_title, fill=title_color, anchor="mm")
    draw.text((W//2, y + 110), subtitle, font=f_sub, fill=SUBTEXT, anchor="mm")
    return y + 200

def draw_bottom_bar(draw):
    # Gradient-like bottom bar
    bar_y = H - 220
    draw.rectangle([0, bar_y, W, H], fill=(10, 10, 11))
    draw_rounded_rect(draw, [100, bar_y + 30, W - 100, bar_y + 120], 40,
                      fill=PRIMARY)
    f = font(52, bold=True)
    draw.text((W//2, bar_y + 75), "Free Download  •  RAIMZEAL", font=f,
              fill=(255, 255, 255), anchor="mm")
    # tagline
    f2 = font(36)
    draw.text((W//2, bar_y + 155), "Fitness · Nutrition · AI-Powered Wellness",
              font=f2, fill=SUBTEXT, anchor="mm")

def pill(draw, cx, cy, w, h, text, bg, fg=TEXT, fsize=38):
    x0, y0 = cx - w//2, cy - h//2
    draw_rounded_rect(draw, [x0, y0, x0+w, y0+h], h//2, fill=bg)
    draw.text((cx, cy), text, font=font(fsize, bold=True), fill=fg, anchor="mm")

def stat_card(draw, x, y, w, h, label, value, unit="", color=PRIMARY):
    draw_rounded_rect(draw, [x, y, x+w, y+h], 28, fill=CARD)
    draw_rounded_rect(draw, [x, y, x+w, y+h], 28, outline=BORDER, width=2)
    draw.text((x + w//2, y + 38), label, font=font(34), fill=SUBTEXT, anchor="mm")
    draw.text((x + w//2, y + h//2 + 10), value, font=font(72, bold=True), fill=color, anchor="mm")
    if unit:
        draw.text((x + w//2, y + h - 38), unit, font=font(32), fill=SUBTEXT, anchor="mm")

def progress_bar(draw, x, y, w, h, pct, color=PRIMARY, bg=MUTED):
    draw_rounded_rect(draw, [x, y, x+w, y+h], h//2, fill=bg)
    filled = int(w * pct)
    if filled > h:
        draw_rounded_rect(draw, [x, y, x+filled, y+h], h//2, fill=color)

def section_label(draw, x, y, text):
    draw.text((x, y), text, font=font(38, bold=True), fill=SUBTEXT)

# ── Screen 1: Workout ──────────────────────────────────────────────────────────

def screen_workout():
    img, draw = new_canvas()
    y = draw_logo(img, draw, y=80)
    y = draw_headline(draw, y + 60, "CRUSH YOUR GOALS", "Track every rep, set & personal best", title_color=PRIMARY)

    # Top row stats
    pad = 60
    card_w = (W - pad*2 - 30) // 3
    card_h = 220
    row_y = y + 40
    stat_card(draw, pad,               row_y, card_w, card_h, "CALORIES", "847",  "kcal", SUCCESS)
    stat_card(draw, pad + card_w + 15, row_y, card_w, card_h, "DURATION", "48",   "min",  GOLD)
    stat_card(draw, pad + (card_w+15)*2, row_y, card_w, card_h, "VOLUME",  "12.4", "tons", PRIMARY)

    # Active workout card
    wc_y = row_y + card_h + 40
    draw_rounded_rect(draw, [pad, wc_y, W - pad, wc_y + 160], 28, fill=CARD)
    draw_rounded_rect(draw, [pad, wc_y, W - pad, wc_y + 160], 28, outline=PRIMARY, width=3)
    draw.text((pad + 40, wc_y + 40), "ACTIVE WORKOUT", font=font(34, bold=True), fill=PRIMARY)
    draw.text((pad + 40, wc_y + 95), "Push Day — Chest & Triceps", font=font(44, bold=True), fill=TEXT)
    pill(draw, W - 180, wc_y + 80, 180, 60, "● LIVE", (46, 139, 87, 60), SUCCESS, 36)

    # Exercise list
    exercises = [
        ("Bench Press",    "4 × 8",  "135 lbs",  0.78, True),
        ("Incline DB Press","3 × 10", "70 lbs",   0.60, True),
        ("Cable Fly",      "3 × 12", "40 lbs",   0.33, False),
        ("Tricep Pushdown","3 × 15", "55 lbs",   0.00, False),
    ]
    ex_y = wc_y + 195
    for name, sets, weight, prog, done in exercises:
        row_col = (20, 20, 22) if not done else CARD
        draw_rounded_rect(draw, [pad, ex_y, W - pad, ex_y + 110], 20, fill=row_col)
        dot_color = SUCCESS if done else MUTED
        draw.ellipse([pad + 24, ex_y + 38, pad + 56, ex_y + 70], fill=dot_color)
        draw.text((pad + 80, ex_y + 22), name, font=font(42, bold=True), fill=TEXT if not done else SUBTEXT)
        draw.text((pad + 80, ex_y + 70), f"{sets}  ·  {weight}", font=font(34), fill=SUBTEXT)
        draw.text((W - pad - 20, ex_y + 55), sets, font=font(36, bold=True), fill=GOLD if done else SUBTEXT, anchor="rm")
        if prog > 0:
            progress_bar(draw, W - 230, ex_y + 85, 170, 8, prog, SUCCESS if done else MUTED)
        ex_y += 130

    # Weekly progress chart (simplified bars)
    chart_y = ex_y + 50
    section_label(draw, pad, chart_y, "WEEKLY VOLUME")
    chart_y += 55
    days = ["M","T","W","T","F","S","S"]
    vals = [0.5, 0.8, 0.3, 0.9, 0.6, 1.0, 0.4]
    bar_w = 100
    chart_h_max = 280
    bar_spacing = (W - pad*2) // 7
    for i, (day, v) in enumerate(zip(days, vals)):
        bx = pad + i * bar_spacing + bar_spacing//2 - bar_w//2
        bh = int(chart_h_max * v)
        by = chart_y + chart_h_max - bh
        clr = PRIMARY if i < 6 else GOLD
        draw_rounded_rect(draw, [bx, by, bx + bar_w, chart_y + chart_h_max], 12, fill=clr)
        draw.text((bx + bar_w//2, chart_y + chart_h_max + 28),
                  day, font=font(34), fill=SUBTEXT, anchor="mm")

    draw_bottom_bar(draw)
    img.save(f"{OUT_DIR}/01_workout.png")
    print("✓ 01_workout.png")

# ── Screen 2: Ovia AI ─────────────────────────────────────────────────────────

def screen_ovia_ai():
    img, draw = new_canvas()
    y = draw_logo(img, draw, y=80)
    y = draw_headline(draw, y + 60, "MEET OVIA AI", "Your personal wellness coach, 24/7", title_color=ACCENT)

    # Chat interface
    pad = 60
    chat_y = y + 30

    messages = [
        ("user",  "I want to lose 10 lbs in 3 months while building muscle"),
        ("ai",    "Great goal! Based on your stats, I recommend a slight caloric deficit (–300 kcal/day) combined with progressive overload training 4×/week."),
        ("user",  "What should I eat before my workout today?"),
        ("ai",    "With your 6 PM session coming up, aim for:\n• 40g carbs + 20g protein at 4:30 PM\n• Brown rice, chicken, banana works perfectly.\n• Hydrate with 500ml water beforehand."),
        ("user",  "Can you create a meal plan for tomorrow?"),
        ("ai",    "Done! I've built your personalised plan below ↓"),
    ]

    for role, text in messages:
        is_ai = role == "ai"
        lines = text.split("\n")
        line_h = 46
        msg_h = max(100, len(lines) * line_h + 50)
        msg_w = W - pad*2 - 80

        if is_ai:
            # AI bubble — left aligned with avatar
            draw.ellipse([pad, chat_y + 10, pad + 60, chat_y + 70], fill=ACCENT)
            draw.text((pad + 30, chat_y + 40), "O", font=font(34, bold=True), fill=TEXT, anchor="mm")
            bx = pad + 75
            draw_rounded_rect(draw, [bx, chat_y, bx + msg_w - 75, chat_y + msg_h], 24,
                              fill=(25, 17, 35))
            draw_rounded_rect(draw, [bx, chat_y, bx + msg_w - 75, chat_y + msg_h], 24,
                              outline=(80, 40, 120), width=2)
            tx, ta = bx + 24, "la"
            fc = TEXT
        else:
            # User bubble — right aligned
            bx = pad + 80
            bw = msg_w - 75
            draw_rounded_rect(draw, [bx, chat_y, bx + bw, chat_y + msg_h], 24, fill=MUTED)
            tx = bx + bw - 24
            ta = "ra"
            fc = TEXT

        ty = chat_y + 24
        for line in lines:
            if line:
                draw.text((tx, ty), line, font=font(38), fill=fc, anchor=f"l{'a' if ta=='la' else 'a'}" if ta == 'la' else 'ra')
            ty += line_h

        chat_y += msg_h + 28

    # Quick action pills
    pill_y = chat_y + 20
    draw.text((pad, pill_y), "Suggested", font=font(34), fill=SUBTEXT)
    pill_y += 55
    for label, col in [("💪 Build Muscle Plan", PRIMARY), ("🥗 Nutrition Audit", GOLD), ("😴 Recovery Tips", ACCENT)]:
        tw = draw.textlength(label, font=font(36, bold=True))
        pw = int(tw) + 60
        draw_rounded_rect(draw, [pad, pill_y, pad + pw, pill_y + 72], 36,
                          fill=(20,20,24), outline=col, width=2)
        draw.text((pad + 30, pill_y + 36), label, font=font(36, bold=True), fill=col, anchor="lm")
        pad_next = pad + pw + 20
        if pad_next + 200 > W - 60:
            pill_y += 90
            pad = 60
        else:
            pad = pad_next

    draw_bottom_bar(draw)
    img.save(f"{OUT_DIR}/02_ovia_ai.png")
    print("✓ 02_ovia_ai.png")

# ── Screen 3: Nutrition ────────────────────────────────────────────────────────

def screen_nutrition():
    img, draw = new_canvas()
    y = draw_logo(img, draw, y=80)
    y = draw_headline(draw, y + 60, "FUEL YOUR BODY", "Smart nutrition tracking & meal planning", title_color=GOLD)

    pad = 60

    # Macro ring (simplified with arcs)
    ring_cx, ring_cy = W // 2, y + 220
    ring_r_outer, ring_r_inner = 180, 120
    # Background ring
    draw.ellipse([ring_cx - ring_r_outer, ring_cy - ring_r_outer,
                  ring_cx + ring_r_outer, ring_cy + ring_r_outer], fill=MUTED)
    draw.ellipse([ring_cx - ring_r_inner, ring_cy - ring_r_inner,
                  ring_cx + ring_r_inner, ring_cy + ring_r_inner], fill=BG)

    # Macro arcs (protein 35%, carbs 45%, fat 20%)
    macros = [
        (SUCCESS, 0,   126),   # protein 35%
        (GOLD,    126, 288),   # carbs 45%
        (ACCENT,  288, 360),   # fat 20%
    ]
    for col, start, end in macros:
        bbox = [ring_cx - ring_r_outer, ring_cy - ring_r_outer,
                ring_cx + ring_r_outer, ring_cy + ring_r_outer]
        draw.pieslice(bbox, start=-90+start, end=-90+end, fill=col)

    # Inner hole
    draw.ellipse([ring_cx - ring_r_inner, ring_cy - ring_r_inner,
                  ring_cx + ring_r_inner, ring_cy + ring_r_inner], fill=BG)

    # Centre text
    draw.text((ring_cx, ring_cy - 30), "1,840", font=font(68, bold=True), fill=TEXT, anchor="mm")
    draw.text((ring_cx, ring_cy + 28), "/ 2,200 kcal", font=font(34), fill=SUBTEXT, anchor="mm")

    # Macro legend
    leg_y = ring_cy + ring_r_outer + 40
    for i, (label, g, pct, col) in enumerate([
        ("Protein", "142g", "35%", SUCCESS),
        ("Carbs",   "207g", "45%", GOLD),
        ("Fat",      "47g", "20%", ACCENT),
    ]):
        lx = pad + i * ((W - pad*2) // 3)
        lw = (W - pad*2) // 3 - 20
        draw_rounded_rect(draw, [lx, leg_y, lx+lw, leg_y+120], 20, fill=CARD)
        draw.rectangle([lx, leg_y, lx+6, leg_y+120], fill=col)
        draw.text((lx + lw//2, leg_y + 38), label, font=font(32), fill=SUBTEXT, anchor="mm")
        draw.text((lx + lw//2, leg_y + 82), g, font=font(48, bold=True), fill=col, anchor="mm")

    # Today's meals
    meals_y = leg_y + 150
    section_label(draw, pad, meals_y, "TODAY'S MEALS")
    meals_y += 55

    meals = [
        ("Breakfast", "Oats + Banana + Whey Shake", "487 kcal", SUCCESS),
        ("Lunch",     "Grilled Chicken Rice Bowl",   "612 kcal", GOLD),
        ("Snack",     "Greek Yogurt + Mixed Nuts",   "285 kcal", PRIMARY),
        ("Dinner",    "Salmon + Broccoli + Quinoa",  "456 kcal", ACCENT),
    ]
    for meal, desc, kcal, col in meals:
        draw_rounded_rect(draw, [pad, meals_y, W - pad, meals_y + 100], 20, fill=CARD)
        draw.rectangle([pad, meals_y, pad + 6, meals_y + 100], fill=col)
        draw.text((pad + 28, meals_y + 24), meal, font=font(34, bold=True), fill=col)
        draw.text((pad + 28, meals_y + 65), desc, font=font(36), fill=SUBTEXT)
        draw.text((W - pad - 20, meals_y + 50), kcal, font=font(38, bold=True), fill=TEXT, anchor="rm")
        meals_y += 118

    # Water tracker
    water_y = meals_y + 30
    draw_rounded_rect(draw, [pad, water_y, W - pad, water_y + 100], 20, fill=CARD)
    draw.text((pad + 28, water_y + 30), "💧  Hydration", font=font(38, bold=True), fill=TEXT)
    draw.text((W - pad - 20, water_y + 30), "1.8L / 3L", font=font(38, bold=True), fill=PRIMARY, anchor="rm")
    progress_bar(draw, pad + 28, water_y + 75, W - pad*2 - 56, 14, 0.60, PRIMARY)

    draw_bottom_bar(draw)
    img.save(f"{OUT_DIR}/03_nutrition.png")
    print("✓ 03_nutrition.png")

# ── Screen 4: Community ───────────────────────────────────────────────────────

def screen_community():
    img, draw = new_canvas()
    y = draw_logo(img, draw, y=80)
    y = draw_headline(draw, y + 60, "STRONGER TOGETHER", "Join a thriving wellness community", title_color=GOLD)

    pad = 60

    # Community stats banner
    banner_y = y + 20
    draw_rounded_rect(draw, [pad, banner_y, W - pad, banner_y + 140], 28, fill=CARD)
    draw_rounded_rect(draw, [pad, banner_y, W - pad, banner_y + 140], 28, outline=PRIMARY, width=2)
    bw = (W - pad*2) // 3
    for i, (val, lbl) in enumerate([("48.2K", "Members"), ("12.6K", "Posts/Week"), ("4.9 ★", "Rating")]):
        cx = pad + bw*i + bw//2
        draw.text((cx, banner_y + 50), val, font=font(56, bold=True), fill=PRIMARY, anchor="mm")
        draw.text((cx, banner_y + 105), lbl, font=font(34), fill=SUBTEXT, anchor="mm")
        if i < 2:
            draw.line([pad + bw*(i+1), banner_y + 25, pad + bw*(i+1), banner_y + 115],
                      fill=BORDER, width=2)

    # Feed posts
    posts_y = banner_y + 175
    section_label(draw, pad, posts_y, "COMMUNITY FEED")
    posts_y += 55

    posts = [
        ("DR", "Dr. Raimzy", "Just hit a new PR! 225 lbs bench press after 6 weeks on the RAIMZEAL program 🔥", "2m", 284, 47, PRIMARY),
        ("JM", "Jake M.",    "Week 3 nutrition check-in — down 4 lbs, energy through the roof. Ovia AI meal plans are 🐐", "18m", 156, 23, GOLD),
        ("SA", "Sofia A.",   "30-day yoga + strength challenge complete! Before & after progress photos inside 💪", "1h", 412, 89, ACCENT),
    ]
    for initials, name, text, time_ago, likes, comments, col in posts:
        ph = 260
        draw_rounded_rect(draw, [pad, posts_y, W - pad, posts_y + ph], 24, fill=CARD)
        # Avatar
        draw.ellipse([pad + 20, posts_y + 20, pad + 80, posts_y + 80], fill=col)
        draw.text((pad + 50, posts_y + 50), initials, font=font(28, bold=True), fill=TEXT, anchor="mm")
        # Name + time
        draw.text((pad + 98, posts_y + 28), name, font=font(38, bold=True), fill=TEXT)
        draw.text((W - pad - 20, posts_y + 28), time_ago, font=font(32), fill=SUBTEXT, anchor="rm")
        # Post text (wrap at ~55 chars)
        words = text.split()
        line, lines = "", []
        for w in words:
            if len(line) + len(w) < 52:
                line += (" " if line else "") + w
            else:
                lines.append(line); line = w
        if line: lines.append(line)
        ty = posts_y + 85
        for l in lines[:3]:
            draw.text((pad + 20, ty), l, font=font(36), fill=TEXT)
            ty += 48
        # Engagement
        draw.text((pad + 20, posts_y + ph - 36), f"♥ {likes}", font=font(34, bold=True), fill=col)
        draw.text((pad + 160, posts_y + ph - 36), f"💬 {comments}", font=font(34), fill=SUBTEXT)
        posts_y += ph + 28

    # Trending tags
    tags_y = posts_y + 10
    section_label(draw, pad, tags_y, "TRENDING")
    tags_y += 55
    tag_x = pad
    for tag in ["#RAIMZEALchallenge", "#HealthcareAwareness", "#FoodTherapy", "#FitnessCommunity", "#OviaAI"]:
        tw = int(draw.textlength(tag, font=font(34, bold=True))) + 40
        if tag_x + tw > W - pad:
            tag_x = pad; tags_y += 68
        draw_rounded_rect(draw, [tag_x, tags_y, tag_x + tw, tags_y + 56], 28,
                          fill=MUTED, outline=BORDER, width=2)
        draw.text((tag_x + 20, tags_y + 28), tag, font=font(34, bold=True), fill=PRIMARY, anchor="lm")
        tag_x += tw + 16

    draw_bottom_bar(draw)
    img.save(f"{OUT_DIR}/04_community.png")
    print("✓ 04_community.png")

# ── Screen 5: Progress ────────────────────────────────────────────────────────

def screen_progress():
    img, draw = new_canvas()
    y = draw_logo(img, draw, y=80)
    y = draw_headline(draw, y + 60, "SEE YOUR GROWTH", "Visualize every milestone & body change", title_color=SUCCESS)

    pad = 60

    # Summary cards
    card_h = 180
    card_w = (W - pad*2 - 20) // 2
    for i, (lbl, val, delta, col) in enumerate([
        ("Body Weight", "183 lbs", "↓ 7 lbs", SUCCESS),
        ("Body Fat %",  "14.2%",   "↓ 2.8%",  PRIMARY),
        ("Muscle Mass", "152 lbs", "↑ 3 lbs",  GOLD),
        ("VO₂ Max",     "48.3",    "↑ 4.1",    ACCENT),
    ]):
        row = i // 2
        col_i = i % 2
        cx = pad + col_i * (card_w + 20)
        cy = y + 20 + row * (card_h + 20)
        draw_rounded_rect(draw, [cx, cy, cx+card_w, cy+card_h], 24, fill=CARD)
        draw_rounded_rect(draw, [cx, cy, cx+card_w, cy+card_h], 24, outline=col, width=2)
        draw.text((cx + 24, cy + 28), lbl, font=font(32), fill=SUBTEXT)
        draw.text((cx + 24, cy + 80), val, font=font(60, bold=True), fill=col)
        draw.text((cx + 24, cy + card_h - 34), delta, font=font(34, bold=True),
                  fill=SUCCESS if "↑" in delta or "↓" in delta else SUBTEXT)

    # Weight trend line chart
    chart_y = y + 20 + 2 * (card_h + 20) + 30
    section_label(draw, pad, chart_y, "12-WEEK WEIGHT TREND")
    chart_y += 50
    chart_h = 300
    chart_w = W - pad*2
    draw_rounded_rect(draw, [pad, chart_y, W-pad, chart_y+chart_h], 20, fill=CARD)

    # Grid lines
    for gi in range(5):
        gy = chart_y + int(chart_h * gi / 4)
        draw.line([pad+20, gy, W-pad-20, gy], fill=BORDER, width=1)

    # Data points (weight going down over 12 weeks)
    weights = [190, 189, 188, 187, 187, 186, 185, 184, 184, 183, 183, 183]
    wmin, wmax = 181, 192
    pts = []
    for i, w in enumerate(weights):
        px = pad + 20 + i * (chart_w - 40) // 11
        py = chart_y + chart_h - 20 - int((w - wmin) / (wmax - wmin) * (chart_h - 40))
        pts.append((px, py))

    # Fill under curve
    fill_pts = [(pad+20, chart_y+chart_h-20)] + pts + [(W-pad-20, chart_y+chart_h-20)]
    fill_img = Image.new("RGBA", (W, H), (0,0,0,0))
    fill_draw = ImageDraw.Draw(fill_img)
    fill_draw.polygon(fill_pts, fill=(46, 139, 87, 40))
    img.paste(fill_img, mask=fill_img)
    draw = ImageDraw.Draw(img)

    # Line
    for i in range(len(pts)-1):
        draw.line([pts[i], pts[i+1]], fill=PRIMARY, width=4)
    # Dots
    for px, py in pts:
        draw.ellipse([px-7, py-7, px+7, py+7], fill=PRIMARY)
    # Last point highlight
    lx, ly = pts[-1]
    draw.ellipse([lx-14, ly-14, lx+14, ly+14], fill=PRIMARY)
    draw.text((lx, ly - 36), "183 lbs", font=font(32, bold=True), fill=PRIMARY, anchor="mm")

    # Week labels
    for i in range(0, 12, 2):
        px = pad + 20 + i * (chart_w - 40) // 11
        draw.text((px, chart_y + chart_h + 20), f"W{i+1}", font=font(28), fill=SUBTEXT, anchor="mm")

    # Streaks & achievements
    ach_y = chart_y + chart_h + 60
    section_label(draw, pad, ach_y, "ACHIEVEMENTS")
    ach_y += 55

    achievements = [
        ("🏆", "84-Day Streak",     "Consistency King",    GOLD),
        ("💪", "First 100 Workouts", "Century Club",        PRIMARY),
        ("⚡", "PR Breaker",         "10 personal records", ACCENT),
        ("🥗", "Clean Month",        "30 days on plan",     SUCCESS),
    ]
    ach_w = (W - pad*2 - 30) // 2
    for i, (icon, title, sub, col) in enumerate(achievements):
        ax = pad + (i % 2) * (ach_w + 30)
        ay = ach_y + (i // 2) * 120
        draw_rounded_rect(draw, [ax, ay, ax+ach_w, ay+100], 20, fill=CARD)
        draw.text((ax + 20, ay + 50), icon, font=font(44), fill=col, anchor="lm")
        draw.text((ax + 80, ay + 28), title, font=font(34, bold=True), fill=col)
        draw.text((ax + 80, ay + 66), sub, font=font(28), fill=SUBTEXT)

    draw_bottom_bar(draw)
    img.save(f"{OUT_DIR}/05_progress.png")
    print("✓ 05_progress.png")

# ── Run ───────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    print(f"Generating 5 RAIMZEAL App Store screenshots at {W}×{H}px ...")
    screen_workout()
    screen_ovia_ai()
    screen_nutrition()
    screen_community()
    screen_progress()
    print(f"\nAll done! Files saved to ./{OUT_DIR}/")
