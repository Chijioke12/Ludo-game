import fs from 'fs';
import { createCanvas, Canvas, Image } from 'canvas';

// constants
const SS = 4;
const PLAYERS = {
    red:    { light: [255, 150, 140], base: [220, 45, 55],  dark: [120, 10, 18] },
    green:  { light: [165, 235, 180], base: [35, 158, 92],  dark: [8, 80, 42] },
    yellow: { light: [255, 230, 150], base: [240, 175, 25], dark: [150, 95, 0] },
    blue:   { light: [160, 195, 255], base: [40, 105, 215], dark: [12, 45, 120] },
};
const GOLD = { light: [255, 244, 200], base: [235, 185, 70], dark: [140, 95, 15] };
const CREAM = { light: [255, 255, 252], base: [250, 244, 230], dark: [210, 198, 175] };
const UI = { light: [150, 165, 235], base: [78, 92, 175], dark: [28, 32, 78] };
const PURPLE = { light: [220, 175, 255], base: [140, 70, 200], dark: [60, 20, 100] };

function lerp(a: number, b: number, t: number) {
    return a + (b - a) * t;
}

function radialShadedDisc(diameter: number, palette: any, lightOffset = [-0.35, -0.40]) {
    diameter = Math.floor(diameter);
    const canvas = createCanvas(diameter, diameter);
    const ctx = canvas.getContext('2d');
    const imgData = ctx.createImageData(diameter, diameter);
    const data = imgData.data;

    const r = diameter / 2.0;
    const cx = r, cy = r;
    const lx = cx + lightOffset[0] * diameter;
    const ly = cy + lightOffset[1] * diameter;

    const max_d = Math.sqrt(diameter ** 2 + diameter ** 2) * 0.62;

    for (let y = 0; y < diameter; y++) {
        for (let x = 0; x < diameter; x++) {
            const distCenter = Math.sqrt((x - cx) ** 2 + (y - cy) ** 2);
            const mask = distCenter <= (r - 0.5);

            if (!mask) continue;

            const distLight = Math.sqrt((x - lx) ** 2 + (y - ly) ** 2);
            let t = Math.max(0, Math.min(1, distLight / max_d));

            let t1 = Math.max(0, Math.min(1, t / 0.45));
            let t2 = Math.max(0, Math.min(1, (t - 0.45) / 0.55));

            let mixed = [0, 0, 0];
            for (let c = 0; c < 3; c++) {
                let seg1 = lerp(palette.light[c], palette.base[c], t1);
                let seg2 = lerp(palette.base[c], palette.dark[c], t2);
                mixed[c] = (t < 0.45) ? seg1 : seg2;
            }

            const edge_t = Math.max(0, Math.min(1, (distCenter - (r * 0.78)) / (r * 0.22)));
            for (let c = 0; c < 3; c++) {
                let rimDark = palette.dark[c] * 0.55;
                mixed[c] = Math.floor(lerp(mixed[c], rimDark, edge_t * 0.5));
            }

            const idx = (y * diameter + x) * 4;
            data[idx] = mixed[0];
            data[idx + 1] = mixed[1];
            data[idx + 2] = mixed[2];
            data[idx + 3] = 255;
        }
    }
    ctx.putImageData(imgData, 0, 0);
    return canvas;
}

function flatGradientRect(w: number, h: number, palette: any, lightOffset = [-0.4, -0.4]) {
    const dim = Math.floor(Math.max(w, h) * 2);
    const big = radialShadedDisc(dim, palette, lightOffset);
    const canvas = createCanvas(w, h);
    const ctx = canvas.getContext('2d');
    const left = (dim - w) / 2;
    const top = (dim - h) / 2;
    ctx.drawImage(big, left, top, w, h, 0, 0, w, h);
    return canvas;
}

function addSpecular(im: Canvas, centerRatio = [0.32, 0.30], radiusRatio = 0.22, strength = 235) {
    const w = im.width, h = im.height;
    const canvas = createCanvas(w, h);
    const ctx = canvas.getContext('2d');
    ctx.drawImage(im, 0, 0);
    
    const spec = createCanvas(w, h);
    const sCtx = spec.getContext('2d');
    const cx = w * centerRatio[0], cy = h * centerRatio[1];
    const rad = Math.max(w, h) * radiusRatio;
    
    sCtx.filter = `blur(${Math.max(w, h) * 0.045}px)`;
    sCtx.fillStyle = `rgba(255, 255, 255, ${strength / 255})`;
    sCtx.beginPath();
    sCtx.ellipse(cx, cy, rad, rad * 0.7, 0, 0, Math.PI * 2);
    sCtx.fill();
    
    ctx.drawImage(spec, 0, 0);
    return canvas;
}

function softShadow(w: number, h: number, scaleX = 0.9, scaleY = 0.32, alpha = 110, blur = 0.10, cyRatio = 0.80) {
    const canvas = createCanvas(w, h);
    const ctx = canvas.getContext('2d');
    const sw = w * scaleX, sh = h * scaleY;
    const cx = w / 2, cy = h * cyRatio;
    
    (ctx as any).filter = `blur(${Math.max(w, h) * blur}px)`;
    ctx.fillStyle = `rgba(10, 8, 5, ${alpha / 255})`;
    ctx.beginPath();
    ctx.ellipse(cx, cy, sw / 2, sh / 2, 0, 0, Math.PI * 2);
    ctx.fill();
    
    return canvas;
}

function downsample(im: Canvas, w: number, h: number) {
    const canvas = createCanvas(w, h);
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = true;
    (ctx as any).imageSmoothingQuality = 'high';
    ctx.drawImage(im, 0, 0, w, h);
    return canvas;
}

function rotPt(cx: number, cy: number, x: number, y: number, deg: number) {
    const a = (deg * Math.PI) / 180;
    const dx = x - cx;
    const dy = y - cy;
    return [
        cx + dx * Math.cos(a) - dy * Math.sin(a),
        cy + dx * Math.sin(a) + dy * Math.cos(a)
    ];
}

function drawPolygon(ctx: any, pts: number[][]) {
    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) {
        ctx.lineTo(pts[i][0], pts[i][1]);
    }
    ctx.closePath();
}

function roundedRectPath(ctx: any, x: number, y: number, w: number, h: number, r: number) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
}

const MODERN_PLAYERS: any = {
    red:    { light: [210, 31, 60], base: [155, 17, 30],  dark: [92, 10, 18] },
    green:  { light: [0, 168, 107], base: [0, 86, 59],   dark: [0, 51, 35] },
    yellow: { light: [243, 229, 171], base: [197, 160, 41], dark: [120, 95, 20] },
    blue:   { light: [59, 122, 250], base: [15, 82, 186],  dark: [9, 49, 112] },
};

const MODERN_GOLD = { light: [255, 244, 212], base: [212, 175, 55], dark: [94, 78, 10] };

function createModernGradient(ctx: any, x0: number, y0: number, x1: number, y1: number, palette: any) {
    const grd = ctx.createLinearGradient(x0, y0, x1, y1);
    grd.addColorStop(0, `rgb(${palette.light[0]}, ${palette.light[1]}, ${palette.light[2]})`);
    grd.addColorStop(0.5, `rgb(${palette.base[0]}, ${palette.base[1]}, ${palette.base[2]})`);
    grd.addColorStop(1, `rgb(${palette.dark[0]}, ${palette.dark[1]}, ${palette.dark[2]})`);
    return grd;
}

