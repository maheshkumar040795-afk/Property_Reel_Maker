/* --- effects --- */
let _grain = null;
function grain(ctx, t) {
  if (!_grain) { _grain = document.createElement('canvas'); _grain.width = _grain.height = 256; const g = _grain.getContext('2d'), d = g.createImageData(256, 256);
    for (let i = 0; i < d.data.length; i += 4) { const v = Math.random() * 255; d.data[i] = d.data[i + 1] = d.data[i + 2] = v; d.data[i + 3] = 255; } g.putImageData(d, 0, 0); }
  const f = Math.floor(t * FPS), ox = (f * 73) % 256, oy = (f * 151) % 256;
  ctx.save(); ctx.globalAlpha = .06; ctx.globalCompositeOperation = 'overlay';
  for (let x = -ox; x < W; x += 256) for (let y = -oy; y < H; y += 256) ctx.drawImage(_grain, x, y);
  ctx.restore();
}
function frameLines(ctx) { ctx.save(); ctx.strokeStyle = rgba(PAL().accent, .75); ctx.lineWidth = 3; ctx.strokeRect(34, 34, W - 68, H - 68); ctx.lineWidth = 1; ctx.strokeRect(46, 46, W - 92, H - 92); ctx.restore(); }
let _tc = null;
function shineText(ctx, s, x, y, size, color, sp, face, align = 'left') {
  if (!_tc) { _tc = document.createElement('canvas'); _tc.width = W; _tc.height = 340; }
  const t = _tc.getContext('2d'); t.clearRect(0, 0, W, 340); setFont(t, 700, size, face); t.textBaseline = 'top'; t.textAlign = align; t.fillStyle = '#fff'; t.fillText(s, x, 60);
  t.globalCompositeOperation = 'source-in'; const bx = -300 + (W + 600) * sp, g = t.createLinearGradient(bx - 160, 0, bx + 160, 340);
  g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(.5, 'rgba(255,246,214,.95)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  t.fillStyle = g; t.fillRect(0, 0, W, 340); t.globalCompositeOperation = 'source-over';
  text(ctx, s, x, y, { size, color, serif: face, align, shadow: color === '#fff' }); if (sp > 0 && sp < 1) ctx.drawImage(_tc, 0, y - 60);
}
function urgency(ctx, lt, start, x, y, align) {
  const b = (state.prop.badge || '').trim(); if (!b || /\bsold\b/i.test(b)) return;
  const a = an(lt, start, .35); if (a <= 0) return; const k = (1 + .04 * Math.sin((lt - start) * 6)) * (.6 + .4 * easeBack((lt - start) / .45));
  ctx.save(); ctx.translate(x, y); ctx.rotate(-.06); ctx.scale(k, k);
  pill(ctx, '🔥 ' + b, 0, -40, { size: 38, w: 700, bg: '#E53935', fg: '#fff', padX: 28, padY: 14, alpha: a, align, maxW: 900 }); ctx.restore();
}
function soldStamp(ctx, lt, start, cy = 640) {
  const b = (state.prop.badge || '').trim(); if (!/\bsold\b/i.test(b)) return;
  const p = clamp((lt - start) / .35); if (p <= 0) return; const k = 2.2 - 1.2 * ease(p), sh = p < 1 ? 0 : Math.sin((lt - start) * 40) * Math.max(0, 1 - (lt - start - .35) * 4) * 6;
  ctx.save(); ctx.translate(W / 2 + sh, cy); ctx.rotate(-.21); ctx.scale(k, k); ctx.globalAlpha = Math.min(1, p * 1.5) * .93;
  setFont(ctx, 700, 150); const tw = ctx.measureText(b.toUpperCase()).width, bw = tw + 120, bh = 230;
  rr(ctx, -bw / 2, -bh / 2, bw, bh, 26); ctx.lineWidth = 14; ctx.strokeStyle = '#E53935'; ctx.stroke();
  rr(ctx, -bw / 2 + 22, -bh / 2 + 22, bw - 44, bh - 44, 14); ctx.lineWidth = 4; ctx.stroke();
  ctx.fillStyle = '#E53935'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(b.toUpperCase(), 0, 8); ctx.restore();
}
/* --- layout building blocks --- */
function mediaBox(ctx, ph, x, y, w, h, p, alt, r = 0) {
  ctx.save(); if (r) rr(ctx, x, y, w, h, r); else { ctx.beginPath(); ctx.rect(x, y, w, h); } ctx.clip();
  if (!ph) { ctx.fillStyle = mix(PAL().main, '#ffffff', .18); ctx.fillRect(x, y, w, h); ctx.restore(); return; }
  const vid = ph.kind === 'video', amt = vid ? .05 : .12, z = alt ? 1 + amt - amt * p : 1 + amt * p;
  const s = Math.max(w / ph.w, h / ph.h) * z, dw = ph.w * s, dh = ph.h * s, ox = vid ? 0 : (alt ? -1 : 1) * (p - .5) * 30;
  ctx.drawImage(mediaSrc(ph), x + (w - dw) / 2 + ox, y + (h - dh) / 2, dw, dh); ctx.restore();
}
let _pat = null, _patKey = '';
function patternBg(ctx) {
  const P = PAL(), key = P.main + P.accent;
  if (_patKey !== key) { _patKey = key; _pat = document.createElement('canvas'); _pat.width = W; _pat.height = H; const g = _pat.getContext('2d');
    g.fillStyle = P.main; g.fillRect(0, 0, W, H); const rg = g.createRadialGradient(W / 2, 700, 80, W / 2, 700, 1100); rg.addColorStop(0, mix(P.main, '#ffffff', .14)); rg.addColorStop(1, rgba(P.main, 0)); g.fillStyle = rg; g.fillRect(0, 0, W, H);
    g.fillStyle = rgba(P.accent, .10); for (let y = 30; y < H; y += 46) for (let x = (y / 46 % 2) * 23 + 20; x < W; x += 46) { g.beginPath(); g.arc(x, y, 3, 0, 7); g.fill(); } }
  ctx.drawImage(_pat, 0, 0);
}
function blurBg(ctx, ph, dark = .78) { const P = PAL(); if (ph) { coverDraw(ctx, ph.blur, ph.blur.width, ph.blur.height, 1.1); ctx.fillStyle = rgba(P.main, dark); ctx.fillRect(0, 0, W, H); } else { ctx.fillStyle = P.main; ctx.fillRect(0, 0, W, H); } }
function splitPanel(ctx, y0, y1) { ctx.save(); ctx.fillStyle = PAL().main; ctx.beginPath(); ctx.moveTo(0, y0); ctx.lineTo(W, y1); ctx.lineTo(W, H); ctx.lineTo(0, H); ctx.closePath(); ctx.shadowColor = 'rgba(0,0,0,.35)'; ctx.shadowBlur = 40; ctx.fill(); ctx.restore();
  ctx.save(); ctx.strokeStyle = PAL().accent; ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(0, y0); ctx.lineTo(W, y1); ctx.stroke(); ctx.restore(); }
function polaroid(ctx, ph, cx, cy, w, h, rot, p, alt, caption, a = 1) {
  if (a <= 0) return; const P = PAL(), pad = 30, bottom = caption ? 140 : 96;
  ctx.save(); ctx.globalAlpha *= a; ctx.translate(cx, cy); ctx.rotate(rot);
  ctx.save(); ctx.shadowColor = 'rgba(0,0,0,.5)'; ctx.shadowBlur = 60; ctx.shadowOffsetY = 24; ctx.fillStyle = '#FBFAF6'; ctx.fillRect(-w / 2 - pad, -h / 2 - pad, w + pad * 2, h + pad + bottom); ctx.restore();
  mediaBox(ctx, ph, -w / 2, -h / 2, w, h, p, alt, 0);
  ctx.save(); ctx.translate(0, -h / 2 - pad - 4); ctx.rotate(-.05); ctx.fillStyle = rgba(P.accent, .8); ctx.fillRect(-95, -24, 190, 48); ctx.restore();
  if (caption) { const f = fit(ctx, caption, 700, 62, 34, w - 20, 1, TF()); ctx.fillStyle = P.main; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; setFont(ctx, 700, f.size, TF()); ctx.fillText(f.lines[0] || '', 0, h / 2 + (bottom - pad) / 2 + 4); }
  ctx.restore();
}
function label(ctx, s, x, y, a, o = {}) { text(ctx, (s || '').toUpperCase(), x, y + (1 - a) * 30, { size: o.size || 32, color: o.color || PAL().accent, spacing: 8, alpha: a, align: o.align || 'left', shadow: o.shadow !== false }); }
function title(ctx, s, x, y, a, o = {}) {
  const f = fit(ctx, UP(s), D().font === 'bold' ? 400 : 700, TS(o.max || 92), TS(o.min || 54), o.maxW || 936, o.lines || 2, TF());
  return lines(ctx, f.lines, x, y + (1 - a) * (o.dy || 50), f.size, { alpha: a, serif: TF(), w: D().font === 'bold' ? 400 : 700, color: o.color || '#fff', align: o.align || 'left', shadow: o.shadow !== false });
}
function subText(ctx, s, x, y, a, o = {}) { const sf = fit(ctx, s, 400, o.max || 38, 26, o.maxW || 936, 2); return lines(ctx, sf.lines, x, y + (1 - a) * 30, sf.size, { w: 400, color: o.color || 'rgba(255,255,255,.9)', alpha: a, align: o.align || 'left', shadow: o.shadow !== false }); }
function priceBlock(ctx, lt, x, y, maxW, ink, o = {}) {
  const p = state.prop, face = TF(), f = fit(ctx, UP(p.price || '₹ —'), 700, TS(o.max || 104), TS(56), maxW, 1, face), pp = clamp((lt - (o.start || .5)) / .45);
  if (pp <= 0) return y + f.size; const k = 1.35 - .35 * easeBack(pp), ax = o.align === 'center' ? x : x, cy = y + f.size / 2;
  ctx.save(); ctx.globalAlpha *= Math.min(1, pp * 2); ctx.translate(ax, cy); ctx.scale(k, k); ctx.translate(-ax, -cy);
  shineText(ctx, f.lines[0], x, y, f.size, ink, clamp((lt - (o.start || .5) - .65) / .8), face, o.align || 'left'); ctx.restore();
  return y + f.size * (face === 'display' ? 1.0 : 1.12);
}
function chipRow(ctx, lt, start, x, y, maxW, o = {}) {
  const c = chips(); let cx = x, cy = y; const gap = 14, out = [];
  c.forEach(t => { setFont(ctx, 500, o.size || 32); const w = ctx.measureText(t).width + (o.padX || 24) * 2; if (cx + w > x + maxW && cx > x) { cx = x; cy += (o.size || 32) * 1.5 + 20 + gap; } out.push([t, cx, cy]); cx += w + gap; });
  if (o.align === 'center') { const rows = {}; out.forEach(r => (rows[r[2]] = rows[r[2]] || []).push(r)); Object.values(rows).forEach(row => { const last = row[row.length - 1]; setFont(ctx, 500, o.size || 32); const rw = last[1] + ctx.measureText(last[0]).width + (o.padX || 24) * 2 - row[0][1]; const off = (maxW - rw) / 2; row.forEach(r => r[1] += off); }); }
  out.forEach(([t, px, py], i) => { const a = an(lt, start + i * .15); pill(ctx, t, px, py + (1 - a) * 30, { size: o.size || 32, w: 500, bg: o.bg || '#fff', fg: o.fg || PAL().main, padX: o.padX || 24, padY: 10, alpha: a, radius: o.radius }); });
  return cy + (o.size || 32) * 1.5 + 20;
}

/* ======================= SCENE RENDERERS ======================= */
function sceneIntro(ctx, lt, s, thumb) {
  const L = D().layout, P = PAL(), p = state.prop, ph = state.photos[0], face = TF(), ttl = thumb && p.thumbText ? p.thumbText : (p.title || 'Property title');
  const loc = (y, a, o = {}) => { if (p.location) return pill(ctx, p.location, o.x == null ? 90 : o.x, y + (1 - a) * 40, { size: 42, w: 500, bg: o.bg || 'rgba(255,255,255,.16)', fg: o.fg || '#fff', icon: 'pin', alpha: a, align: o.align || 'left' }); return { h: 0 }; };
  if (L === 'split') {
    mediaBox(ctx, ph, 0, 0, W, 1120, Math.min(1, lt / 4), 0); splitPanel(ctx, 1000, 1110); chrome(ctx);
    label(ctx, p.label, 80, 1160, an(lt, .2));
    const ye = title(ctx, ttl, 74, 1212, an(lt, .4), { max: 120, min: 64, lines: 2, maxW: 920 });
    loc(ye + 26, an(lt, .75), { x: 80 }); urgency(ctx, lt, 1.1, W - 70, 1010, 'right'); return;
  }
  if (L === 'magazine') {
    drawPhoto(ctx, ph, Math.min(1, lt / 5), 0); ctx.fillStyle = rgba(P.main, .55); ctx.fillRect(0, 0, W, H); chrome(ctx);
    const a0 = an(lt, .15); rule(ctx, W / 2, 640, 160, a0, true); label(ctx, p.label, W / 2, 680, an(lt, .2), { align: 'center' });
    const ye = title(ctx, ttl, W / 2, 750, an(lt, .4), { max: 140, min: 70, lines: 3, maxW: 900, align: 'center' });
    rule(ctx, W / 2, ye + 30, 160, an(lt, .6), true); loc(ye + 80, an(lt, .75), { x: W / 2, align: 'center' }); urgency(ctx, lt, 1.1, W / 2, ye + 270, 'center'); return;
  }
  if (L === 'bold') {
    ctx.fillStyle = P.accent; ctx.fillRect(0, 0, W, H); chrome(ctx);
    const a1 = an(lt, .15); if (a1 > 0) pill(ctx, (p.label || '').toUpperCase(), 70 - (1 - a1) * 200, 300, { size: 34, w: 700, bg: P.main, fg: P.accent, radius: 8, padX: 22, padY: 10 });
    const ye = title(ctx, ttl, 66, 400, an(lt, .35), { max: 170, min: 90, lines: 3, maxW: 950, color: P.main, shadow: false, dy: 80 });
    const bh = Math.max(380, Math.min(760, 1640 - ye - 140)), a2 = an(lt, .6, .6);
    if (a2 > 0) { ctx.save(); ctx.globalAlpha = a2; mediaBox(ctx, ph, 70, ye + 50 + (1 - a2) * 120, W - 140, bh, Math.min(1, lt / 4), 0, 28); ctx.restore(); }
    loc(ye + 50 + bh + 30, an(lt, .9), { x: 70, bg: P.main, fg: '#fff' }); urgency(ctx, lt, 1.2, W - 70, 300, 'right'); return;
  }
  if (L === 'minimal') {
    drawPhoto(ctx, ph, Math.min(1, lt / 5), 0); const g = ctx.createLinearGradient(0, H * .5, 0, H); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,.72)'); ctx.fillStyle = g; ctx.fillRect(0, H * .5, W, H * .5); chrome(ctx);
    label(ctx, p.label, 80, 1330, an(lt, .25), { size: 28 });
    const ye = title(ctx, ttl, 76, 1375, an(lt, .45), { max: 96, min: 56, lines: 2, maxW: 900 });
    loc(ye + 22, an(lt, .75), { x: 80, bg: 'rgba(255,255,255,.18)' }); urgency(ctx, lt, 1.1, W - 70, 300, 'right'); return;
  }
  if (L === 'frame') {
    patternBg(ctx); chrome(ctx);
    const a = an(lt, .1, .6); polaroid(ctx, ph, W / 2, 720 + (1 - a) * 80, 800, 640, -.035 * a, Math.min(1, lt / 4), 0, '', a);
    label(ctx, p.label, W / 2, 1180, an(lt, .45), { align: 'center' });
    const ye = title(ctx, ttl, W / 2, 1230, an(lt, .6), { max: 110, min: 60, lines: 2, maxW: 920, align: 'center' });
    loc(ye + 26, an(lt, .85), { x: W / 2, align: 'center' }); urgency(ctx, lt, 1.2, W - 90, 330, 'right'); return;
  }
  // card (default)
  if (ph && thumb) { drawPhoto(ctx, ph, 0, 0); ctx.fillStyle = rgba(P.main, .55); ctx.fillRect(0, 0, W, H); }
  else if (ph) { coverDraw(ctx, ph.blur, ph.blur.width, ph.blur.height, 1.1 + lt * .02); ctx.fillStyle = rgba(P.main, .66); ctx.fillRect(0, 0, W, H); }
  else { ctx.fillStyle = P.main; ctx.fillRect(0, 0, W, H); }
  brandTag(ctx, 90, 470 + (1 - an(lt, 0, .5)) * -30);
  rule(ctx, 90, 700, 120, an(lt, .15)); label(ctx, p.label, 90, 740, an(lt, .2), { size: 38 });
  const ye = title(ctx, ttl, 84, 800, an(lt, .4), { max: face === true ? 150 : 160, min: 80, lines: 3, maxW: 920, dy: 70 });
  loc(ye + 30, an(lt, .75)); urgency(ctx, lt, 1.1, 90, ye + 210, 'left');
}
function scenePrice(ctx, lt, s) {
  const L = D().layout, p = state.prop, P = PAL(), c = chips(), pr = lt / s.dur;
  if (L === 'split') {
    mediaBox(ctx, s.photo, 0, 0, W, 1180, pr, 0); splitPanel(ctx, 1080, 1170); chrome(ctx);
    rule(ctx, 80, 1225, 80, an(lt, .35)); label(ctx, T[state.lang].price, 80, 1250, an(lt, .35), { size: 30 });
    const ye = priceBlock(ctx, lt, 74, 1294, 920, '#fff', { max: 120 });
    const nf = fit(ctx, p.priceNote, 400, 34, 26, 920, 1); text(ctx, nf.lines[0], 80, ye + 4, { size: nf.size, w: 400, color: 'rgba(255,255,255,.8)', alpha: an(lt, .7), shadow: false });
    chipRow(ctx, lt, 1, 80, ye + 64, 920, { bg: P.accent, fg: P.main });
    urgency(ctx, lt, 1.6, W - 70, 300, 'right'); soldStamp(ctx, lt, .9, 560); return;
  }
  if (L === 'magazine') {
    drawPhoto(ctx, s.photo, pr, 0); bottomGrad(ctx); chrome(ctx);
    const a = clamp((lt - .4) / .5), r = 200, cx = W - 260, cy = 1290;
    if (a > 0) { const k = .4 + .6 * easeBack(a); ctx.save(); ctx.translate(cx, cy); ctx.scale(k, k); ctx.beginPath(); ctx.arc(0, 0, r, 0, 7); ctx.fillStyle = P.accent; ctx.shadowColor = 'rgba(0,0,0,.4)'; ctx.shadowBlur = 40; ctx.fill(); ctx.shadowBlur = 0;
      ctx.strokeStyle = rgba(P.main, .5); ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(0, 0, r - 16, 0, 7); ctx.stroke();
      text(ctx, T[state.lang].price, 0, -110, { size: 28, color: P.main, spacing: 6, align: 'center', shadow: false });
      const f = fit(ctx, UP(p.price || '₹ —'), 700, TS(84), TS(40), r * 1.6, 2, TF()); lines(ctx, f.lines, 0, -60 + (2 - f.lines.length) * f.size * .5, f.size, { color: P.main, align: 'center', serif: TF(), w: D().font === 'bold' ? 400 : 700, shadow: false }); ctx.restore(); }
    let y = 1170; c.forEach((t, i) => { const ca = an(lt, .9 + i * .15); text(ctx, t, 80, y + (1 - ca) * 30, { size: 40, w: 500, alpha: ca }); if (ca > 0) { ctx.save(); ctx.globalAlpha = ca; ctx.fillStyle = P.accent; ctx.fillRect(80, y + 64, 120 * ca, 3); ctx.restore(); } y += 96; });
    subText(ctx, p.priceNote, 80, y + 10, an(lt, 1.4), { maxW: 520, max: 32 });
    urgency(ctx, lt, 1.6, W - 70, 300, 'right'); soldStamp(ctx, lt, .9); return;
  }
  if (L === 'bold') {
    drawPhoto(ctx, s.photo, pr, 0); bottomGrad(ctx); chrome(ctx);
    const a = clamp((lt - .3) / .5); if (a > 0) { ctx.save(); ctx.translate(W / 2, 1360); ctx.rotate(-.05 * a); const k = .6 + .4 * easeBack(a); ctx.scale(k, k); ctx.globalAlpha = Math.min(1, a * 2);
      rr(ctx, -470, -160, 940, 320, 22); ctx.fillStyle = P.accent; ctx.shadowColor = 'rgba(0,0,0,.45)'; ctx.shadowBlur = 40; ctx.fill(); ctx.shadowBlur = 0;
      text(ctx, T[state.lang].price, -420, -125, { size: 32, w: 700, color: P.main, spacing: 6, shadow: false });
      const f = fit(ctx, UP(p.price || '₹ —'), 700, TS(150), TS(70), 840, 1, TF()); text(ctx, f.lines[0], -424, -80 + (TS(150) - f.size) * .4, { size: f.size, w: D().font === 'bold' ? 400 : 700, serif: TF(), color: P.main, shadow: false });
      const nf = fit(ctx, p.priceNote, 500, 32, 24, 840, 1); text(ctx, nf.lines[0], -420, 100, { size: nf.size, w: 500, color: rgba(P.main, .8), shadow: false }); ctx.restore(); }
    chipRow(ctx, lt, 1, 70, 1580, 940, { bg: P.main, fg: '#fff', radius: 8 });
    urgency(ctx, lt, 1.6, W - 70, 300, 'right'); soldStamp(ctx, lt, .9); return;
  }
  if (L === 'minimal') {
    drawPhoto(ctx, s.photo, pr, 0); const g = ctx.createLinearGradient(0, H * .55, 0, H); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,.75)'); ctx.fillStyle = g; ctx.fillRect(0, H * .55, W, H * .45); chrome(ctx);
    label(ctx, T[state.lang].price, 80, 1380, an(lt, .35), { size: 28 });
    const ye = priceBlock(ctx, lt, 76, 1420, 900, '#fff', { max: 96 });
    subText(ctx, c.join('  ·  '), 80, ye + 6, an(lt, .9), { max: 34, maxW: 920 });
    text(ctx, p.priceNote, 80, ye + 66, { size: 28, w: 400, color: 'rgba(255,255,255,.7)', alpha: an(lt, 1.1) });
    urgency(ctx, lt, 1.6, W - 70, 300, 'right'); soldStamp(ctx, lt, .9); return;
  }
  if (L === 'frame') {
    patternBg(ctx); chrome(ctx);
    polaroid(ctx, s.photo, W / 2, 700, 820, 700, .025, pr, 0, '', 1);
    const a = clamp((lt - .4) / .5); if (a > 0) { ctx.save(); ctx.translate(W / 2, 1290); ctx.rotate(.03); const k = .5 + .5 * easeBack(a); ctx.scale(k, k); ctx.globalAlpha = Math.min(1, a * 2);
      const f = fit(ctx, UP(p.price || '₹ —'), 700, TS(100), TS(50), 760, 1, TF()); setFont(ctx, 700, f.size, TF()); const tw = ctx.measureText(f.lines[0]).width + 120;
      rr(ctx, -tw / 2, -90, tw, 180, 20); ctx.fillStyle = P.accent; ctx.shadowColor = 'rgba(0,0,0,.4)'; ctx.shadowBlur = 30; ctx.fill(); ctx.shadowBlur = 0;
      ctx.beginPath(); ctx.arc(-tw / 2 + 36, 0, 12, 0, 7); ctx.fillStyle = P.main; ctx.fill();
      text(ctx, f.lines[0], 20, -f.size * .55, { size: f.size, w: D().font === 'bold' ? 400 : 700, serif: TF(), color: P.main, align: 'center', shadow: false }); ctx.restore(); }
    chipRow(ctx, lt, 1, 70, 1430, 940, { align: 'center' });
    subText(ctx, p.priceNote, W / 2, 1530, an(lt, 1.3), { align: 'center', max: 32 });
    urgency(ctx, lt, 1.6, W - 70, 300, 'right'); soldStamp(ctx, lt, .9, 700); return;
  }
  // card
  drawPhoto(ctx, s.photo, pr, 0); bottomGrad(ctx); chrome(ctx);
  const pa = an(lt, .2), top = 1290 + (1 - pa) * 40;
  if (pa > 0) { ctx.save(); ctx.globalAlpha = pa; rr(ctx, 44, top, W - 88, 380, TF() === true ? 8 : 36); ctx.fillStyle = rgba(P.main, .88); ctx.fill(); if (TF() === true) { ctx.strokeStyle = rgba(P.accent, .8); ctx.lineWidth = 2; ctx.stroke(); } ctx.restore(); }
  rule(ctx, 92, top + 42, 80, an(lt, .35)); label(ctx, T[state.lang].price, 92, top + 68, an(lt, .35), { size: 30 });
  const maxW = c.length ? 540 : 880; priceBlock(ctx, lt, 86, top + 112, maxW, '#fff');
  const nf = fit(ctx, p.priceNote, 400, 36, 26, maxW, 2); lines(ctx, nf.lines, 92, top + 250 + (1 - an(lt, .7)) * 30, nf.size, { w: 400, color: 'rgba(255,255,255,.85)', alpha: an(lt, .7), shadow: false });
  c.forEach((t, i) => { const ca = an(lt, 1 + i * .15); pill(ctx, t, 668, top + 96 + i * 82 + (1 - ca) * 30, { size: 32, w: 500, bg: '#fff', fg: P.main, padX: 24, padY: 10, alpha: ca, maxW: 330 }); });
  urgency(ctx, lt, 1.6, W - 70, 290, 'right'); soldStamp(ctx, lt, .9);
}
function scenePhoto(ctx, lt, s) {
  const L = D().layout, ph = s.photo, P = PAL(), pr = lt / s.dur, has = ph.tag || ph.title || ph.sub;
  if (L === 'split') {
    mediaBox(ctx, ph, 0, 0, W, 1240, pr, s.alt); splitPanel(ctx, s.alt ? 1230 : 1150, s.alt ? 1150 : 1230); chrome(ctx); if (!has) return;
    let y = 1290; if (ph.tag) { label(ctx, ph.tag, 80, y, an(lt, .35), { size: 30 }); y += 56; }
    y = title(ctx, ph.title, 74, y, an(lt, .5), { max: 88, min: 52, maxW: 920 }); subText(ctx, ph.sub, 80, y + 10, an(lt, .75), { maxW: 920 }); return;
  }
  if (L === 'magazine') {
    drawPhoto(ctx, ph, pr, s.alt); const g = ctx.createLinearGradient(0, 0, 0, 900); g.addColorStop(0, rgba(P.main, .85)); g.addColorStop(1, rgba(P.main, 0)); ctx.fillStyle = g; ctx.fillRect(0, 0, W, 900); chrome(ctx); if (!has) return;
    let y = 260; if (ph.tag) { label(ctx, ph.tag, W / 2, y, an(lt, .35), { align: 'center', size: 30 }); y += 56; }
    y = title(ctx, ph.title, W / 2, y, an(lt, .5), { max: 100, min: 56, maxW: 920, align: 'center' }); rule(ctx, W / 2, y + 18, 120, an(lt, .65), true);
    subText(ctx, ph.sub, W / 2, y + 50, an(lt, .8), { align: 'center', maxW: 900 }); return;
  }
  if (L === 'bold') {
    drawPhoto(ctx, ph, pr, s.alt); bottomGrad(ctx); chrome(ctx); if (!has) return;
    let y = 1290; if (ph.tag) { const a = an(lt, .3); if (a > 0) pill(ctx, ph.tag.toUpperCase(), 70 - (1 - a) * 150, y, { size: 30, w: 700, bg: P.main, fg: P.accent, radius: 8, padX: 20, padY: 8 }); y += 82; }
    const f = fit(ctx, UP(ph.title), D().font === 'bold' ? 400 : 700, TS(96), TS(52), 900, 2, TF());
    f.lines.forEach((l, i) => { const a = an(lt, .45 + i * .12); if (a <= 0) return; setFont(ctx, D().font === 'bold' ? 400 : 700, f.size, TF()); const tw = ctx.measureText(l).width, ly = y + i * (f.size * 1.18);
      ctx.save(); ctx.globalAlpha = a; ctx.fillStyle = P.accent; ctx.fillRect(56, ly - 6, (tw + 36) * a, f.size * 1.1); ctx.restore(); text(ctx, l, 74, ly + (TF() === 'display' ? 4 : -4), { size: f.size, w: D().font === 'bold' ? 400 : 700, serif: TF(), color: P.main, alpha: a, shadow: false }); });
    subText(ctx, ph.sub, 74, y + f.lines.length * f.size * 1.18 + 20, an(lt, .8)); return;
  }
  if (L === 'minimal') {
    drawPhoto(ctx, ph, pr, s.alt); const g = ctx.createLinearGradient(0, H * .6, 0, H); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,.7)'); ctx.fillStyle = g; ctx.fillRect(0, H * .6, W, H * .4); chrome(ctx); if (!has) return;
    let y = 1440; if (ph.tag) { label(ctx, ph.tag, 80, y, an(lt, .35), { size: 26 }); y += 48; }
    y = title(ctx, ph.title, 78, y, an(lt, .5), { max: 72, min: 44, maxW: 900 }); subText(ctx, ph.sub, 80, y + 6, an(lt, .75), { max: 32, maxW: 900 }); return;
  }
  if (L === 'frame') {
    patternBg(ctx); chrome(ctx);
    const a = an(lt, 0, .6); polaroid(ctx, ph, W / 2 + (s.alt ? 20 : -20), 780 + (1 - a) * 60, 800, 900, (s.alt ? .03 : -.03) * a, pr, s.alt, ph.title || '', a);
    if (ph.tag) label(ctx, ph.tag, W / 2, 1420, an(lt, .45), { align: 'center' });
    subText(ctx, ph.sub, W / 2, 1480, an(lt, .7), { align: 'center', maxW: 920 }); return;
  }
  // card
  drawPhoto(ctx, ph, pr, s.alt); bottomGrad(ctx); chrome(ctx); if (!has) return;
  let y = 1330; rule(ctx, 72, y, 90, an(lt, .3));
  if (ph.tag) { label(ctx, ph.tag, 72, y + 30, an(lt, .35)); y += 74; } else y += 34;
  y = title(ctx, ph.title, 66, y, an(lt, .5)); subText(ctx, ph.sub, 72, y + 14, an(lt, .75));
}
function sceneFeatures(ctx, lt, s) {
  const L = D().layout, P = PAL(), ph = state.photos[state.photos.length - 1], F = feats(), Lg = T[state.lang];
  if (L === 'magazine' || L === 'minimal') {
    blurBg(ctx, ph, L === 'minimal' ? .72 : .86); chrome(ctx); if (L === 'magazine') frameLines(ctx);
    const cx = L === 'magazine' ? W / 2 : 90, al = L === 'magazine' ? 'center' : 'left';
    label(ctx, Lg.why, cx, 430, an(lt, .15), { align: al, size: 30 });
    const ye = title(ctx, Lg.hl, cx, 480, an(lt, .3), { max: 88, min: 56, maxW: 900, align: al });
    const gap = Math.min(150, (1640 - ye - 60) / Math.max(F.length, 1));
    F.forEach((t, i) => { const a = an(lt, .55 + i * .2, .45), y = ye + 70 + i * gap;
      if (L === 'magazine') { text(ctx, String(i + 1).padStart(2, '0'), 140, y + (1 - a) * 20, { size: 46, w: 700, color: P.accent, alpha: a, serif: TF() }); text(ctx, t, 250, y + 4 + (1 - a) * 20, { size: 44, w: 500, alpha: a }); }
      else text(ctx, '—  ' + t, 90, y + (1 - a) * 20, { size: 44, w: 500, alpha: a });
      if (a > 0) { ctx.save(); ctx.globalAlpha = a * .35; ctx.fillStyle = '#fff'; ctx.fillRect(L === 'magazine' ? 140 : 90, y + gap - 24, (L === 'magazine' ? 800 : 900) * a, 1.5); ctx.restore(); } });
    return;
  }
  if (L === 'bold') {
    ctx.fillStyle = P.accent; ctx.fillRect(0, 0, W, H); chrome(ctx);
    label(ctx, Lg.why, 70, 420, an(lt, .15), { color: rgba(P.main, .75), shadow: false, size: 30 });
    const ye = title(ctx, Lg.hl, 66, 470, an(lt, .3), { max: 120, min: 60, maxW: 940, color: P.main, shadow: false });
    const gap = Math.min(140, (1640 - ye - 60) / Math.max(F.length, 1));
    F.forEach((t, i) => { const fa = an(lt, .55 + i * .2, .45); pill(ctx, t, 70 + (1 - fa) * -120, ye + 60 + i * gap, { size: 44, w: 600, bg: P.main, fg: '#fff', icon: 'tick', iconCol: P.accent, tickCol: P.main, padX: 28, padY: 18, radius: 10, alpha: fa, maxW: 940 }); });
    return;
  }
  if (L === 'split') { mediaBox(ctx, ph, 0, 0, W, 760, Math.min(1, lt / s.dur), 1); splitPanel(ctx, 660, 740); chrome(ctx); }
  else if (L === 'frame') { patternBg(ctx); chrome(ctx); }
  else { blurBg(ctx, ph, .8); chrome(ctx); }
  const top = L === 'split' ? 780 : 470;
  rule(ctx, 90, top, 90, an(lt, .1)); label(ctx, Lg.why, 90, top + 30, an(lt, .15), { size: 34 });
  const ye = title(ctx, Lg.hl, 84, top + 78, an(lt, .3), { max: 88, min: 56, maxW: 900 });
  const gap = Math.min(132, (1640 - ye - 60) / Math.max(F.length, 1));
  F.forEach((t, i) => { const fa = an(lt, .55 + i * .2, .45); pill(ctx, t, 90 + (1 - fa) * -60, ye + 50 + i * gap, { size: 44, w: 500, bg: L === 'frame' ? '#FBFAF6' : 'rgba(255,255,255,.12)', fg: L === 'frame' ? P.main : '#fff', icon: 'tick', iconCol: P.accent, tickCol: P.main, padX: 28, padY: 18, radius: TF() === true ? 6 : 22, alpha: fa, maxW: 900 }); });
}
function sceneOutro(ctx, lt, s) {
  const b = state.brand, L = D().layout, P = PAL(), Lg = T[state.lang], ph = state.photos[0], acc = L === 'bold';
  const ink = acc ? P.main : '#fff', lab = acc ? rgba(P.main, .75) : P.accent, sh = !acc;
  if (acc) { ctx.fillStyle = P.accent; ctx.fillRect(0, 0, W, H); }
  else if (L === 'minimal') blurBg(ctx, ph, .82);
  else if (L === 'frame' || L === 'split') patternBg(ctx);
  else { ctx.fillStyle = P.main; ctx.fillRect(0, 0, W, H); const g = ctx.createRadialGradient(W / 2, 820, 50, W / 2, 820, 820); g.addColorStop(0, mix(P.main, '#ffffff', .2)); g.addColorStop(1, rgba(P.main, 0)); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H); }
  if (L === 'magazine') frameLines(ctx);
  let a = an(lt, .1); title(ctx, Lg.cta, W / 2, 440, a, { max: 60, min: 36, maxW: 940, align: 'center', color: ink, shadow: sh, dy: 40 });
  if (acc) { ctx.save(); ctx.fillStyle = P.main; const ww = 120 * an(lt, .25); rr(ctx, W / 2 - ww / 2, 610, ww, 8, 4); ctx.fill(); ctx.restore(); } else rule(ctx, W / 2, 610, 120, an(lt, .25), true);
  a = an(lt, .3); text(ctx, Lg.call, W / 2, 652 + (1 - a) * 30, { size: 32, color: lab, spacing: 8, align: 'center', alpha: a, shadow: sh });
  a = an(lt, .45); const pf = fit(ctx, b.phone || '—', 700, TS(120), 60, 980, 1, TF() === 'display' ? 'display' : false);
  text(ctx, pf.lines[0], W / 2, 700 + (TS(120) - pf.size) / 2 + (1 - a) * 60, { size: pf.size, align: 'center', alpha: a, color: ink, shadow: sh, serif: TF() === 'display' ? 'display' : false, w: TF() === 'display' ? 400 : 700 });
  a = an(lt, .9);
  if (a > 0) {
    ctx.save(); ctx.globalAlpha = a; const cy = 1010 + (1 - a) * 40;
    if (b.logo) { const r = b.logo.width / b.logo.height, lw = Math.min(150 * r, 520), lhh = lw / r; rr(ctx, W / 2 - lw / 2 - 30, cy - 20, lw + 60, lhh + 40, 28); ctx.fillStyle = '#fff'; ctx.fill(); ctx.drawImage(b.logo, W / 2 - lw / 2, cy, lw, lhh); }
    else { const cx = W / 2, c1 = acc ? P.main : P.accent, c2 = acc ? P.accent : P.main; ctx.fillStyle = c1; ctx.beginPath(); ctx.moveTo(cx - 75, cy + 70); ctx.lineTo(cx, cy); ctx.lineTo(cx + 75, cy + 70); ctx.closePath(); ctx.fill(); ctx.fillRect(cx - 54, cy + 68, 108, 80); ctx.fillStyle = c2; ctx.fillRect(cx - 15, cy + 94, 30, 54); }
    ctx.restore();
  }
  a = an(lt, 1.05); const bf = fit(ctx, (b.name || 'Your Brand').toUpperCase(), 700, 66, 40, 960, 2); const ye = lines(ctx, bf.lines, W / 2, 1210 + (1 - a) * 30, bf.size, { align: 'center', alpha: a, spacing: 5, color: ink, shadow: sh });
  a = an(lt, 1.2); const tf = fit(ctx, b.tagline, 400, 36, 26, 940, 2); lines(ctx, tf.lines, W / 2, ye + 16, tf.size, { w: 400, align: 'center', color: acc ? rgba(P.main, .75) : 'rgba(255,255,255,.78)', alpha: a, shadow: false });
  a = an(lt, 1.4); text(ctx, b.credit, W / 2, 1630, { size: 26, w: 400, align: 'center', color: acc ? rgba(P.main, .55) : 'rgba(255,255,255,.5)', alpha: a, shadow: false });
}
/* thumbnail / cover image = finished intro + price sticker */
function sceneThumb(ctx, lt, s) {
  sceneIntro(ctx, 9, s, true);
  const p = state.prop, P = PAL(); if (!p.price) return;
  ctx.save(); ctx.translate(W - 70, 236); ctx.rotate(-.05);
  const f = fit(ctx, UP(p.price), 700, TS(76), TS(44), 520, 1, TF()); setFont(ctx, D().font === 'bold' ? 400 : 700, f.size, TF()); const tw = ctx.measureText(f.lines[0]).width + 70;
  rr(ctx, -tw, -10, tw, f.size * 1.25 + 40, 18); ctx.fillStyle = P.accent; ctx.shadowColor = 'rgba(0,0,0,.4)'; ctx.shadowBlur = 30; ctx.fill(); ctx.shadowBlur = 0;
  text(ctx, f.lines[0], -tw / 2, 14, { size: f.size, w: D().font === 'bold' ? 400 : 700, serif: TF(), color: P.main, align: 'center', shadow: false }); ctx.restore();
  if (/\bsold\b/i.test(p.badge || '')) soldStamp(ctx, 9, 0);
}
const RENDER = { thumb: sceneThumb, intro: sceneIntro, price: scenePrice, photo: scenePhoto, features: sceneFeatures, outro: sceneOutro };
function renderScene(ctx, s, lt, t) {
  ctx.save(); ctx.globalAlpha = 1; ctx.clearRect(0, 0, W, H);
  RENDER[s.type](ctx, lt, s);
  if (TH().frame && s.type !== 'thumb') frameLines(ctx);
  if (state.subs && _TL && s.type !== 'thumb') { const sp = _TL.scenes.find(x => x.vEnd && t >= x.vStart - .2 && t <= x.vEnd + .3); subtitle(ctx, sp ? state.lines[sp.key] : (lt > .3 ? state.lines[s.key] : '')); }
  ctx.restore();
}
let _TL = null;
let _oc = null;
const XF = () => TH().trans === 'fade' ? .4 : .45;
function sceneAt(TL, t) { const sc = TL.scenes; let i = sc.findIndex(s => t >= s.start && t < s.start + s.dur); return i < 0 ? sc.length - 1 : i; }
function drawFrame(ctx, t, TL) {
  _TL = TL;
  const sc = TL.scenes, i = sceneAt(TL, t), s = sc[i], lt = t - s.start, xf = XF();
  if (i > 0 && lt < xf) {
    const pv = sc[i - 1], e = ease(lt / xf), tr = TH().trans;
    if (!_oc) { _oc = document.createElement('canvas'); _oc.width = W; _oc.height = H; }
    const o = _oc.getContext('2d'); renderScene(o, pv, t - pv.start, t);
    ctx.save(); ctx.clearRect(0, 0, W, H);
    if (tr === 'slide') { ctx.drawImage(_oc, -W * .35 * e, 0); ctx.fillStyle = `rgba(0,0,0,${.35 * e})`; ctx.fillRect(0, 0, W, H); }
    else ctx.drawImage(_oc, 0, 0);
    renderScene(o, s, lt, t);
    if (tr === 'slide') { ctx.shadowColor = 'rgba(0,0,0,.5)'; ctx.shadowBlur = 40; ctx.drawImage(_oc, W * (1 - e), 0); }
    else if (tr === 'zoom') { const k = 1.12 - .12 * e; ctx.globalAlpha = e; ctx.translate(W / 2, H / 2); ctx.scale(k, k); ctx.drawImage(_oc, -W / 2, -H / 2); }
    else { ctx.globalAlpha = e; ctx.drawImage(_oc, 0, 0); }
    ctx.restore();
  } else renderScene(ctx, s, lt, t);
  if (TH().grain) grain(ctx, t);
}
