import pkg from 'wavefile';
const { WaveFile } = pkg;
import fs from 'fs';
import path from 'path';

const SR = 22050; // Reduced from 44100 to save space

function tAxis(duration: number) {
    const n = Math.floor(SR * duration);
    return { t: Array.from({ length: n }, (_, i) => i / SR), n };
}

function sine(freq: number, duration: number) {
    const { t, n } = tAxis(duration);
    return t.map(v => Math.sin(2 * Math.PI * freq * v));
}

function whiteNoise(duration: number) {
    const { n } = tAxis(duration);
    return Array.from({ length: n }, () => Math.random() * 2 - 1);
}

function freqSweepSine(f0: number, f1: number, duration: number, curve: 'lin' | 'exp' = 'lin') {
    const { n } = tAxis(duration);
    const out = new Float64Array(n);
    let phase = 0;
    for (let i = 0; i < n; i++) {
        const k = curve === 'exp' ? Math.pow(i / n, 2) : i / n;
        const freq = f0 + (f1 - f0) * k;
        phase += (2 * Math.PI * freq) / SR;
        out[i] = Math.sin(phase);
    }
    return Array.from(out);
}

function expDecayEnv(n: number, rate = 6.0, attackFrac = 0.01) {
    const env = new Float64Array(n);
    const a = Math.max(1, Math.floor(n * attackFrac));
    for (let i = 0; i < n; i++) {
        const t = i / n;
        let val = Math.exp(-rate * t);
        if (i < a) val *= i / a;
        env[i] = val;
    }
    return Array.from(env);
}

function adsr(n: number, attack = 0.01, decay = 0.1, sustainLevel = 0.6, release = 0.2) {
    const a = Math.max(1, Math.floor(n * attack));
    const d = Math.max(1, Math.floor(n * decay));
    const r = Math.max(1, Math.floor(n * release));
    const s = Math.max(0, n - a - d - r);
    const env = new Float64Array(n);
    
    for (let i = 0; i < a; i++) env[i] = i / a;
    for (let i = 0; i < d; i++) env[a + i] = 1 + (sustainLevel - 1) * (i / d);
    for (let i = 0; i < s; i++) env[a + d + i] = sustainLevel;
    for (let i = 0; i < r; i++) env[a + d + s + i] = sustainLevel * (1 - i / r);
    
    return Array.from(env);
}

function onePoleLowpass(x: number[], cutoff: number) {
    const rc = 1.0 / (2 * Math.PI * cutoff);
    const dt = 1.0 / SR;
    const alpha = dt / (rc + dt);
    const y = new Float64Array(x.length);
    let prev = 0;
    for (let i = 0; i < x.length; i++) {
        prev = prev + alpha * (x[i] - prev);
        y[i] = prev;
    }
    return Array.from(y);
}

function timeVaryingLowpass(x: number[], cutoffs: number[]) {
    const dt = 1.0 / SR;
    const y = new Float64Array(x.length);
    let prev = 0;
    for (let i = 0; i < x.length; i++) {
        const rc = 1.0 / (2 * Math.PI * Math.max(20, cutoffs[i]));
        const alpha = dt / (rc + dt);
        prev = prev + alpha * (x[i] - prev);
        y[i] = prev;
    }
    return Array.from(y);
}

function highpassDiff(x: number[]) {
    const y = new Float64Array(x.length);
    y[0] = 0;
    for (let i = 1; i < x.length; i++) {
        y[i] = x[i] - x[i - 1];
    }
    return Array.from(y);
}

function normalize(x: number[], peak = 0.92) {
    let max = 0;
    for (const v of x) if (Math.abs(v) > max) max = Math.abs(v);
    if (max < 1e-9) return x;
    return x.map(v => (v / max) * peak);
}

function softClip(x: number[], k = 0.9) {
    const tk = Math.tanh(k);
    return x.map(v => Math.tanh(v * k) / tk);
}

function midiToFreq(m: number) {
    return 440 * Math.pow(2, (m - 69) / 12);
}

function bellTone(freq: number, duration: number, decay = 5.0, harmonics = [[1, 1.0], [2.756, 0.55], [5.04, 0.30], [8.93, 0.15]]) {
    const { t, n } = tAxis(duration);
    const out = new Float64Array(n);
    for (const [ratio, amp] of harmonics) {
        const partialDecay = decay * (1 + ratio * 0.4);
        for (let i = 0; i < n; i++) {
            const env = Math.exp(-partialDecay * t[i]);
            out[i] += amp * Math.sin(2 * Math.PI * freq * ratio * t[i]) * env;
        }
    }
    return Array.from(out);
}