function renderTokenV2(colorKey: string, final = 128) {
    const d = final * SS;
    const canvas = createCanvas(d, d);
    const ctx = canvas.getContext('2d') as any;
    const player = MODERN_PLAYERS[colorKey];
    const cx = d/2, cy = d/2;

    // Shadow
    ctx.fillStyle = "rgba(0,0,0,0.35)";
    ctx.beginPath();
    ctx.ellipse(cx, cy + d*0.38, d*0.35, d*0.12, 0, 0, Math.PI*2);
    ctx.fill();

    const drawPawnV2 = (tx: number, ty: number, scale: number) => {
        ctx.save();
        ctx.translate(tx, ty);
        ctx.scale(scale, scale);
        
        const goldGrd = createModernGradient(ctx, d*0.2, d*0.2, d*0.8, d*0.8, MODERN_GOLD);
        
        // Specular glow for the body
        const bodyGrd = ctx.createRadialGradient(d*0.4, d*0.4, d*0.1, d*0.5, d*0.5, d*0.5);
        bodyGrd.addColorStop(0, `rgb(${player.light[0]}, ${player.light[1]}, ${player.light[2]})`);
        bodyGrd.addColorStop(1, `rgb(${player.dark[0]}, ${player.dark[1]}, ${player.dark[2]})`);

        // Base with metallic trim
        ctx.fillStyle = goldGrd;
        ctx.beginPath();
        ctx.moveTo(d*0.15, d*0.80);
        ctx.lineTo(d*0.85, d*0.80);
        ctx.quadraticCurveTo(d*0.85, d*0.92, d*0.75, d*0.92);
        ctx.lineTo(d*0.25, d*0.92);
        ctx.quadraticCurveTo(d*0.15, d*0.92, d*0.15, d*0.80);
        ctx.fill();

        // High-gloss waist
        ctx.fillStyle = bodyGrd;
        roundedRectPath(ctx, d*0.20, d*0.70, d*0.60, d*0.12, d*0.06);
        ctx.fill();
        ctx.strokeStyle = "rgba(255,255,255,0.3)";
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // Royal Crest Body
        ctx.beginPath();
        ctx.moveTo(d*0.25, d*0.70);
        ctx.bezierCurveTo(d*0.20, d*0.50, d*0.35, d*0.45, d*0.35, d*0.35);
        ctx.lineTo(d*0.42, d*0.45);
        ctx.lineTo(d*0.50, d*0.25);
        ctx.lineTo(d*0.58, d*0.45);
        ctx.lineTo(d*0.65, d*0.35);
        ctx.bezierCurveTo(d*0.65, d*0.45, d*0.80, d*0.50, d*0.75, d*0.70);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Top Jewel
        ctx.fillStyle = goldGrd;
        ctx.beginPath();
        ctx.arc(d*0.5, d*0.22, d*0.09, 0, Math.PI*2);
        ctx.fill();
        
        ctx.restore();
    };

    drawPawnV2(0, 0, 1);

    return downsample(canvas, final, final);
}

function renderDieV2(n: number, final = 96) {
    const d = final * SS;
    const canvas = createCanvas(d, d);
    const ctx = canvas.getContext('2d');
    const goldGrd = createModernGradient(ctx, 0, 0, d, d, MODERN_GOLD);
    
    // Frame
    roundedRectPath(ctx, d*0.09, d*0.09, d*0.82, d*0.82, d*0.17);
    ctx.fillStyle = goldGrd;
    ctx.fill();
    ctx.strokeStyle = "#5C4010";
    ctx.lineWidth = 1;
    ctx.stroke();

    // Inner Cushion
    const cushionPalette = { light: [255, 244, 212], base: [212, 175, 55], dark: [92, 64, 16] };
    const cushionGrd = createModernGradient(ctx, d*0.11, d*0.11, d*0.77, d*0.77, cushionPalette);
    roundedRectPath(ctx, d*0.115, d*0.115, d*0.77, d*0.77, d*0.145);
    ctx.fillStyle = cushionGrd;
    ctx.fill();
    ctx.strokeStyle = goldGrd;
    ctx.lineWidth = d*0.015;
    ctx.stroke();

    // Pips
    const pipLayout = PIP_LAYOUT[n];
    const pipR = d * 0.065;
    for (const [px, py] of pipLayout) {
        const cx = px * d;
        const cy = py * d;
        
        // Shadow
        ctx.fillStyle = "rgba(0,0,0,0.3)";
        ctx.beginPath(); ctx.arc(cx, cy, pipR*1.18, 0, Math.PI*2); ctx.fill();
        
        // Pip
        ctx.fillStyle = goldGrd;
        ctx.strokeStyle = "#5C4010";
        ctx.lineWidth = d * 0.008;
        ctx.beginPath(); ctx.arc(cx, cy, pipR, 0, Math.PI*2); ctx.fill(); ctx.stroke();
        
        // Inner highlight
        ctx.strokeStyle = "rgba(255,255,255,0.4)";
        ctx.lineWidth = d * 0.005;
        ctx.beginPath(); ctx.arc(cx, cy, pipR*0.77, 0, Math.PI*2); ctx.stroke();
        
        // Specular dot
        ctx.fillStyle = "#FFFFFF";
        ctx.beginPath(); ctx.arc(cx - pipR*0.35, cy - pipR*0.35, pipR*0.25, 0, Math.PI*2); ctx.fill();
    }

    // Gloss
    const glossGrd = ctx.createLinearGradient(0, 0, d, d);
    glossGrd.addColorStop(0, "rgba(255,255,255,0.45)");
    glossGrd.addColorStop(0.4, "rgba(255,255,255,0.1)");
    glossGrd.addColorStop(0.6, "rgba(255,255,255,0)");
    ctx.fillStyle = glossGrd;
    roundedRectPath(ctx, d*0.115, d*0.115, d*0.77, d*0.77, d*0.145);
    ctx.fill();

    return downsample(canvas, final, final);
}

