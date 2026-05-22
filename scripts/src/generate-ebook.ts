import PDFDocument from 'pdfkit';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../../');
const ASSETS = path.join(ROOT, 'attached_assets');
const GEN_IMAGES = path.join(ROOT, 'generated/ebook/images');
const OUTPUT = path.join(ROOT, 'generated/RAIMZEAL-Complete-Guide.pdf');

fs.mkdirSync(path.join(ROOT, 'generated/ebook/images'), { recursive: true });

// ─── KDP 6" × 9" in points (1 pt = 1/72 inch) ──────────────────────────────
const W = 432;
const H = 648;
const ML = 54; // inner margin
const MR = 36; // outer margin
const MT = 50; // top margin
const MB = 54; // bottom margin (room for footer)
const CW = W - ML - MR; // content width = 342

// ─── Brand colours ───────────────────────────────────────────────────────────
const GREEN  = '#2E8B57';
const GOLD   = '#C9A84C';
const BLACK  = '#0d0d0d';
const DARK   = '#1a1a1a';
const BODY   = '#222222';
const MUTED  = '#555555';
const LIGHT  = '#F5FAF6';
const WHITE  = '#FFFFFF';

const DONATE_URL  = 'https://donate.stripe.com/aFa6oH7GE50z37Xdmh6kg00';
const DONATE_TEXT = '❤  Support RAIMZEAL (Free Forever) → donate.raimzeal.com';
const WEB_URL     = 'https://www.raimzeal.com';

// ─── Image helper ────────────────────────────────────────────────────────────
function img(name: string): string | null {
  const p = path.join(ASSETS, name);
  if (fs.existsSync(p)) return p;
  const g = path.join(GEN_IMAGES, name);
  if (fs.existsSync(g)) return g;
  return null;
}

// ─── Document setup ──────────────────────────────────────────────────────────
const doc = new PDFDocument({
  size: [W, H],
  margins: { top: MT, bottom: MB, left: ML, right: MR },
  info: {
    Title: 'RAIMZEAL: The Complete Guide to Free Fitness, Food Therapy & Healthcare',
    Author: 'Dr. Ephraim Oviawe (RAIMZY)',
    Subject: 'Fitness, Food Therapy, Healthcare Awareness',
    Keywords: 'RAIMZEAL, fitness, health, food therapy, wellness, free',
    Creator: 'ECONTEUR LLC',
    Producer: 'ECONTEUR LLC',
  },
  autoFirstPage: false,
});

const out = fs.createWriteStream(OUTPUT);
doc.pipe(out);

let pageNum = 0;

// ─── Footer helper ──────────────────────────────────────────────────────────
function addFooter(isNumbered = true) {
  const y = H - 38;
  doc.save();
  doc.moveTo(ML, y - 6).lineTo(W - MR, y - 6)
     .strokeColor(GREEN).lineWidth(0.5).stroke();
  doc.fontSize(7).fillColor(GREEN)
     .font('Helvetica')
     .text(DONATE_TEXT, ML, y, {
       width: CW - 40,
       link: DONATE_URL,
       underline: false,
     });
  if (isNumbered && pageNum > 4) {
    doc.fontSize(7).fillColor(MUTED)
       .text(String(pageNum - 4), W - MR - 20, y, { align: 'right', width: 20 });
  }
  doc.restore();
}

// ─── New page helper ─────────────────────────────────────────────────────────
function newPage(numbered = true) {
  doc.addPage({ size: [W, H], margins: { top: MT, bottom: MB, left: ML, right: MR } });
  pageNum++;
  addFooter(numbered);
  doc.y = MT;
}

// ─── Horizontal rule ────────────────────────────────────────────────────────
function rule(color = GREEN, weight = 0.5) {
  doc.moveTo(ML, doc.y).lineTo(W - MR, doc.y)
     .strokeColor(color).lineWidth(weight).stroke();
  doc.moveDown(0.4);
}

// ─── Full-bleed cover image helper ──────────────────────────────────────────
function coverPage(imgPath: string | null, extraContent: () => void) {
  doc.addPage({ size: [W, H], margins: { top: 0, bottom: 0, left: 0, right: 0 } });
  pageNum++;
  if (imgPath) {
    doc.image(imgPath, 0, 0, { width: W, height: H, cover: [W, H] });
  } else {
    doc.rect(0, 0, W, H).fill(BLACK);
  }
  doc.save();
  extraContent();
  doc.restore();
  addFooter(false);
}

// ─── Chapter opener helper ──────────────────────────────────────────────────
function chapterOpener(
  num: string,
  title: string,
  subtitle: string,
  imgPath: string | null,
  imgCaption?: string
) {
  newPage(true);
  // Dark header band
  doc.rect(ML - 10, doc.y - 4, CW + 10, 4).fill(GREEN);
  doc.moveDown(0.3);

  doc.font('Helvetica-Bold').fontSize(8).fillColor(GOLD)
     .text(`CHAPTER ${num}`, ML, doc.y, { characterSpacing: 2 });
  doc.moveDown(0.15);

  doc.font('Helvetica-Bold').fontSize(20).fillColor(GREEN)
     .text(title, ML, doc.y, { width: CW });
  doc.moveDown(0.2);

  doc.font('Helvetica-Oblique').fontSize(11).fillColor(MUTED)
     .text(subtitle, ML, doc.y, { width: CW });
  doc.moveDown(0.6);
  rule(GOLD, 1);

  if (imgPath && fs.existsSync(imgPath)) {
    const imgH = 160;
    doc.image(imgPath, ML, doc.y, { width: CW, height: imgH, cover: [CW, imgH] });
    doc.y += imgH + 4;
    if (imgCaption) {
      doc.fontSize(7).fillColor(MUTED).font('Helvetica-Oblique')
         .text(imgCaption, ML, doc.y, { width: CW, align: 'center' });
      doc.moveDown(0.4);
    }
  }
  doc.moveDown(0.4);
}

// ─── Body paragraph ──────────────────────────────────────────────────────────
function para(text: string, indent = 0) {
  checkPageBreak(60);
  doc.font('Helvetica').fontSize(10.5).fillColor(BODY)
     .text(text, ML + indent, doc.y, { width: CW - indent, align: 'justify', lineGap: 2 });
  doc.moveDown(0.6);
}

// ─── Section heading ─────────────────────────────────────────────────────────
function heading(text: string, level: 1 | 2 = 1) {
  checkPageBreak(80);
  doc.moveDown(0.3);
  if (level === 1) {
    doc.font('Helvetica-Bold').fontSize(13).fillColor(GREEN)
       .text(text, ML, doc.y, { width: CW });
    doc.moveDown(0.2);
    doc.moveTo(ML, doc.y).lineTo(ML + 60, doc.y)
       .strokeColor(GOLD).lineWidth(1.5).stroke();
    doc.moveDown(0.4);
  } else {
    doc.font('Helvetica-Bold').fontSize(11).fillColor(DARK)
       .text(text, ML, doc.y, { width: CW });
    doc.moveDown(0.3);
  }
}

// ─── Bullet list ─────────────────────────────────────────────────────────────
function bullet(items: string[], color = GREEN) {
  items.forEach(item => {
    checkPageBreak(40);
    doc.font('Helvetica-Bold').fontSize(10.5).fillColor(color)
       .text('•', ML, doc.y, { continued: true, width: 14 });
    doc.font('Helvetica').fontSize(10.5).fillColor(BODY)
       .text(' ' + item, { width: CW - 14, lineGap: 1.5 });
    doc.moveDown(0.2);
  });
  doc.moveDown(0.3);
}

// ─── Callout box ─────────────────────────────────────────────────────────────
function callout(text: string, bgColor = '#E8F5EE', borderColor = GREEN) {
  checkPageBreak(80);
  const bh = Math.min(doc.heightOfString(text, { width: CW - 20 }) + 20, 200);
  doc.rect(ML, doc.y, CW, bh).fill(bgColor);
  doc.rect(ML, doc.y, 3, bh).fill(borderColor);
  doc.font('Helvetica-Oblique').fontSize(10.5).fillColor(DARK)
     .text(text, ML + 12, doc.y + 10, { width: CW - 22, lineGap: 2 });
  doc.y += bh + 10;
  doc.moveDown(0.3);
}

// ─── Quote block ─────────────────────────────────────────────────────────────
function quote(text: string, attribution?: string) {
  checkPageBreak(80);
  doc.moveDown(0.3);
  doc.font('Helvetica-Oblique').fontSize(12).fillColor(GREEN)
     .text(`"${text}"`, ML + 16, doc.y, { width: CW - 32, align: 'center', lineGap: 2 });
  doc.moveDown(0.3);
  if (attribution) {
    doc.font('Helvetica-Bold').fontSize(9).fillColor(GOLD)
       .text(`— ${attribution}`, ML, doc.y, { width: CW, align: 'center' });
    doc.moveDown(0.3);
  }
  doc.moveDown(0.3);
}

