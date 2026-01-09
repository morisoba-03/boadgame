// =============================================
//  みんなのボドゲ - アプリケーションスクリプト (v4.5)
// =============================================

document.addEventListener('DOMContentLoaded', () => {
    const getEl = (id) => document.getElementById(id);
    const shuffle = (array) => [...array].sort(() => Math.random() - 0.5);
    let themes = {};

    const pages = document.querySelectorAll('.page');
    document.body.addEventListener('click', (e) => {
        const button = e.target.closest('button[data-goto]');
        if (button) {
            const pageId = button.dataset.goto;
            pages.forEach(p => p.classList.remove('active'));
            getEl(pageId).classList.add('active');
            const initFuncs = {
                'page-ws-mode-select': () => {},
                'page-word-sniper': () => ws.init(button.dataset.mode),
                'page-ito': () => ito.init(),
                'page-bob-jiten': () => bj.init(),
                'page-cat-choco': () => cc.init(),
                'page-stack-ttt': sttt.init,
                'page-word-wolf': () => ww.init(),
                'page-quiz-iisen': () => qis.init(),
                'page-make-ten-mode-select': () => {},
                'page-make-ten': () => mt.init(button.dataset.difficulty),
                'page-settings': settings.init,
                'page-player-setup': () => {}
            };
            if(initFuncs[pageId]) initFuncs[pageId]();
        }
    });

    function loadThemes() {
        if (typeof initialThemes !== 'undefined') {
            const storedThemes = localStorage.getItem('bodoge-themes-v4.5');
            try {
                const parsed = storedThemes ? JSON.parse(storedThemes) : JSON.parse(JSON.stringify(initialThemes));
                if(!parsed.ワードスナイパー || !parsed.ITO || !parsed.ボブジテン || !parsed['キャット＆チョコレート'] || !parsed['ワードウルフ'] || !parsed['クイズいいセン行きまSHOW！']) throw new Error("Data structure mismatch");
                themes = parsed;
            } catch (e) {
                console.error("Failed to load themes, falling back to initial data.", e);
                themes = JSON.parse(JSON.stringify(initialThemes));
            }
        } else {
            console.error("initialThemes is not defined. Make sure themes.js is loaded.");
            getEl('page-top').innerHTML = '<h1>エラー</h1><p>お題データの読み込みに失敗しました。themes.jsが正しく配置されているか確認してください。</p>';
        }
    }
    
    const gameModules = {};

    getEl('app-container').addEventListener('click', (e) => {
        const btn = e.target.closest('.score-btn');
        if (!btn) return;
        
        const pageId = btn.closest('.page').id;
        const index = parseInt(btn.dataset.index, 10);
        const delta = parseInt(btn.dataset.delta, 10);
        
        const game = gameModules[pageId];
        if (game && typeof game.updateScore === 'function') {
            game.updateScore(index, delta);
        }
    });

    const scoreBoard = {
        create(container, players) {
            container.innerHTML = '';
            const list = document.createElement('ul');
            list.className = 'scoreboard-list';
            players.forEach((player, index) => {
                const item = document.createElement('li');
                item.innerHTML = `
                    <span class="player-name">${player.name}</span>
                    <span class="player-score">スコア: ${player.score}</span>
                    <div class="score-controls">
                        <button class="score-btn minus" data-index="${index}" data-delta="-1">–</button>
                        <button class="score-btn plus" data-index="${index}" data-delta="1">+</button>
                    </div>
                `;
                list.appendChild(item);
            });
            container.appendChild(list);
        },
        update(container, players) {
             players.forEach((player, index) => {
                const scoreEl = container.querySelector(`li:nth-child(${index + 1}) .player-score`);
                if(scoreEl) scoreEl.textContent = `スコア: ${player.score}`;
            });
        }
    };

    const ws = { 
        id: 'page-word-sniper',
        topicEl: getEl('ws-topic'), charEl: getEl('ws-char'), headerTitle: getEl('ws-header-title'), 
        mode: 'normal', 
        chars: { base: ['あ','い','う','え','お','か','き','く','け','こ','さ','し','す','せ','そ','た','ち','つ','て','と','な','に','ぬ','ね','の','は','ひ','ふ','へ','ほ','ま','み','む','め','も','や','ゆ','よ','ら','り','る','れ','ろ','わ','ん'], dakuon: ['が','ぎ','ぐ','げ','ご','ざ','じ','ず','ぜ','ぞ','だ','ぢ','づ','で','ど','ば','び','ぶ','べ','ぼ'], handakuon: ['ぱ','ぴ','ぷ','ぺ','ぽ'], youon: ['きゃ','きゅ','きょ','しゃ','しゅ','しょ','ちゃ','ちゅ','ちょ','にゃ','にゅ','にょ','ひゃ','ひゅ','ひょ','みゃ','みゅ','みょ','りゃ','りゅ','りょ','ぎゃ','ぎゅ','ぎょ','じゃ','じゅ','じょ','びゃ','びゅ','びょ','ぴゃ','ぴゅ','ぴょ'] },
        gameState: { players: [] },
        draw: () => { 
            let charPool = [...ws.chars.base]; 
            if(getEl('ws-opt-dakuon').checked) charPool.push(...ws.chars.dakuon); 
            if(getEl('ws-opt-handakuon').checked) charPool.push(...ws.chars.handakuon); 
            if(getEl('ws-opt-youon').checked) charPool.push(...ws.chars.youon); 
            ws.topicEl.textContent = shuffle(themes['ワードスナイパー'][ws.mode])[0]; 
            ws.charEl.textContent = shuffle(charPool)[0]; 
        },
        init: (mode) => { 
            if(!mode) return; 
            ws.mode = mode; 
            ws.headerTitle.textContent = `ワードスナイパー (${mode === 'normal' ? 'ノーマル' : 'キッズ'})`;
            getEl('ws-player-count').value = 4;
            ws.setupPlayers();
            ws.draw(); 
        },
        setupPlayers: () => {
            const playerCount = parseInt(getEl('ws-player-count').value, 10);
            ws.gameState.players = Array.from({ length: playerCount }, (_, i) => ({ name: `プレイヤー${i + 1}`, score: 0 }));
            scoreBoard.create(getEl('ws-scoreboard'), ws.gameState.players);
        },
        updateScore: (index, delta) => {
            ws.gameState.players[index].score += delta;
            scoreBoard.update(getEl('ws-scoreboard'), ws.gameState.players);
        }
    };
    gameModules[ws.id] = ws;
    document.querySelectorAll('#page-word-sniper .ingame-options input').forEach(el => el.addEventListener('change', ws.draw)); 
    getEl('ws-draw').addEventListener('click', ws.draw);
    getEl('ws-player-count').addEventListener('change', ws.setupPlayers);

    const bj = { 
        id: 'page-bob-jiten',
        gameState: { players: [] },
        draw: () => { 
            getEl('bj-topic').textContent = shuffle(themes['ボブジテン'].normal)[0]; 
            if (getEl('bj-opt-special').checked && Math.random() * 100 < 20) { 
                getEl('bj-special-topic').textContent = shuffle(themes['ボブジテン'].special)[0]; 
                getEl('bj-special-card').classList.remove('hidden'); 
            } else { 
                getEl('bj-special-card').classList.add('hidden'); 
            } 
        }, 
        init: () => {
            getEl('bj-player-count').value = 4;
            bj.setupPlayers();
            bj.draw();
        },
        setupPlayers: () => {
            const playerCount = parseInt(getEl('bj-player-count').value, 10);
            bj.gameState.players = Array.from({ length: playerCount }, (_, i) => ({ name: `プレイヤー${i + 1}`, score: 0 }));
            scoreBoard.create(getEl('bj-scoreboard'), bj.gameState.players);
        },
        updateScore: (index, delta) => {
            bj.gameState.players[index].score += delta;
            scoreBoard.update(getEl('bj-scoreboard'), bj.gameState.players);
        }
    };
    gameModules[bj.id] = bj;
    getEl('bj-draw').addEventListener('click', () => { bj.draw(); }); 
    getEl('bj-player-count').addEventListener('change', bj.setupPlayers);

    const cc = { 
        id: 'page-cat-choco',
        gameState: { players: [] },
        draw: () => { 
            getEl('cc-event').textContent = shuffle(themes['キャット＆チョコレート'].events)[0]; 
            getEl('cc-item-count').textContent = Math.floor(Math.random() * 3) + 1; 
            const items = shuffle(themes['キャット＆チョコレート'].items).slice(0, 3); 
            const handEl = getEl('cc-items-hand'); 
            handEl.innerHTML = ''; 
            items.forEach(item => { const card = document.createElement('div'); card.className = 'card'; const p = document.createElement('p'); p.textContent = item; card.appendChild(p); handEl.appendChild(card); }); 
        }, 
        init: () => {
            getEl('cc-player-count').value = 4;
            cc.setupPlayers();
            cc.draw();
        },
        setupPlayers: () => {
            const playerCount = parseInt(getEl('cc-player-count').value, 10);
            cc.gameState.players = Array.from({ length: playerCount }, (_, i) => ({ name: `プレイヤー${i + 1}`, score: 0 }));
            scoreBoard.create(getEl('cc-scoreboard'), cc.gameState.players);
        },
        updateScore: (index, delta) => {
            cc.gameState.players[index].score += delta;
            scoreBoard.update(getEl('cc-scoreboard'), cc.gameState.players);
        }
    };
    gameModules[cc.id] = cc;
    getEl('cc-draw').addEventListener('click', cc.draw);
    getEl('cc-player-count').addEventListener('change', cc.setupPlayers);

    const sttt = { 
        id: 'page-stack-ttt',
        boardEl: getEl('sttt-board'), infoEl: getEl('sttt-info'), playerAreas: {1: getEl('sttt-player1-area'), 2: getEl('sttt-player2-area')}, resetBtn: getEl('sttt-reset'), gameState: {}, sizeValue: { S: 1, M: 2, L: 3 }, 
        init: () => { sttt.gameState = { board: Array(9).fill(null).map(() => []), hands: { 1: {S:2, M:2, L:2}, 2: {S:2, M:2, L:2} }, currentPlayer: 1, selectedPiece: null, gameOver: false, }; sttt.resetBtn.classList.add('hidden'); sttt.boardEl.innerHTML = Array(9).fill(0).map((_, i) => `<div class="sttt-cell" data-index="${i}"></div>`).join(''); sttt.render(); }, 
        render: () => { sttt.boardEl.querySelectorAll('.sttt-cell').forEach((cell, i) => { cell.innerHTML = ''; const stack = sttt.gameState.board[i]; if (stack.length > 0) { const topPiece = stack[stack.length - 1]; const pieceEl = document.createElement('div'); pieceEl.className = `sttt-piece player${topPiece.player} size-${topPiece.size}`; cell.appendChild(pieceEl); } }); for (const player of [1, 2]) { sttt.playerAreas[player].classList.toggle('active-player', sttt.gameState.currentPlayer === player && !sttt.gameState.gameOver); for (const size of ['S', 'M', 'L']) { const stackEl = document.querySelector(`.sttt-hand-stack[data-player="${player}"][data-size="${size}"]`); stackEl.innerHTML = ''; for (let i = 0; i < sttt.gameState.hands[player][size]; i++) { const pieceEl = document.createElement('div'); pieceEl.className = `sttt-piece player${player} size-${size}`; stackEl.appendChild(pieceEl); } stackEl.classList.toggle('selected', sttt.gameState.selectedPiece?.player === player && sttt.gameState.selectedPiece?.size === size); } } sttt.infoEl.classList.remove('player1', 'player2'); if (sttt.gameState.gameOver) { sttt.infoEl.textContent = `プレイヤー ${sttt.gameState.currentPlayer} の勝ち！`; sttt.infoEl.classList.add(`player${sttt.gameState.currentPlayer}`); sttt.resetBtn.classList.remove('hidden'); } else { sttt.infoEl.textContent = `プレイヤー ${sttt.gameState.currentPlayer} の番です`; sttt.infoEl.classList.add(`player${sttt.gameState.currentPlayer}`); } document.querySelectorAll('.highlight').forEach(el => el.classList.remove('highlight')); if(sttt.gameState.selectedPiece){ const { size, from, index: fromIndex } = sttt.gameState.selectedPiece; sttt.boardEl.querySelectorAll('.sttt-cell').forEach((cell, i) => { if(from === 'board' && i === fromIndex) return; const stack = sttt.gameState.board[i]; const topPiece = stack.length > 0 ? stack[stack.length - 1] : null; if (!topPiece || sttt.sizeValue[size] > sttt.sizeValue[topPiece.size]) { cell.classList.add('highlight'); } }); } }, 
        handleClick: (e) => { if (sttt.gameState.gameOver) return; const handStack = e.target.closest('.sttt-hand-stack'); const cell = e.target.closest('.sttt-cell'); if (handStack) { const { player, size } = handStack.dataset; if (sttt.gameState.currentPlayer !== parseInt(player) || sttt.gameState.hands[player][size] === 0) return; if (sttt.gameState.selectedPiece?.from === 'hand' && sttt.gameState.selectedPiece?.size === size) { sttt.gameState.selectedPiece = null; } else { sttt.gameState.selectedPiece = { player: parseInt(player), size, from: 'hand' }; } } else if (cell) { const index = parseInt(cell.dataset.index); const stack = sttt.gameState.board[index]; const topPiece = stack.length > 0 ? stack[stack.length - 1] : null; if (sttt.gameState.selectedPiece) { if (!cell.classList.contains('highlight')) return; const { player, size, from, index: fromIndex } = sttt.gameState.selectedPiece; sttt.gameState.board[index].push({ player, size }); if (from === 'hand') sttt.gameState.hands[player][size]--; if (from === 'board') sttt.gameState.board[fromIndex].pop(); sttt.gameState.selectedPiece = null; if(sttt.checkWin()){ sttt.gameState.gameOver = true; } else { sttt.gameState.currentPlayer = player === 1 ? 2 : 1; } } else { if (topPiece && topPiece.player === sttt.gameState.currentPlayer) { sttt.gameState.selectedPiece = { player: topPiece.player, size: topPiece.size, from: 'board', index }; } } } sttt.render(); }, 
        checkWin: () => { const p = sttt.gameState.currentPlayer; const b = sttt.gameState.board.map(s => s.length > 0 ? s[s.length-1].player : null); const lines = [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]]; return lines.some(line => line.every(i => b[i] === p)); } 
    };
    getEl('page-stack-ttt').addEventListener('click', sttt.handleClick); 
    sttt.resetBtn.addEventListener('click', sttt.init);
    getEl('sttt-header-reset').addEventListener('click', sttt.init);

    const playerSetup = {
        setup: (game, playerCount, fromPage, startCallback) => {
            playerSetup.startCallback = startCallback;
            playerSetup.fromPage = fromPage;
            const container = getEl('player-names-container');
            container.innerHTML = '';
            for (let i = 1; i <= playerCount; i++) {
                const div = document.createElement('div');
                div.className = 'player-name-input';
                div.innerHTML = `<label for="player-name-${i}">プレイヤー${i}:</label><input type="text" id="player-name-${i}" value="プレイヤー${i}">`;
                container.appendChild(div);
            }
            getEl('player-setup-back-btn').dataset.goto = fromPage;
            pages.forEach(p => p.classList.remove('active'));
            getEl('page-player-setup').classList.add('active');
        },
        confirm: () => {
            const names = [];
            const inputs = document.querySelectorAll('#player-names-container input');
            inputs.forEach(input => names.push(input.value || input.placeholder));
            playerSetup.startCallback(names);
        }
    };
    getEl('player-setup-confirm-btn').addEventListener('click', playerSetup.confirm);

    const ito = {
        id: 'page-ito',
        gameState: {},
        init: () => { getEl('ito-setup').classList.remove('hidden'); getEl('ito-check').classList.add('hidden'); getEl('ito-theme').classList.add('hidden'); getEl('ito-player-count').value = 4; },
        startSetup: () => { const playerCount = parseInt(getEl('ito-player-count').value); if(playerCount < 2 || playerCount > 10) { alert("2〜10人で設定してください。"); return; } playerSetup.setup('ito', playerCount, 'page-ito', ito.start); },
        start: (playerNames) => {
            const numbers = shuffle([...Array(100).keys()].map(i => i + 1)).slice(0, playerNames.length);
            ito.gameState = { 
                playerCount: playerNames.length, 
                currentPlayerIndex: 0, 
                players: playerNames.map((name, i) => ({name, score: 0, number: numbers[i]}))
            };
            pages.forEach(p => p.classList.remove('active')); getEl('page-ito').classList.add('active');
            getEl('ito-setup').classList.add('hidden'); getEl('ito-check').classList.remove('hidden'); ito.updatePlayerView();
        },
        updatePlayerView: () => { getEl('ito-current-player').textContent = ito.gameState.players[ito.gameState.currentPlayerIndex].name; getEl('ito-number-display').classList.add('hidden'); getEl('ito-confirm-number').classList.add('hidden'); getEl('ito-show-number').classList.remove('hidden'); },
        showNumber: () => { getEl('ito-number-display').textContent = ito.gameState.players[ito.gameState.currentPlayerIndex].number; getEl('ito-number-display').classList.remove('hidden'); getEl('ito-confirm-number').classList.remove('hidden'); getEl('ito-show-number').classList.add('hidden'); },
        confirmNumber: () => { ito.gameState.currentPlayerIndex++; if (ito.gameState.currentPlayerIndex < ito.gameState.playerCount) { ito.updatePlayerView(); } else { getEl('ito-check').classList.add('hidden'); getEl('ito-theme').classList.remove('hidden'); ito.drawTheme(); } },
        drawTheme: () => { 
            getEl('ito-theme-display').textContent = shuffle(themes['ITO'])[0];
            scoreBoard.create(getEl('ito-scoreboard'), ito.gameState.players);
        },
        updateScore: (index, delta) => {
            ito.gameState.players[index].score += delta;
            scoreBoard.update(getEl('ito-scoreboard'), ito.gameState.players);
        }
    };
    gameModules[ito.id] = ito;
    getEl('ito-start-setup').addEventListener('click', ito.startSetup); getEl('ito-show-number').addEventListener('click', ito.showNumber); getEl('ito-confirm-number').addEventListener('click', ito.confirmNumber); getEl('ito-new-theme').addEventListener('click', ito.drawTheme); getEl('ito-reset').addEventListener('click', ito.init);

    const ww = {
        id: 'page-word-wolf',
        gameState: {}, timerId: null, timeLeft: 180,
        init: () => { getEl('ww-setup').classList.remove('hidden'); getEl('ww-check').classList.add('hidden'); getEl('ww-discuss').classList.add('hidden'); getEl('ww-result').classList.add('hidden'); getEl('ww-player-count').value = 4; getEl('ww-time-select').value = 180;},
        startSetup: () => { const playerCount = parseInt(getEl('ww-player-count').value); if(playerCount < 3 || playerCount > 10) { alert("3〜10人で設定してください。"); return; } ww.timeLeft = parseInt(getEl('ww-time-select').value); playerSetup.setup('ww', playerCount, 'page-word-wolf', ww.start); },
        start: (playerNames) => {
            const themePair = shuffle(themes['ワードウルフ'])[0];
            const wolfIndex = Math.floor(Math.random() * playerNames.length);
            ww.gameState = { playerCount: playerNames.length, currentPlayerIndex: 0,
                players: playerNames.map((name, i) => ({ name, score: 0, role: i === wolfIndex ? 'ウルフ' : '市民', word: i === wolfIndex ? themePair[1] : themePair[0] }))
            };
            pages.forEach(p => p.classList.remove('active')); getEl('page-word-wolf').classList.add('active');
            getEl('ww-setup').classList.add('hidden'); getEl('ww-check').classList.remove('hidden'); ww.updatePlayerView();
        },
        updatePlayerView: () => { getEl('ww-current-player').textContent = ww.gameState.players[ww.gameState.currentPlayerIndex].name; getEl('ww-word-display').classList.add('hidden'); getEl('ww-confirm-word').classList.add('hidden'); getEl('ww-show-word').classList.remove('hidden'); },
        showWord: () => { getEl('ww-word-display').textContent = ww.gameState.players[ww.gameState.currentPlayerIndex].word; getEl('ww-word-display').classList.remove('hidden'); getEl('ww-confirm-word').classList.remove('hidden'); getEl('ww-show-word').classList.add('hidden'); },
        confirmWord: () => { ww.gameState.currentPlayerIndex++; if (ww.gameState.currentPlayerIndex < ww.gameState.playerCount) { ww.updatePlayerView(); } else { getEl('ww-check').classList.add('hidden'); getEl('ww-discuss').classList.remove('hidden'); ww.resetTimer(); } },
        resetTimer: () => { clearInterval(ww.timerId); ww.timerId = null; const min = String(Math.floor(ww.timeLeft / 60)).padStart(2, '0'); const sec = String(ww.timeLeft % 60).padStart(2, '0'); getEl('ww-timer').textContent = `${min}:${sec}`; getEl('ww-timer-start').textContent = 'タイマースタート'; },
        startTimer: () => { if (ww.timerId) { ww.resetTimer(); return; } getEl('ww-timer-start').textContent = 'リセット'; let time = ww.timeLeft; ww.timerId = setInterval(() => { time--; const min = String(Math.floor(time / 60)).padStart(2, '0'); const sec = String(time % 60).padStart(2, '0'); getEl('ww-timer').textContent = `${min}:${sec}`; if (time <= 0) { clearInterval(ww.timerId); ww.timerId = null; getEl('ww-timer-start').textContent = 'タイマースタート'; } }, 1000); },
        showResult: () => { 
            clearInterval(ww.timerId); ww.timerId = null; 
            getEl('ww-discuss').classList.add('hidden'); 
            getEl('ww-result').classList.remove('hidden'); 
            const listEl = getEl('ww-result-list'); 
            listEl.innerHTML = ''; 
            ww.gameState.players.forEach(p => { 
                const li = document.createElement('li'); 
                li.innerHTML = `${p.name}: <span class="role">${p.role}</span> (お題: ${p.word})`; 
                listEl.appendChild(li); 
            });
            scoreBoard.create(getEl('ww-scoreboard'), ww.gameState.players);
        },
        updateScore: (index, delta) => {
            ww.gameState.players[index].score += delta;
            scoreBoard.update(getEl('ww-scoreboard'), ww.gameState.players);
        }
    };
    gameModules[ww.id] = ww;
    getEl('ww-start-setup').addEventListener('click', ww.startSetup); getEl('ww-show-word').addEventListener('click', ww.showWord); getEl('ww-confirm-word').addEventListener('click', ww.confirmWord); getEl('ww-show-result').addEventListener('click', ww.showResult); getEl('ww-timer-start').addEventListener('click', ww.startTimer); getEl('ww-reset').addEventListener('click', ww.init);

    const qis = {
        id: 'page-quiz-iisen',
        gameState: {},
        init: () => { 
            getEl('qis-setup').classList.remove('hidden');
            getEl('qis-game').classList.add('hidden');
            getEl('qis-player-count').value = 4; 
        },
        startSetup: () => { 
            const playerCount = parseInt(getEl('qis-player-count').value); 
            if(playerCount < 2) { alert("2人以上で設定してください。"); return; } 
            playerSetup.setup('qis', playerCount, 'page-quiz-iisen', qis.start); 
        },
        start: (playerNames) => {
            qis.gameState.players = playerNames.map(name => ({name, score: 0}));
            pages.forEach(p => p.classList.remove('active')); 
            getEl('page-quiz-iisen').classList.add('active');
            getEl('qis-setup').classList.add('hidden'); 
            getEl('qis-game').classList.remove('hidden'); 
            qis.newQuestion();
            scoreBoard.create(getEl('qis-scoreboard'), qis.gameState.players);
        },
        newQuestion: () => {
            getEl('qis-question-display').textContent = shuffle(themes['クイズいいセン行きまSHOW！'])[0];
            getEl('qis-calc-input').value = '';
            getEl('qis-calc-result').textContent = '';
        },
        calculate: () => {
            const input = getEl('qis-calc-input').value.trim();
            if (input === '') {
                getEl('qis-calc-result').textContent = '数字を入力してください。';
                return;
            }
            const numbers = input.split(/[\s,，、]+/).map(n => parseFloat(n)).filter(n => !isNaN(n));
            if (numbers.length === 0) {
                getEl('qis-calc-result').textContent = '有効な数字がありません。';
                return;
            }
            numbers.sort((a,b) => a - b);
            const midIndex = Math.floor((numbers.length - 1) / 2);
            const median = numbers[midIndex];
            let resultText = `入力: [${numbers.join(', ')}] --- 中央値は「${median}」です。`;
            if (numbers.length % 2 === 0 && numbers.length > 0) {
                const midIndex2 = midIndex + 1;
                const median2 = numbers[midIndex2];
                if(median !== median2) {
                   resultText = `入力: [${numbers.join(', ')}] --- 中央値は「${median}」と「${median2}」です。`;
                }
            }
            getEl('qis-calc-result').textContent = resultText;
        },
        updateScore: (index, delta) => {
            qis.gameState.players[index].score += delta;
            scoreBoard.update(getEl('qis-scoreboard'), qis.gameState.players);
        },
        resetGame: () => {
            qis.init();
        }
    };
    gameModules[qis.id] = qis;
    getEl('qis-start-setup').addEventListener('click', qis.startSetup);
    getEl('qis-new-question').addEventListener('click', qis.newQuestion);
    getEl('qis-calc-button').addEventListener('click', qis.calculate);
    getEl('qis-reset').addEventListener('click', qis.resetGame);

    const mt = {
        difficulty: 'easiest', currentNumbers: [],
        init: (difficulty) => {
            if(!difficulty) return;
            mt.difficulty = difficulty;
            const modeText = {'easiest': 'もっともかんたん', 'easy': 'かんたん', 'hard': 'むずかしい'}[difficulty];
            getEl('mt-header-title').textContent = `10パズル (${modeText})`;
            mt.draw();
        },
        draw: () => {
            let solutions = [];
            while(solutions.length === 0){
                mt.currentNumbers = Array(4).fill(0).map(() => Math.floor(Math.random() * 9) + 1);
                solutions = mt.solve(mt.currentNumbers);
            }
            const numbersEl = getEl('mt-numbers');
            numbersEl.innerHTML = '';
            mt.currentNumbers.forEach(num => { const box = document.createElement('div'); box.className = 'mt-number-box'; box.textContent = num; numbersEl.appendChild(box); });
            getEl('mt-answer-area').classList.add('hidden');
            getEl('mt-show-answer').textContent = '答えを見る';
        },
        showAnswer: () => {
            const answerArea = getEl('mt-answer-area');
            if(!answerArea.classList.contains('hidden')){
                answerArea.classList.add('hidden');
                getEl('mt-show-answer').textContent = '答えを見る'; return;
            }
            const solutions = mt.solve(mt.currentNumbers);
            const listEl = getEl('mt-answer-list');
            listEl.innerHTML = '';
            if (solutions.length > 0) {
                solutions.forEach(sol => { const li = document.createElement('li'); li.textContent = sol; listEl.appendChild(li); });
            } else {
                const li = document.createElement('li'); li.textContent = 'この難易度では解けません'; listEl.appendChild(li);
            }
            answerArea.classList.remove('hidden');
            getEl('mt-show-answer').textContent = '答えを隠す';
        },
        solve: (numbers) => {
            let solutions = new Set();
            const permute = (arr, l, r) => {
                if (l === r) {
                    const results = mt.calculate([...arr]);
                    results.forEach(res => solutions.add(res));
                } else {
                    for (let i = l; i <= r; i++) {
                        [arr[l], arr[i]] = [arr[i], arr[l]];
                        permute(arr, l + 1, r);
                        [arr[l], arr[i]] = [arr[i], arr[l]];
                    }
                }
            };
            permute(numbers, 0, numbers.length - 1);
            return Array.from(solutions);
        },
        calculate: (nums) => {
            const operators = {'easiest': ['+', '-'], 'easy': ['+', '-'], 'hard': ['+', '-', '*', '/']}[mt.difficulty];
            const results = [];
            const performOp = (a, op, b) => {
                if (op === '+') return a + b;
                if (op === '-') return a - b;
                if (op === '*') return a * b;
                if (op === '/') return b !== 0 ? a / b : NaN;
                return NaN;
            };

            for (const op1 of operators) for (const op2 of operators) for (const op3 of operators) {
                // ((a op1 b) op2 c) op3 d
                let val_b = performOp(nums[0], op1, nums[1]);
                if (mt.difficulty === 'easiest' && val_b < 0) continue;
                if (isNaN(val_b)) continue;
                let val_c = performOp(val_b, op2, nums[2]);
                if (mt.difficulty === 'easiest' && val_c < 0) continue;
                if (isNaN(val_c)) continue;
                let val_d = performOp(val_c, op3, nums[3]);
                if (Math.abs(val_d - 10) < 1e-9) results.push(`((${nums[0]}${op1}${nums[1]})${op2}${nums[2]})${op3}${nums[3]}`);

                // (a op1 b) op2 (c op3 d)
                let v1 = performOp(nums[0], op1, nums[1]);
                if (mt.difficulty === 'easiest' && v1 < 0) continue;
                if (isNaN(v1)) continue;
                let v2 = performOp(nums[2], op3, nums[3]);
                if (mt.difficulty === 'easiest' && v2 < 0) continue;
                if (isNaN(v2)) continue;
                
                let res = performOp(v1, op2, v2);
                 if (Math.abs(res - 10) < 1e-9) results.push(`(${nums[0]}${op1}${nums[1]})${op2}(${nums[2]}${op3}${nums[3]})`);
            }
            return results.filter(res => !res.includes('NaN'));
        }
    };
    getEl('mt-draw').addEventListener('click', mt.draw);
    getEl('mt-show-answer').addEventListener('click', mt.showAnswer);

    const settings = {
        activeGame: 'ワードスナイパー', activeSubKey: 'normal',
        init: () => { settings.switchTab('ワードスナイパー'); },
        renderList: () => { const listEl = getEl('settings-list'); listEl.innerHTML = ''; const listData = settings.activeSubKey ? themes[settings.activeGame][settings.activeSubKey] : themes[settings.activeGame]; if(!listData) return; if(settings.activeGame === 'ワードウルフ') { listData.forEach((theme, index) => { const li = document.createElement('li'); li.innerHTML = `<span class="theme-text">${theme.join(' / ')}</span><div class="theme-actions"><button data-index="${index}" class="edit-btn">編集</button><button data-index="${index}" class="delete-btn">削除</button></div>`; listEl.appendChild(li); }); } else { listData.forEach((theme, index) => { const li = document.createElement('li'); li.innerHTML = `<span class="theme-text">${theme}</span><div class="theme-actions"><button data-index="${index}" class="edit-btn">編集</button><button data-index="${index}" class="delete-btn">削除</button></div>`; listEl.appendChild(li); }); } },
        switchTab: (gameName) => {
            settings.activeGame = gameName; document.querySelectorAll('#settings-tabs .tab-button').forEach(btn => btn.classList.toggle('active', btn.dataset.game === gameName));
            const subTabsContainer = getEl('settings-sub-tabs'); const gameData = themes[gameName];
            if (!gameData || Array.isArray(gameData) || (gameName === 'ワードウルフ') || (gameName === 'クイズいいセン行きまSHOW！')) { subTabsContainer.classList.add('hidden'); settings.activeSubKey = null; } else {
                subTabsContainer.classList.remove('hidden'); subTabsContainer.innerHTML = ''; const keys = Object.keys(gameData);
                keys.forEach(key => { const btn = document.createElement('button'); btn.className = 'sub-tab-button'; btn.dataset.key = key; btn.textContent = {normal: 'ノーマル', kids: 'キッズ', special: '特殊お題', events: 'イベント', items: 'アイテム'}[key] || key; subTabsContainer.appendChild(btn); });
                settings.switchSubTab(keys[0]); return;
            }
            settings.renderList();
        },
        switchSubTab: (key) => { settings.activeSubKey = key; document.querySelectorAll('#settings-sub-tabs .sub-tab-button').forEach(btn => btn.classList.toggle('active', btn.dataset.key === key)); settings.renderList(); },
        saveThemes: () => { localStorage.setItem('bodoge-themes-v4.5', JSON.stringify(themes)); },
        addNewTheme: () => { const input = getEl('new-theme-input'); const newTheme = input.value.trim(); if (newTheme) { const listData = settings.activeSubKey ? themes[settings.activeGame][settings.activeSubKey] : themes[settings.activeGame]; if(!listData) return; if(settings.activeGame === 'ワードウルフ'){ if(newTheme.split(/[,\s/]+/).length !== 2) { alert('「単語1, 単語2」のように、2つの単語をカンマやスペースで区切って入力してください。'); return; } listData.push(newTheme.split(/[,\s/]+/)); } else { listData.push(newTheme); } settings.saveThemes(); settings.renderList(); input.value = ''; } },
        editTheme: (index) => { const listData = settings.activeSubKey ? themes[settings.activeGame][settings.activeSubKey] : themes[settings.activeGame]; if(!listData) return; const oldTheme = settings.activeGame === 'ワードウルフ' ? listData[index].join(', ') : listData[index]; const newTheme = prompt('編集してください:', oldTheme); if (newTheme && newTheme.trim() !== oldTheme) { if(settings.activeGame === 'ワードウルフ'){ if(newTheme.split(/[,\s/]+/).length !== 2) { alert('「単語1, 単語2」のように、2つの単語をカンマやスペースで区切って入力してください。'); return; } listData[index] = newTheme.split(/[,\s/]+/); } else { listData[index] = newTheme.trim(); } settings.saveThemes(); settings.renderList(); } },
        deleteTheme: (index) => { const listData = settings.activeSubKey ? themes[settings.activeGame][settings.activeSubKey] : themes[settings.activeGame]; if(!listData) return; const themeText = settings.activeGame === 'ワードウルフ' ? listData[index].join(' / ') : listData[index]; if (confirm(`「${themeText}」を削除しますか？`)) { listData.splice(index, 1); settings.saveThemes(); settings.renderList(); } },
        exportCsv: () => { const listData = settings.activeSubKey ? themes[settings.activeGame][settings.activeSubKey] : themes[settings.activeGame]; if(!listData) return; const filename = `${settings.activeGame}${settings.activeSubKey ? '_' + settings.activeSubKey : ''}.csv`; let csvData; if(settings.activeGame === 'ワードウルフ'){ csvData = listData.map(e => e.join(",")).join("\n"); } else { csvData = listData.join("\n"); } const bom = '\uFEFF'; const blob = new Blob([bom + csvData], { type: 'text/csv;charset=utf-8;' }); const url = URL.createObjectURL(blob); const link = document.createElement("a"); link.setAttribute("href", url); link.setAttribute("download", filename); document.body.appendChild(link); link.click(); document.body.removeChild(link); URL.revokeObjectURL(url); },
        importCsv: (e) => { const file = e.target.files[0]; if (!file) return; const reader = new FileReader(); reader.onload = (event) => { const listData = settings.activeSubKey ? themes[settings.activeGame][settings.activeSubKey] : themes[settings.activeGame]; if(!listData) return; const currentThemes = new Set(listData.map(t => settings.activeGame === 'ワードウルフ' ? t.join(',') : t)); const newThemesRaw = event.target.result.split(/\r\n|\n/).filter(line => line.trim() !== ''); let addedCount = 0; newThemesRaw.forEach(theme => { if(settings.activeGame === 'ワードウルフ'){ const pair = theme.split(','); if(pair.length === 2 && !currentThemes.has(pair.join(','))){ listData.push(pair.map(p => p.trim())); addedCount++; } } else { const trimmedTheme = theme.trim(); if (trimmedTheme && !currentThemes.has(trimmedTheme)) { listData.push(trimmedTheme); addedCount++; } } }); settings.saveThemes(); alert(`${addedCount}件の新しいお題を追加しました！`); settings.renderList(); }; reader.readAsText(file); e.target.value = ''; }
    };
    document.querySelectorAll('#settings-tabs .tab-button').forEach(btn => btn.addEventListener('click', () => settings.switchTab(btn.dataset.game)));
    getEl('settings-sub-tabs').addEventListener('click', e => { if(e.target.classList.contains('sub-tab-button')) settings.switchSubTab(e.target.dataset.key) });
    getEl('add-theme-button').addEventListener('click', settings.addNewTheme);
    getEl('settings-list').addEventListener('click', e => { if (e.target.classList.contains('edit-btn')) settings.editTheme(e.target.dataset.index); if (e.target.classList.contains('delete-btn')) settings.deleteTheme(e.target.dataset.index); });
    getEl('csv-export').addEventListener('click', settings.exportCsv);
    getEl('csv-import').addEventListener('change', settings.importCsv);
    document.querySelectorAll('.number-input-wrapper .minus').forEach(btn => btn.addEventListener('click', e => { const input = e.target.nextElementSibling; input.stepDown(); input.dispatchEvent(new Event('change')); }));
    document.querySelectorAll('.number-input-wrapper .plus').forEach(btn => btn.addEventListener('click', e => { const input = e.target.previousElementSibling; input.stepUp(); input.dispatchEvent(new Event('change')); }));

    loadThemes();
    getEl('page-top').classList.add('active');

    // ひらがなモードの切り替え
    const hiraganaMode = {
        enabled: false,
        textMap: {
            'オフラインで遊ぶ（ツール）': 'オフラインであそぶ（ツール）',
            'オンラインで対戦': 'オンラインでたいせん',
            '戻る': 'もどる',
            'どのゲーム？': 'どのゲーム？',
            'ゲーム開始': 'ゲームかいし',
            '次のカードをめくる': 'つぎのカードをめくる',
            '次のお題へ': 'つぎのおだいへ',
            '次のラウンド': 'つぎのラウンド',
            'もう一度遊ぶ': 'もういちどあそぶ',
            '参加人数': 'さんかにんずう',
            'スコア': 'スコア',
            'プレイヤー': 'プレイヤー',
            'お題': 'おだい',
            '文字': 'もじ',
            '設定': 'せってい',
            '各': 'かく',
            '指定': 'してい',
            '単語': 'たんご',
            '含': 'ふく',
            '言': 'い',
            '回答': 'かいとう',
            '連想': 'れんそう',
            '協力': 'きょうりょく',
            '全員': 'ぜんいん',
            '順番': 'じゅんばん',
            '数字': 'すうじ',
            '並': 'なら',
            '説明': 'せつめい',
            '使': 'つか',
            '乗': 'の',
            '切': 'き',
            '抜': 'ぬ',
            '役割': 'やくわり',
            '与': 'あた',
            '見破': 'みやぶ',
            '話': 'はな',
            '合': 'あ',
            '質問': 'しつもん',
            '範囲': 'はんい',
            '自由': 'じゆう',
            '数': 'かず',
            '枚': 'まい',
            '計算': 'けいさん',
            '式': 'しき',
            '作': 'つく'
        },
        toggle() {
            this.enabled = !this.enabled;
            this.apply();
            localStorage.setItem('hiragana-mode', this.enabled);
        },
        apply() {
            document.body.classList.toggle('hiragana-mode', this.enabled);
            if (this.enabled) {
                this.replaceText(document.body);
            } else {
                location.reload();
            }
        },
        replaceText(element) {
            const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT, null, false);
            const nodesToReplace = [];
            while (walker.nextNode()) {
                nodesToReplace.push(walker.currentNode);
            }
            nodesToReplace.forEach(node => {
                let text = node.nodeValue;
                Object.keys(this.textMap).forEach(key => {
                    text = text.replace(new RegExp(key, 'g'), this.textMap[key]);
                });
                node.nodeValue = text;
            });
        }
    };

    const hiraganaCheckbox = getEl('hiragana-mode-checkbox');
    if (hiraganaCheckbox) {
        const saved = localStorage.getItem('hiragana-mode');
        if (saved === 'true') {
            hiraganaCheckbox.checked = true;
            hiraganaMode.enabled = true;
            hiraganaMode.apply();
        }
        hiraganaCheckbox.addEventListener('change', () => hiraganaMode.toggle());
    }

    // ルール説明ボタンのイベントハンドラー
    const gameRules = {
        'word-sniper': 'ワードスナイパー\n\nお題に合った言葉を、指定された文字で始まる言葉で答えるゲームです。\n\n1. お題と文字が表示されます\n2. その文字で始まる、お題に合った言葉を考えます\n3. 一番早く答えた人が得点します',
        'ito': 'I T O\n\n1～100の数字を使って、テーマに沿った大きさを表現するゲームです。\n\n1. 各プレイヤーに1～100の数字が配られます\n2. テーマが発表されます\n3. 自分の数字の大きさをテーマに例えて表現します\n4. 全員で数字の小さい順に並べます',
        'bob-jiten': 'ボブジテン\n\nカタカナ語を、カタカナを使わずに説明するゲームです。\n\n1. お題のカタカナ語が表示されます\n2. カタカナを一切使わずに説明します\n3. 他のプレイヤーが当てたら得点',
        'cat-choco': 'キャット＆チョコレート\n\nピンチな状況を、配られたアイテムで切り抜けるゲームです。\n\n1. イベント（ピンチな状況）が発表されます\n2. 必要なアイテム数が表示されます\n3. 手札のアイテムを使って、どう切り抜けるか説明します',
        'stack-ttt': 'スタック三目並べ\n\n駒を重ねられる三目並べです。\n\n1. 各プレイヤーはS・M・Lサイズの駒を2個ずつ持っています\n2. 大きい駒は小さい駒の上に重ねて置けます\n3. 先に縦・横・斜めに3つ並べた方の勝ち',
        'word-wolf': 'ワードウルフ\n\n違うお題を持つ少数派を見つけるゲームです。\n\n1. 各プレイヤーにお題が配られます（1人だけ違うお題）\n2. 制限時間内で自分のお題について話し合います\n3. 投票で少数派（ウルフ）を当てます',
        'quiz-iisen': 'いいセン行きまSHOW！\n\n答えが数字の問題で、みんなの答えの中央値を当てるゲームです。\n\n1. お題が発表されます\n2. 各プレイヤーが数字で答えます\n3. 中央値に一番近い人が得点',
        'make-ten': '10パズル\n\n4つの数字を使って、答えが10になる式を作るゲームです。\n\n1. 4つの数字が表示されます\n2. すべての数字を1回ずつ使います\n3. 四則演算（+、-、×、÷）で答えが10になる式を作ります',
        'battle-line': 'バトルライン\n\n9つの戦場で部隊カードを配置し、過半数の戦場を確保するゲームです。\n\n1. 各戦場に3枚ずつカードを配置します\n2. 色と数字で役を作ります（ストレート、フラッシュなど）\n3. 役の強さで戦場を確保し、5つ以上または連続する3つを取れば勝利'
    };

    document.querySelectorAll('.rule-button').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const gameKey = btn.dataset.game;
            const rule = gameRules[gameKey];
            if (rule) {
                alert(rule);
            }
        });
    });
});