// Sound effects
function makeDiceRoll() {
    const total = 1.0;
    const nTotal = Math.floor(SR * total);
    const buf = new Float64Array(nTotal);
    
    const nClicks = 12;
    let ti = 0.05;
    for (let i = 0; i < nClicks; i++) {
        ti += 0.02 + Math.random() * 0.04;
        if (ti > 0.72) break;
        const progress = i / nClicks;
        const amp = 0.55 * (1 - 0.6 * progress) + 0.1;
        const clickDur = 0.012 + Math.random() * 0.013;
        const click = onePoleLowpass(whiteNoise(clickDur), 1800 + Math.random() * 2400);
        const env = expDecayEnv(click.length, 22);
        const startIdx = Math.floor(ti * SR);
        for (let j = 0; j < click.length && (startIdx + j) < nTotal; j++) {
            buf[startIdx + j] += click[j] * env[j] * amp;
        }
    }

    [0.78, 0.86].forEach((ti, j) => {
        const dur = 0.05;
        const noise = onePoleLowpass(whiteNoise(dur), 700);
        const thump = sine(120, dur).map((v, idx) => v * Math.exp(-18 * (idx / (SR * dur))));
        const env = expDecayEnv(noise.length, 14);
        const startIdx = Math.floor(ti * SR);
        const amp = j === 0 ? 0.7 : 0.85;
        for (let k = 0; k < noise.length && (startIdx + k) < nTotal; k++) {
            buf[startIdx + k] += (noise[k] * 0.5 + thump[k] * 0.5) * env[k] * amp;
        }
    });

    return normalize(softClip(Array.from(buf), 0.8));
}

function makeTokenMove() {
    const dur = 0.16;
    const tone = freqSweepSine(320, 640, dur);
    const env = expDecayEnv(tone.length, 14, 0.02);
    const click = highpassDiff(whiteNoise(0.006)).map(v => v * 0.4);
    const out = tone.map((v, i) => v * env[i]);
    for (let i = 0; i < click.length; i++) out[i] += click[i];
    return normalize(softClip(out, 0.85));
}

function makeTokenCapture() {
    const total = 0.62;
    const nTotal = Math.floor(SR * total);
    const buf = new Float64Array(nTotal);
    
    const sweepDur = 0.26;
    const noise = whiteNoise(sweepDur);
    const cutoffs = Array.from({ length: noise.length }, (_, i) => 5200 - (5200 - 280) * (i / noise.length));
    const whoosh = timeVaryingLowpass(noise, cutoffs).map((v, i) => v * Math.pow(1 - i / noise.length, 0.6) * 0.8);
    
    for (let i = 0; i < whoosh.length; i++) buf[i] += whoosh[i];
    
    const thudDur = 0.22;
    const thudN = Math.floor(SR * thudDur);
    const thud = sine(85, thudDur).map((v, i) => v * Math.exp(-12 * (i / thudN)));
    const thud2 = sine(140, thudDur).map((v, i) => v * 0.4 * Math.exp(-16 * (i / thudN)));
    
    const startIdx = Math.floor(0.20 * SR);
    for (let i = 0; i < thud.length && (startIdx + i) < nTotal; i++) {
        buf[startIdx + i] += (thud[i] + thud2[i]) * 0.9;
    }
    
    return normalize(softClip(Array.from(buf), 0.85));
}

function makeTokenHome() {
    const notes = [72, 76, 79].map(midiToFreq);
    const total = 0.55;
    const nTotal = Math.floor(SR * total);
    const buf = new Float64Array(nTotal);
    notes.forEach((f, i) => {
        const start = i * 0.09;
        const tone = bellTone(f, total - start, 7.0);
        const startIdx = Math.floor(start * SR);
        for (let j = 0; j < tone.length && (startIdx + j) < nTotal; j++) {
            buf[startIdx + j] += tone[j] * 0.8;
        }
    });
    return normalize(softClip(Array.from(buf), 0.9));
}

function makeButtonClick() {
    const dur = 0.07;
    const tick = sine(1500, dur).map((v, i) => v * Math.exp(-55 * (i / (SR * dur))));
    const noise = highpassDiff(whiteNoise(0.004)).map(v => v * 0.5);
    const out = tick.map(v => v * 0.7);
    for (let i = 0; i < noise.length; i++) out[i] += noise[i];
    return normalize(softClip(out, 0.8));
}

function makeGameStart() {
    const sweepDur = 0.30;
    const sweep = freqSweepSine(220, 880, sweepDur, 'exp').map((v, i) => v * Math.exp(-2.5 * (i / (SR * sweepDur))));
    const chordNotes = [60, 64, 67, 72].map(midiToFreq);
    const chordDur = 0.45;
    const total = sweepDur + chordDur;
    const nTotal = Math.floor(SR * total);
    const buf = new Float64Array(nTotal);
    
    for (let i = 0; i < sweep.length; i++) buf[i] += sweep[i] * 0.7;
    
    const startIdx = Math.floor(sweepDur * 0.85 * SR);
    chordNotes.forEach(f => {
        const tone = bellTone(f, chordDur, 4.0);
        for (let j = 0; j < tone.length && (startIdx + j) < nTotal; j++) {
            buf[startIdx + j] += tone[j] * 0.45;
        }
    });
    
    return normalize(softClip(Array.from(buf), 0.85));
}