// ─── Two-column stat box ──────────────────────────────────────────────────────
function statBox(stats: { label: string; value: string }[]) {
  checkPageBreak(100);
  const colW = (CW - 8) / 2;
  let startY = doc.y;
  stats.forEach((s, i) => {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const x = ML + col * (colW + 8);
    const y = startY + row * 54;
    doc.rect(x, y, colW, 48).fill(LIGHT);
    doc.rect(x, y, colW, 3).fill(GREEN);
    doc.font('Helvetica-Bold').fontSize(18).fillColor(GREEN)
       .text(s.value, x + 6, y + 8, { width: colW - 12 });
    doc.font('Helvetica').fontSize(8).fillColor(MUTED)
       .text(s.label, x + 6, y + 31, { width: colW - 12 });
  });
  const rows = Math.ceil(stats.length / 2);
  doc.y = startY + rows * 54 + 10;
  doc.moveDown(0.3);
}

// ─── Inline image helper ─────────────────────────────────────────────────────
function inlineImage(imgPath: string | null, caption?: string, h = 140) {
  if (!imgPath || !fs.existsSync(imgPath)) return;
  checkPageBreak(h + 30);
  doc.image(imgPath, ML, doc.y, { width: CW, height: h, cover: [CW, h] });
  doc.y += h + 4;
  if (caption) {
    doc.font('Helvetica-Oblique').fontSize(7.5).fillColor(MUTED)
       .text(caption, ML, doc.y, { width: CW, align: 'center' });
    doc.moveDown(0.4);
  }
  doc.moveDown(0.3);
}

// ─── Page break check ────────────────────────────────────────────────────────
function checkPageBreak(needed = 60) {
  if (doc.y + needed > H - MB - 10) {
    newPage(true);
  }
}

// ─── TOC entries (collected for reference only) ──────────────────────────────
function tocEntry(_title: string) { /* tracked inline on TOC page */ }

// ════════════════════════════════════════════════════════════════════════════
//  COVER PAGE
// ════════════════════════════════════════════════════════════════════════════
coverPage(img('C480BCA2-7858-48E6-BCAD-6CA847828E84_1779388031282.png'), () => {
  // dark gradient overlay at bottom
  doc.rect(0, H * 0.55, W, H * 0.45).fill('rgba(0,0,0,0.82)');

  // Logo top-left
  const logo = img('IMG_1513_1779388174602.jpeg') || img('002FEB67-8D79-4211-94B8-51ECBB9D3E78_1779388031282.png');
  if (logo) doc.image(logo, 12, 12, { width: 64, height: 64 });

  doc.font('Helvetica-Bold').fontSize(28).fillColor(WHITE)
     .text('RAIMZEAL', ML, H * 0.57, { width: CW, align: 'center' });
  doc.font('Helvetica').fontSize(11).fillColor(GOLD)
     .text('The Complete Guide to Free Fitness,', ML, H * 0.65, { width: CW, align: 'center' });
  doc.font('Helvetica').fontSize(11).fillColor(GOLD)
     .text('Food Therapy & Healthcare Awareness', ML, H * 0.70, { width: CW, align: 'center' });

  doc.font('Helvetica-Oblique').fontSize(9).fillColor('#cccccc')
     .text('By Dr. Ephraim Oviawe  (RAIMZY)', ML, H * 0.77, { width: CW, align: 'center' });
  doc.font('Helvetica').fontSize(8).fillColor('#aaaaaa')
     .text('Published by ECONTEUR LLC  |  www.raimzeal.com', ML, H * 0.82, { width: CW, align: 'center' });
  doc.font('Helvetica').fontSize(8).fillColor(GREEN)
     .text('FREE FOREVER — WELLNESS. POWER. YOU.', ML, H * 0.87, { width: CW, align: 'center' });
});

// ════════════════════════════════════════════════════════════════════════════
//  TITLE PAGE (page 2)
// ════════════════════════════════════════════════════════════════════════════
newPage(false);
const logo2 = img('IMG_1513_1779388174602.jpeg') || img('002FEB67-8D79-4211-94B8-51ECBB9D3E78_1779388031282.png');
if (logo2) {
  doc.image(logo2, (W - 90) / 2, MT + 10, { width: 90, height: 90 });
  doc.y = MT + 110;
}
doc.font('Helvetica-Bold').fontSize(24).fillColor(GREEN)
   .text('RAIMZEAL', ML, doc.y, { width: CW, align: 'center' });
doc.moveDown(0.3);
doc.font('Helvetica').fontSize(12).fillColor(GOLD)
   .text('The Complete Guide to', ML, doc.y, { width: CW, align: 'center' });
doc.font('Helvetica-Bold').fontSize(13).fillColor(GOLD)
   .text('Free Fitness, Food Therapy &', ML, doc.y + 18, { width: CW, align: 'center' });
doc.font('Helvetica-Bold').fontSize(13).fillColor(GOLD)
   .text('Healthcare Awareness', ML, doc.y + 36, { width: CW, align: 'center' });
doc.y += 60;
doc.moveTo(W / 2 - 60, doc.y).lineTo(W / 2 + 60, doc.y)
   .strokeColor(GREEN).lineWidth(1).stroke();
doc.moveDown(1.2);
doc.font('Helvetica-Bold').fontSize(11).fillColor(DARK)
   .text('Dr. Ephraim Oviawe  (RAIMZY)', ML, doc.y, { width: CW, align: 'center' });
doc.moveDown(0.4);
doc.font('Helvetica').fontSize(9).fillColor(MUTED)
   .text('PhD Leadership & Business Development  |  MBA Information Technology', ML, doc.y, { width: CW, align: 'center' });
doc.font('Helvetica').fontSize(9).fillColor(MUTED)
   .text('Master of Theology  |  PMP  |  CSM  |  CST', ML, doc.y + 14, { width: CW, align: 'center' });
doc.y += 36;
doc.font('Helvetica').fontSize(8).fillColor(MUTED)
   .text('ECONTEUR LLC  |  www.econteur.com', ML, doc.y, { width: CW, align: 'center' });
doc.moveDown(0.2);
doc.font('Helvetica').fontSize(8).fillColor(MUTED)
   .text('First Edition, 2025', ML, doc.y, { width: CW, align: 'center' });

// ════════════════════════════════════════════════════════════════════════════
//  COPYRIGHT PAGE (page 3)
// ════════════════════════════════════════════════════════════════════════════
newPage(false);
doc.y = H / 2 - 60;
doc.font('Helvetica-Bold').fontSize(10).fillColor(DARK)
   .text('Copyright © 2025 ECONTEUR LLC. All rights reserved.', ML, doc.y, { width: CW, align: 'center' });
doc.moveDown(0.8);
doc.font('Helvetica').fontSize(8.5).fillColor(MUTED)
   .text(
     'RAIMZEAL is a free, non-profit wellness platform operated by ECONTEUR LLC, a United States Limited Liability Company registered in Arizona. ' +
     'No part of this publication may be reproduced, distributed, or transmitted in any form without the prior written permission of ECONTEUR LLC, ' +
     'except for brief quotations in reviews and certain non-commercial uses permitted by copyright law.\n\n' +
     'RAIMZEAL is not a substitute for professional medical advice, diagnosis, or treatment. Always seek the advice of your physician or other ' +
     'qualified health provider with any questions you may have regarding a medical condition.\n\n' +
     'Platform: www.raimzeal.com\n' +
     'Business: www.econteur.com\n' +
     'Author: www.raimzy.com\n' +
     'Email: support@raimzeal.com\n' +
     'Support the mission: ' + DONATE_URL,
     ML, doc.y, { width: CW, align: 'center', lineGap: 2 }
   );

// ════════════════════════════════════════════════════════════════════════════
//  DEDICATION PAGE (page 4)
// ════════════════════════════════════════════════════════════════════════════
newPage(false);
doc.y = H / 2 - 80;
doc.moveTo(W / 2 - 40, doc.y).lineTo(W / 2 + 40, doc.y)
   .strokeColor(GOLD).lineWidth(1).stroke();
doc.moveDown(1);
doc.font('Helvetica-Oblique').fontSize(12).fillColor(DARK)
   .text('To every person who has ever felt that a healthy life', ML, doc.y, { width: CW, align: 'center' });
doc.font('Helvetica-Oblique').fontSize(12).fillColor(DARK)
   .text('was out of reach — this platform was built for you.', ML, doc.y + 18, { width: CW, align: 'center' });
doc.y += 50;
doc.font('Helvetica-Oblique').fontSize(10).fillColor(MUTED)
   .text('Health is not a privilege. It is a right.', ML, doc.y, { width: CW, align: 'center' });
doc.y += 22;
doc.font('Helvetica-Bold').fontSize(10).fillColor(GREEN)
   .text('— Dr. Ephraim Oviawe (RAIMZY)', ML, doc.y, { width: CW, align: 'center' });
