"use client";

import { useEffect, useRef } from "react";

/**
 * AVAIA Chemistry Background — a faithful port of the Claude Design piece
 * "AVAIA Chemistry Background.dc.html". A fixed, full-viewport dark field with:
 *   - two slow floating glow blobs (violet + amber)
 *   - an animated canvas: rising violet→amber particles and drifting chemical
 *     reaction equations drawn as real molecule diagrams.
 * Sits behind all content (-z-10). Respects prefers-reduced-motion.
 */

type Atom = { x: number; y: number; el: string };
type Bond = { a: number; b: number; o: number };
type Tpl = { atoms: Atom[]; bonds: Bond[] };

const A = (x: number, y: number, el: string): Atom => ({ x, y, el });
const B = (a: number, b: number, o = 1): Bond => ({ a, b, o });

function molTemplates(): Record<string, Tpl> {
  const ring: Atom[] = [];
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    ring.push(A(Math.cos(a), Math.sin(a), "C"));
  }
  return {
    water: { atoms: [A(0, 0, "O"), A(-0.85, 0.62, "H"), A(0.85, 0.62, "H")], bonds: [B(0, 1), B(0, 2)] },
    co2: { atoms: [A(0, 0, "C"), A(-1.15, 0, "O"), A(1.15, 0, "O")], bonds: [B(0, 1, 2), B(0, 2, 2)] },
    o2: { atoms: [A(-0.6, 0, "O"), A(0.6, 0, "O")], bonds: [B(0, 1, 2)] },
    n2: { atoms: [A(-0.6, 0, "N"), A(0.6, 0, "N")], bonds: [B(0, 1, 3)] },
    h2: { atoms: [A(-0.55, 0, "H"), A(0.55, 0, "H")], bonds: [B(0, 1)] },
    c1: { atoms: [A(0, 0, "C")], bonds: [] },
    nh3: { atoms: [A(0, 0, "N"), A(0, -1, "H"), A(-0.9, 0.62, "H"), A(0.9, 0.62, "H")], bonds: [B(0, 1), B(0, 2), B(0, 3)] },
    ch4: { atoms: [A(0, 0, "C"), A(0, -1, "H"), A(0, 1, "H"), A(-1, 0, "H"), A(1, 0, "H")], bonds: [B(0, 1), B(0, 2), B(0, 3), B(0, 4)] },
  };
}

function elColor(el: string): string {
  return (
    ({ C: "224,232,244", H: "196,208,224", O: "255,124,112", N: "116,168,255", S: "244,206,96" } as Record<string, string>)[el] ||
    "210,220,235"
  );
}

function drawMol(ctx: CanvasRenderingContext2D, tpl: Tpl, cx: number, cy: number, ang: number, sc: number, alpha: number, bondColor: string) {
  const ca = Math.cos(ang), sa = Math.sin(ang);
  const pts = tpl.atoms.map((a) => ({ x: cx + (a.x * ca - a.y * sa) * sc, y: cy + (a.x * sa + a.y * ca) * sc, el: a.el }));
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.lineCap = "round";
  for (const b of tpl.bonds) {
    const p = pts[b.a], q = pts[b.b];
    const dx = q.x - p.x, dy = q.y - p.y;
    const len = Math.hypot(dx, dy) || 1;
    const nx = -dy / len, ny = dx / len, off = sc * 0.1;
    ctx.strokeStyle = bondColor;
    ctx.lineWidth = Math.max(1, sc * 0.05);
    const offs = b.o === 1 ? [0] : b.o === 2 ? [-off, off] : [-off * 1.7, 0, off * 1.7];
    for (const o of offs) {
      ctx.beginPath();
      ctx.moveTo(p.x + nx * o, p.y + ny * o);
      ctx.lineTo(q.x + nx * o, q.y + ny * o);
      ctx.stroke();
    }
  }
  for (const p of pts) {
    const col = elColor(p.el), r = sc * 0.26;
    const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, r * 2.4);
    g.addColorStop(0, `rgba(${col},0.5)`);
    g.addColorStop(0.5, `rgba(${col},0.16)`);
    g.addColorStop(1, `rgba(${col},0)`);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(p.x, p.y, r * 2.4, 0, 6.283);
    ctx.fill();
    ctx.fillStyle = `rgba(${col},0.62)`;
    ctx.beginPath();
    ctx.arc(p.x, p.y, r, 0, 6.283);
    ctx.fill();
    ctx.fillStyle = "rgba(7,11,18,0.72)";
    ctx.font = `500 ${sc * 0.34}px "IBM Plex Mono", monospace`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(p.el, p.x, p.y + sc * 0.02);
  }
  ctx.restore();
}

function makeSprite(rgb: string): HTMLCanvasElement {
  const s = 28;
  const c = document.createElement("canvas");
  c.width = c.height = s;
  const x = c.getContext("2d")!;
  const g = x.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
  g.addColorStop(0, `rgba(${rgb},0.95)`);
  g.addColorStop(0.35, `rgba(${rgb},0.4)`);
  g.addColorStop(1, `rgba(${rgb},0)`);
  x.fillStyle = g;
  x.fillRect(0, 0, s, s);
  return c;
}