function renderModernBoard(final = 512) {
    const d = final * SS;
    const canvas = createCanvas(d, d);
    const ctx = canvas.getContext('2d') as any;
    
    // Background
    ctx.fillStyle = "#12100E";
    ctx.fillRect(0, 0, d, d);

    // Decorative ambient glow
    const glow = ctx.createRadialGradient(d/2, d/2, 0, d/2, d/2, d*0.7);
    glow.addColorStop(0, "rgba(212, 175, 55, 0.08)");
    glow.addColorStop(0.5, "rgba(212, 175, 55, 0.02)");
    glow.addColorStop(1, "rgba(212, 175, 55, 0)");
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, d, d);

    // Gold Outer Frame with bevel
    const frameGrd = createModernGradient(ctx, 0, 0, d, d, MODERN_GOLD);
    ctx.strokeStyle = frameGrd;
    ctx.lineWidth = d * 0.012;
    ctx.strokeRect(d*0.006, d*0.006, d*0.988, d*0.988);
    
    ctx.strokeStyle = "rgba(0,0,0,0.5)";
    ctx.lineWidth = 1;
    ctx.strokeRect(d*0.012, d*0.012, d*0.976, d*0.976);

    const cellSize = d / 15;

    // Track Cells
    const drawCell = (x:number, y:number, colorKey: string | null = null, isSafe = false) => {
        ctx.save();
        ctx.translate(x * cellSize, y * cellSize);
        
        let palette = CREAM;
        if (colorKey) palette = MODERN_PLAYERS[colorKey];
        
        // Subtle cell gradient
        const cellGrd = ctx.createLinearGradient(0, 0, cellSize, cellSize);
        cellGrd.addColorStop(0, `rgb(${palette.light[0]}, ${palette.light[1]}, ${palette.light[2]})`);
        cellGrd.addColorStop(1, `rgb(${palette.base[0]}, ${palette.base[1]}, ${palette.base[2]})`);
        
        ctx.fillStyle = cellGrd;
        ctx.fillRect(1, 1, cellSize - 2, cellSize - 2);
        
        // Modern border
        ctx.strokeStyle = "rgba(0,0,0,0.15)";
        ctx.lineWidth = 1;
        ctx.strokeRect(0, 0, cellSize, cellSize);

        // Safe zone indicator
        if (isSafe) {
            const cx = cellSize/2, cy = cellSize/2;
            ctx.fillStyle = "rgba(0,0,0,0.05)";
            ctx.beginPath();
            ctx.arc(cx, cy, cellSize * 0.35, 0, Math.PI * 2);
            ctx.fill();
            
            const pts = starPoints(cx, cy, cellSize * 0.28, cellSize * 0.12, 5, -90);
            ctx.fillStyle = createModernGradient(ctx, 0, 0, cellSize, cellSize, MODERN_GOLD);
            drawPolygon(ctx, pts);
            ctx.fill();
        }

        ctx.restore();
    };

    // Tracks
    for (let i = 0; i < 3; i++) {
        for (let j = 0; j < 6; j++) {
            drawCell(6 + i, j, (i === 1 && j > 0) ? "red" : null, (i === 2 && j === 1));
            drawCell(6 + i, 9 + j, (i === 1 && j < 5) ? "yellow" : null, (i === 0 && j === 3));
            drawCell(j, 6 + i, (i === 1 && j > 0) ? "green" : null, (i === 0 && j === 1));
            drawCell(9 + j, 6 + i, (i === 1 && j < 5) ? "blue" : null, (i === 2 && j === 3));
        }
    }

    // Home Squadrons
    const drawHome = (qx: number, qy: number, colorKey: string) => {
        const x = qx * cellSize, y = qy * cellSize, s = 6 * cellSize;
        const player = MODERN_PLAYERS[colorKey];
        
        // Dashboard style base
        ctx.fillStyle = "#12100E";
        ctx.strokeStyle = createModernGradient(ctx, x, y, x+s, y+s, MODERN_GOLD);
        ctx.lineWidth = d * 0.005;
        roundedRectPath(ctx, x + d*0.015, y + d*0.015, s - d*0.03, s - d*0.03, d*0.02);
        ctx.fill();
        ctx.stroke();

        // Main colored disc
        const cx = x + s/2, cy = y + s/2;
        const mainR = s * 0.4;
        const mainGrd = ctx.createRadialGradient(cx, cy, 0, cx, cy, mainR);
        mainGrd.addColorStop(0, `rgb(${player.light[0]}, ${player.light[1]}, ${player.light[2]})`);
        mainGrd.addColorStop(0.7, `rgb(${player.base[0]}, ${player.base[1]}, ${player.base[2]})`);
        mainGrd.addColorStop(1, `rgb(${player.dark[0]}, ${player.dark[1]}, ${player.dark[2]})`);
        
        ctx.fillStyle = mainGrd;
        ctx.beginPath(); ctx.arc(cx, cy, mainR, 0, Math.PI*2); ctx.fill();
        ctx.strokeStyle = "rgba(255,255,255,0.2)";
        ctx.lineWidth = 2;
        ctx.stroke();

        // Specific slot alignment: 2.28 and 3.72 relative to cellSize
        // In this local square s=6*cellSize, these are at 0.38*s and 0.62*s
        const p0 = 0.38 * s, p1 = 0.62 * s;
        const slotsPos = [
            [x + p0, y + p0], [x + p1, y + p0],
            [x + p0, y + p1], [x + p1, y + p1]
        ];

        for (const [sx, sy] of slotsPos) {
            ctx.fillStyle = "rgba(0,0,0,0.4)";
            ctx.beginPath(); ctx.arc(sx, sy, s*0.12, 0, Math.PI*2); ctx.fill();
            ctx.strokeStyle = "rgba(255,255,255,0.15)";
            ctx.lineWidth = 1;
            ctx.stroke();
            
            // Gloss on slot
            const slotGloss = ctx.createRadialGradient(sx, sy, 0, sx, sy, s*0.12);
            slotGloss.addColorStop(0, "rgba(255,255,255,0.1)");
            slotGloss.addColorStop(1, "rgba(255,255,255,0)");
            ctx.fillStyle = slotGloss;
            ctx.fill();
        }
    };

    drawHome(0, 0, "green");
    drawHome(9, 0, "red");
    drawHome(0, 9, "yellow");
    drawHome(9, 9, "blue");

    // Victory Center
    const vx = 6*cellSize, vy = 6*cellSize, vs = 3*cellSize;
    const vcx = vx + vs/2, vcy = vy + vs/2;

    const drawTri = (p1x:number, p1y:number, p2x:number, p2y:number, p3x:number, p3y:number, color: string) => {
        const player = (MODERN_PLAYERS as any)[color];
        const triGrd = ctx.createLinearGradient(p1x, p1y, p3x, p3y);
        triGrd.addColorStop(0, `rgb(${player.light[0]}, ${player.light[1]}, ${player.light[2]})`);
        triGrd.addColorStop(1, `rgb(${player.dark[0]}, ${player.dark[1]}, ${player.dark[2]})`);
        
        ctx.fillStyle = triGrd;
        ctx.beginPath(); ctx.moveTo(p1x, p1y); ctx.lineTo(p2x, p2y); ctx.lineTo(p3x, p3y); ctx.closePath(); ctx.fill();
        ctx.strokeStyle = "rgba(255,255,255,0.3)";
        ctx.lineWidth = 1;
        ctx.stroke();
    };

    drawTri(vx, vy, vx + vs, vy, vcx, vcy, "red");
    drawTri(vx + vs, vy, vx + vs, vy + vs, vcx, vcy, "blue");
    drawTri(vx + vs, vy + vs, vx, vy + vs, vcx, vcy, "yellow");
    drawTri(vx, vy + vs, vx, vy, vcx, vcy, "green");

    // Center Gold Emblem
    ctx.fillStyle = frameGrd;
    ctx.beginPath(); ctx.arc(vcx, vcy, vs*0.25, 0, Math.PI*2); ctx.fill();
    ctx.strokeStyle = "rgba(0,0,0,0.4)";
    ctx.stroke();
    
    return downsample(canvas, final, final);
}

// ================================================================= GAMEPLAY PIECES