doc.y += 30;
doc.moveTo(W / 2 - 40, doc.y).lineTo(W / 2 + 40, doc.y)
   .strokeColor(GOLD).lineWidth(1).stroke();

// ════════════════════════════════════════════════════════════════════════════
//  TABLE OF CONTENTS (page 5)
// ════════════════════════════════════════════════════════════════════════════
newPage(false);
doc.font('Helvetica-Bold').fontSize(18).fillColor(GREEN)
   .text('TABLE OF CONTENTS', ML, doc.y, { width: CW });
doc.moveDown(0.3);
rule(GOLD, 1.5);
doc.moveDown(0.5);

const tocItems: Array<{ label: string; isChapter: boolean }> = [
  { label: 'Foreword — A Letter from the Founder', isChapter: false },
  { label: 'Chapter 1  —  What Is RAIMZEAL?', isChapter: true },
  { label: 'Chapter 2  —  Meet Dr. Ephraim Oviawe (RAIMZY)', isChapter: true },
  { label: 'Chapter 3  —  Your Fitness Foundation', isChapter: true },
  { label: 'Chapter 4  —  Food Therapy: Eat Your Way to Wellness', isChapter: true },
  { label: 'Chapter 5  —  Tracking Your Progress', isChapter: true },
  { label: 'Chapter 6  —  Ovia AI: Your Personal Coach', isChapter: true },
  { label: 'Chapter 7  —  Your Journey on the Web', isChapter: true },
  { label: 'Chapter 8  —  The RAIMZEAL Mobile App', isChapter: true },
  { label: 'Chapter 9  —  Complete Feature Reference', isChapter: true },
  { label: 'Chapter 10  —  The Future of RAIMZEAL', isChapter: true },
  { label: 'Chapter 11  —  RAIMZEAL & Humanity', isChapter: true },
  { label: 'Chapter 12  —  How to Support the Mission', isChapter: true },
  { label: 'Acknowledgements', isChapter: false },
  { label: 'Resources & Important Links', isChapter: false },
  { label: 'About the Author', isChapter: false },
];

tocItems.forEach((item) => {
  const indent = item.isChapter ? 8 : 0;
  const sz = item.isChapter ? 10.5 : 9.5;
  const col = item.isChapter ? DARK : MUTED;
  const fontName = item.isChapter ? 'Helvetica-Bold' : 'Helvetica';
  doc.rect(ML, doc.y, 3, 14).fill(item.isChapter ? GREEN : GOLD);
  doc.font(fontName).fontSize(sz).fillColor(col)
     .text(item.label, ML + 10 + indent, doc.y + 1, { width: CW - 10 - indent });
  doc.moveDown(item.isChapter ? 0.35 : 0.3);
});
doc.moveDown(0.4);

// ════════════════════════════════════════════════════════════════════════════
//  FOREWORD
// ════════════════════════════════════════════════════════════════════════════
newPage(true);
tocEntry('Foreword');
doc.font('Helvetica-Bold').fontSize(16).fillColor(GREEN)
   .text('Foreword', ML, doc.y, { width: CW });
doc.moveDown(0.2);
rule(GOLD, 1);
const drPhoto = img('IMG_1211_1779388174602.png') || img('IMG_1200_1779388031282.png');
if (drPhoto) {
  doc.image(drPhoto, ML, doc.y, { width: 80, height: 100 });
  doc.font('Helvetica-Bold').fontSize(10.5).fillColor(DARK)
     .text('Dr. Ephraim Oviawe PHD, MBA, MTS, CST, AMA, DMIPRO, CSM, PMP (RAIMZY)\nFounder, RAIMZEAL | CEO, ECONTEUR LLC', ML + 90, doc.y + 18, { width: CW - 90 });
  doc.y += 110;
} else {
  doc.moveDown(0.5);
}
doc.font('Helvetica-Oblique').fontSize(11).fillColor(DARK)
   .text('A Note from the Founder', ML, doc.y, { width: CW });
doc.moveDown(0.5);
para(
  'When I set out to build RAIMZEAL, I made one non-negotiable promise to myself and to the world: ' +
  'this platform would always be completely free. No subscriptions. No tiers. No ads. No hidden fees. ' +
  'Just pure, high-quality health and wellness guidance — for every human being on earth, regardless of ' +
  'where they live, how much they earn, or what language they speak.'
);
para(
  'I have spent decades studying leadership, theology, technology, marketing, and healthcare. ' +
  'I hold multiple advanced degrees and certifications across disciplines that rarely connect. ' +
  'RAIMZEAL is the convergence of all that knowledge, distilled into a single, accessible platform ' +
  'that anyone can use — from a teenager in Phoenix, Arizona to a farmer in rural Africa.'
);
para(
  'This book is your complete guide to RAIMZEAL. It will show you what the platform does today, ' +
  'what it is becoming, and why it matters for humanity. I also want you to understand the vision — ' +
  'the burning belief that if we give people the right tools, knowledge, and consistent guidance, ' +
  'they can transform their health, their families, and their communities.'
);
callout(
  '"RAIMZEAL was built from zeal — my artist name RAIMZY combined with the word ZEAL. ' +
  'Zeal means passionate, enthusiastic commitment. That is exactly what this platform represents: ' +
  'a passionate commitment to your health, for free, forever." — Dr. Ephraim Oviawe'
);
para(
  'I want to thank every person who has supported this mission — through donations, by sharing ' +
  'the platform, through prayer, encouragement, and simply showing up. You are co-creators of ' +
  'what RAIMZEAL is becoming.'
);
para(
  'Read this book. Use the platform. Share it with everyone you know. And if you are able, ' +
  'consider making a small donation to help keep it free for the next person who needs it most.'
);
doc.font('Helvetica-Bold').fontSize(10.5).fillColor(GREEN)
   .text('With gratitude and purpose,', ML, doc.y);
doc.moveDown(0.3);
doc.font('Helvetica-Bold').fontSize(11).fillColor(DARK)
   .text('Dr. Ephraim Oviawe (RAIMZY)', ML, doc.y);
doc.font('Helvetica').fontSize(9).fillColor(MUTED)
   .text('Founder, RAIMZEAL  |  CEO, ECONTEUR LLC', ML, doc.y + 14);

// ════════════════════════════════════════════════════════════════════════════
//  CHAPTER 1 — WHAT IS RAIMZEAL?
// ════════════════════════════════════════════════════════════════════════════
chapterOpener('ONE', 'What Is RAIMZEAL?', 'Born from zeal. Built for humanity.',
  img('A3A3FA6D-505C-4B19-8DA0-8ED87069DC08_1779388031282.png'),
  'RAIMZEAL: The all-in-one free fitness, food therapy, and healthcare awareness platform'
);
tocEntry('Chapter 1 — What Is RAIMZEAL?');
para(
  'RAIMZEAL is a free, non-profit fitness, food therapy, and healthcare awareness platform created ' +
  'by Dr. Ephraim Oviawe — known worldwide by his artist name RAIMZY — and operated by ECONTEUR LLC. ' +
  'The platform exists for one singular purpose: to make world-class health and wellness guidance ' +
  'available to every person on earth, at zero cost, forever.'
);
heading('The Name');
para(
  'The name RAIMZEAL is a fusion of two powerful ideas. "RAIMZY" is the artist name of its founder ' +
  '— a name that carries his identity as a creator, healer, and visionary. "ZEAL" is a word that ' +
  'means passionate, fierce, unrelenting dedication. Together, RAIMZEAL means: a passionate, ' +
  'purposeful pursuit of wellness for all.'
);
heading('The Three Pillars');
statBox([
  { value: 'FITNESS', label: 'Structured workouts, programs & habit tracking' },
  { value: 'FOOD\nTHERAPY', label: 'Nutrition planning and healing foods' },
  { value: 'HEALTH\nAWARENESS', label: 'Track progress, know your body' },
  { value: 'AI COACH', label: 'Ovia AI — 24/7 personal guidance' },
]);
para(
  'Every feature on RAIMZEAL was designed with three questions in mind: Does this actually help someone get healthier? ' +
  'Is it easy enough that a first-time user can understand it immediately? And can we make it free? ' +
  'If the answer to all three was yes, the feature made it in.'
);
heading('Who RAIMZEAL Is For');
bullet([
  'Complete beginners who have never followed a fitness routine',
  'Busy professionals who have no time to waste on complicated apps',
  'People recovering from illness who need gentle, food-based healing guidance',
  'Athletes and advanced trainers who want structured programs and tracking',
  'Parents, caregivers, and community leaders who want to bring wellness to others',
  'Anyone, anywhere in the world — no equipment required for many programs',
]);
callout(
  'RAIMZEAL is the only free platform in the world that combines professional fitness programming, ' +
  'AI-powered coaching, food therapy guidance, and detailed health tracking — with no premium tier, ' +
  'no ads, and no data selling. Ever.'
);
quote(
  'Free access. Personal coaching. Food therapy. Wellness support. Be early. Be ready. Be better.',
  'RAIMZEAL Mission Statement'
);

