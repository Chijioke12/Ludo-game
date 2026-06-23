import fs from 'fs';
import { createCanvas } from 'canvas';

function createGlowingRect(ctx: any, x: number, y: number, w: number, h: number, r: number, color: string) {
    ctx.save();
    ctx.shadowColor = color;
    ctx.shadowBlur = 20;
    ctx.strokeStyle = '#FFFFFF'; // White inner line
    ctx.lineWidth = 6;
    ctx.beginPath();
    if (r > 0) {
        ctx.moveTo(x + r, y);
        ctx.lineTo(x + w - r, y);
        ctx.quadraticCurveTo(x + w, y, x + w, y + r);
        ctx.lineTo(x + w, y + h - r);
        ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
        ctx.lineTo(x + r, y + h);
        ctx.quadraticCurveTo(x, y + h, x, y + h - r);
        ctx.lineTo(x, y + r);
        ctx.quadraticCurveTo(x, y, x + r, y);
    } else {
        ctx.rect(x, y, w, h);
    }
    ctx.closePath();
    ctx.stroke();
    // 2nd stroke to intensify the glow
    ctx.shadowBlur = 10;
    ctx.stroke();
    ctx.restore();
}

function createGlowingCircle(ctx: any, cx: number, cy: number, radius: number, color: string) {
    ctx.save();
    ctx.shadowColor = color;
    ctx.shadowBlur = 15;
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.shadowBlur = 8;
    ctx.stroke();
    ctx.restore();
}

function main() {
    const size = 512;
    const canvas = createCanvas(size, size);
    const ctx = canvas.getContext('2d');
    
    // Create an intense Cyan focus (standard for many KaiOS/feature phones interfaces)
    const cyanFocus = '#00FFFF';

    // 1. Draw Rectangular Focus (for classic board cells)
    createGlowingRect(ctx, 32, 32, 100, 100, 12, cyanFocus);

    // 2. Draw Circular Focus (for settings/sound/UI icons)
    createGlowingCircle(ctx, 240, 82, 50, cyanFocus);

    // 3. Draw Wide Rectangular Focus (for menu buttons like Play/Settings layout)
    createGlowingRect(ctx, 32, 180, 260, 60, 25, cyanFocus);
    
    // Create a Gold 'Selected/Active' state
    const goldFocus = '#FFD700';

    // 4. Draw Gold Rect focus
    createGlowingRect(ctx, 350, 32, 100, 100, 12, goldFocus);

    // 5. Draw Gold Circle focus
    createGlowingCircle(ctx, 240, 210, 50, goldFocus);
    
    // 6. D-PAD hint graphics for the game (Arrows)
    ctx.fillStyle = '#FFFFFF';
    ctx.shadowColor = 'rgba(0,0,0,0.5)';
    ctx.shadowBlur = 5;
    
    const drawArrow = (cx: number, cy: number, rot: number) => {
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(rot);
        ctx.beginPath();
        ctx.moveTo(0, -20);
        ctx.lineTo(20, 10);
        ctx.lineTo(10, 10);
        ctx.lineTo(10, 30);
        ctx.lineTo(-10, 30);
        ctx.lineTo(-10, 10);
        ctx.lineTo(-20, 10);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
    };

    // Up, Right, Down, Left D-Pad hints
    drawArrow(380, 200, 0);               // Up
    drawArrow(420, 240, Math.PI/2);       // Right
    drawArrow(380, 280, Math.PI);         // Down
    drawArrow(340, 240, -Math.PI/2);      // Left

    if (!fs.existsSync('public')) fs.mkdirSync('public');
    
    fs.writeFileSync('public/focus_assets.png', canvas.toBuffer("image/png"));
    console.log("Generated focus_assets.png (512x512)");
    
    // Save atlas metadata
    const atlas = {
        frames: {
            focus_cell_cyan: { frame: { x: 0, y: 0, w: 164, h: 164 } },
            focus_circle_cyan: { frame: { x: 170, y: 12, w: 140, h: 140 } },
            focus_btn_cyan: { frame: { x: 0, y: 150, w: 320, h: 120 } },
            focus_cell_gold: { frame: { x: 318, y: 0, w: 164, h: 164 } },
            focus_circle_gold: { frame: { x: 170, y: 140, w: 140, h: 140 } },
            focus_dpad_hints: { frame: { x: 310, y: 170, w: 140, h: 140 } }
        }
    };
    fs.writeFileSync('public/focus_atlas.json', JSON.stringify(atlas, null, 2));
}

main();