function renderToken(colorKey: string, final = 128) {
    const d = final * SS;
    const canvas = createCanvas(d, d);
    const ctx = canvas.getContext('2d');
    
    ctx.drawImage(softShadow(d, d, 0.62, 0.16, 120, 0.05), 0, 0);

    const baseH = d * 0.30, baseW = d * 0.70;
    const baseDiscTmp = radialShadedDisc(baseW, (PLAYERS as any)[colorKey], [-0.25, -0.55]);
    const bx = (d - baseW) / 2, by = d * 0.62;
    ctx.drawImage(baseDiscTmp, 0, 0, baseW, baseW, bx, by, baseW, baseH);

    ctx.strokeStyle = `rgba(235, 195, 90, ${230/255})`;
    ctx.lineWidth = Math.max(2, Math.floor(d * 0.012));
    ctx.beginPath();
    ctx.ellipse(bx + baseW/2, by + baseH/2, baseW/2 - 0.5, baseH/2 - 0.5, 0, 0, Math.PI * 2);
    ctx.stroke();

    const sphereD = d * 0.62;
    const sphereDesc = radialShadedDisc(sphereD, (PLAYERS as any)[colorKey]);
    const sphere = addSpecular(sphereDesc, [0.32, 0.30], 0.22, 230);
    const sx = (d - sphereD) / 2, sy = d * 0.16;
    ctx.drawImage(sphere, sx, sy);

    ctx.strokeStyle = `rgba(0, 0, 0, ${90/255})`;
    ctx.lineWidth = Math.max(2, Math.floor(d * 0.01));
    ctx.beginPath();
    ctx.ellipse(sx + sphereD/2, sy + sphereD/2, sphereD/2 - 1.5, sphereD/2 - 1.5, 0, 0, Math.PI * 2);
    ctx.stroke();

    return downsample(canvas, final, final);
}

const PIP_LAYOUT: Record<number, number[][]> = {
    1: [[0.5, 0.5]],
    2: [[0.27, 0.27], [0.73, 0.73]],
    3: [[0.27, 0.27], [0.5, 0.5], [0.73, 0.73]],
    4: [[0.27, 0.27], [0.73, 0.27], [0.27, 0.73], [0.73, 0.73]],
    5: [[0.27, 0.27], [0.73, 0.27], [0.5, 0.5], [0.27, 0.73], [0.73, 0.73]],
    6: [[0.27, 0.22], [0.73, 0.22], [0.27, 0.5], [0.73, 0.5], [0.27, 0.78], [0.73, 0.78]],
};

function renderDie(n: number, final = 96) {
    const d = final * SS;
    const canvas = createCanvas(d, d);
    const ctx = canvas.getContext('2d');

    const shadow = softShadow(d, d, 0.78, 0.18, 110, 0.06);
    ctx.drawImage(shadow, 0, 0);

    const pad = d * 0.08;
    const radius = d * 0.16;
    const cw = d - pad*2;
    const grad = radialShadedDisc(Math.floor(d), CREAM, [-0.3, -0.35]);
    
    ctx.save();
    roundedRectPath(ctx, pad, pad, cw, cw, radius);
    ctx.clip();
    ctx.drawImage(grad, 0, 0);
    
    ctx.strokeStyle = `rgba(220, 175, 70, 255)`;
    ctx.lineWidth = Math.max(2, Math.floor(d * 0.018));
    ctx.stroke();

    (ctx as any).filter = `blur(${d * 0.04}px)`;
    ctx.fillStyle = `rgba(255, 255, 255, ${110/255})`;
    ctx.beginPath();
    ctx.ellipse(d * 0.10 + (d * 0.45)/2, d * 0.06 + (d * 0.24)/2, (d * 0.45)/2, (d * 0.24)/2, 0, 0, Math.PI*2);
    ctx.fill();
    (ctx as any).filter = 'none';
    ctx.restore();

    const pipR = d * 0.085;
    for (const [px, py] of PIP_LAYOUT[n]) {
        const cx = px * d;
        const cy = py * d;
        ctx.fillStyle = `rgba(40, 28, 20, 255)`;
        ctx.beginPath();
        ctx.ellipse(cx, cy, pipR, pipR, 0, 0, Math.PI*2);
        ctx.fill();

        const hlR = pipR * 0.35;
        ctx.fillStyle = `rgba(255, 255, 255, ${130/255})`;
        ctx.beginPath();
        ctx.ellipse(cx - pipR*0.25, cy - pipR*0.3, hlR, hlR, 0, 0, Math.PI*2);
        ctx.fill();
    }

    return downsample(canvas, final, final);
}

function starPoints(cx: number, cy: number, rOut: number, rIn: number, n = 5, rot = -90) {
    const pts = [];
    for (let i = 0; i < n * 2; i++) {
        const ang = (rot * Math.PI) / 180 + (i * Math.PI) / n;
        const r = i % 2 === 0 ? rOut : rIn;
        pts.push([cx + r * Math.cos(ang), cy + r * Math.sin(ang)]);
    }
    return pts;
}

function renderStar(final = 96, glow = true) {
    const d = final * SS;
    const canvas = createCanvas(d, d);
    const ctx = canvas.getContext('2d');
    const cx = d / 2, cy = d / 2;

    if (glow) {
        ctx.save();
        (ctx as any).filter = `blur(${d * 0.08}px)`;
        ctx.fillStyle = `rgba(255, 225, 120, ${90/255})`;
        ctx.beginPath();
        ctx.ellipse(cx, cy, d * 0.42, d * 0.42, 0, 0, Math.PI*2);
        ctx.fill();
        ctx.restore();
    }

    const pts = starPoints(cx, cy, d * 0.40, d * 0.40 * 0.42);
    
    ctx.save();
    drawPolygon(ctx, pts);
    ctx.clip();
    const grad = radialShadedDisc(Math.floor(d), GOLD, [-0.3, -0.4]);
    ctx.drawImage(grad, 0, 0);
    ctx.restore();

    ctx.strokeStyle = `rgba(120, 80, 10, ${220/255})`;
    ctx.lineWidth = Math.max(2, Math.floor(d * 0.012));
    drawPolygon(ctx, pts);
    ctx.stroke();

    return downsample(addSpecular(canvas, [0.40, 0.36], 0.14, 200), final, final);
}

function renderHome(colorKey: string, final = 96) {
    const d = final * SS;
    const canvas = createCanvas(d, d);
    const ctx = canvas.getContext('2d');
    
    ctx.drawImage(softShadow(d, d, 0.6, 0.14, 100, 0.05), 0, 0);
    
    const cx = d / 2;
    const top = d * 0.14, bottom = d * 0.86;
    const w = d * 0.62;
    const left = cx - w / 2, right = cx + w / 2;
    const mid = d * 0.58;
    const points = [[left, top], [right, top], [right, mid], [cx, bottom], [left, mid]];
    
    ctx.save();
    drawPolygon(ctx, points);
    ctx.clip();
    const grad = radialShadedDisc(d, (PLAYERS as any)[colorKey], [-0.3, -0.4]);
    ctx.drawImage(grad, 0, 0);
    ctx.restore();
    
    ctx.strokeStyle = `rgba(235, 200, 110, ${240/255})`;
    ctx.lineWidth = Math.max(2, Math.floor(d * 0.016));
    drawPolygon(ctx, points);
    ctx.stroke();
    
    const hw = d * 0.30, hh = d * 0.22;
    const hx = cx - hw / 2, hy = d * 0.40;
    
    ctx.fillStyle = `rgba(255, 255, 255, ${235/255})`;
    ctx.fillRect(hx, hy + hh * 0.35, hw, hh - hh * 0.35); // Since y=hy+hh*0.35, height=hh - ...
    drawPolygon(ctx, [
        [hx - hw * 0.12, hy + hh * 0.38],
        [cx, hy - hh * 0.35],
        [hx + hw * 1.12, hy + hh * 0.38]
    ]);
    ctx.fill();
    
    return downsample(addSpecular(canvas, [0.36, 0.30], 0.16, 160), final, final);
}