// ════════════════════════════════════════════════════════════════════════════
//  CHAPTER 2 — MEET YOUR GUIDE: DR. EPHRAIM OVIAWE
// ════════════════════════════════════════════════════════════════════════════
chapterOpener('TWO', 'Meet Your Guide', 'Dr. Ephraim Oviawe — Scholar. Visionary. Artist. Leader.',
  img('BFF9F726-FFA2-4159-AEE8-5F88B35A1CC4_1779388174602.png'),
  'Dr. Ephraim Oviawe — author, strategist, technologist, and founder of RAIMZEAL'
);
tocEntry('Chapter 2 — Meet Dr. Ephraim Oviawe (RAIMZY)');
heading('A Life Built on Purpose');
para(
  'Dr. Ephraim Oviawe is one of the rare human beings who has mastered multiple disciplines simultaneously. ' +
  'He holds doctoral and master\'s degrees in leadership, theology, business, and information technology. ' +
  'He is a Certified Surgical Technologist, a Project Management Professional, a Certified Scrum Master, ' +
  'a music artist, an author, a business builder, and now — the founder of one of the most ambitious ' +
  'free wellness platforms in the world.'
);
heading('Academic Credentials');
bullet([
  'PhD in Leadership & Business Development — Higher-Place Christian University (HPCU)',
  'Master\'s in Theology — Higher-Place Christian University (HPCU)',
  'MBA in Information Technology — Southern New Hampshire University (SNHU)',
  'Bachelor of Science in Business Administration — SNHU',
  'Bachelor of Science in Leadership — HPCU',
  'Digital Marketing Diploma — Open University',
]);
heading('Professional Certifications');
bullet([
  'Project Management Professional (PMP) — Project Management Institute',
  'Certified Scrum Master (CSM) — Scrum Alliance',
  'Certified Surgical Technologist (CST)',
  'Google Digital Marketing & E-Commerce',
  'Google Project Management',
  'HubSpot SEO, Inbound Marketing, Email Marketing & Social Media',
  'AI Content Creation & Automation',
  'Healthcare Compliance, Medical Coding & Billing',
  'Cybersecurity Fundamentals & Cloud Computing',
  'Data Analytics & Business Intelligence',
]);

const royalPhoto = img('83A426E8-9A3E-43F5-AF23-CA7ABF1075D6_1779388174602.png');
if (royalPhoto) {
  checkPageBreak(160);
  inlineImage(royalPhoto, 'Dr. Ephraim Oviawe — a leader who walks with purpose and principle', 130);
}

heading('RAIMZY — The Artist');
para(
  'Beyond his academic and professional accomplishments, Dr. Oviawe is known globally as RAIMZY — ' +
  'a music artist whose work spans inspiration, health empowerment, and spiritual depth. ' +
  'His music is available on all major streaming platforms, and his presence on social media ' +
  'under @raimzysocial reaches communities worldwide.'
);
para(
  'His books, available on Amazon, carry his philosophy into print — connecting leadership, ' +
  'creativity, faith, and health into a unified vision for human flourishing. You can find his ' +
  'author page at amazon.com/author/dr.ephraim-oviawe.'
);
heading('The Decision to Build RAIMZEAL for Free');
para(
  'Dr. Oviawe made a deliberate, principled decision to make RAIMZEAL completely free. ' +
  'When the world\'s wealthiest technology companies monetize health data, Dr. Oviawe chose ' +
  'the opposite path. RAIMZEAL runs on voluntary donations and the support of ECONTEUR LLC — ' +
  'because he believes health is a human right, not a product.'
);

const refusePhoto = img('749F1B8C-6AAB-4995-BD84-BA54727FFFF6_1779388174602.png');
if (refusePhoto) {
  checkPageBreak(160);
  inlineImage(refusePhoto, 'A man of principle: Dr. Oviawe\'s commitment to integrity in everything he builds', 130);
}

callout(
  'Where others see a business opportunity in your health, Dr. Oviawe sees a responsibility. ' +
  'RAIMZEAL will never be sold. It will never have a premium tier. It will never run ads. ' +
  'It exists purely to serve you — and that is a promise backed by his character and his credentials.'
);
heading('Connect with Dr. Oviawe');
const links = [
  ['Official Website', 'https://www.raimzy.com'],
  ['Linktree (All Resources)', 'https://linktr.ee/Raimzy'],
  ['Music', 'https://unitedmasters.com/raimzy'],
  ['Amazon Author Page', 'https://www.amazon.com/author/dr.ephraim-oviawe'],
  ['ECONTEUR LLC', 'https://www.econteur.com'],
  ['Innovation Hub', 'https://www.v3edge.com'],
  ['Social Media', '@raimzysocial'],
  ['RAIMZEAL Platform', 'https://www.raimzeal.com'],
];
links.forEach(([label, url]) => {
  checkPageBreak(20);
  doc.font('Helvetica-Bold').fontSize(10).fillColor(DARK)
     .text(`${label}: `, ML, doc.y, { continued: true, width: CW });
  doc.font('Helvetica').fontSize(10).fillColor(GREEN)
     .text(url, { link: url.startsWith('http') ? url : undefined });
  doc.moveDown(0.25);
});

// ════════════════════════════════════════════════════════════════════════════
//  CHAPTER 3 — YOUR FITNESS FOUNDATION
// ════════════════════════════════════════════════════════════════════════════
chapterOpener('THREE', 'Your Fitness Foundation', 'Structured training for every level. Every goal. Every body.',
  img('ch1-fitness-community.png'),
  'RAIMZEAL brings professional-grade fitness programming to everyone, for free'
);
tocEntry('Chapter 3 — Your Fitness Foundation');
para(
  'Fitness is the first pillar of RAIMZEAL, and it is built on a foundation of professional-grade ' +
  'programming that was previously only available through expensive personal trainers or elite gym memberships. ' +
  'RAIMZEAL changes that equation entirely — putting structured, expert-designed workouts in everyone\'s pocket, for free.'
);
heading('The Workout Library');
para(
  'At the heart of RAIMZEAL\'s fitness system is an extensive exercise library containing hundreds of ' +
  'movements across every major muscle group and training style. Each exercise includes clear ' +
  'descriptions, proper form guidance, muscle group targeting, and progression options. ' +
  'Whether you are performing a bodyweight squat or a barbell deadlift, RAIMZEAL has you covered.'
);
heading('Structured Programs');
para('RAIMZEAL features multiple professionally designed training programs for every level:');
bullet([
  '4-Week Beginner Foundation — Perfect for those new to fitness. Builds strength, endurance, and healthy habits through 16 compound movement workouts',
  '8-Week Hypertrophy Program — Designed for muscle growth using progressive overload and volume. 38 targeted workouts over 8 weeks',
  '12-Week Strength Power — A serious program built around progressive overload on the big 4 lifts for intermediate to advanced trainees',
  '6-Week Fat Loss Sprint — A high-intensity program combining cardio and resistance training for rapid, healthy fat reduction',
  '8-Week Beginner Builder — Builds your fitness foundation with compound movements and steady progression for beginners',
]);

const disciplinePhoto = img('051B9E61-FC75-4633-A640-F19EEBA609A9_1779388031282.png');
if (disciplinePhoto) {
  checkPageBreak(155);
  inlineImage(disciplinePhoto, '"Discipline looks good on you." — RAIMZEAL', 125);
}

heading('Habit Tracking');
para(
  'Consistency is the single most important factor in fitness success. RAIMZEAL\'s habit tracker ' +
  'lets you build and track daily habits that support your training goals — including water intake, ' +
  'sleep quality, workout completion, nutrition goals, and mindset practices. ' +
  'Small daily habits compound into extraordinary results over months and years.'
);
heading('Workout Logging & History');
para(
  'Every workout you complete is logged automatically. RAIMZEAL tracks your sets, reps, weights, ' +
  'duration, and calories burned. Over time, you build a rich history of your training journey — ' +
  'showing exactly how far you have come and giving you the data to optimize what comes next.'
);
callout(
  'Train hard. Recover smart. Win daily.\n\n' +
  'RAIMZEAL\'s workout system is designed around the scientific principles of progressive overload, ' +
  'periodization, and recovery. You are not just exercising — you are building a sustainable, ' +
  'science-backed fitness practice.'
);
quote(
  'Build strength, stamina, and better health. Discipline looks good on you.',
  'RAIMZEAL'
);