function makeInvalidMove() {
    const n1 = Math.floor(SR * 0.10);
    const n2 = Math.floor(SR * 0.12);
    const tone1 = square(220, 0.10).map((v, i) => v * adsr(n1, 0.02, 0.1, 0.5, 0.6)[i]);
    const tone2 = square(165, 0.12).map((v, i) => v * adsr(n2, 0.02, 0.1, 0.5, 0.6)[i]);
    const total = 0.27;
    const nTotal = Math.floor(SR * total);
    const buf = new Float64Array(nTotal);
    for (let i = 0; i < tone1.length; i++) buf[i] += tone1[i] * 0.5;
    const start2 = Math.floor(0.13 * SR);
    for (let i = 0; i < tone2.length && (start2 + i) < nTotal; i++) buf[start2 + i] += tone2[i] * 0.5;
    return normalize(softClip(onePoleLowpass(Array.from(buf), 2500), 0.8));
}

function makeSixBonus() {
    const midiNotes = [69, 73, 76, 81, 85];
    const total = 0.5;
    const nTotal = Math.floor(SR * total);
    const buf = new Float64Array(nTotal);
    midiNotes.forEach((m, i) => {
        const start = i * 0.06;
        const tone = bellTone(midiToFreq(m), total - start, 9.0, [[1, 1.0], [2.0, 0.4], [3.0, 0.2]]);
        const startIdx = Math.floor(start * SR);
        for (let j = 0; j < tone.length && (startIdx + j) < nTotal; j++) {
            buf[startIdx + j] += tone[j] * 0.7;
        }
    });
    return normalize(softClip(Array.from(buf), 0.9));
}

function makeGameWin() {
    const total = 2.4;
    const nTotal = Math.floor(SR * total);
    const buf = new Float64Array(nTotal);
    const runNotes = [60, 64, 67, 72].map(midiToFreq);
    runNotes.forEach((f, i) => {
        const tone = bellTone(f, 0.5, 6.0, [[1, 1.0], [2.0, 0.5], [3.01, 0.3], [4.0, 0.15]]);
        const startIdx = Math.floor(i * 0.14 * SR);
        for (let j = 0; j < tone.length && (startIdx + j) < nTotal; j++) {
            buf[startIdx + j] += tone[j] * 0.55;
        }
    });
    const chordNotes = [60, 64, 67, 72, 76].map(midiToFreq);
    const chordStart = 0.62;
    chordNotes.forEach(f => {
        const tone = bellTone(f, total - chordStart, 1.6, [[1, 1.0], [2.0, 0.45], [3.0, 0.22], [4.02, 0.12]]);
        const startIdx = Math.floor(chordStart * SR);
        for (let j = 0; j < tone.length && (startIdx + j) < nTotal; j++) {
            buf[startIdx + j] += tone[j] * 0.30;
        }
    });
    return normalize(softClip(Array.from(buf), 0.92));
}

function square(freq: number, duration: number) {
    const { t } = tAxis(duration);
    return t.map(v => ((v * freq) % 1.0 < 0.5 ? 1.0 : -1.0));
}

async function main() {
    const outDir = path.resolve(process.cwd(), 'public/assets/sounds');
    if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

    const generators: [string, () => number[]][] = [
        ['dice_roll', makeDiceRoll],
        ['token_move', makeTokenMove],
        ['token_capture', makeTokenCapture],
        ['token_home', makeTokenHome],
        ['button_click', makeButtonClick],
        ['game_start', makeGameStart],
        ['invalid_move', makeInvalidMove],
        ['six_bonus', makeSixBonus],
        ['game_win', makeGameWin],
    ];

    const gapSec = 0.35;
    const gapN = Math.floor(SR * gapSec);
    let totalN = 0;
    const sprites: Record<string, { start: number, end: number }> = {};
    
    const clips = generators.map(([name, gen]) => {
        const sig = gen();
        const startSec = totalN / SR;
        const durSec = sig.length / SR;
        sprites[name] = {
            start: startSec,
            end: startSec + durSec
        };
        
        totalN += sig.length + gapN;
        return sig;
    });

    const fullSig = new Float64Array(totalN);
    let cursor = 0;
    clips.forEach(sig => {
        fullSig.set(sig, cursor);
        cursor += sig.length + gapN;
    });

    const wav = new WaveFile();
    // Convert float samples to 16-bit PCM
    const pcm = new Int16Array(fullSig.length);
    for (let i = 0; i < fullSig.length; i++) {
        pcm[i] = Math.max(-32768, Math.min(32767, Math.floor(fullSig[i] * 32767)));
    }
    wav.fromScratch(1, SR, '16', pcm);
    
    fs.writeFileSync(path.join(outDir, 'ludo_soundsprite.wav'), wav.toBuffer());
    
    const atlas = {
        resources: ['/assets/sounds/ludo_soundsprite.wav'],
        spritemap: sprites
    };
    fs.writeFileSync(path.join(outDir, 'ludo_sound_atlas.json'), JSON.stringify(atlas, null, 2));
    
    console.log('Generated sounds and atlas at public/assets/sounds/');
}

main().catch(console.error);