function renderArrow(colorKey: string, final = 96, palette: any = null) {
    palette = palette || (PLAYERS as any)[colorKey];
    const d = final * SS;
    const canvas = createCanvas(d, d);
    const ctx = canvas.getContext('2d');
    
    ctx.drawImage(softShadow(d, d, 0.6, 0.14, 90, 0.05), 0, 0);
    
    const cy = d / 2;
    const shaftH = d * 0.22, shaftW = d * 0.38, headW = d * 0.34;
    const left = d * 0.16;
    const points = [
        [left, cy - shaftH / 2], [left + shaftW, cy - shaftH / 2],
        [left + shaftW, cy - shaftH * 1.4], [left + shaftW + headW, cy],
        [left + shaftW, cy + shaftH * 1.4], [left + shaftW, cy + shaftH / 2],
        [left, cy + shaftH / 2],
    ];
    
    ctx.save();
    drawPolygon(ctx, points);
    ctx.clip();
    const grad = radialShadedDisc(d, palette, [-0.3, -0.4]);
    ctx.drawImage(grad, 0, 0);
    ctx.restore();
    
    ctx.strokeStyle = `rgba(255, 255, 255, ${160/255})`;
    ctx.lineWidth = Math.max(2, Math.floor(d * 0.012));
    drawPolygon(ctx, points);
    ctx.stroke();
    
    return downsample(addSpecular(canvas, [0.30, 0.32], 0.14, 150), final, final);
}

// ================================================================= BOARD

function renderCell(final = 96, tint: any = null, labelStar = false) {
    const d = final * SS;
    const canvas = createCanvas(d, d);
    const ctx = canvas.getContext('2d');
    const pad = d * 0.04;
    const radius = d * 0.10;
    const palette = tint ? tint : CREAM;
    const grad = radialShadedDisc(d, palette, [-0.35, -0.4]);
    
    ctx.save();
    roundedRectPath(ctx, pad, pad, d - pad*2, d - pad*2, radius);
    ctx.clip();
    ctx.drawImage(grad, 0, 0);
    ctx.restore();
    
    ctx.strokeStyle = `rgba(255, 255, 255, ${90/255})`;
    ctx.lineWidth = Math.max(2, Math.floor(d * 0.012));
    roundedRectPath(ctx, pad*2.4, pad*2.4, d - pad*4.8, d - pad*4.8, radius*0.7);
    ctx.stroke();
    
    ctx.strokeStyle = `rgba(120, 100, 70, ${160/255})`;
    ctx.lineWidth = Math.max(2, Math.floor(d * 0.012));
    roundedRectPath(ctx, pad, pad, d - pad*2, d - pad*2, radius);
    ctx.stroke();
    
    if (labelStar) {
        const cx = d / 2, cy = d / 2;
        const pts = starPoints(cx, cy, d * 0.24, d * 0.24 * 0.42);
        ctx.save();
        drawPolygon(ctx, pts);
        ctx.clip();
        ctx.drawImage(radialShadedDisc(d, GOLD, [-0.3, -0.4]), 0, 0);
        ctx.restore();
        
        ctx.strokeStyle = `rgba(120, 80, 10, ${200/255})`;
        ctx.lineWidth = Math.max(2, Math.floor(d * 0.01));
        drawPolygon(ctx, pts);
        ctx.stroke();
    }
    
    return downsample(canvas, final, final);
}

function renderHomeQuadrant(colorKey: string, final = 192) {
    const d = final * SS;
    const canvas = createCanvas(d, d);
    const ctx = canvas.getContext('2d');
    
    ctx.drawImage(softShadow(d, d, 0.85, 0.14, 90, 0.04, 0.92), 0, 0);
    
    const pad = d * 0.04, radius = d * 0.10;
    ctx.save();
    roundedRectPath(ctx, pad, pad, d - pad*2, d - pad*2, radius);
    ctx.clip();
    ctx.drawImage(radialShadedDisc(d, (PLAYERS as any)[colorKey], [-0.3, -0.4]), 0, 0);
    ctx.restore();
    
    ctx.strokeStyle = `rgba(255, 220, 140, ${230/255})`;
    ctx.lineWidth = Math.max(3, Math.floor(d * 0.012));
    roundedRectPath(ctx, pad, pad, d - pad*2, d - pad*2, radius);
    ctx.stroke();
    
    const inset = d * 0.20;
    ctx.save();
    roundedRectPath(ctx, inset, inset, d - inset*2, d - inset*2, radius*0.8);
    ctx.clip();
    ctx.drawImage(radialShadedDisc(d, CREAM, [-0.3, -0.35]), 0, 0);
    ctx.restore();
    
    ctx.strokeStyle = `rgba(150, 130, 100, ${180/255})`;
    ctx.lineWidth = Math.max(2, Math.floor(d * 0.008));
    roundedRectPath(ctx, inset, inset, d - inset*2, d - inset*2, radius*0.8);
    ctx.stroke();
    
    const slotR = d * 0.085;
    const cx0 = d * 0.38, cy0 = d * 0.38; // Slightly wider spacing
    const cx1 = d * 0.62, cy1 = d * 0.62;
    for (const [sx, sy] of [[cx0, cy0], [cx1, cy0], [cx0, cy1], [cx1, cy1]]) {
        // Draw empty slot instead of pawn
        ctx.strokeStyle = `rgba(0, 0, 0, ${40/255})`;
        ctx.lineWidth = Math.max(1, Math.floor(d * 0.005));
        ctx.beginPath();
        ctx.arc(sx, sy, slotR, 0, Math.PI * 2);
        ctx.stroke();
        
        ctx.fillStyle = `rgba(0, 0, 0, ${15/255})`;
        ctx.fill();
    }
    return downsample(canvas, final, final);
}

function renderCenterHome(final = 192) {
    const d = final * SS;
    const canvas = createCanvas(d, d);
    const ctx = canvas.getContext('2d');
    
    ctx.drawImage(softShadow(d, d, 0.85, 0.14, 90, 0.04, 0.92), 0, 0);
    
    const cx = d / 2, cy = d / 2;
    const pad = d * 0.04;
    const radius = d * 0.10;
    
    const corners: Record<string, number[][]> = {
        red:    [[pad, pad], [d - pad, pad]],
        blue:   [[d - pad, pad], [d - pad, d - pad]],
        yellow: [[d - pad, d - pad], [pad, d - pad]],
        green:  [[pad, d - pad], [pad, pad]],
    };
    
    ctx.save();
    roundedRectPath(ctx, pad, pad, d - pad*2, d - pad*2, radius);
    ctx.clip();
    for (const [color, [p1, p2]] of Object.entries(corners)) {
        ctx.save();
        drawPolygon(ctx, [p1, p2, [cx, cy]]);
        ctx.clip();
        ctx.drawImage(flatGradientRect(d, d, (PLAYERS as any)[color], [-0.3, -0.4]), 0, 0);
        ctx.restore();
    }
    ctx.restore();
    
    ctx.strokeStyle = `rgba(255, 220, 140, ${235/255})`;
    ctx.lineWidth = Math.max(3, Math.floor(d * 0.014));
    roundedRectPath(ctx, pad, pad, d - pad*2, d - pad*2, radius);
    ctx.stroke();
    
    ctx.strokeStyle = `rgba(255, 220, 140, ${140/255})`;
    ctx.lineWidth = Math.max(2, Math.floor(d * 0.007));
    ctx.beginPath(); ctx.moveTo(pad, pad); ctx.lineTo(d - pad, d - pad); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(d - pad, pad); ctx.lineTo(pad, d - pad); ctx.stroke();
    
    // Center Medal removed for clarity
    
    return downsample(canvas, final, final);
}