export default function ChemistryBackground() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const S = 0.6;
    const T = molTemplates();
    const stops = [[176, 110, 240], [200, 120, 200], [224, 140, 150], [240, 165, 110], [248, 190, 90]];
    const sprites = stops.map((c) => makeSprite(c.join(",")));
    const bondColor = "rgba(232,196,236,0.72)";

    let W = 0, H = 0;
    let parts: { x: number; y: number; vy: number; amp: number; ph: number; r: number }[] = [];
    type Eqn = { r: { c?: number; k?: string; op?: string }[]; x: number; y: number; vx: number; sc: number; ph: number };
    let eqns: Eqn[] = [];
    let raf = 0;

    const reactions = [
      [{ c: 2, k: "h2" }, { op: "+" }, { c: 1, k: "o2" }, { op: "→" }, { c: 2, k: "water" }],
      [{ c: 1, k: "n2" }, { op: "+" }, { c: 3, k: "h2" }, { op: "→" }, { c: 2, k: "nh3" }],
      [{ c: 1, k: "c1" }, { op: "+" }, { c: 1, k: "o2" }, { op: "→" }, { c: 1, k: "co2" }],
      [{ c: 1, k: "ch4" }, { op: "+" }, { c: 2, k: "o2" }, { op: "→" }, { c: 1, k: "co2" }, { op: "+" }, { c: 2, k: "water" }],
    ];

    const build = () => {
      const w = canvas.offsetWidth, h = canvas.offsetHeight;
      if (!w || !h) return false;
      canvas.width = Math.floor(w * S);
      canvas.height = Math.floor(h * S);
      W = canvas.width;
      H = canvas.height;
      const count = Math.min(170, Math.floor((W * H) / 26000));
      parts = [];
      for (let i = 0; i < count; i++) {
        parts.push({ x: Math.random() * W, y: Math.random() * H, vy: -(Math.random() * 0.14 + 0.05), amp: Math.random() * 0.5 + 0.2, ph: Math.random() * 6.28, r: Math.random() * 1.6 + 0.8 });
      }
      buildEqns();
      return true;
    };
    const buildEqns = () => {
      const n = Math.max(4, Math.min(11, Math.floor(H / 420)));
      eqns = [];
      for (let i = 0; i < n; i++) {
        eqns.push({ r: reactions[Math.floor(Math.random() * reactions.length)], x: Math.random() * W, y: Math.random() * H, vx: (Math.random() < 0.5 ? -1 : 1) * (Math.random() * 0.08 + 0.04), sc: (Math.random() * 8 + 30) * S, ph: Math.random() * 6.28 });
      }
    };

    let tries = 0;
    const ensure = () => {
      if (build()) return;
      if (tries++ < 100) setTimeout(ensure, 100);
    };
    ensure();

    let lastW = 0;
    const ro = new ResizeObserver(() => {
      if (Math.abs(canvas.offsetWidth - lastW) > 2) {
        lastW = canvas.offsetWidth;
        build();
      }
    });
    ro.observe(canvas);

    const drawEqn = (eq: Eqn) => {
      const sc = eq.sc, slot = sc * 3.0, opw = sc * 1.7;
      let total = 0;
      for (const it of eq.r) total += it.op ? opw : slot;
      let x = eq.x - total / 2;
      const y = eq.y;
      for (const it of eq.r) {
        if (it.op) {
          ctx.save();
          ctx.globalAlpha = 0.3;
          ctx.fillStyle = it.op === "→" ? "rgba(248,190,90,0.9)" : "rgba(200,180,220,0.8)";
          ctx.font = `${it.op === "→" ? "400 " : "300 "}${sc * 1.3}px "IBM Plex Mono", monospace`;
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText(it.op, x + opw / 2, y);
          ctx.restore();
          x += opw;
        } else {
          if ((it.c ?? 1) > 1) {
            ctx.save();
            ctx.globalAlpha = 0.32;
            ctx.fillStyle = "rgba(220,206,236,0.9)";
            ctx.font = `400 ${sc * 0.85}px "Space Grotesk", sans-serif`;
            ctx.textAlign = "right";
            ctx.textBaseline = "middle";
            ctx.fillText(String(it.c), x + sc * 0.55, y);
            ctx.restore();
          }
          drawMol(ctx, T[it.k!], x + slot / 2 + sc * 0.35, y, 0, sc, 0.5, bondColor);
          x += slot;
        }
      }
    };

    let t = 0;
    const draw = () => {
      if (!W) {
        raf = requestAnimationFrame(draw);
        return;
      }
      t += 0.006;
      ctx.clearRect(0, 0, W, H);
      ctx.globalCompositeOperation = "lighter";
      ctx.globalAlpha = 0.4;
      for (const p of parts) {
        p.y += p.vy;
        p.x += Math.sin(t + p.ph) * p.amp * 0.3;
        if (p.y < -20) {
          p.y = H + 20;
          p.x = Math.random() * W;
        }
        if (p.x < -20) p.x = W + 20;
        if (p.x > W + 20) p.x = -20;
        const frac = 1 - Math.min(1, Math.max(0, p.y / H));
        const idx = Math.min(stops.length - 1, Math.floor(frac * stops.length));
        const sz = p.r * 10;
        ctx.drawImage(sprites[idx], p.x - sz / 2, p.y - sz / 2, sz, sz);
      }
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = "source-over";
      if (!eqns.length) buildEqns();
      const m = 260;
      for (const eq of eqns) {
        eq.x += eq.vx;
        eq.y += Math.sin(t * 0.5 + eq.ph) * 0.12;
        if (eq.x < -m) eq.x = W + m;
        if (eq.x > W + m) eq.x = -m;
        drawEqn(eq);
      }
      raf = requestAnimationFrame(draw);
    };
    draw();

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, []);

  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-[#05060b]">
      <div className="avaia-glow avaia-glow-a" />
      <div className="avaia-glow avaia-glow-b" />
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />
      {/* gentle vignette so content stays legible over the field */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_40%,rgba(5,6,11,0.55))]" />
    </div>
  );
}
