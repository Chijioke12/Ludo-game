import Phaser from 'phaser';

// Initialize simulator only in development
if (import.meta.env.DEV) {
    import('./simulator').then(m => m.initSimulator());
}

const GameState = {
    soundEnabled: true
};

function toggleSound(scene: any) {
    GameState.soundEnabled = !GameState.soundEnabled;
    if (scene.sound) {
        scene.sound.mute = !GameState.soundEnabled;
    }
}

class BootScene extends Phaser.Scene {
    constructor() { super('BootScene'); }
    preload() {
        const width = this.cameras.main.width;
        const height = this.cameras.main.height;
        
        const progressBar = this.add.graphics();
        const progressBox = this.add.graphics();
        progressBox.fillStyle(0x222222, 0.8);
        progressBox.fillRect(40, height / 2 - 15, width - 80, 30);
        
        const loadingText = this.make.text({
            x: width / 2,
            y: height / 2 - 40,
            text: 'Loading Assets...',
            style: {
                font: '14px monospace',
                color: '#ffffff'
            }
        });
        loadingText.setOrigin(0.5, 0.5);

        this.load.on('progress', (value: number) => {
            progressBar.clear();
            progressBar.fillStyle(0xffffff, 1);
            progressBar.fillRect(45, height / 2 - 10, (width - 90) * value, 20);
        });

        this.load.on('complete', () => {
            progressBar.destroy();
            progressBox.destroy();
            loadingText.destroy();
        });

        this.load.atlas('ludo', '/ludo_spritesheet.png', '/ludo_atlas.json');
        this.load.atlas('focus', '/focus_assets.png', '/focus_atlas.json');
        
        const sounds = [
            'dice_roll', 'token_move', 'token_capture', 'token_home',
            'button_click', 'game_start', 'invalid_move', 'six_bonus', 'game_win'
        ];
        sounds.forEach(s => {
            this.load.audio(s, `/assets/sounds/${s}.wav`);
        });

        this.load.on('loaderror', (file: any) => {
            console.error('Error loading file:', file.key, file.src);
        });
    }
    create() {
        const loadingOverlay = document.getElementById('loading-overlay');
        if (loadingOverlay) {
            loadingOverlay.style.display = 'none';
        }
        this.sound.mute = !GameState.soundEnabled;

        // Global shortcut for sound toggle (*)
        window.addEventListener('keydown', (event: KeyboardEvent) => {
            if (event.key === '*') {
                toggleSound(this);
                // If we are in MenuScene, we might want to update the UI
                const menuScene = this.scene.get('MenuScene');
                if (this.scene.isActive('MenuScene') && (menuScene as any).updateFocus) {
                    (menuScene as any).updateFocus();
                }
            }
        });

        this.scene.start('MenuScene');
    }
}

class MenuScene extends Phaser.Scene {
    focusIndex: number = 0;
    menuItems: any[] = [];
    focusIndicator: any;
    menuSprites: any[] = [];

    constructor() { super('MenuScene'); }

    create() {
        this.focusIndex = 0;
        
        this.add.image(120, 60, 'ludo', 'banner_ribbon').setScale(0.5);
        this.add.text(120, 50, 'LUDO PRO', { fontSize: '20px', color: '#FFD700', fontStyle: 'bold' }).setOrigin(0.5);

        this.menuItems = [
            { id: 'play', y: 140, text: 'PLAY GAME', icon: 'btn_play' },
            { id: 'sound', y: 190, text: `SOUND: ${GameState.soundEnabled ? 'ON' : 'OFF'}`, icon: GameState.soundEnabled ? 'btn_sound_on' : 'btn_sound_off' },
            { id: 'help', y: 240, text: 'HELP', icon: 'btn_restart' }
        ];

        this.focusIndicator = this.add.image(80, 140, 'focus', 'focus_circle_cyan').setScale(0.4).setAlpha(0);

        this.menuSprites = [];
        this.menuItems.forEach(item => {
            const icon = this.add.image(70, item.y, 'ludo', item.icon).setScale(0.3);
            const text = this.add.text(95, item.y, item.text, { fontSize: '16px', color: '#FFF', fontStyle: 'bold', stroke: '#000', strokeThickness: 3 }).setOrigin(0, 0.5);
            this.menuSprites.push({ icon, text, id: item.id });
        });

        this.updateFocus();

        this.input.keyboard.on('keydown', (event: any) => {
            if (event.key === 'ArrowDown') {
                this.focusIndex = (this.focusIndex + 1) % this.menuItems.length;
                this.updateFocus();
            } else if (event.key === 'ArrowUp') {
                this.focusIndex = (this.focusIndex - 1 + this.menuItems.length) % this.menuItems.length;
                this.updateFocus();
            } else if (event.key === 'Enter' || event.key === '5') {
                this.selectItem();
            }
        });
    }