// ================================================================= UI BUTTONS

function uiButtonBase(d: number, palette = UI) {
    const canvas = createCanvas(d, d);
    const ctx = canvas.getContext('2d');
    
    ctx.drawImage(softShadow(d, d, 0.72, 0.22, 130, 0.07), 0, 0);
    const disc = addSpecular(radialShadedDisc(d, palette), [0.32, 0.30], 0.22, 190);
    ctx.drawImage(disc, 0, 0);
    
    ctx.strokeStyle = `rgba(255, 220, 140, ${230/255})`;
    ctx.lineWidth = Math.max(2, Math.floor(d * 0.022));
    ctx.beginPath();
    ctx.ellipse(d/2, d/2, d/2 - d*0.03, d/2 - d*0.03, 0, 0, Math.PI*2);
    ctx.stroke();
    
    return canvas;
}

function renderBtnPlay(final = 128) {
    const d = final * SS;
    const canvas = uiButtonBase(d);
    const ctx = canvas.getContext('2d');
    const cx = d / 2, cy = d / 2, s = d * 0.22;
    const pts = [[cx - s * 0.6, cy - s], [cx - s * 0.6, cy + s], [cx + s * 1.1, cy]];
    
    ctx.fillStyle = `rgba(0, 0, 0, ${60/255})`;
    drawPolygon(ctx, pts.map(p => [p[0] + d * 0.02, p[1]]));
    ctx.fill();
    
    ctx.fillStyle = `rgba(255, 255, 255, ${245/255})`;
    drawPolygon(ctx, pts);
    ctx.fill();
    
    return downsample(canvas, final, final);
}

function renderBtnPause(final = 128) {
    const d = final * SS;
    const canvas = uiButtonBase(d);
    const ctx = canvas.getContext('2d');
    const cx = d / 2, cy = d / 2;
    const bw = d * 0.12, bh = d * 0.40, gap = d * 0.10;
    
    ctx.fillStyle = `rgba(255, 255, 255, ${245/255})`;
    roundedRectPath(ctx, cx - gap - bw, cy - bh / 2, bw, bh, bw * 0.3); ctx.fill();
    roundedRectPath(ctx, cx + gap, cy - bh / 2, bw, bh, bw * 0.3); ctx.fill();
    
    return downsample(canvas, final, final);
}

function renderBtnSettings(final = 128) {
    const d = final * SS;
    const canvas = uiButtonBase(d);
    const ctx = canvas.getContext('2d');
    const cx = d / 2, cy = d / 2;
    const pts = starPoints(cx, cy, d * 0.30, d * 0.22, 8, 0);
    
    ctx.save();
    ctx.fillStyle = `rgba(255, 255, 255, ${245/255})`;
    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
    ctx.closePath();
    ctx.arc(cx, cy, d * 0.12, 0, Math.PI * 2, true);
    ctx.fill();
    ctx.restore();
    
    ctx.strokeStyle = `rgba(255, 255, 255, ${245/255})`;
    ctx.lineWidth = Math.max(2, Math.floor(d * 0.02));
    ctx.beginPath(); ctx.arc(cx, cy, d * 0.12, 0, Math.PI * 2); ctx.stroke();
    
    return downsample(canvas, final, final);
}

function renderBtnSound(final = 128, on = true) {
    const d = final * SS;
    const canvas = uiButtonBase(d);
    const ctx = canvas.getContext('2d');
    const cx = d * 0.42, cy = d / 2;
    
    const body = [
        [cx - d * 0.18, cy - d * 0.08], [cx - d * 0.06, cy - d * 0.08], [cx + d * 0.10, cy - d * 0.20],
        [cx + d * 0.10, cy + d * 0.20], [cx - d * 0.06, cy + d * 0.08], [cx - d * 0.18, cy + d * 0.08]
    ];
    ctx.fillStyle = `rgba(255, 255, 255, ${245/255})`;
    drawPolygon(ctx, body); ctx.fill();
    
    ctx.strokeStyle = `rgba(255, 255, 255, ${245/255})`;
    if (on) {
        ctx.lineWidth = Math.max(2, Math.floor(d * 0.018));
        for (const r of [0.07, 0.13, 0.19]) {
            ctx.beginPath();
            ctx.arc(cx + d * 0.10, cy, d * r, (-50 * Math.PI)/180, (50 * Math.PI)/180);
            ctx.stroke();
        }
    } else {
        const x0 = cx + d * 0.22, y0 = cy - d * 0.14, x1 = cx + d * 0.38, y1 = cy + d * 0.14;
        ctx.lineWidth = Math.max(3, Math.floor(d * 0.02));
        ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(x0, y1); ctx.lineTo(x1, y0); ctx.stroke();
    }
    return downsample(canvas, final, final);
}

function renderBtnRestart(final = 128) {
    const d = final * SS;
    const canvas = uiButtonBase(d);
    const ctx = canvas.getContext('2d');
    const cx = d / 2, cy = d / 2, r = d * 0.24;
    
    ctx.strokeStyle = `rgba(255, 255, 255, ${245/255})`;
    ctx.lineWidth = Math.max(3, Math.floor(d * 0.035));
    ctx.beginPath(); ctx.arc(cx, cy, r, (-220 * Math.PI)/180, (120 * Math.PI)/180); ctx.stroke();
    
    const tipAng = (120 * Math.PI) / 180;
    const tip = [cx + r * Math.cos(tipAng), cy + r * Math.sin(tipAng)];
    const a1 = ((120 - 35) * Math.PI) / 180;
    const p1 = [tip[0] + d * 0.07 * Math.cos(a1 + Math.PI / 2), tip[1] + d * 0.07 * Math.sin(a1 + Math.PI / 2)];
    const arrowTip = [tip[0] + d * 0.10 * Math.cos(tipAng + 0.9), tip[1] + d * 0.10 * Math.sin(tipAng + 0.9)];
    
    ctx.fillStyle = `rgba(255, 255, 255, ${245/255})`;
    drawPolygon(ctx, [tip, p1, arrowTip]); ctx.fill();
    
    return downsample(canvas, final, final);
}

function renderBtnBack(final = 128) {
    const d = final * SS;
    const canvas = uiButtonBase(d);
    const ctx = canvas.getContext('2d');
    const cx = d / 2, cy = d / 2, s = d * 0.20;
    
    ctx.fillStyle = `rgba(255, 255, 255, ${245/255})`;
    drawPolygon(ctx, [[cx + s * 0.7, cy - s], [cx + s * 0.7, cy + s], [cx - s * 1.0, cy]]); ctx.fill();
    return downsample(canvas, final, final);
}

// ================================================================= WIN SCREEN