// ════════════════════════════════════════════════════════════════════════════
//  CHAPTER 4 — FOOD THERAPY
// ════════════════════════════════════════════════════════════════════════════
chapterOpener('FOUR', 'Food Therapy', 'Eat your way to wellness. Food is the most powerful medicine.',
  img('D33CB27E-0FC3-4560-894B-2C96302F01E2_1779388031282.png'),
  'Dr. Oviawe with RAIMZEAL\'s food therapy team — real food, real healing'
);
tocEntry('Chapter 4 — Food Therapy: Eat Your Way to Wellness');
para(
  'Food therapy is the second pillar of RAIMZEAL — and it is perhaps the most revolutionary aspect ' +
  'of the platform. While most fitness apps treat nutrition as simple calorie counting, RAIMZEAL ' +
  'approaches food as medicine: a powerful, natural tool for healing inflammation, restoring energy, ' +
  'balancing hormones, and protecting long-term health.'
);
heading('The Science of Food as Medicine');
para(
  'Thousands of years of traditional medicine and decades of modern nutritional science agree: ' +
  'what you eat directly determines how your body functions at the cellular level. ' +
  'Chronic diseases — including type 2 diabetes, cardiovascular disease, and many cancers — ' +
  'are significantly influenced by dietary patterns. RAIMZEAL\'s food therapy approach is built ' +
  'on this science, translating complex nutritional research into simple, actionable guidance.'
);

inlineImage(img('ch2-food-therapy.png'), 'Food therapy: nature\'s most powerful healing system', 130);

heading('RAIMZEAL Nutrition Features');
bullet([
  'Personalised meal planning based on your goals, preferences, and dietary restrictions',
  'Macronutrient tracking (protein, carbohydrates, fats) with intelligent daily targets',
  'Calorie management with detailed nutritional data for thousands of foods',
  'Therapeutic food recommendations for specific health goals (anti-inflammatory, gut health, etc.)',
  'Hydration tracking with daily water intake goals and reminders',
  'Meal history and nutritional trend analysis over time',
  'Food journal for capturing what you eat and how it makes you feel',
]);
heading('Healing Foods & Their Benefits');
para(
  'RAIMZEAL educates users on the specific therapeutic properties of foods — which foods reduce ' +
  'inflammation, which support brain health, which regulate blood sugar, and which protect ' +
  'cardiovascular function. This knowledge empowers you to make better choices every time you eat.'
);
callout(
  'Food therapy is not a diet. It is a lifestyle of intentional, intelligent eating that supports ' +
  'your body\'s natural healing capabilities. When you eat right, your body does the rest.'
);
heading('Nutrition Programs');
para(
  'Just as RAIMZEAL offers structured fitness programs, it also provides structured nutrition ' +
  'guidance aligned with each fitness program. When you enrol in the 8-Week Hypertrophy program, ' +
  'for example, RAIMZEAL provides nutritional guidance optimised for muscle growth and recovery. ' +
  'This integration of fitness and nutrition is what sets RAIMZEAL apart from every other free platform.'
);
quote(
  'Eat smart. Feel better. Food therapy supports your energy, body, and mind.',
  'RAIMZEAL Food Therapy'
);

// ════════════════════════════════════════════════════════════════════════════
//  CHAPTER 5 — TRACKING YOUR PROGRESS
// ════════════════════════════════════════════════════════════════════════════
chapterOpener('FIVE', 'Track Your Progress', 'See how far you have come. Measure what matters.',
  img('ch3-progress-tracking.png'),
  'RAIMZEAL\'s progress tracking system gives you real data about your transformation'
);
tocEntry('Chapter 5 — Tracking Your Progress');
para(
  'The third pillar of RAIMZEAL is healthcare awareness — and at its core is a comprehensive ' +
  'progress tracking system. What gets measured, gets managed. RAIMZEAL gives you the tools ' +
  'to see your transformation in real time, stay motivated through the inevitable plateaus, ' +
  'and celebrate every milestone on your wellness journey.'
);
heading('Weight & Body Composition Tracking');
para(
  'Log your weight and body measurements with any frequency you choose. ' +
  'RAIMZEAL generates beautiful trend charts showing your progress over days, weeks, and months — ' +
  'both in pounds/kilograms and in centimetres/inches (with a metric/imperial toggle to suit users worldwide). ' +
  'Understanding your body composition trends is one of the most motivating things you can do for long-term wellness.'
);
heading('Performance Records (PRs)');
para(
  'Track your personal records in key exercises — your heaviest squat, fastest mile, longest plank. ' +
  'PRs are one of the most powerful motivational tools in fitness. Every time you beat a previous best, ' +
  'RAIMZEAL celebrates that achievement with you. Your progress is permanent and visible.'
);
heading('Progress Photos');
para(
  'Visual transformation is real and deeply motivating. RAIMZEAL\'s progress photo feature lets you ' +
  'capture and compare your physical transformation over time — privately and securely. Many users ' +
  'report that seeing their progress photos is the most powerful motivation to continue their journey.'
);
heading('Body Measurements');
para(
  'Beyond weight, RAIMZEAL tracks chest, waist, arms, legs, hips, and more — giving you a ' +
  'comprehensive picture of your body\'s changes over time. Body measurements often tell a more ' +
  'accurate story than the scale, especially as muscle replaces fat.'
);
statBox([
  { value: '192 lbs', label: 'Example: Weight tracked in real time' },
  { value: '3', label: 'Workouts this week with 890 cal burned' },
  { value: '↑ Trend', label: 'Weight trend charted over weeks' },
  { value: 'PRs', label: 'Personal records in every exercise' },
]);
callout(
  'Progress is not always linear. Some weeks the scale moves; some weeks it does not. ' +
  'RAIMZEAL\'s multi-metric tracking system ensures you always see the full picture of your progress — ' +
  'not just one number on a scale.'
);

// ════════════════════════════════════════════════════════════════════════════
//  CHAPTER 6 — OVIA AI
// ════════════════════════════════════════════════════════════════════════════
chapterOpener('SIX', 'Ovia AI — Your Personal Coach', 'World-class fitness coach, nutritionist & mindset mentor. Always available.',
  img('ch4-ovia-ai.png'),
  'Ovia AI: 24/7 AI-powered personal coaching — exclusive to RAIMZEAL'
);
tocEntry('Chapter 6 — Ovia AI: Your Personal Coach');
para(
  'Ovia AI is the crown jewel of the RAIMZEAL platform — and one of the most advanced free ' +
  'wellness tools ever created. Ovia is your personal AI fitness coach, nutritionist, and ' +
  'mindset mentor, available 24 hours a day, 7 days a week, completely free of charge.'
);
heading('What Ovia AI Can Do');
para('When you open Ovia AI, you are greeted with a set of intelligent conversation starters that reflect the most common coaching needs:');
bullet([
  '"Design my workout plan for this week"',
  '"What should I eat today to hit my goals?"',
  '"Help me stay motivated right now"',
  '"Best supplements for my goals"',
  '"How do I recover faster?"',
  '"What are my next fitness goals?"',
], GOLD);
para(
  'But Ovia is not limited to these prompts. You can ask anything related to fitness, nutrition, ' +
  'health, mindset, recovery, sleep, stress, or lifestyle — and Ovia will give you expert-level ' +
  'guidance instantly, drawing on your personal profile and goals to personalise every response.'
);
heading('Personalised Coaching');
para(
  'Ovia knows your fitness level, your workout history, your nutrition goals, and your current ' +
  'program. This means every piece of guidance it gives you is tailored specifically to where ' +
  'you are in your journey — not generic advice, but contextual coaching designed for you.'
);
heading('Mindset & Motivation');
para(
  'Physical transformation starts in the mind. Ovia AI is not just a technical coach — it is also ' +
  'a mindset mentor. When you are struggling to stay consistent, when life gets in the way, when ' +
  'you need someone to remind you why you started — Ovia is there. Free. Available. Ready.'
);
callout(
  'Most personal trainers charge $50–150 per session. Most AI health coaching apps charge $30–50 per month. ' +
  'Ovia AI on RAIMZEAL is completely free — because Dr. Oviawe believes everyone deserves ' +
  'access to expert guidance, not just those who can afford it.'
);
quote(
  'Hey! I\'m Ovia, your AI fitness coach. I\'m here to help you crush your goals. How are you feeling today?',
  'Ovia AI — RAIMZEAL'
);

