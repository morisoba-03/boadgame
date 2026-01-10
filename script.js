// =============================================
//  みんなのボドゲ - アプリケーションスクリプト (v4.5)
// =============================================

document.addEventListener('DOMContentLoaded', () => {
    const getEl = (id) => document.getElementById(id);
    const shuffle = (array) => [...array].sort(() => Math.random() - 0.5);
    let themes = {};

    // ひらがなモードでも使える「漢字なし」デフォルト（カタカナ/英語はそのままでOK）
    const DEFAULT_NG_WORDS = [
        'やきにく', 'YouTuber', 'はつこい', 'せいじ', 'きんにく', 'タピオカ', 'おし', 'てんしょく', 'しつれん', 'いぬ',
        'ねこ', 'スマホ', 'おふろ', 'きゅうしょく', 'ぶかつ', 'しゅくだい', 'ゲーム', 'マンガ', 'アニメ', 'りょこう',
        'クリスマス', 'しょうがつ', 'はなび', 'おんせん', 'カラオケ', 'すし', 'ラーメン', 'コーヒー', 'しょうぎ', 'サッカー',
        'やきゅう', 'えいが', 'アイドル', 'オムライス', 'ピザ'
    ];

    function ensureNgWordThemes() {
        if (!themes || typeof themes !== 'object') return;
        const existing = themes['ng-word'];
        if (Array.isArray(existing) && existing.length) return;
        themes['ng-word'] = [...DEFAULT_NG_WORDS];
    }

    const pages = document.querySelectorAll('.page');
    document.body.addEventListener('click', (e) => {
        const button = e.target.closest('button[data-goto]');
        if (button) {
            const pageId = button.dataset.goto;

            const currentActive = document.querySelector('.page.active');
            const currentPageId = currentActive ? currentActive.id : null;
            if (currentPageId === 'page-ng-word' && pageId !== 'page-ng-word') {
                try { if (ngw && ngw.game) ngw.game.stopTimer(); } catch (_) {}
            }

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
                'page-ng-word': () => ngw.init(),
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
                ensureNgWordThemes();
            } catch (e) {
                console.error("Failed to load themes, falling back to initial data.", e);
                themes = JSON.parse(JSON.stringify(initialThemes));
                ensureNgWordThemes();
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

    // =========================
    // NGワードゲーム
    // =========================
    class NgWordGame {
        constructor(container) {
            this.container = container;
            this.timerId = null;
            this.endAt = 0;
            this.durationSec = 180;
            this.bound = false;
            this.resetAll();
        }

        resetAll() {
            this.playerA = localStorage.getItem('ngw-playerA') || 'Player A';
            this.playerB = localStorage.getItem('ngw-playerB') || 'Player B';
            this.mode = null;
            this.ngWordA = '';
            this.ngWordB = '';
            this.winner = null;
        }

        getWordList() {
            const list = themes && Array.isArray(themes['ng-word']) ? themes['ng-word'] : null;
            const cleaned = Array.isArray(list) ? list.map((x) => String(x).trim()).filter(Boolean) : [];
            return cleaned.length ? cleaned : [...DEFAULT_NG_WORDS];
        }

        init() {
            if (!this.container) return;
            this.stopTimer();
            this.resetAll();
            this.bindEventsOnce();
            this.renderMode();
        }

        bindEventsOnce() {
            if (this.bound) return;
            this.bound = true;
            this.container.addEventListener('click', (e) => {
                const btn = e.target.closest('button[data-action]');
                if (!btn) return;
                e.preventDefault();
                this.handleAction(String(btn.dataset.action || ''));
            });
        }

        escapeHtml(s) {
            return String(s)
                .replaceAll('&', '&amp;')
                .replaceAll('<', '&lt;')
                .replaceAll('>', '&gt;')
                .replaceAll('"', '&quot;')
                .replaceAll("'", '&#39;');
        }

        formatTime(sec) {
            const s = Math.max(0, Math.floor(sec));
            const m = String(Math.floor(s / 60)).padStart(2, '0');
            const r = String(s % 60).padStart(2, '0');
            return `${m}:${r}`;
        }

        pickTwoWords() {
            const pool = this.getWordList();
            if (pool.length < 2) return ['(候補不足)','(候補不足)'];
            const shuffled = shuffle(pool);
            return [shuffled[0], shuffled[1]];
        }

        pickOneExcluding(excludeSet) {
            const pool = this.getWordList();
            const candidates = pool.filter(w => !excludeSet.has(w));
            if (candidates.length === 0) return null;
            return candidates[Math.floor(Math.random() * candidates.length)];
        }

        passReveal(which) {
            if (this.mode !== 'random') {
                alert('パスはランダムモードでのみ使えます。');
                return;
            }
            const pool = this.getWordList();
            if (pool.length < 2) {
                alert('NGワード候補が不足しています。\n設定 > NGワード で追加してください。');
                return;
            }

            // which=A は Aが「BのNGワード」を見ている（= ngWordB を変更）
            const targetKey = which === 'A' ? 'ngWordB' : 'ngWordA';
            const keepKey = which === 'A' ? 'ngWordA' : 'ngWordB';
            const current = this[targetKey];
            const keep = this[keepKey];

            const exclude = new Set([current, keep]);
            const next = this.pickOneExcluding(exclude);

            if (!next) {
                // 候補が2件しかない場合は入れ替えで「別のお題」を実現する
                if (pool.length === 2 && this.ngWordA && this.ngWordB && this.ngWordA !== this.ngWordB) {
                    const tmp = this.ngWordA;
                    this.ngWordA = this.ngWordB;
                    this.ngWordB = tmp;
                    this.renderReveal(which);
                    return;
                }
                alert('別のお題にできません（候補不足）。\n設定 > NGワード で候補を増やしてください。');
                return;
            }

            this[targetKey] = next;
            this.renderReveal(which);
        }

        setDurationFromUi() {
            const minutesEl = this.container.querySelector('#ngw-minutes');
            const minutes = minutesEl ? parseInt(minutesEl.value, 10) : 3;
            const m = Number.isFinite(minutes) ? Math.max(1, Math.min(60, minutes)) : 3;
            this.durationSec = m * 60;
        }

        handleAction(action) {
            if (action === 'minus-minutes') {
                const input = this.container.querySelector('#ngw-minutes');
                if (input) input.stepDown();
                return;
            }
            if (action === 'plus-minutes') {
                const input = this.container.querySelector('#ngw-minutes');
                if (input) input.stepUp();
                return;
            }

            if (action === 'pass-reveal-A') {
                this.passReveal('A');
                return;
            }
            if (action === 'pass-reveal-B') {
                this.passReveal('B');
                return;
            }

            const aNameInput = this.container.querySelector('#ngw-player-a');
            const bNameInput = this.container.querySelector('#ngw-player-b');
            const aName = (aNameInput ? aNameInput.value : this.playerA).trim() || 'Player A';
            const bName = (bNameInput ? bNameInput.value : this.playerB).trim() || 'Player B';
            this.playerA = aName;
            this.playerB = bName;
            localStorage.setItem('ngw-playerA', this.playerA);
            localStorage.setItem('ngw-playerB', this.playerB);

            if (action === 'start-random') {
                this.mode = 'random';
                this.setDurationFromUi();
                const list = this.getWordList();
                if (list.length < 2) {
                    alert('NGワード候補が2件以上必要です。\n設定 > NGワード で追加してください。');
                    return;
                }
                const [a, b] = this.pickTwoWords();
                this.ngWordA = a;
                this.ngWordB = b;
                this.renderReveal('A');
                return;
            }

            if (action === 'start-custom') {
                this.mode = 'custom';
                this.setDurationFromUi();
                this.renderCustom('A');
                return;
            }

            if (action === 'custom-a-done') {
                const input = this.container.querySelector('#ngw-custom-a');
                const word = (input ? input.value : '').trim();
                if (!word) {
                    alert('NGワードを入力してください');
                    return;
                }
                this.ngWordB = word;
                this.renderCustom('B');
                return;
            }

            if (action === 'custom-b-done') {
                const input = this.container.querySelector('#ngw-custom-b');
                const word = (input ? input.value : '').trim();
                if (!word) {
                    alert('NGワードを入力してください');
                    return;
                }
                this.ngWordA = word;
                this.renderReveal('A');
                return;
            }

            if (action === 'reveal-next-A') {
                this.renderReveal('B');
                return;
            }
            if (action === 'reveal-next-B') {
                this.renderPlay();
                return;
            }

            if (action === 'begin-talk') {
                this.startTimer();
                return;
            }

            if (action === 'win-A') {
                this.winner = 'A';
                this.stopTimer();
                this.renderResult();
                return;
            }
            if (action === 'win-B') {
                this.winner = 'B';
                this.stopTimer();
                this.renderResult();
                return;
            }

            if (action === 'reset') {
                this.init();
                return;
            }
        }

        renderMode() {
            const canRandom = this.getWordList().length >= 2;
            this.container.innerHTML = `
                <div class="card">
                    <div class="card-title">モード選択</div>
                    <p style="font-size:1rem; font-family:sans-serif;">2人用の会話ゲームです。自分のNGワードは見えず、相手のNGワードだけ確認してから会話します。</p>
                </div>

                <div class="card">
                    <div class="card-title">プレイヤー名</div>
                    <div style="display:flex; gap:0.5rem; justify-content:center; flex-wrap:wrap; font-family:sans-serif;">
                        <input id="ngw-player-a" type="text" value="${this.escapeHtml(this.playerA)}" style="width:10rem; font-size:1.1rem;" autocomplete="off" />
                        <input id="ngw-player-b" type="text" value="${this.escapeHtml(this.playerB)}" style="width:10rem; font-size:1.1rem;" autocomplete="off" />
                    </div>
                    <p style="font-size:0.85rem; font-family:sans-serif;">名前は端末に保存されます。</p>
                </div>

                <div class="card">
                    <div class="card-title">タイマー</div>
                    <div class="number-input-wrapper">
                        <button class="num-btn minus" type="button" data-action="minus-minutes">-</button>
                        <input type="number" id="ngw-minutes" min="1" max="60" value="3">
                        <button class="num-btn plus" type="button" data-action="plus-minutes">+</button>
                    </div>
                    <p style="font-size:0.9rem; font-family:sans-serif; margin-top:0.5rem;">分</p>
                </div>

                <button class="main-button" data-action="start-random" ${canRandom ? '' : 'disabled'}>${canRandom ? 'ランダムで開始' : 'ランダム（候補不足）'}</button>
                ${canRandom ? '' : '<p style="font-size:0.85rem; font-family:sans-serif;">※ 設定 > NGワード に2件以上追加してください</p>'}
                <button class="main-button" data-action="start-custom">カスタムで開始</button>
            `;

            if (hiraganaMode && hiraganaMode.enabled) hiraganaMode.applyIncremental(this.container);
        }

        renderCustom(which) {
            const title = which === 'A' ? `${this.playerA} → ${this.playerB} のNGワード` : `${this.playerB} → ${this.playerA} のNGワード`;
            const inputId = which === 'A' ? 'ngw-custom-a' : 'ngw-custom-b';
            const action = which === 'A' ? 'custom-a-done' : 'custom-b-done';
            this.container.innerHTML = `
                <div class="card">
                    <div class="card-title">カスタム入力</div>
                    <p style="font-size:1rem; font-family:sans-serif;">${this.escapeHtml(title)}</p>
                    <input id="${inputId}" type="password" style="width:80%; font-size:1.2rem;" autocomplete="off" />
                </div>
                <button class="main-button" data-action="${action}">決定</button>
                <button class="sub-button" data-action="reset">最初に戻る</button>
            `;

            if (hiraganaMode && hiraganaMode.enabled) hiraganaMode.applyIncremental(this.container);
        }

        renderReveal(which) {
            const viewer = which === 'A' ? this.playerA : this.playerB;
            const word = which === 'A' ? this.ngWordB : this.ngWordA;
            const action = which === 'A' ? 'reveal-next-A' : 'reveal-next-B';
            const passAction = which === 'A' ? 'pass-reveal-A' : 'pass-reveal-B';
            this.container.innerHTML = `
                <div class="card">
                    <div class="card-title">確認</div>
                    <p style="font-size:1rem; font-family:sans-serif;">${this.escapeHtml(viewer)} さんが確認します</p>
                    <p style="font-size:1rem; font-family:sans-serif;">相手のNGワード：</p>
                    <p class="large-text">「${this.escapeHtml(word)}」</p>
                    <p style="font-size:0.85rem; font-family:sans-serif;">※ 自分のNGワードは見えません</p>
                </div>
                ${this.mode === 'random' ? `<button class="sub-button" data-action="${passAction}">パス（別のお題）</button>` : ''}
                <button class="main-button" data-action="${action}">次へ</button>
            `;

            if (hiraganaMode && hiraganaMode.enabled) hiraganaMode.applyIncremental(this.container);
        }

        renderPlay() {
            this.container.innerHTML = `
                <div class="card">
                    <div class="card-title">会話スタート</div>
                    <div id="ngw-timer" class="large-text" style="font-family:monospace; font-size:2.6rem;">${this.formatTime(this.durationSec)}</div>
                    <button class="main-button" data-action="begin-talk">開始</button>
                </div>

                <div class="card">
                    <div class="card-title">勝敗</div>
                    <button class="main-button" data-action="win-A">Aが言わせた（Bの負け）</button>
                    <button class="main-button" data-action="win-B">Bが言わせた（Aの負け）</button>
                    <button class="sub-button" data-action="reset">最初に戻る</button>
                </div>
            `;

            if (hiraganaMode && hiraganaMode.enabled) hiraganaMode.applyIncremental(this.container);
        }

        renderResult() {
            const winnerName = this.winner === 'A' ? this.playerA : this.playerB;
            this.container.innerHTML = `
                <div class="card">
                    <div class="card-title">結果</div>
                    <p class="large-text">勝者：${this.escapeHtml(winnerName)}</p>
                </div>

                <div class="card">
                    <div class="card-title">NGワード公開</div>
                    <p style="font-size:1rem; font-family:sans-serif;">${this.escapeHtml(this.playerA)} のNGワード：</p>
                    <p class="large-text">「${this.escapeHtml(this.ngWordA)}」</p>
                    <p style="font-size:1rem; font-family:sans-serif; margin-top:1rem;">${this.escapeHtml(this.playerB)} のNGワード：</p>
                    <p class="large-text">「${this.escapeHtml(this.ngWordB)}」</p>
                </div>

                <button class="main-button" data-action="reset">もう一度</button>
            `;

            if (hiraganaMode && hiraganaMode.enabled) hiraganaMode.applyIncremental(this.container);
        }

        startTimer() {
            this.stopTimer();
            this.endAt = Date.now() + this.durationSec * 1000;
            const tick = () => {
                const el = this.container.querySelector('#ngw-timer');
                if (!el) return;
                const remain = Math.max(0, Math.ceil((this.endAt - Date.now()) / 1000));
                el.textContent = this.formatTime(remain);
                if (remain <= 0) this.stopTimer();
            };
            tick();
            this.timerId = setInterval(tick, 250);
        }

        stopTimer() {
            if (this.timerId) {
                clearInterval(this.timerId);
                this.timerId = null;
            }
        }
    }

    const ngw = {
        id: 'page-ng-word',
        game: null,
        init: () => {
            ensureNgWordThemes();
            if (!ngw.game) ngw.game = new NgWordGame(getEl('game-container'));
            ngw.game.init();
        }
    };
    gameModules[ngw.id] = ngw;

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
        observer: null,
        applyTimerId: null,
        // 「完全変換」ではなく、確実に“漢字を表示しない”ためのフィルタです。
        // 変換できない漢字は（かんじ）に置換します。
        replaceKanjiRuns(text) {
            // CJK統合漢字 + 互換漢字を「（かんじ）」に。
            // 連続をまとめて置換して、読めない漢字が大量に並ぶのを防ぐ。
            return String(text).replace(/[\u3400-\u9FFF\uF900-\uFAFF]+/g, '（かんじ）');
        },
        normalizeText(text) {
            let t = String(text);
            Object.keys(this.textMap).forEach(key => {
                t = t.replace(new RegExp(key, 'g'), this.textMap[key]);
            });
            t = this.replaceKanjiRuns(t);
            return t;
        },
        replaceAttributes(root) {
            if (!root || !root.querySelectorAll) return;
            // placeholder / title / aria-label など「説明テキスト」に漢字が残りやすいので対象にする
            const targets = root.querySelectorAll('[placeholder], [title], [aria-label]');
            targets.forEach((el) => {
                if (el.hasAttribute('placeholder')) {
                    const v = el.getAttribute('placeholder');
                    const nv = this.normalizeText(v);
                    if (nv !== v) el.setAttribute('placeholder', nv);
                }
                if (el.hasAttribute('title')) {
                    const v = el.getAttribute('title');
                    const nv = this.normalizeText(v);
                    if (nv !== v) el.setAttribute('title', nv);
                }
                if (el.hasAttribute('aria-label')) {
                    const v = el.getAttribute('aria-label');
                    const nv = this.normalizeText(v);
                    if (nv !== v) el.setAttribute('aria-label', nv);
                }
            });
        },
        textMap: {
            'オフラインで遊ぶ（ツール）': 'オフラインであそぶ（ツール）',
            'オンラインで対戦': 'オンラインでたいせん',
            '戻る': 'もどる',
            'どのゲーム？': 'どのゲーム？',
            'ゲーム開始': 'ゲームかいし',
            '次のカードをめくる': 'つぎのカードをめくる',
            '次のお題へ': 'つぎのおだいへ',
            '次の問題': 'つぎのもんだい',
            '次のラウンド': 'つぎのラウンド',
            'もう一度遊ぶ': 'もういちどあそぶ',
            '参加人数': 'さんかにんずう',
            'プレイ人数': 'プレイにんずう',
            'スコア': 'スコア',
            'プレイヤー': 'プレイヤー',
            'プレイヤー名': 'プレイヤーめい',

            '議論時間': 'ぎろんじかん',
            '結果発表': 'けっかはっぴょう',
            '勝者': 'しょうしゃ',
            '結果': 'けっか',
            '勝敗': 'しょうはい',
            '開始': 'かいし',
            '会話': 'かいわ',
            '公開': 'こうかい',

            '確認': 'かくにん',
            '確認します': 'かくにんします',
            '決定': 'けってい',
            '次へ': 'つぎへ',
            '最初に戻る': 'さいしょにもどる',

            'お題の管理': 'おだいのかんり',
            '追加': 'ついか',
            '編集': 'へんしゅう',
            '削除': 'さくじょ',
            '入出力': 'にゅうしゅつりょく',

            '候補不足': 'こうほぶそく',
            '設定': 'せってい',
            'モード選択': 'モードせんたく',

            // 既存のざっくり置換（完全なひらがな化ではありません）
            '文字': 'もじ',
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
            '作': 'つく',
            '各': 'かく',
            '指定': 'してい'
        },
        toggle() {
            this.enabled = !this.enabled;
            this.apply();
            localStorage.setItem('hiragana-mode', this.enabled);
        },
        apply() {
            document.body.classList.toggle('hiragana-mode', this.enabled);
            if (this.enabled) {
                this.startObserver();
                this.replaceText(document.body);
                this.replaceAttributes(document.body);
            } else {
                this.stopObserver();
                location.reload();
            }
        },
        applyIncremental(root) {
            if (!this.enabled) return;
            this.replaceText(root);
            this.replaceAttributes(root);
        },
        scheduleApply() {
            if (!this.enabled) return;
            if (this.applyTimerId) return;
            this.applyTimerId = setTimeout(() => {
                this.applyTimerId = null;
                this.replaceText(document.body);
                this.replaceAttributes(document.body);
            }, 50);
        },
        startObserver() {
            if (this.observer) return;
            this.observer = new MutationObserver(() => this.scheduleApply());
            this.observer.observe(document.body, { childList: true, subtree: true, characterData: true });
        },
        stopObserver() {
            if (!this.observer) return;
            this.observer.disconnect();
            this.observer = null;
            if (this.applyTimerId) {
                clearTimeout(this.applyTimerId);
                this.applyTimerId = null;
            }
        },
        replaceText(element) {
            const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT, null, false);
            const nodesToReplace = [];
            while (walker.nextNode()) {
                nodesToReplace.push(walker.currentNode);
            }
            nodesToReplace.forEach(node => {
                node.nodeValue = this.normalizeText(node.nodeValue);
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
        'ng-word': 'NGワードゲーム\n\n2人用の会話ゲームです。\n\n1. 相手が言ってはいけない言葉（NGワード）をそれぞれ設定します（ランダム/カスタム）。\n2. 確認フェーズで、自分は相手のNGワードだけ確認します（自分のNGワードは見えません）。\n3. 会話を開始し、相手に自分のNGワードを言わせたら勝ちです。',
        'battle-line': 'バトルライン\n\n9つの戦場で部隊カードを配置し、過半数の戦場を確保するゲームです。\n\n1. 各戦場に3枚ずつカードを配置します\n2. 色と数字で役を作ります（ストレート、フラッシュなど）\n3. 役の強さで戦場を確保し、5つ以上または連続する3つを取れば勝利'
    };

    document.querySelectorAll('.rule-button').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const gameKey = btn.dataset.game;
            const rule = gameRules[gameKey];
            if (rule) {
                const shown = (hiraganaMode && hiraganaMode.enabled)
                    ? hiraganaMode.normalizeText(rule)
                    : rule;
                alert(shown);
            }
        });
    });
});