function renderCrown(final = 128) {
    const d = final * SS;
    const canvas = createCanvas(d, d);
    const ctx = canvas.getContext('2d');
    
    ctx.drawImage(softShadow(d, d, 0.7, 0.16, 110, 0.06), 0, 0);
    
    const cx = d / 2;
    const baseY = d * 0.66, topY = d * 0.40, peakY = d * 0.18;
    const left = d * 0.16, right = d * 0.84;
    const pts = [
        [left, baseY], [left, topY], [d * 0.30, d * 0.50], [d * 0.40, peakY],
        [cx, d * 0.42], [d * 0.60, peakY], [d * 0.70, d * 0.50], [right, topY],
        [right, baseY],
    ];
    
    ctx.save();
    drawPolygon(ctx, pts);
    ctx.clip();
    ctx.drawImage(radialShadedDisc(d, GOLD, [-0.3, -0.4]), 0, 0);
    ctx.restore();
    
    ctx.save();
    ctx.beginPath(); ctx.rect(left, baseY, right - left, d * 0.78 - baseY); ctx.clip();
    ctx.drawImage(radialShadedDisc(d, GOLD, [-0.3, 0.1]), 0, 0);
    ctx.restore();
    
    ctx.strokeStyle = `rgba(140, 95, 15, ${230/255})`;
    ctx.lineWidth = Math.max(2, Math.floor(d * 0.012));
    drawPolygon(ctx, pts); ctx.stroke();
    ctx.strokeRect(left, baseY, right - left, d * 0.78 - baseY);
    
    const gemColors = [PLAYERS.red.base, PLAYERS.blue.base, PLAYERS.green.base];
    const gemXs = [d * 0.40, cx, d * 0.60];
    for (let i = 0; i < 3; i++) {
        const gx = gemXs[i], col = gemColors[i];
        const gr = d * 0.045;
        ctx.fillStyle = `rgba(${col[0]}, ${col[1]}, ${col[2]}, 1)`;
        ctx.beginPath(); ctx.ellipse(gx, peakY + gr * 0.6, gr, gr, 0, 0, Math.PI*2); ctx.fill();
    }
    
    const bigGemR = d * 0.06;
    ctx.fillStyle = `rgba(${PLAYERS.red.base[0]}, ${PLAYERS.red.base[1]}, ${PLAYERS.red.base[2]}, 1)`;
    ctx.strokeStyle = `rgba(255, 255, 255, ${200/255})`;
    ctx.lineWidth = 1; // Match Pillow default outline
    ctx.beginPath(); ctx.arc(cx, d * 0.68, bigGemR, 0, Math.PI*2); ctx.fill(); ctx.stroke();
    
    return downsample(addSpecular(canvas, [0.34, 0.30], 0.16, 150), final, final);
}

function renderTrophy(final = 128) {
    const d = final * SS;
    const canvas = createCanvas(d, d);
    const ctx = canvas.getContext('2d');
    
    ctx.drawImage(softShadow(d, d, 0.6, 0.14, 110, 0.05), 0, 0);
    
    const cx = d / 2, cupTop = d * 0.18, cupBot = d * 0.52;
    const cupPts = [[d * 0.30, cupTop], [d * 0.70, cupTop], [d * 0.62, cupBot], [d * 0.38, cupBot]];
    
    ctx.save();
    drawPolygon(ctx, cupPts); ctx.clip();
    ctx.drawImage(radialShadedDisc(d, GOLD, [-0.3, -0.4]), 0, 0);
    ctx.restore();
    
    ctx.strokeStyle = `rgba(200, 150, 40, 1)`;
    ctx.lineWidth = Math.max(3, Math.floor(d * 0.03));
    ctx.beginPath(); ctx.ellipse(d * 0.25, cupTop + d * 0.11, d * 0.13, d * 0.11, 0, (60*Math.PI)/180, (300*Math.PI)/180); ctx.stroke();
    ctx.beginPath(); ctx.ellipse(d * 0.75, cupTop + d * 0.11, d * 0.13, d * 0.11, 0, (240*Math.PI)/180, (120*Math.PI)/180); ctx.stroke();
    
    ctx.fillStyle = `rgba(210, 165, 50, 1)`;
    ctx.fillRect(cx - d * 0.035, cupBot, d * 0.07, d * 0.66 - cupBot);
    
    ctx.fillStyle = `rgba(190, 145, 40, 1)`;
    drawPolygon(ctx, [[d * 0.30, d * 0.66], [d * 0.70, d * 0.66], [d * 0.62, d * 0.76], [d * 0.38, d * 0.76]]); ctx.fill();
    
    ctx.fillStyle = `rgba(160, 120, 30, 1)`;
    ctx.fillRect(d * 0.26, d * 0.76, d * 0.48, d * 0.08);
    
    ctx.strokeStyle = `rgba(140, 95, 15, ${230/255})`;
    ctx.lineWidth = Math.max(2, Math.floor(d * 0.012));
    drawPolygon(ctx, cupPts); ctx.stroke();
    
    return downsample(addSpecular(canvas, [0.36, 0.26], 0.14, 170), final, final);
}

const CONFETTI_SPECS: any[] = [
    ["confetti_1", "rect", PLAYERS.red.base, 25],
    ["confetti_2", "circle", PLAYERS.blue.base, 0],
    ["confetti_3", "triangle", PLAYERS.yellow.base, -15],
    ["confetti_4", "rect", PLAYERS.green.base, -30],
    ["confetti_5", "ribbon", GOLD.base, 10],
    ["confetti_6", "circle", PURPLE.base, 0],
];

function renderConfetti(shape: string, color: number[], angle: number, final = 48) {
    const d = final * SS;
    const canvas = createCanvas(d, d);
    const ctx = canvas.getContext('2d');
    const cx = d / 2, cy = d / 2;
    const light = color.map(c => Math.min(255, c + 70));
    
    ctx.fillStyle = `rgba(${color[0]}, ${color[1]}, ${color[2]}, 1)`;
    if (shape === "rect") {
        const w = d * 0.62, h = d * 0.30;
        let pts = [[cx - w/2, cy - h/2], [cx + w/2, cy - h/2], [cx + w/2, cy + h/2], [cx - w/2, cy + h/2]];
        pts = pts.map(([x, y]) => rotPt(cx, cy, x, y, angle));
        drawPolygon(ctx, pts); ctx.fill();
        const [l1x, l1y] = rotPt(cx, cy, cx - w/2, cy - h/4, angle);
        const [l2x, l2y] = rotPt(cx, cy, cx + w/2, cy - h/4, angle);
        ctx.strokeStyle = `rgba(${light[0]}, ${light[1]}, ${light[2]}, ${180/255})`;
        ctx.lineWidth = Math.max(1, Math.floor(d * 0.04));
        ctx.beginPath(); ctx.moveTo(l1x, l1y); ctx.lineTo(l2x, l2y); ctx.stroke();
    } else if (shape === "circle") {
        const r = d * 0.26;
        ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = `rgba(${light[0]}, ${light[1]}, ${light[2]}, ${160/255})`;
        ctx.beginPath(); ctx.arc(cx - r*0.15, cy - r*0.45, r*0.25, 0, Math.PI*2); ctx.fill();
    } else if (shape === "triangle") {
        const s = d * 0.32;
        let pts = [[cx, cy - s], [cx + s, cy + s * 0.8], [cx - s, cy + s * 0.8]];
        pts = pts.map(([x, y]) => rotPt(cx, cy, x, y, angle));
        drawPolygon(ctx, pts); ctx.fill();
    } else if (shape === "ribbon") {
        const w = d * 0.70, h = d * 0.18;
        let pts = [[cx - w/2, cy], [cx - w/4, cy - h/2], [cx + w/4, cy + h/2], [cx + w/2, cy], [cx + w/4, cy - h/2], [cx - w/4, cy + h/2]];
        pts = pts.map(([x, y]) => rotPt(cx, cy, x, y, angle));
        drawPolygon(ctx, pts); ctx.fill();
    }
    return downsample(canvas, final, final);
}