// ════════════════════════════════════════════════════════════════════════════
//  CHAPTER 7 — THE WEB EXPERIENCE
// ════════════════════════════════════════════════════════════════════════════
chapterOpener('SEVEN', 'Your Journey on the Web', 'Full-featured wellness on any device. No app download required.',
  img('5162630E-2CAC-4AEC-902F-7FADD6795A65_1779388031282.png'),
  'Your coach in your pocket — accessible on web at www.raimzeal.com'
);
tocEntry('Chapter 7 — The Web Experience (www.raimzeal.com)');
heading('Getting Started on the Web');
para(
  'RAIMZEAL is fully accessible at www.raimzeal.com from any web browser — no download required. ' +
  'The web platform gives you the complete RAIMZEAL experience on desktop, laptop, or mobile browser. ' +
  'You can even save it to your home screen on iPhone (Safari → Share → Add to Home Screen) ' +
  'or Android (Chrome → three-dot menu → Add to Home Screen) for instant one-tap access.'
);
heading('Creating Your Account');
bullet([
  'Visit www.raimzeal.com and tap "Get Started" or "Sign Up"',
  'Enter your name, email, and create a secure password',
  'Complete the brief onboarding questionnaire to set your goals, activity level, and preferences',
  'Choose your measurement preference: metric (kg/cm) or imperial (lbs/inches)',
  'Your personalised dashboard is ready immediately — no waiting, no approval',
]);
heading('Web App Navigation');
bullet([
  'Dashboard — Your daily overview: workouts, nutrition, habits, AI coach messages',
  'Workouts — Full exercise library, programs, and workout logging',
  'Nutrition — Meal planning, food diary, macros, and hydration tracking',
  'Progress — Charts, photos, measurements, and personal records',
  'Ovia AI — Your 24/7 AI coaching interface',
  'Profile & Settings — Personalise your experience, manage account preferences',
]);
heading('Mobile-Optimised Design');
para(
  'The RAIMZEAL web app is fully responsive and works beautifully on any screen size. ' +
  'The dark-themed interface was specifically designed for mobile use — with large touch targets, ' +
  'clear typography, and a layout that feels as good on a phone as it does on a desktop monitor.'
);
callout(
  'TIP: Save RAIMZEAL to your home screen for the fastest possible access.\n' +
  'iPhone: Open Safari → tap the Share icon → "Add to Home Screen"\n' +
  'Android: Open Chrome → tap the three-dot menu → "Add to Home Screen"\n\n' +
  'One tap from your home screen is faster, easier, and smarter.'
);

// ════════════════════════════════════════════════════════════════════════════
//  CHAPTER 8 — THE MOBILE APP
// ════════════════════════════════════════════════════════════════════════════
chapterOpener('EIGHT', 'RAIMZEAL Mobile', 'Take your wellness journey everywhere. The full experience, always in your pocket.',
  img('ch6-mobile-app.png'),
  'RAIMZEAL mobile app — coming soon to Apple App Store and Google Play Store'
);
tocEntry('Chapter 8 — The RAIMZEAL Mobile App');
para(
  'RAIMZEAL\'s dedicated mobile app brings the complete wellness platform to your iPhone or Android device ' +
  'as a native application. Designed with a beautiful dark theme and an intuitive tab-based navigation ' +
  'system, the mobile app puts your entire health journey at your fingertips — optimised for the speed ' +
  'and convenience that only a native mobile app can deliver.'
);
heading('Mobile App Features');
bullet([
  'Home Tab — Daily overview: goals progress, workout schedule, nutrition summary, coach messages',
  'Workouts Tab — Full program library, exercise browser, workout logging with timer and rest intervals',
  'Ovia AI Tab — Direct access to your AI coach with a beautiful dark conversational interface',
  'Nutrition Tab — Food diary, meal planning, macronutrient tracking, and hydration logging',
  'Progress Tab — Weight trends, PR tracker, progress photos, and body measurement logs',
  'More Menu — Profile, settings, community, resources, and platform settings',
]);
heading('Dark Theme Design');
para(
  'The RAIMZEAL mobile app uses an elegant dark theme throughout — not just for aesthetics, ' +
  'but for real functional benefits. A dark interface reduces eye strain during early morning ' +
  'workouts or late-night tracking, conserves battery on OLED screens, and creates a ' +
  'focused, premium feel that reflects the seriousness of your wellness goals.'
);
heading('How to Get the App');
para(
  'RAIMZEAL\'s mobile app is coming soon to the Apple App Store and Google Play Store. ' +
  'While you wait for the app store release, you can access the full mobile web experience ' +
  'by visiting www.raimzeal.com in your mobile browser and adding it to your home screen. ' +
  'This progressive web app experience is available right now, today, for free.'
);
const appStoreImg = img('A3A3FA6D-505C-4B19-8DA0-8ED87069DC08_1779388031282.png');
if (appStoreImg) {
  checkPageBreak(150);
  inlineImage(appStoreImg, 'RAIMZEAL coming soon to Apple App Store and Google Play Store', 130);
}

// ════════════════════════════════════════════════════════════════════════════
//  CHAPTER 9 — COMPLETE FEATURE REFERENCE
// ════════════════════════════════════════════════════════════════════════════
chapterOpener('NINE', 'The Complete Feature Reference', 'Everything RAIMZEAL can do for you — right now.',
  img('F2E8AD90-504B-4FB6-9108-F1460F2323AE_1779388031282.png'),
  'No time? No excuses. RAIMZEAL gives you simple routines, smart wellness, and powerful results'
);
tocEntry('Chapter 9 — Complete Feature Reference');
heading('Authentication & Onboarding');
bullet([
  'Secure email/password registration and login',
  'Phone verification via SMS for account security',
  'Personalised onboarding: goals, activity level, experience, preferences',
  'Metric/Imperial measurement preference toggle',
  'Smooth, welcoming first-time experience designed for any age or background',
]);
heading('Fitness & Workouts');
bullet([
  'Extensive exercise library with proper form guidance for each movement',
  'Five professionally designed training programs (Beginner to Advanced)',
  'Custom workout builder — create your own routines from the exercise library',
  'Workout logging with sets, reps, weights, duration, and calorie tracking',
  'Complete workout history with filterable logs',
  'Rest timer and workout timer with audio cues',
  'Exercise search and filter by muscle group and equipment',
  'Personal records (PRs) tracking across all exercises',
]);
heading('Nutrition & Food Therapy');
bullet([
  'Personalised daily calorie and macronutrient targets',
  'Food diary with thousands of food items in the database',
  'Meal planning and scheduling for the week ahead',
  'Hydration tracker with daily water goal and intake logging',
  'Nutritional trend charts showing macro balance over time',
  'Food therapy guidance: healing foods, anti-inflammatory eating, therapeutic nutrition',
]);
heading('Progress Tracking');
bullet([
  'Weight logging with trend chart (daily, weekly, monthly views)',
  'Body measurements tracker: chest, waist, arms, legs, hips and more',
  'Progress photography: capture, compare, and celebrate visual transformation',
  'Personal records across all exercises and physical benchmarks',
  'Weekly progress summary reports',
]);
heading('Ovia AI Coaching');
bullet([
  '24/7 conversational AI fitness coach, nutritionist, and mindset mentor',
  'Personalised responses based on your profile, history, and current goals',
  'Workout planning, meal guidance, supplement advice, and recovery coaching',
  'Motivational support and mindset coaching',
  'Contextual suggestions based on your current program and progress',
]);
heading('Habit Tracking');
bullet([
  'Daily habit creation and custom habit scheduling',
  'Habit streak tracking with visual progress indicators',
  'Pre-built habit templates for common wellness habits',
  'Weekly habit completion overview',
]);
heading('Profile & Settings');
bullet([
  'Complete profile customisation with photo upload',
  'Unit preference (metric/imperial) toggle',
  'Notification preferences (upcoming)',
  'Privacy settings',
  'App version information and update management',
  'Linked accounts and security settings',
]);
heading('Community & Support');
bullet([
  'Community feed for sharing progress and motivation',
  'Support via support@raimzeal.com',
  'Customer Care: +1 202 670 7087',
]);

// ════════════════════════════════════════════════════════════════════════════
//  CHAPTER 10 — THE FUTURE OF RAIMZEAL
// ════════════════════════════════════════════════════════════════════════════
chapterOpener('TEN', 'The Future of RAIMZEAL', 'The vision is just getting started. The best is ahead.',
  img('ch7-future.png'),
  'The future of RAIMZEAL: where wellness meets technology, community, and global impact'
);
tocEntry('Chapter 10 — The Future of RAIMZEAL');
para(
  'RAIMZEAL today is a powerful platform. But RAIMZEAL tomorrow will be something that has never ' +
  'existed before: a comprehensive, free, global wellness ecosystem that serves every community ' +
  'on earth. Dr. Oviawe\'s vision for RAIMZEAL extends far beyond what you see today.'
);
heading('Coming Features & Roadmap');
bullet([
  'Wearable Device Integration — Sync data from Apple Watch, Fitbit, Garmin, and other devices for real-time health monitoring',
  'Community Challenges & Leaderboards — Global and local fitness challenges where users compete, collaborate, and celebrate together',
  'Telehealth Integration — Connect with certified health professionals directly through the platform for personalised medical guidance',
  'Expanded Food Therapy Database — Thousands of therapeutic food profiles with evidence-based healing properties and meal combinations',
  'Multilingual Support — Full platform translation into Spanish, French, Portuguese, Yoruba, Igbo, Swahili, and other global languages',
  'Offline Mode — Full workout and nutrition tracking capability without an internet connection',
  'Social Community Features — Share your transformation, follow other users, create accountability groups',
  'Corporate & Organizational Wellness Programs — Custom RAIMZEAL deployments for companies, churches, schools, and NGOs',
  'Kids & Youth Health Module — Age-appropriate fitness, nutrition, and health education for children aged 8–17',
  'Advanced AI Coaching — Next-generation Ovia AI with video coaching, form correction using camera, and predictive health analytics',
  'Peer Support Groups — Moderated wellness communities for specific health conditions, goals, and demographics',
  'Sleep Tracking & Recovery Optimization — Comprehensive sleep quality analysis and recovery guidance',
]);

