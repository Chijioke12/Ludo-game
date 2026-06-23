
export function initSimulator() {
    if (document.getElementById('simulator-ui')) return;

    const style = document.createElement('style');
    style.textContent = `
        #simulator-ui {
            margin-top: 20px;
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 15px;
            padding: 20px;
            background: #222;
            border-radius: 40px;
            border: 4px solid #444;
            user-select: none;
        }
        .keypad {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 10px;
        }
        .btn {
            background: #444;
            color: white;
            border: none;
            padding: 15px;
            border-radius: 8px;
            cursor: pointer;
            font-weight: bold;
            min-width: 60px;
            text-align: center;
            transition: background 0.1s;
        }
        .btn:active { background: #666; }
        .btn-center { background: #e91e63; }
        .btn-center:active { background: #f06292; }
        .softkeys {
            display: flex;
            gap: 10px;
            width: 100%;
            justify-content: center;
        }
    `;
    document.head.appendChild(style);

    const ui = document.createElement('div');
    ui.id = 'simulator-ui';
    ui.innerHTML = `
        <div class="softkeys">
            <button class="btn" id="sim-LSK">LSK</button>
            <button class="btn" id="sim-Backspace">BACK</button>
            <button class="btn" id="sim-RSK">RSK</button>
        </div>
        <div class="keypad">
            <div></div>
            <button class="btn" id="sim-ArrowUp">↑</button>
            <div></div>
            <button class="btn" id="sim-ArrowLeft">←</button>
            <button class="btn btn-center" id="sim-Enter">✓</button>
            <button class="btn" id="sim-ArrowRight">→</button>
            <div></div>
            <button class="btn" id="sim-ArrowDown">↓</button>
            <div></div>
        </div>
    `;
    document.body.appendChild(ui);

    const simulateKey = (key: string) => {
        document.body.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
        setTimeout(() => {
            document.body.dispatchEvent(new KeyboardEvent('keyup', { key, bubbles: true }));
        }, 50);
    };

    ui.querySelectorAll('.btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const key = btn.id.replace('sim-', '');
            simulateKey(key === 'LSK' ? 'SoftLeft' : key === 'RSK' ? 'SoftRight' : key);
        });
    });

    console.log('KaiOS Simulator Initialized (Dev Mode)');
}