    updateFocus() {
        const item = this.menuItems[this.focusIndex];
        this.focusIndicator.setAlpha(1);
        this.focusIndicator.setPosition(70, item.y);
        
        this.sound.play('button_click', { volume: 0.5 });

        this.menuSprites.forEach((sprite, idx) => {
            if (idx === this.focusIndex) {
                sprite.text.setColor('#00FF00');
            } else {
                sprite.text.setColor('#FFF');
            }
        });

        if (this.menuSprites[1]) {
            this.menuSprites[1].icon.setFrame(GameState.soundEnabled ? 'btn_sound_on' : 'btn_sound_off');
            this.menuSprites[1].text.setText(`SOUND: ${GameState.soundEnabled ? 'ON' : 'OFF'}`);
        }
    }

    selectItem() {
        const item = this.menuItems[this.focusIndex];
        this.sound.play('button_click');
        if (item.id === 'play') {
            this.scene.start('GameScene');
        } else if (item.id === 'sound') {
            toggleSound(this);
            this.updateFocus();
        } else if (item.id === 'help') {
            this.scene.start('HelpScene');
        }
    }
}

class HelpScene extends Phaser.Scene {
    constructor() { super('HelpScene'); }
    create() {
        this.add.rectangle(120, 160, 240, 320, 0x1E2235);
        this.add.text(120, 35, 'HOW TO PLAY', { fontSize: '18px', color: '#FFD700', fontStyle: 'bold' }).setOrigin(0.5);
        
        const helpText = [
            "• Objective: Move all 4 tokens",
            "  to the center home triangle.",
            "• Roll a 6 to move a token",
            "  out of your home area.",
            "• Land on an opponent's piece",
            "  to send it back home.",
            "• Star tiles are safe zones.",
            "",
            "CONTROLS:",
            "• Arrows: Navigate menu/dice",
            "• Enter: Roll / Select token",
            "• [BKSP]: Return to Menu"
        ];

        this.add.text(20, 65, helpText.join('\n'), { 
            fontSize: '10px', 
            color: '#FFF', 
            lineSpacing: 2,
            wordWrap: { width: 210 } 
        });

        this.add.text(120, 300, 'Press any key to return', { fontSize: '10px', color: '#00FF00' }).setOrigin(0.5);
        
        // Add a small delay so a "Menu" press doesn't instantly close help
        this.time.delayedCall(200, () => {
            this.input.keyboard.on('keydown', (event: any) => {
                // Exit on any non-arrow key
                if (!['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.key)) {
                    this.scene.start('MenuScene');
                }
            });
        });
    }
}

class GameScene extends Phaser.Scene {
    constructor() { super('GameScene'); }