const techPhoto = img('IMG_1207_1779388174602.png') || img('IMG_1206_1779388174602.png');
if (techPhoto) {
  checkPageBreak(155);
  inlineImage(techPhoto, 'Dr. Oviawe\'s technology vision: data-driven wellness at global scale', 125);
}

heading('The Long-Term Vision');
para(
  'Dr. Oviawe\'s vision for RAIMZEAL is to become the world\'s most used free health and wellness ' +
  'platform — not through marketing gimmicks or viral tricks, but through pure value delivered ' +
  'consistently to every user. When RAIMZEAL succeeds, millions of people will have access to ' +
  'coaching, nutrition guidance, and health awareness that was previously only available to the wealthy.'
);
callout(
  'By 2030, Dr. Oviawe\'s goal is for RAIMZEAL to have positively impacted 10 million people worldwide — ' +
  'reducing preventable illness, improving quality of life, and proving that free and excellent ' +
  'are not contradictions but a calling.'
);

// ════════════════════════════════════════════════════════════════════════════
//  CHAPTER 11 — RAIMZEAL & HUMANITY
// ════════════════════════════════════════════════════════════════════════════
chapterOpener('ELEVEN', 'RAIMZEAL & Humanity', 'Health is a human right. RAIMZEAL is the proof.',
  img('ch5-humanity.png'),
  'RAIMZEAL\'s global mission: democratising health and wellness for every human being'
);
tocEntry('Chapter 11 — RAIMZEAL & Humanity');
para(
  'The global health crisis is not primarily a medical crisis. It is an access crisis. ' +
  'Around the world, hundreds of millions of people live with preventable chronic diseases ' +
  'because they lack access to basic health education, nutritional guidance, and fitness resources. ' +
  'The knowledge exists. The solutions exist. But they are locked behind paywalls that most ' +
  'of the world\'s population cannot afford to climb.'
);
heading('The Access Problem');
bullet([
  'Over 1.9 billion adults worldwide are overweight or obese, largely due to preventable lifestyle factors',
  'Chronic diseases such as type 2 diabetes, heart disease, and hypertension affect billions and are largely preventable',
  'Personal training sessions cost $50–150/hour in Western countries — inaccessible to 90% of the global population',
  'Quality nutrition coaching costs $200–500/month — a privilege of affluence, not a universal right',
  'Health literacy remains critically low in underserved communities worldwide, perpetuating cycles of illness',
]);
heading('How RAIMZEAL Solves This');
para(
  'RAIMZEAL is a direct answer to the access problem. By making every feature, every program, ' +
  'every piece of coaching guidance, and every tool completely free — forever — Dr. Oviawe is ' +
  'dismantling the barriers that have kept health and wellness as a privilege of the wealthy.'
);
para(
  'A teenager in Lagos, Nigeria can access the same fitness programming as a Silicon Valley executive. ' +
  'A single mother in rural Mississippi gets the same Ovia AI coaching session as someone paying $300/hour ' +
  'for a certified nutritionist in Manhattan. A community health worker in rural India can use RAIMZEAL ' +
  'to educate their village about healing foods and preventive health. This is what equality of access looks like.'
);

const madeForPhoto = img('6A260C6C-865E-4D5F-886C-2A104B5B7C07_1779388031282.png');
if (madeForPhoto) {
  checkPageBreak(155);
  inlineImage(madeForPhoto, '"Made for every body." — RAIMZEAL is built for every person on earth', 125);
}

heading('The Spiritual Dimension');
para(
  'For Dr. Oviawe, the work of RAIMZEAL is deeply connected to his faith and his calling. ' +
  'As a man with a Master\'s in Theology and multiple doctorates, he understands that caring for ' +
  'the body is inseparable from caring for the spirit. RAIMZEAL is not just a fitness app — it is ' +
  'an act of service, grounded in the belief that every human life has infinite value, ' +
  'and that preserving and enhancing that life is a sacred responsibility.'
);
const churchPhoto = img('91527FB1-D21B-4D05-851D-98BCE599A542_1779388174602.png');
if (churchPhoto) {
  checkPageBreak(140);
  inlineImage(churchPhoto, 'A man of faith and purpose: Dr. Oviawe\'s calling extends far beyond business', 115);
}
quote(
  'Transform your body. Protect your health. RAIMZEAL is your personal coach, wellness partner, and food therapy guide.',
  'RAIMZEAL'
);

// ════════════════════════════════════════════════════════════════════════════
//  CHAPTER 12 — HOW TO SUPPORT THE MISSION
// ════════════════════════════════════════════════════════════════════════════
chapterOpener('TWELVE', 'Support the Mission', 'RAIMZEAL is free for everyone. Help keep it that way.',
  img('ch8-donate-support.png'),
  'Together we keep RAIMZEAL free for every person who needs it'
);
tocEntry('Chapter 12 — How to Support the Mission');
para(
  'RAIMZEAL is free for every user, forever. But running and continuously improving a world-class ' +
  'wellness platform has real costs — servers, AI systems, development, content creation, and ' +
  'global outreach. RAIMZEAL is sustained entirely by voluntary support from people who believe ' +
  'in the mission. If RAIMZEAL has helped you, you can help RAIMZEAL help others.'
);
heading('Make a Donation');
para('Every contribution — no matter how small — directly funds:');
bullet([
  'Server infrastructure to keep the platform fast and reliable for everyone',
  'AI coaching capabilities and updates for Ovia AI',
  'New features and content development',
  'Global marketing to reach underserved communities who need RAIMZEAL most',
  'Translation and localisation for new languages',
  'Educational resources and community programs',
]);
doc.moveDown(0.3);
doc.rect(ML, doc.y, CW, 52).fill(GREEN);
doc.font('Helvetica-Bold').fontSize(12).fillColor(WHITE)
   .text('DONATE TO RAIMZEAL', ML, doc.y + 8, { width: CW, align: 'center' });
doc.font('Helvetica').fontSize(9).fillColor(WHITE)
   .text(DONATE_URL, ML, doc.y + 26, { width: CW, align: 'center', link: DONATE_URL });
doc.font('Helvetica-Oblique').fontSize(8).fillColor('#ccffcc')
   .text('100% of donations go directly to keeping RAIMZEAL free for everyone', ML, doc.y + 40, { width: CW, align: 'center' });
doc.y += 62;
doc.moveDown(0.5);
heading('Other Ways to Support');
bullet([
  'Share RAIMZEAL with friends, family, and your community — word of mouth is our most powerful tool',
  'Share RAIMZEAL on social media and tag @raimzysocial',
  'Leave a review on the App Store or Play Store when the mobile app launches',
  'Introduce RAIMZEAL to your gym, school, church, or workplace wellness program',
  'Follow and engage with Dr. Oviawe at www.raimzy.com and on all social platforms',
  'Purchase Dr. Oviawe\'s books at amazon.com/author/dr.ephraim-oviawe',
  'Stream RAIMZY music at unitedmasters.com/raimzy — every stream supports the creator',
]);
callout(
  'You do not have to give money to support RAIMZEAL. Your voice is powerful. ' +
  'Tell one person about this platform today. That is one more life that may be changed forever.'
);
heading('Contact & Community');
const contacts = [
  ['Platform', 'www.raimzeal.com'],
  ['Email', 'support@raimzeal.com'],
  ['Customer Care', '+1 202 670 7087'],
  ['Social', '@raimzysocial'],
  ['Donate', DONATE_URL],
  ['Founder', 'www.raimzy.com'],
  ['Business', 'www.econteur.com'],
  ['Innovation', 'www.v3edge.com'],
];
contacts.forEach(([label, value]) => {
  checkPageBreak(18);
  doc.font('Helvetica-Bold').fontSize(9.5).fillColor(DARK)
     .text(`${label}: `, ML, doc.y, { continued: true });
  doc.font('Helvetica').fontSize(9.5).fillColor(GREEN)
     .text(value, { link: value.startsWith('http') ? value : undefined });
  doc.moveDown(0.25);
});

// ════════════════════════════════════════════════════════════════════════════
//  ACKNOWLEDGEMENTS
// ════════════════════════════════════════════════════════════════════════════
newPage(true);
tocEntry('Acknowledgements');
doc.font('Helvetica-Bold').fontSize(18).fillColor(GREEN)
   .text('Acknowledgements', ML, doc.y, { width: CW });