function renderBanner(w = 320, h = 140) {
    const dw = w * SS, dh = h * SS;
    const canvas = createCanvas(dw, dh);
    const ctx = canvas.getContext('2d');
    ctx.drawImage(softShadow(dw, dh, 0.85, 0.30, 110, 0.05), 0, 0);
    
    const body = [[dw * 0.04, dh * 0.18], [dw * 0.96, dh * 0.18], [dw * 0.96, dh * 0.82], [dw * 0.04, dh * 0.82]];
    ctx.save();
    drawPolygon(ctx, body); ctx.clip();
    ctx.drawImage(flatGradientRect(dw, dh, PURPLE, [-0.3, -0.4]), 0, 0);
    ctx.restore();
    
    const tailW = dw * 0.10;
    const leftTail = [[dw * 0.04, dh * 0.18], [dw * 0.04 - tailW, dh * 0.30], [dw * 0.04, dh * 0.5], [dw * 0.04 - tailW, dh * 0.70], [dw * 0.04, dh * 0.82]];
    const rightTail = [[dw * 0.96, dh * 0.18], [dw * 0.96 + tailW, dh * 0.30], [dw * 0.96, dh * 0.5], [dw * 0.96 + tailW, dh * 0.70], [dw * 0.96, dh * 0.82]];
    const dark = PURPLE.dark.map(c => Math.floor(c * 0.6));
    ctx.fillStyle = `rgba(${dark[0]}, ${dark[1]}, ${dark[2]}, 1)`;
    drawPolygon(ctx, leftTail); ctx.fill();
    drawPolygon(ctx, rightTail); ctx.fill();
    
    ctx.strokeStyle = `rgba(255, 220, 140, ${235/255})`;
    ctx.lineWidth = Math.max(2, Math.floor(dh * 0.025));
    drawPolygon(ctx, body); ctx.stroke();
    
    ctx.save();
    drawPolygon(ctx, body); ctx.clip();
    (ctx as any).filter = `blur(${dh * 0.06}px)`;
    ctx.fillStyle = `rgba(255, 255, 255, ${70/255})`;
    ctx.beginPath();
    ctx.ellipse(dw * 0.25, dh * 0.25, dw * 0.20, dh * 0.15, 0, 0, Math.PI*2);
    ctx.fill();
    ctx.restore();
    
    return downsample(canvas, w, h);
}

// ================================================================= PACKING

function shelfPack(sprites: Record<string, Canvas>, maxWidth = 1100, pad = 8) {
    const items = Object.entries(sprites).sort((a, b) => b[1].height - a[1].height);
    let x = pad, y = pad, rowH = 0;
    const placements: Record<string, any> = {};
    for (const [name, img] of items) {
        const w = img.width, h = img.height;
        if (x + w + pad > maxWidth && x > pad) {
            y += rowH + pad;
            x = pad;
            rowH = 0;
        }
        placements[name] = { x, y, img };
        x += w + pad;
        rowH = Math.max(rowH, h);
    }
    const totalH = y + rowH + pad;
    const sheet = createCanvas(maxWidth, totalH);
    const ctx = sheet.getContext('2d');
    const frames: Record<string, any> = {};
    for (const [name, data] of Object.entries(placements)) {
        ctx.drawImage(data.img, data.x, data.y);
        frames[name] = { x: data.x, y: data.y, w: data.img.width, h: data.img.height };
    }
    return { sheet, frames, totalH };
}

function main() {
    const sprites: Record<string, Canvas> = {};

    for (const c of Object.keys(PLAYERS)) sprites[`token_${c}`] = renderToken(c, 128);
    for (const c of Object.keys(PLAYERS)) sprites[`token_${c}_v2`] = renderTokenV2(c, 128);
    for (let n = 1; n <= 6; n++) sprites[`dice_face_${n}`] = renderDie(n, 96);
    for (let n = 1; n <= 6; n++) sprites[`dice_face_${n}_v2`] = renderDieV2(n, 96);
    sprites["star_safe"] = renderStar(96);
    for (const c of Object.keys(PLAYERS)) sprites[`home_${c}`] = renderHome(c, 96);
    for (const c of Object.keys(PLAYERS)) sprites[`arrow_${c}`] = renderArrow(c, 96);

    sprites["cell_plain"] = renderCell(96);
    sprites["cell_safe"] = renderCell(96, null, true);
    for (const c of Object.keys(PLAYERS)) sprites[`cell_${c}`] = renderCell(96, (PLAYERS as any)[c]);
    for (const c of Object.keys(PLAYERS)) sprites[`home_quadrant_${c}`] = renderHomeQuadrant(c, 192);
    sprites["center_home"] = renderCenterHome(192);
    sprites["board_modern"] = renderModernBoard(600);

    sprites["btn_play"] = renderBtnPlay(128);
    sprites["btn_pause"] = renderBtnPause(128);
    sprites["btn_settings"] = renderBtnSettings(128);
    sprites["btn_sound_on"] = renderBtnSound(128, true);
    sprites["btn_sound_off"] = renderBtnSound(128, false);
    sprites["btn_restart"] = renderBtnRestart(128);
    sprites["btn_back"] = renderBtnBack(128);

    sprites["crown_gold"] = renderCrown(128);
    sprites["trophy_gold"] = renderTrophy(128);
    for (const [name, shape, color, angle] of CONFETTI_SPECS) sprites[name] = renderConfetti(shape, color, angle, 48);
    sprites["banner_ribbon"] = renderBanner(320, 140);

    const { sheet, frames } = shelfPack(sprites, 1100, 8);
    
    if (!fs.existsSync('public')) fs.mkdirSync('public');
    
    fs.writeFileSync('public/ludo_spritesheet.png', sheet.toBuffer("image/png"));
    
    const atlas = {
        frames: {} as any,
        meta: {
            app: "js-procedural-generator",
            version: "1.0",
            image: "ludo_spritesheet.png",
            format: "RGBA8888",
            size: { w: sheet.width, h: sheet.height },
            scale: "1",
        },
    };
    for (const [name, rect] of Object.entries(frames)) {
        atlas.frames[name] = {
            frame: { x: (rect as any).x, y: (rect as any).y, w: (rect as any).w, h: (rect as any).h },
            rotated: false, trimmed: false,
            spriteSourceSize: { x: 0, y: 0, w: (rect as any).w, h: (rect as any).h },
            sourceSize: { w: (rect as any).w, h: (rect as any).h }, pivot: { x: 0.5, y: 0.5 },
        };
    }
    fs.writeFileSync("public/ludo_atlas.json", JSON.stringify(atlas, null, 2));
    console.log(`Wrote atlas with ${Object.keys(frames).length} frames`);
}

main();