    create() {
        const CELL_SIZE = 16;
        const OFFSET_Y = 40;
        
        const quadSize = CELL_SIZE * 6;
        const centerSize = CELL_SIZE * 3;

        this.add.image(0, OFFSET_Y, 'ludo', 'home_quadrant_green').setOrigin(0).setDisplaySize(quadSize, quadSize);
        this.add.image(9 * CELL_SIZE, OFFSET_Y, 'ludo', 'home_quadrant_red').setOrigin(0).setDisplaySize(quadSize, quadSize);
        this.add.image(0, OFFSET_Y + 9 * CELL_SIZE, 'ludo', 'home_quadrant_yellow').setOrigin(0).setDisplaySize(quadSize, quadSize);
        this.add.image(9 * CELL_SIZE, OFFSET_Y + 9 * CELL_SIZE, 'ludo', 'home_quadrant_blue').setOrigin(0).setDisplaySize(quadSize, quadSize);

        const addCell = (x: number, y: number, name: string) => {
            this.add.image(x * CELL_SIZE + CELL_SIZE/2, OFFSET_Y + y * CELL_SIZE + CELL_SIZE/2, 'ludo', name)
                .setDisplaySize(CELL_SIZE, CELL_SIZE);
        };

        // Draw track area background to ensure no GAPS
        for(let i=0; i<15; i++) {
            for(let j=6; j<=8; j++) {
                addCell(i, j, 'cell_plain');
                addCell(j, i, 'cell_plain');
            }
        }

        for(let y=1; y<6; y++) {
            addCell(7, y, 'cell_red');
        }
        addCell(8, 1, 'cell_safe'); addCell(6, 2, 'cell_safe');

        for(let y=9; y<14; y++) {
            addCell(7, y, 'cell_yellow');
        }
        addCell(6, 13, 'cell_safe'); addCell(8, 12, 'cell_safe');

        for(let x=1; x<6; x++) {
            addCell(x, 7, 'cell_green');
        }
        addCell(1, 6, 'cell_safe'); addCell(2, 8, 'cell_safe');

        for(let x=9; x<14; x++) {
            addCell(x, 7, 'cell_blue');
        }
        addCell(13, 8, 'cell_safe'); addCell(12, 6, 'cell_safe');

        this.add.image(6 * CELL_SIZE, OFFSET_Y + 6 * CELL_SIZE, 'ludo', 'center_home')
            .setOrigin(0).setDisplaySize(centerSize, centerSize);

        const lableColor = '#FFF';
        this.add.text(3 * CELL_SIZE, OFFSET_Y + 0.8 * CELL_SIZE, 'AI', { fontSize: '16px', color: lableColor, fontStyle: 'bold', stroke: '#000', strokeThickness: 4 }).setOrigin(0.5);
        this.add.text(12 * CELL_SIZE, OFFSET_Y + 0.8 * CELL_SIZE, 'AI', { fontSize: '16px', color: lableColor, fontStyle: 'bold', stroke: '#000', strokeThickness: 4 }).setOrigin(0.5);
        this.add.text(3 * CELL_SIZE, OFFSET_Y + 14.2 * CELL_SIZE, 'YOU', { fontSize: '16px', color: lableColor, fontStyle: 'bold', stroke: '#000', strokeThickness: 4 }).setOrigin(0.5);
        this.add.text(12 * CELL_SIZE, OFFSET_Y + 14.2 * CELL_SIZE, 'YOU', { fontSize: '16px', color: lableColor, fontStyle: 'bold', stroke: '#000', strokeThickness: 4 }).setOrigin(0.5);

        const LUDO_PATH = [
            {x: 6, y: 14}, {x: 6, y: 13}, {x: 6, y: 12}, {x: 6, y: 11}, {x: 6, y: 10}, {x: 6, y: 9},
            {x: 5, y: 8}, {x: 4, y: 8}, {x: 3, y: 8}, {x: 2, y: 8}, {x: 1, y: 8}, {x: 0, y: 8},
            {x: 0, y: 7},
            {x: 0, y: 6}, {x: 1, y: 6}, {x: 2, y: 6}, {x: 3, y: 6}, {x: 4, y: 6}, {x: 5, y: 6},
            {x: 6, y: 5}, {x: 6, y: 4}, {x: 6, y: 3}, {x: 6, y: 2}, {x: 6, y: 1}, {x: 6, y: 0},
            {x: 7, y: 0},
            {x: 8, y: 0}, {x: 8, y: 1}, {x: 8, y: 2}, {x: 8, y: 3}, {x: 8, y: 4}, {x: 8, y: 5},
            {x: 9, y: 6}, {x: 10, y: 6}, {x: 11, y: 6}, {x: 12, y: 6}, {x: 13, y: 6}, {x: 14, y: 6},
            {x: 14, y: 7},
            {x: 14, y: 8}, {x: 13, y: 8}, {x: 12, y: 8}, {x: 11, y: 8}, {x: 10, y: 8}, {x: 9, y: 8},
            {x: 8, y: 9}, {x: 8, y: 10}, {x: 8, y: 11}, {x: 8, y: 12}, {x: 8, y: 13}, {x: 8, y: 14},
            {x: 7, y: 14}
        ];

        const HOME_STRETCH = {
            'yellow': [{x: 7, y: 13}, {x: 7, y: 12}, {x: 7, y: 11}, {x: 7, y: 10}, {x: 7, y: 9}, {x: 7, y: 8}],
            'blue': [{x: 13, y: 7}, {x: 12, y: 7}, {x: 11, y: 7}, {x: 10, y: 7}, {x: 9, y: 7}, {x: 8, y: 7}],
            'red': [{x: 7, y: 1}, {x: 7, y: 2}, {x: 7, y: 3}, {x: 7, y: 4}, {x: 7, y: 5}, {x: 7, y: 6}],
            'green': [{x: 1, y: 7}, {x: 2, y: 7}, {x: 3, y: 7}, {x: 4, y: 7}, {x: 5, y: 7}, {x: 6, y: 7}],
        } as any;

        const STARTS = { 'yellow': 1, 'blue': 40, 'red': 27, 'green': 14 } as any;

        const tokens: any[] = [];
        const renderHomeTokens = (color: string, startX: number, startY: number) => {
            const tokenSize = 12;
            const positions = [
                { x: startX + 2.28 * CELL_SIZE, y: startY + 2.28 * CELL_SIZE },
                { x: startX + 3.72 * CELL_SIZE, y: startY + 2.28 * CELL_SIZE },
                { x: startX + 2.28 * CELL_SIZE, y: startY + 3.72 * CELL_SIZE },
                { x: startX + 3.72 * CELL_SIZE, y: startY + 3.72 * CELL_SIZE }
            ];
            positions.forEach((pos, idx) => {
                const sprite = this.add.image(pos.x, pos.y, 'ludo', `token_${color}`).setDisplaySize(tokenSize, tokenSize);
                tokens.push({ id: `${color}_${idx}`, color, state: 'home', relativePos: 0, homeX: pos.x, homeY: pos.y, sprite });
            });
        };

        renderHomeTokens('green', 0, OFFSET_Y);
        renderHomeTokens('red', 9 * CELL_SIZE, OFFSET_Y);
        renderHomeTokens('yellow', 0, OFFSET_Y + 9 * CELL_SIZE);
        renderHomeTokens('blue', 9 * CELL_SIZE, OFFSET_Y + 9 * CELL_SIZE);

        this.add.rectangle(120, 10, 240, 20, 0x000000, 0.6);
        const turnText = this.add.text(120, 10, '', { fontSize: '10px', color: '#FFFF00', stroke: '#000', strokeThickness: 2, fontStyle: 'bold' }).setOrigin(0.5);
        const hintText = this.add.text(120, 25, 'Arrows: Pick | Enter: Action', { fontSize: '8px', color: '#FFF', stroke: '#000', strokeThickness: 1 }).setOrigin(0.5);

        let turnOwner = 'YOU'; // 'YOU' or 'AI'
        
        const updateTurnText = (str: string) => {
            turnText.setText(`TURN: ${turnOwner} - ${str}`);
            turnText.setColor(turnOwner === 'YOU' ? '#00FF00' : '#FF0000');
        };

        updateTurnText('[Enter] to Roll');
        this.sound.play('game_start');

        let gameState = 'WAIT_ROLL'; // WAIT_ROLL, ROLLING, WAIT_MOVE, AI_MOVE

        const focusFrame = this.add.image(0, 0, 'focus', 'focus_cell_gold').setDisplaySize(CELL_SIZE + 4, CELL_SIZE + 4).setVisible(false);
        this.tweens.add({ targets: focusFrame, alpha: 0.2, yoyo: true, repeat: -1, duration: 300 });

        const targetFrame = this.add.image(0, 0, 'focus', 'focus_cell_cyan').setDisplaySize(CELL_SIZE + 4, CELL_SIZE + 4).setVisible(false);
        this.tweens.add({ targets: targetFrame, alpha: 0.2, yoyo: true, repeat: -1, duration: 300 });

        const dice1 = this.add.sprite(90, 160, 'ludo', 'dice_face_6').setDisplaySize(32, 32).setVisible(false);
        const dice2 = this.add.sprite(150, 160, 'ludo', 'dice_face_6').setDisplaySize(32, 32).setVisible(false);

        let val1 = 0, val2 = 0;
        let remainingDice: number[] = [];
        let isBonusTurn = false;
        let validMoves: any[] = [];
        let activeMoveIdx = 0;

        const getCellCoords = (color: string, relativePos: number) => {
            let cell;
            if (relativePos < 51) {
                const absIndex = (STARTS[color] + relativePos) % 52;
                cell = LUDO_PATH[absIndex];
            } else {
                const homeIndex = relativePos - 51;
                if (HOME_STRETCH[color] && HOME_STRETCH[color][homeIndex]) {
                    cell = HOME_STRETCH[color][homeIndex];
                }
            }
            if (cell) {
                return {
                    x: cell.x * CELL_SIZE + CELL_SIZE/2,
                    y: OFFSET_Y + cell.y * CELL_SIZE + CELL_SIZE/2
                };
            }
            return null;
        };

        const updateTokenPos = (t: any) => {
            if (t.state === 'home') {
                t.sprite.x = t.homeX;
                t.sprite.y = t.homeY;
            } else if (t.state === 'path') {
                const coords = getCellCoords(t.color, t.relativePos);
                if (coords) {
                    this.sound.play('token_move', { volume: 0.6 });
                    t.sprite.x = coords.x;
                    t.sprite.y = coords.y;
                }
            }
        };

        const updateFocus = () => {
            if (validMoves.length > 0) {
                const m = validMoves[activeMoveIdx];
                if (!m || !m.token) {
                    focusFrame.setVisible(false);
                    targetFrame.setVisible(false);
                    return;
                }
                focusFrame.setVisible(true);
                targetFrame.setVisible(true);
                focusFrame.setPosition(m.token.sprite.x, m.token.sprite.y);
                
                let targetCoords;
                if (m.isHomeOut) {
                    targetCoords = getCellCoords(m.token.color, 0);
                } else {
                    targetCoords = getCellCoords(m.token.color, m.targetRelPos);
                }
                if (targetCoords) {
                    targetFrame.setPosition(targetCoords.x, targetCoords.y);
                }
            } else {
                focusFrame.setVisible(false);
                targetFrame.setVisible(false);
            }
        };

        const getValidMoves = (playerStr: string, dice: number[]) => {
            const colors = playerStr === 'YOU' ? ['yellow', 'blue'] : ['green', 'red'];
            const moves: any[] = [];
            const myTokens = tokens.filter(t => colors.includes(t.color));

            const uniqueDice = [...new Set(dice)];

            myTokens.forEach(t => {
                if (t.state === 'home') {
                    if (uniqueDice.includes(6)) {
                        moves.push({ token: t, usedDice: [6], targetRelPos: 0, isHomeOut: true });
                    }
                } else if (t.state === 'path') {
                    uniqueDice.forEach(d => {
                        if (t.relativePos + d <= 56) {
                            moves.push({ token: t, usedDice: [d], targetRelPos: t.relativePos + d, isHomeOut: false });
                        }
                    });
                }
            });
            return moves;
        };

        const executeMove = (m: any) => {
            if (!m || !m.token) return;
            const t = m.token;
            let startRelPos = t.relativePos;
            let wasHome = t.state === 'home';
            let targetRelPos = m.targetRelPos;

            // Remove used dice from remaining
            m.usedDice.forEach((ud: number) => {
                const idx = remainingDice.indexOf(ud);
                if (idx > -1) remainingDice.splice(idx, 1);
            });

            focusFrame.setVisible(false);
            targetFrame.setVisible(false);
            gameState = 'ANIMATING';

            const steps: number[] = [];
            if (wasHome) {
                t.state = 'path';
                steps.push(0);
            } else {
                for (let p = startRelPos + 1; p <= targetRelPos; p++) {
                    steps.push(p);
                }
            }
            t.relativePos = targetRelPos;

            let stepIndex = 0;
            const onCompleteMove = () => {
                if (t.state === 'path' && t.relativePos < 51) {
                    const absIndex = (STARTS[t.color] + t.relativePos) % 52;
                    const SAFE_INDICES = [1, 9, 14, 22, 27, 35, 40, 48];
                    if (!SAFE_INDICES.includes(absIndex)) {
                        const captured = tokens.filter(other => 
                            other.color !== t.color && 
                            other.state === 'path' && 
                            other.relativePos < 51 &&
                            ((STARTS[other.color] + other.relativePos) % 52) === absIndex
                        );
                        if (captured.length > 0) {
                            this.sound.play('token_capture');
                            captured.forEach(c => {
                                c.state = 'home';
                                c.relativePos = 0;
                                updateTokenPos(c);
                            });
                            isBonusTurn = true;
                        }
                    }
                }
                if (t.relativePos === 56) {
                    this.sound.play('token_home');
                    
                    const myTokens = tokens.filter(tok => tok.color === t.color);
                    const allHome = myTokens.every(tok => tok.relativePos === 56);
                    if (allHome) {
                        this.sound.play('game_win');
                        updateTurnText(`${t.color.toUpperCase()} WINS!`);
                        gameState = 'WIN';
                        // Could add a win animation or scene here
                        this.time.delayedCall(3000, () => {
                            this.scene.start('MenuScene');
                        });
                        return;
                    }
                }
                evaluateMoves();
            };

            const nextStep = () => {
                if (stepIndex >= steps.length) {
                    onCompleteMove();
                    return;
                }
                const coords = getCellCoords(t.color, steps[stepIndex]);
                if (coords) {
                    this.tweens.add({
                        targets: t.sprite,
                        x: coords.x,
                        y: coords.y,
                        duration: 150,
                        ease: 'Linear',
                        onComplete: () => {
                            this.sound.play('token_move', { volume: 0.4 });
                            stepIndex++;
                            nextStep();
                        }
                    });
                } else {
                    stepIndex++;
                    nextStep();
                }
            };
            
            nextStep();
        };

        const nextTurn = () => {
            turnOwner = turnOwner === 'YOU' ? 'AI' : 'YOU';
        };

        const endTurn = () => {
            dice1.setVisible(false);
            dice2.setVisible(false);
            remainingDice = [];
            if (isBonusTurn) {
                isBonusTurn = false;
                gameState = 'WAIT_ROLL';
                if (turnOwner === 'YOU') {
                    updateTurnText('Double 6! Bonus Roll!');
                } else {
                    updateTurnText('AI got Double 6! Rolling again...');
                    this.time.delayedCall(1500, () => { if (this.scene.isActive()) rollDice(); });
                }
            } else {
                nextTurn();
                gameState = 'WAIT_ROLL';
                validMoves = [];
                if (turnOwner === 'YOU') {
                    updateTurnText('YOUR TURN - [Enter] to Roll');
                } else {
                    updateTurnText("OPPONENT'S TURN");
                    this.time.delayedCall(1500, () => { if (this.scene.isActive()) rollDice(); });
                }
            }
        };

        const evaluateMoves = () => {
            if (remainingDice.length === 0) {
                endTurn();
                return;
            }
            
            validMoves = getValidMoves(turnOwner, remainingDice);
            if (validMoves.length === 0) {
                updateTurnText('No valid moves');
                this.time.delayedCall(1500, () => {
                    endTurn();
                });
            } else {
                if (turnOwner === 'YOU') {
                    gameState = 'WAIT_MOVE';
                    activeMoveIdx = 0;
                    updateFocus();
                    updateTurnText(`Select move [🎲 ${remainingDice.join(' & ')}]`);
                } else {
                    gameState = 'AI_MOVE';
                    this.time.delayedCall(1000, () => {
                        if (!this.scene.isActive() || validMoves.length === 0) return;
                        validMoves.sort((a,b) => {
                            if(a.isHomeOut !== b.isHomeOut) return a.isHomeOut ? -1 : 1;
                            return b.targetRelPos - a.targetRelPos;
                        });
                        executeMove(validMoves[0]);
                    });
                }
            }
        };

        const executeRoll = (r1: number, r2: number) => {
             isBonusTurn = (r1 === 6 && r2 === 6);
             if (isBonusTurn) this.sound.play('six_bonus');
             remainingDice = [r1, r2];
             evaluateMoves();
        };

        const rollDice = () => {
            if (gameState !== 'WAIT_ROLL') return;
            this.sound.play('dice_roll');
            gameState = 'ROLLING';
            updateTurnText(turnOwner === 'YOU' ? 'YOU ARE ROLLING...' : 'AI IS ROLLING...');
            dice1.setVisible(true);
            dice2.setVisible(true);

            let rolls = 0;
            const maxRolls = 10;
            this.time.addEvent({
                delay: 60,
                callback: () => {
                    dice1.setFrame(`dice_face_${Math.floor(Math.random() * 6) + 1}`);
                    dice2.setFrame(`dice_face_${Math.floor(Math.random() * 6) + 1}`);
                    dice1.setAngle(Math.random() * 60 - 30);
                    dice2.setAngle(Math.random() * 60 - 30);
                    rolls++;

                    if (rolls >= maxRolls) {
                        val1 = Math.floor(Math.random() * 6) + 1;
                        val2 = Math.floor(Math.random() * 6) + 1;
                        dice1.setFrame(`dice_face_${val1}`);
                        dice2.setFrame(`dice_face_${val2}`);
                        dice1.setAngle(0);
                        dice2.setAngle(0);
                        
                        this.tweens.add({
                            targets: [dice1, dice2],
                            scale: 1,
                            yoyo: true,
                            duration: 100,
                            onComplete: () => executeRoll(val1, val2)
                        });
                    }
                },
                repeat: maxRolls - 1
            });
        };

        this.input.keyboard.on('keydown', (event: any) => {
            if (event.key === 'SoftLeft' || event.key === 'Backspace' || event.key === 'Escape') {
                this.scene.start('MenuScene');
            } else if (turnOwner === 'YOU') {
                if (gameState === 'WAIT_ROLL' && (event.key === 'Enter' || event.key === '5')) {
                    rollDice();
                } else if (gameState === 'WAIT_MOVE') {
                    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
                        activeMoveIdx = (activeMoveIdx + 1) % validMoves.length;
                        updateFocus();
                    } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
                        activeMoveIdx = (activeMoveIdx - 1 + validMoves.length) % validMoves.length;
                        updateFocus();
                    } else if (event.key === 'Enter' || event.key === '5') {
                        executeMove(validMoves[activeMoveIdx]);
                    }
                }
            }
        });
        
    }
}

const config: Phaser.Types.Core.GameConfig = {
    type: Phaser.AUTO,
    parent: 'game-container',
    width: 240,
    height: 320,
    backgroundColor: '#1E2235',
    scale: {
        mode: Phaser.Scale.FIT
    },
    scene: [BootScene, MenuScene, HelpScene, GameScene],
    render: {
        pixelArt: true,
        antialias: false
    }
};

new Phaser.Game(config);