doc.moveDown(0.3);
rule(GOLD, 1.5);
para(
  'This book — and the RAIMZEAL platform itself — would not exist without the extraordinary support, ' +
  'belief, and dedication of many remarkable people and organisations.'
);
heading('ECONTEUR LLC');
para(
  'RAIMZEAL is proudly operated by ECONTEUR LLC — a United States company registered in Arizona, ' +
  'with offices in Alpharetta, Georgia. ECONTEUR LLC is more than a business; it is a vehicle for ' +
  'impact, innovation, and service. The leadership and operational infrastructure of ECONTEUR LLC ' +
  'provides the foundation that allows RAIMZEAL to exist as a free platform. To every person at ' +
  'ECONTEUR LLC who believed in this vision and contributed their time, talent, and energy: ' +
  'thank you. Visit www.econteur.com to learn more.'
);
heading('Dr. Ephraim Oviawe — RAIMZY');
para(
  'The founder, creator, and driving force of RAIMZEAL deserves the deepest recognition. ' +
  'Dr. Oviawe did not build RAIMZEAL to make money. He built it because he has spent a lifetime ' +
  'accumulating knowledge — across healthcare, technology, business, theology, and the arts — ' +
  'and he believes that knowledge should serve humanity, not be hoarded for profit.'
);
para(
  'Dr. Oviawe\'s courage to give away world-class wellness guidance for free is a radical act ' +
  'of generosity in a world that constantly monetises care. His credentials are extraordinary. ' +
  'His mission is even more extraordinary. Thank you, Dr. Oviawe, for RAIMZEAL.'
);

const founderFinalPhoto = img('IMG_1219_1779388174602.png');
if (founderFinalPhoto) {
  checkPageBreak(150);
  inlineImage(founderFinalPhoto, 'Dr. Ephraim Oviawe (RAIMZY) — Founder of RAIMZEAL, CEO of ECONTEUR LLC', 120);
}

heading('The Community');
para(
  'To every person who has used RAIMZEAL, shared it with a friend, donated to keep it alive, ' +
  'or simply believed in the possibility that health could be free — this book and this platform ' +
  'belong to you as much as to us. You are the reason RAIMZEAL exists.'
);
heading('Future Contributors');
para(
  'RAIMZEAL will grow through collaboration. To every developer, nutritionist, fitness trainer, ' +
  'healthcare professional, translator, designer, and advocate who will contribute to ' +
  'RAIMZEAL\'s future: this platform is ready to receive your gifts. Contact us at support@raimzeal.com.'
);

// ════════════════════════════════════════════════════════════════════════════
//  RESOURCES & LINKS
// ════════════════════════════════════════════════════════════════════════════
newPage(true);
tocEntry('Resources & Important Links');
doc.font('Helvetica-Bold').fontSize(18).fillColor(GREEN)
   .text('Resources & Important Links', ML, doc.y, { width: CW });
doc.moveDown(0.3);
rule(GOLD, 1.5);
const allLinks = [
  { category: 'RAIMZEAL Platform', items: [
    ['Web App (Full Experience)', 'https://www.raimzeal.com'],
    ['Support Email', 'support@raimzeal.com'],
    ['Customer Care Phone', '+1 202 670 7087'],
    ['Donate to RAIMZEAL', DONATE_URL],
  ]},
  { category: 'Dr. Ephraim Oviawe (RAIMZY)', items: [
    ['Official Website', 'https://www.raimzy.com'],
    ['All Resources (Linktree)', 'https://linktr.ee/Raimzy'],
    ['Music', 'https://unitedmasters.com/raimzy'],
    ['Amazon Author Page', 'https://www.amazon.com/author/dr.ephraim-oviawe'],
    ['Social Media', '@raimzysocial'],
  ]},
  { category: 'ECONTEUR LLC', items: [
    ['Business Website', 'https://www.econteur.com'],
    ['Innovation Hub', 'https://www.v3edge.com'],
  ]},
];
allLinks.forEach(section => {
  checkPageBreak(80);
  doc.font('Helvetica-Bold').fontSize(11).fillColor(GREEN)
     .text(section.category, ML, doc.y);
  doc.moveDown(0.2);
  section.items.forEach(([label, url]) => {
    checkPageBreak(20);
    doc.font('Helvetica-Bold').fontSize(9.5).fillColor(DARK)
       .text(`${label}: `, ML + 10, doc.y, { continued: true });
    doc.font('Helvetica').fontSize(9.5).fillColor(GREEN)
       .text(url, { link: url.startsWith('http') ? url : undefined });
    doc.moveDown(0.25);
  });
  doc.moveDown(0.4);
});

// ════════════════════════════════════════════════════════════════════════════
//  ABOUT THE AUTHOR (final page)
// ════════════════════════════════════════════════════════════════════════════
newPage(true);
tocEntry('About the Author');
doc.font('Helvetica-Bold').fontSize(18).fillColor(GREEN)
   .text('About the Author', ML, doc.y, { width: CW });
doc.moveDown(0.3);
rule(GOLD, 1.5);

const authorPhoto = img('IMG_1211_1779388174602.png') || img('IMG_1200_1779388031282.png');
if (authorPhoto) {
  doc.image(authorPhoto, ML, doc.y, { width: 100, height: 125 });
  doc.font('Helvetica-Bold').fontSize(13).fillColor(DARK)
     .text('Dr. Ephraim Oviawe', ML + 112, doc.y + 5, { width: CW - 112 });
  doc.font('Helvetica-Bold').fontSize(10).fillColor(GOLD)
     .text('RAIMZY', ML + 112, doc.y + 23, { width: CW - 112 });
  doc.font('Helvetica').fontSize(8.5).fillColor(MUTED)
     .text('PHD · MBA · MTS · CST · AMA · DMIPRO · CSM · PMP', ML + 112, doc.y + 38, { width: CW - 112 });
  doc.font('Helvetica').fontSize(8.5).fillColor(MUTED)
     .text('Founder, RAIMZEAL  |  CEO, ECONTEUR LLC', ML + 112, doc.y + 52, { width: CW - 112 });
  doc.font('Helvetica').fontSize(8.5).fillColor(GREEN)
     .text('www.raimzy.com', ML + 112, doc.y + 66, { width: CW - 112, link: 'https://www.raimzy.com' });
  doc.y += 135;
} else {
  doc.moveDown(0.5);
}
para(
  'Dr. Ephraim Oviawe is an author, strategist, technologist, creative entrepreneur, music artist, ' +
  'educator, and business builder focused on helping people turn intelligence into practical systems. ' +
  'His work connects leadership, artificial intelligence, marketing, project management, creativity, ' +
  'spirituality, and business execution. Through books, music, brands, and business platforms, ' +
  'Dr. Oviawe teaches creators, entrepreneurs, professionals, and organisations how to combine vision ' +
  'with structure, technology with human wisdom, and creativity with disciplined action.'
);
para(
  'As the founder of RAIMZEAL and CEO of ECONTEUR LLC, Dr. Oviawe has dedicated a significant ' +
  'portion of his professional life to building the infrastructure for a healthier humanity. ' +
  'RAIMZEAL is his most ambitious gift to the world — a free, comprehensive wellness platform ' +
  'that will serve millions of people across every continent, culture, and circumstance.'
);
doc.moveDown(0.5);
doc.rect(ML, doc.y, CW, 60).fill('#E8F5EE');
doc.rect(ML, doc.y, CW, 3).fill(GREEN);
doc.font('Helvetica-Bold').fontSize(11).fillColor(GREEN)
   .text('Support the Mission', ML + 10, doc.y + 10);
doc.font('Helvetica').fontSize(9).fillColor(DARK)
   .text('Help RAIMZEAL stay free for every person on earth. Every contribution matters.', ML + 10, doc.y + 26, { width: CW - 20 });
doc.font('Helvetica-Bold').fontSize(9).fillColor(GREEN)
   .text(DONATE_URL, ML + 10, doc.y + 42, { link: DONATE_URL });
doc.y += 70;

// Back cover footer
doc.moveDown(1);
doc.moveTo(ML, doc.y).lineTo(W - MR, doc.y)
   .strokeColor(GOLD).lineWidth(1).stroke();
doc.moveDown(0.5);
doc.font('Helvetica-Bold').fontSize(9).fillColor(GREEN)
   .text('RAIMZEAL  |  WELLNESS. POWER. YOU.', ML, doc.y, { width: CW, align: 'center' });
doc.font('Helvetica').fontSize(8).fillColor(MUTED)
   .text('www.raimzeal.com  |  support@raimzeal.com  |  © 2025 ECONTEUR LLC', ML, doc.y + 14, { width: CW, align: 'center' });

// ─── Save ────────────────────────────────────────────────────────────────────
doc.end();
out.on('finish', () => {
  const stats = fs.statSync(OUTPUT);
  console.log(`✅ RAIMZEAL eBook PDF saved: ${OUTPUT}`);
  console.log(`   Size: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);
  console.log(`   Pages: ~${pageNum}`);
});
out.on('error', (err) => {
  console.error('❌ Error writing PDF:', err);
  process.exit(1);
});
