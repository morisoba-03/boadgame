// =============================================
//  みんなのボドゲ - アプリケーションスクリプト (v5.0)
// =============================================

document.addEventListener('DOMContentLoaded', () => {
    const getEl = (id) => document.getElementById(id);

    // Fisher-Yates。sort(() => Math.random() - 0.5) は分布が偏るため使わない。
    const shuffle = (array) => {
        const a = [...array];
        for (let i = a.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [a[i], a[j]] = [a[j], a[i]];
        }
        return a;
    };
    // 1件だけ引くときに全体をシャッフルしないための入口。
    const pickOne = (array) => (Array.isArray(array) && array.length > 0)
        ? array[Math.floor(Math.random() * array.length)]
        : null;

    const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (c) => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));

    const containsKanji = (text) => /[\u3400-\u4DBF\u4E00-\u9FFF]/.test(String(text || ''));
    const HIRAGANA_MODE_UNAVAILABLE_TEXT = 'ひらがなもーどでは ひょうじできない おだいです';

    // hiraganaMode は下で定義されるが、呼ばれるのは常に定義後なので遅延参照で足りる。
    const isKana = () => hiraganaMode.enabled;
    const byMode = (normalText, hiraganaText) => (isKana() ? hiraganaText : normalText);

    const alertByMode = (normalText, hiraganaText) => alert(byMode(normalText, hiraganaText));
    const confirmByMode = (normalText, hiraganaText) => confirm(byMode(normalText, hiraganaText));

    const pickNoKanji = (list, predicate = () => true) => {
        if (!Array.isArray(list)) return null;
        const filtered = list.filter(item => {
            if (!predicate(item)) return false;
            if (Array.isArray(item)) return item.every(v => !containsKanji(v));
            return !containsKanji(item);
        });
        return pickOne(filtered);
    };

    // ひらがなモードなら漢字を含まないお題だけを、そうでなければ全体から1件引く。
    const drawTopic = (list) => (isKana() ? pickNoKanji(list) : pickOne(list)) ?? null;

    // 既存ユーザーのお題を失わないよう、キー名は v4.5 時代のまま据え置く。
    const THEME_STORAGE_KEY = 'bodoge-themes-v4.5';
    const SCORE_STORAGE_KEY = 'bodoge-scores-v5';
    const HIRAGANA_STORAGE_KEY = 'hiragana-mode';

    let themes = {};

    const pages = document.querySelectorAll('.page');

    // 画面を離れても setInterval が回り続けないよう、遷移のたびに全タイマーを止める。
    const timerOwners = [];
    const registerTimerOwner = (owner) => timerOwners.push(owner);
    const stopAllTimers = () => timerOwners.forEach(owner => {
        try { owner.stopTimer(); } catch (e) { console.warn('Failed to stop a timer.', e); }
    });

    const showPage = (pageId) => {
        const target = getEl(pageId);
        if (!target) {
            console.error(`Unknown page id: ${pageId}`);
            return false;
        }
        stopAllTimers();
        pages.forEach(p => p.classList.remove('active'));
        target.classList.add('active');
        target.scrollTop = 0;
        window.scrollTo(0, 0);
        return true;
    };

    document.body.addEventListener('click', (e) => {
        const button = e.target.closest('button[data-goto]');
        if (button) {
            const pageId = button.dataset.goto;
            if (!showPage(pageId)) return;
            const initFuncs = {
                'page-ws-mode-select': () => {},
                'page-word-sniper': () => ws.init(button.dataset.mode),
                'page-ito': () => ito.init(),
                'page-bob-jiten-mode-select': () => {},
                'page-bob-jiten': () => bj.init(button.dataset.mode),
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
            const storedThemes = localStorage.getItem(THEME_STORAGE_KEY);
            const loadedFromStorage = !!storedThemes;
            let repaired = false;
            try {
                const parsed = storedThemes ? JSON.parse(storedThemes) : JSON.parse(JSON.stringify(initialThemes));
                if (!parsed || typeof parsed !== 'object') throw new Error('Stored themes are not an object');

                // 欠けているゲームだけ初期データで補う。壊れた1件で全ユーザーお題を捨てない。
                Object.keys(initialThemes).forEach(key => {
                    const fallback = initialThemes[key];
                    const current = parsed[key];
                    const shapeOk = Array.isArray(fallback)
                        ? Array.isArray(current)
                        : (current && typeof current === 'object' && !Array.isArray(current));
                    if (!shapeOk) {
                        parsed[key] = JSON.parse(JSON.stringify(fallback));
                        repaired = true;
                        console.warn(`Restored missing/invalid theme data for "${key}".`);
                        return;
                    }
                    if (!Array.isArray(fallback)) {
                        Object.keys(fallback).forEach(subKey => {
                            if (!Array.isArray(current[subKey])) {
                                current[subKey] = [...fallback[subKey]];
                                repaired = true;
                                console.warn(`Restored missing theme sub-list "${key}.${subKey}".`);
                            }
                        });
                    }
                });
                themes = parsed;
            } catch (e) {
                console.error("Failed to load themes, falling back to initial data.", e);
                themes = JSON.parse(JSON.stringify(initialThemes));
                repaired = true;
            }
            if (repaired && loadedFromStorage) {
                localStorage.setItem(THEME_STORAGE_KEY, JSON.stringify(themes));
            }

            // NGワードは最低200件を保証（保存済みデータが少ない場合に初期データから補完）
            try {
                const key = 'NGワードゲーム';
                const minCount = 200;
                const current = Array.isArray(themes[key]) ? themes[key] : [];
                const defaults = Array.isArray(initialThemes[key]) ? initialThemes[key] : [];

                const beforeLen = current.length;
                const set = new Set(current);
                defaults.forEach(w => {
                    if (current.length >= minCount) return;
                    if (!set.has(w)) {
                        current.push(w);
                        set.add(w);
                    }
                });
                themes[key] = current;

                const changed = current.length !== beforeLen;
                if (changed && loadedFromStorage) {
                    localStorage.setItem(THEME_STORAGE_KEY, JSON.stringify(themes));
                }
            } catch (e) {
                console.warn('Failed to ensure minimum NG words.', e);
            }
        } else {
            console.error("initialThemes is not defined. Make sure themes.js is loaded.");
            getEl('page-top').innerHTML = '<h1>エラー</h1><p>お題データの読み込みに失敗しました。themes.jsが正しく配置されているか確認してください。</p>';
        }
    }
    
    const gameModules = {};

    getEl('app-container').addEventListener('click', (e) => {
        const page = e.target.closest('.page');
        if (!page) return;
        const game = gameModules[page.id];
        if (!game) return;

        const btn = e.target.closest('.score-btn');
        if (btn) {
            const index = parseInt(btn.dataset.index, 10);
            const delta = parseInt(btn.dataset.delta, 10);
            if (typeof game.updateScore === 'function') game.updateScore(index, delta);
            return;
        }

        // スコアボードの名前タップで改名（CSS の cursor:pointer が示していた動作）。
        const nameEl = e.target.closest('.player-name');
        if (nameEl && typeof game.renamePlayer === 'function') {
            const index = parseInt(nameEl.dataset.index, 10);
            game.renamePlayer(index);
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
                    <span class="player-name" data-index="${index}" role="button" tabindex="0" title="タップで名前を変更">${escapeHtml(player.name)}</span>
                    <span class="player-score">スコア: ${player.score}</span>
                    <div class="score-controls">
                        <button class="score-btn minus" data-index="${index}" data-delta="-1" aria-label="${escapeHtml(player.name)} のスコアを1減らす">–</button>
                        <button class="score-btn plus" data-index="${index}" data-delta="1" aria-label="${escapeHtml(player.name)} のスコアを1増やす">+</button>
                    </div>
                `;
                list.appendChild(item);
            });
            container.appendChild(list);
        },
        update(container, players) {
             players.forEach((player, index) => {
                const row = container.querySelector(`li:nth-child(${index + 1})`);
                if (!row) return;
                const scoreEl = row.querySelector('.player-score');
                if (scoreEl) scoreEl.textContent = `スコア: ${player.score}`;
                const nameEl = row.querySelector('.player-name');
                if (nameEl) nameEl.textContent = player.name;
            });
        }
    };

    // --- スコア永続化と共通スコアボード -------------------------------------
    const readStoredScores = () => {
        try {
            const raw = localStorage.getItem(SCORE_STORAGE_KEY);
            const parsed = raw ? JSON.parse(raw) : {};
            return (parsed && typeof parsed === 'object') ? parsed : {};
        } catch (e) {
            console.warn('Failed to read stored scores.', e);
            return {};
        }
    };
    const writeStoredScores = (gameId, players) => {
        try {
            const all = readStoredScores();
            all[gameId] = players.map(p => ({ name: p.name, score: p.score }));
            localStorage.setItem(SCORE_STORAGE_KEY, JSON.stringify(all));
        } catch (e) {
            console.warn('Failed to store scores.', e);
        }
    };

    // ws/bj/cc/ito/ww/qis で同じだった setupPlayers / updateScore をここに集約する。
    const attachScoreboard = (mod, { countId = null, boardId }) => {
        mod.gameState = mod.gameState || {};
        mod.gameState.players = mod.gameState.players || [];

        const render = () => scoreBoard.create(getEl(boardId), mod.gameState.players);
        const persist = () => writeStoredScores(mod.id, mod.gameState.players);

        // 人数を変えても既存プレイヤーの名前とスコアは維持する。
        mod.setupPlayers = () => {
            const input = countId ? getEl(countId) : null;
            const requested = input ? parseInt(input.value, 10) : mod.gameState.players.length;
            const count = Math.max(1, isNaN(requested) ? 1 : requested);
            const prev = mod.gameState.players;
            mod.gameState.players = Array.from({ length: count }, (_, i) => prev[i] || { name: `プレイヤー${i + 1}`, score: 0 });
            render();
            persist();
        };

        // ページに入り直しただけでスコアが消えないよう、保存済みの状態から復帰する。
        mod.restorePlayers = () => {
            if (mod.gameState.players.length === 0) {
                const saved = readStoredScores()[mod.id];
                if (Array.isArray(saved) && saved.length > 0) {
                    mod.gameState.players = saved
                        .filter(p => p && typeof p === 'object')
                        .map((p, i) => ({ name: String(p.name ?? `プレイヤー${i + 1}`), score: Number(p.score) || 0 }));
                }
            }
            if (countId && mod.gameState.players.length > 0) {
                getEl(countId).value = mod.gameState.players.length;
            }
            mod.setupPlayers();
        };

        mod.setPlayers = (players) => {
            mod.gameState.players = players;
            render();
            persist();
        };

        mod.updateScore = (index, delta) => {
            const player = mod.gameState.players[index];
            if (!player) return;
            player.score += delta;
            scoreBoard.update(getEl(boardId), mod.gameState.players);
            persist();
        };

        mod.renamePlayer = (index) => {
            const player = mod.gameState.players[index];
            if (!player) return;
            const next = prompt(byMode('プレイヤー名を入力してください:', 'なまえを にゅうりょくしてください:'), player.name);
            if (next === null) return;
            const trimmed = next.trim();
            if (!trimmed) return;
            player.name = trimmed;
            render();
            persist();
        };

        mod.resetScores = () => {
            mod.gameState.players.forEach(p => { p.score = 0; });
            scoreBoard.update(getEl(boardId), mod.gameState.players);
            persist();
        };
    };

    const ws = {
        id: 'page-word-sniper',
        topicEl: getEl('ws-topic'), charEl: getEl('ws-char'), headerTitle: getEl('ws-header-title'),
        mode: 'normal',
        chars: { base: ['あ','い','う','え','お','か','き','く','け','こ','さ','し','す','せ','そ','た','ち','つ','て','と','な','に','ぬ','ね','の','は','ひ','ふ','へ','ほ','ま','み','む','め','も','や','ゆ','よ','ら','り','る','れ','ろ','わ','ん'], dakuon: ['が','ぎ','ぐ','げ','ご','ざ','じ','ず','ぜ','ぞ','だ','ぢ','づ','で','ど','ば','び','ぶ','べ','ぼ'], handakuon: ['ぱ','ぴ','ぷ','ぺ','ぽ'], youon: ['きゃ','きゅ','きょ','しゃ','しゅ','しょ','ちゃ','ちゅ','ちょ','にゃ','にゅ','にょ','ひゃ','ひゅ','ひょ','みゃ','みゅ','みょ','りゃ','りゅ','りょ','ぎゃ','ぎゅ','ぎょ','じゃ','じゅ','じょ','びゃ','びゅ','びょ','ぴゃ','ぴゅ','ぴょ'] },
        gameState: { players: [] },
        draw: () => {
            const charPool = [...ws.chars.base];
            if (getEl('ws-opt-dakuon').checked) charPool.push(...ws.chars.dakuon);
            if (getEl('ws-opt-handakuon').checked) charPool.push(...ws.chars.handakuon);
            if (getEl('ws-opt-youon').checked) charPool.push(...ws.chars.youon);

            const modeKey = (isKana() && themes['ワードスナイパー']?.kids) ? 'kids' : ws.mode;
            ws.topicEl.textContent = drawTopic(themes['ワードスナイパー']?.[modeKey] || []) || HIRAGANA_MODE_UNAVAILABLE_TEXT;
            ws.charEl.textContent = pickOne(charPool);
        },
        init: (mode) => {
            if (!mode) return;
            ws.mode = mode;
            ws.headerTitle.textContent = `ワードスナイパー (${mode === 'normal' ? 'ノーマル' : 'キッズ'})`;
            ws.restorePlayers();
            ws.draw();
        }
    };
    attachScoreboard(ws, { countId: 'ws-player-count', boardId: 'ws-scoreboard' });
    gameModules[ws.id] = ws;
    document.querySelectorAll('#page-word-sniper .ingame-options input').forEach(el => el.addEventListener('change', ws.draw));
    getEl('ws-draw').addEventListener('click', ws.draw);
    getEl('ws-player-count').addEventListener('change', ws.setupPlayers);

    const bj = {
        id: 'page-bob-jiten',
        mode: 'normal',
        headerTitle: getEl('bj-header-title'),
        gameState: { players: [] },
        draw: () => {
            const modeKey = (isKana() && themes['ボブジテン']?.kids) ? 'kids' : bj.mode;
            getEl('bj-topic').textContent = drawTopic(themes['ボブジテン']?.[modeKey] || []) || HIRAGANA_MODE_UNAVAILABLE_TEXT;

            if (getEl('bj-opt-special').checked && Math.random() * 100 < 20) {
                getEl('bj-special-topic').textContent = drawTopic(themes['ボブジテン']?.special || []) || HIRAGANA_MODE_UNAVAILABLE_TEXT;
                getEl('bj-special-card').classList.remove('hidden');
            } else {
                getEl('bj-special-card').classList.add('hidden');
            }
        },
        init: (mode) => {
            if (!mode) return;
            bj.mode = mode;
            bj.headerTitle.textContent = `ボブジテン (${mode === 'normal' ? 'ノーマル' : 'キッズ'})`;
            bj.restorePlayers();
            bj.draw();
        }
    };
    attachScoreboard(bj, { countId: 'bj-player-count', boardId: 'bj-scoreboard' });
    gameModules[bj.id] = bj;
    getEl('bj-draw').addEventListener('click', () => { bj.draw(); });
    getEl('bj-player-count').addEventListener('change', bj.setupPlayers);

    const cc = {
        id: 'page-cat-choco',
        gameState: { players: [] },
        draw: () => {
            getEl('cc-event').textContent = drawTopic(themes['キャット＆チョコレート']?.events || []) || HIRAGANA_MODE_UNAVAILABLE_TEXT;
            getEl('cc-item-count').textContent = Math.floor(Math.random() * 3) + 1;

            const itemsList = themes['キャット＆チョコレート']?.items || [];
            const sourceItems = isKana() ? itemsList.filter(t => !containsKanji(t)) : itemsList;
            const items = shuffle(sourceItems).slice(0, 3);
            const handEl = getEl('cc-items-hand');
            handEl.innerHTML = '';
            const texts = items.length > 0 ? items : [HIRAGANA_MODE_UNAVAILABLE_TEXT];
            texts.forEach(item => {
                const card = document.createElement('div');
                card.className = 'card';
                const paragraph = document.createElement('p');
                paragraph.textContent = item;
                card.appendChild(paragraph);
                handEl.appendChild(card);
            });
        },
        init: () => {
            cc.restorePlayers();
            cc.draw();
        }
    };
    attachScoreboard(cc, { countId: 'cc-player-count', boardId: 'cc-scoreboard' });
    gameModules[cc.id] = cc;
    getEl('cc-draw').addEventListener('click', cc.draw);
    getEl('cc-player-count').addEventListener('change', cc.setupPlayers);

    const sttt = {
        id: 'page-stack-ttt',
        boardEl: getEl('sttt-board'), infoEl: getEl('sttt-info'),
        playerAreas: { 1: getEl('sttt-player1-area'), 2: getEl('sttt-player2-area') },
        resetBtn: getEl('sttt-reset'),
        gameState: {},
        sizeValue: { S: 1, M: 2, L: 3 },
        lines: [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]],

        init: () => {
            sttt.gameState = {
                board: Array(9).fill(null).map(() => []),
                hands: { 1: { S: 2, M: 2, L: 2 }, 2: { S: 2, M: 2, L: 2 } },
                currentPlayer: 1,
                selectedPiece: null,
                gameOver: false,
                winner: null
            };
            sttt.resetBtn.classList.add('hidden');
            sttt.boardEl.innerHTML = Array(9).fill(0).map((_, i) => `<div class="sttt-cell" data-index="${i}"></div>`).join('');
            sttt.render();
        },

        topPieces: () => sttt.gameState.board.map(stack => (stack.length > 0 ? stack[stack.length - 1] : null)),

        canCover: (size, targetPiece) => !targetPiece || sttt.sizeValue[size] > sttt.sizeValue[targetPiece.size],

        render: () => {
            const tops = sttt.topPieces();
            sttt.boardEl.querySelectorAll('.sttt-cell').forEach((cell, i) => {
                cell.innerHTML = '';
                const topPiece = tops[i];
                if (topPiece) {
                    const pieceEl = document.createElement('div');
                    pieceEl.className = `sttt-piece player${topPiece.player} size-${topPiece.size}`;
                    cell.appendChild(pieceEl);
                }
            });

            for (const player of [1, 2]) {
                sttt.playerAreas[player].classList.toggle('active-player', sttt.gameState.currentPlayer === player && !sttt.gameState.gameOver);
                for (const size of ['S', 'M', 'L']) {
                    const stackEl = document.querySelector(`.sttt-hand-stack[data-player="${player}"][data-size="${size}"]`);
                    stackEl.innerHTML = '';
                    for (let i = 0; i < sttt.gameState.hands[player][size]; i++) {
                        const pieceEl = document.createElement('div');
                        pieceEl.className = `sttt-piece player${player} size-${size}`;
                        stackEl.appendChild(pieceEl);
                    }
                    stackEl.classList.toggle('selected', sttt.gameState.selectedPiece?.player === player && sttt.gameState.selectedPiece?.size === size);
                }
            }

            sttt.infoEl.classList.remove('player1', 'player2');
            if (sttt.gameState.gameOver) {
                if (sttt.gameState.winner) {
                    sttt.infoEl.textContent = `プレイヤー ${sttt.gameState.winner} の勝ち！`;
                    sttt.infoEl.classList.add(`player${sttt.gameState.winner}`);
                } else {
                    sttt.infoEl.textContent = '引き分け（動かせる駒がありません）';
                }
                sttt.resetBtn.classList.remove('hidden');
            } else {
                sttt.infoEl.textContent = `プレイヤー ${sttt.gameState.currentPlayer} の番です`;
                sttt.infoEl.classList.add(`player${sttt.gameState.currentPlayer}`);
            }

            document.querySelectorAll('.highlight').forEach(el => el.classList.remove('highlight'));
            if (sttt.gameState.selectedPiece) {
                const { size, from, index: fromIndex } = sttt.gameState.selectedPiece;
                sttt.boardEl.querySelectorAll('.sttt-cell').forEach((cell, i) => {
                    if (from === 'board' && i === fromIndex) return;
                    if (sttt.canCover(size, tops[i])) cell.classList.add('highlight');
                });
            }
        },

        handleClick: (e) => {
            if (sttt.gameState.gameOver) return;
            const handStack = e.target.closest('.sttt-hand-stack');
            const cell = e.target.closest('.sttt-cell');

            if (handStack) {
                const player = parseInt(handStack.dataset.player, 10);
                const size = handStack.dataset.size;
                if (sttt.gameState.currentPlayer !== player || sttt.gameState.hands[player][size] === 0) return;
                const selected = sttt.gameState.selectedPiece;
                sttt.gameState.selectedPiece = (selected?.from === 'hand' && selected?.size === size)
                    ? null
                    : { player, size, from: 'hand' };
            } else if (cell) {
                const index = parseInt(cell.dataset.index, 10);
                if (sttt.gameState.selectedPiece) {
                    if (!cell.classList.contains('highlight')) return;
                    const { player, size, from, index: fromIndex } = sttt.gameState.selectedPiece;
                    sttt.gameState.board[index].push({ player, size });
                    if (from === 'hand') sttt.gameState.hands[player][size]--;
                    if (from === 'board') sttt.gameState.board[fromIndex].pop();
                    sttt.gameState.selectedPiece = null;
                    sttt.finishTurn(player);
                } else {
                    const stack = sttt.gameState.board[index];
                    const topPiece = stack.length > 0 ? stack[stack.length - 1] : null;
                    if (topPiece && topPiece.player === sttt.gameState.currentPlayer) {
                        sttt.gameState.selectedPiece = { player: topPiece.player, size: topPiece.size, from: 'board', index };
                    }
                }
            }
            sttt.render();
        },

        finishTurn: (movedBy) => {
            const winner = sttt.findWinner(movedBy);
            if (winner) {
                sttt.gameState.gameOver = true;
                sttt.gameState.winner = winner;
                sttt.gameState.currentPlayer = winner;
                return;
            }
            const next = movedBy === 1 ? 2 : 1;
            if (!sttt.hasLegalMove(next)) {
                sttt.gameState.gameOver = true;
                sttt.gameState.winner = null;
                return;
            }
            sttt.gameState.currentPlayer = next;
        },

        // 駒を動かすと下の駒が現れるため、手番側だけでなく両者の three-in-a-row を見る。
        findWinner: (movedBy) => {
            const tops = sttt.topPieces();
            const winners = new Set();
            sttt.lines.forEach(line => {
                const owner = tops[line[0]]?.player;
                if (owner && line.every(i => tops[i]?.player === owner)) winners.add(owner);
            });
            if (winners.size === 0) return null;
            if (winners.size === 1) return [...winners][0];
            // 同時に成立したときは、動かした側ではない方の勝ち。
            return movedBy === 1 ? 2 : 1;
        },

        hasLegalMove: (player) => {
            const tops = sttt.topPieces();
            const canPlaceSomewhere = (size, fromIndex) => tops.some((topPiece, i) => i !== fromIndex && sttt.canCover(size, topPiece));
            for (const size of ['S', 'M', 'L']) {
                if (sttt.gameState.hands[player][size] > 0 && canPlaceSomewhere(size, -1)) return true;
            }
            return tops.some((topPiece, i) => topPiece && topPiece.player === player && canPlaceSomewhere(topPiece.size, i));
        }
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
            showPage('page-player-setup');
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
        gameState: { players: [] },
        init: () => { getEl('ito-setup').classList.remove('hidden'); getEl('ito-check').classList.add('hidden'); getEl('ito-theme').classList.add('hidden'); getEl('ito-player-count').value = 4; },
        startSetup: () => { const playerCount = parseInt(getEl('ito-player-count').value); if(playerCount < 2 || playerCount > 10) { alertByMode('2〜10人で設定してください。', '2〜10にんで せっていしてください。'); return; } playerSetup.setup('ito', playerCount, 'page-ito', ito.start); },
        start: (playerNames) => {
            const numbers = shuffle([...Array(100).keys()].map(i => i + 1)).slice(0, playerNames.length);
            ito.gameState.playerCount = playerNames.length;
            ito.gameState.currentPlayerIndex = 0;
            ito.gameState.players = playerNames.map((name, i) => ({ name, score: 0, number: numbers[i] }));
            showPage('page-ito');
            getEl('ito-setup').classList.add('hidden'); getEl('ito-check').classList.remove('hidden'); ito.updatePlayerView();
        },
        updatePlayerView: () => { getEl('ito-current-player').textContent = ito.gameState.players[ito.gameState.currentPlayerIndex].name; getEl('ito-number-display').classList.add('hidden'); getEl('ito-confirm-number').classList.add('hidden'); getEl('ito-show-number').classList.remove('hidden'); },
        showNumber: () => { getEl('ito-number-display').textContent = ito.gameState.players[ito.gameState.currentPlayerIndex].number; getEl('ito-number-display').classList.remove('hidden'); getEl('ito-confirm-number').classList.remove('hidden'); getEl('ito-show-number').classList.add('hidden'); },
        confirmNumber: () => { ito.gameState.currentPlayerIndex++; if (ito.gameState.currentPlayerIndex < ito.gameState.playerCount) { ito.updatePlayerView(); } else { getEl('ito-check').classList.add('hidden'); getEl('ito-theme').classList.remove('hidden'); ito.drawTheme(); } },
        drawTheme: () => {
            getEl('ito-theme-display').textContent = drawTopic(themes['ITO'] || []) || HIRAGANA_MODE_UNAVAILABLE_TEXT;
            ito.setPlayers(ito.gameState.players);
        }
    };
    attachScoreboard(ito, { boardId: 'ito-scoreboard' });
    gameModules[ito.id] = ito;
    getEl('ito-start-setup').addEventListener('click', ito.startSetup); getEl('ito-show-number').addEventListener('click', ito.showNumber); getEl('ito-confirm-number').addEventListener('click', ito.confirmNumber); getEl('ito-new-theme').addEventListener('click', ito.drawTheme); getEl('ito-reset').addEventListener('click', ito.init);

    const ww = {
        id: 'page-word-wolf',
        gameState: { players: [] }, timerId: null, timeLeft: 180,
        init: () => {
            ww.stopTimer();
            getEl('ww-setup').classList.remove('hidden'); getEl('ww-check').classList.add('hidden'); getEl('ww-discuss').classList.add('hidden'); getEl('ww-result').classList.add('hidden');
            getEl('ww-player-count').value = 4; getEl('ww-time-select').value = 180;
        },
        startSetup: () => { const playerCount = parseInt(getEl('ww-player-count').value); if(playerCount < 3 || playerCount > 10) { alertByMode('3〜10人で設定してください。', '3〜10にんで せっていしてください。'); return; } ww.timeLeft = parseInt(getEl('ww-time-select').value); playerSetup.setup('ww', playerCount, 'page-word-wolf', ww.start); },
        start: (playerNames) => {
            const themePair = drawTopic(themes['ワードウルフ'] || []);
            const wolfIndex = Math.floor(Math.random() * playerNames.length);
            ww.gameState.playerCount = playerNames.length;
            ww.gameState.currentPlayerIndex = 0;
            ww.gameState.players = playerNames.map((name, i) => ({
                name, score: 0,
                role: i === wolfIndex ? 'ウルフ' : '市民',
                word: themePair ? (i === wolfIndex ? themePair[1] : themePair[0]) : HIRAGANA_MODE_UNAVAILABLE_TEXT
            }));
            showPage('page-word-wolf');
            getEl('ww-setup').classList.add('hidden'); getEl('ww-check').classList.remove('hidden'); ww.updatePlayerView();
        },
        updatePlayerView: () => { getEl('ww-current-player').textContent = ww.gameState.players[ww.gameState.currentPlayerIndex].name; getEl('ww-word-display').classList.add('hidden'); getEl('ww-confirm-word').classList.add('hidden'); getEl('ww-show-word').classList.remove('hidden'); },
        showWord: () => { getEl('ww-word-display').textContent = ww.gameState.players[ww.gameState.currentPlayerIndex].word; getEl('ww-word-display').classList.remove('hidden'); getEl('ww-confirm-word').classList.remove('hidden'); getEl('ww-show-word').classList.add('hidden'); },
        confirmWord: () => { ww.gameState.currentPlayerIndex++; if (ww.gameState.currentPlayerIndex < ww.gameState.playerCount) { ww.updatePlayerView(); } else { getEl('ww-check').classList.add('hidden'); getEl('ww-discuss').classList.remove('hidden'); ww.resetTimer(); } },
        renderTime: (seconds) => {
            const min = String(Math.floor(Math.max(0, seconds) / 60)).padStart(2, '0');
            const sec = String(Math.max(0, seconds) % 60).padStart(2, '0');
            getEl('ww-timer').textContent = `${min}:${sec}`;
        },
        // ページ遷移時にも呼ばれる。止めるだけで表示は触らない。
        stopTimer: () => {
            if (ww.timerId) { clearInterval(ww.timerId); ww.timerId = null; }
            const btn = getEl('ww-timer-start');
            if (btn) btn.textContent = byMode('タイマースタート', 'たいまーすたーと');
        },
        resetTimer: () => { ww.stopTimer(); ww.renderTime(ww.timeLeft); },
        startTimer: () => {
            if (ww.timerId) { ww.resetTimer(); return; }
            let time = ww.timeLeft;
            ww.renderTime(time);
            ww.timerId = setInterval(() => {
                time--;
                ww.renderTime(time);
                if (time <= 0) ww.stopTimer();
            }, 1000);
            getEl('ww-timer-start').textContent = byMode('リセット', 'りせっと');
        },
        showResult: () => {
            ww.stopTimer();
            getEl('ww-discuss').classList.add('hidden');
            getEl('ww-result').classList.remove('hidden');
            const listEl = getEl('ww-result-list');
            listEl.innerHTML = '';
            ww.gameState.players.forEach(p => {
                const li = document.createElement('li');
                li.innerHTML = `${escapeHtml(p.name)}: <span class="role">${escapeHtml(p.role)}</span> (お題: ${escapeHtml(p.word)})`;
                listEl.appendChild(li);
            });
            ww.setPlayers(ww.gameState.players);
        }
    };
    attachScoreboard(ww, { boardId: 'ww-scoreboard' });
    registerTimerOwner(ww);
    gameModules[ww.id] = ww;
    getEl('ww-start-setup').addEventListener('click', ww.startSetup); getEl('ww-show-word').addEventListener('click', ww.showWord); getEl('ww-confirm-word').addEventListener('click', ww.confirmWord); getEl('ww-show-result').addEventListener('click', ww.showResult); getEl('ww-timer-start').addEventListener('click', ww.startTimer); getEl('ww-reset').addEventListener('click', ww.init);

    const qis = {
        id: 'page-quiz-iisen',
        gameState: { players: [] },
        init: () => {
            getEl('qis-setup').classList.remove('hidden');
            getEl('qis-game').classList.add('hidden');
            getEl('qis-player-count').value = 4;
        },
        startSetup: () => {
            const playerCount = parseInt(getEl('qis-player-count').value);
            if (playerCount < 2) { alertByMode('2人以上で設定してください。', '2にん いじょうで せっていしてください。'); return; }
            playerSetup.setup('qis', playerCount, 'page-quiz-iisen', qis.start);
        },
        start: (playerNames) => {
            showPage('page-quiz-iisen');
            getEl('qis-setup').classList.add('hidden');
            getEl('qis-game').classList.remove('hidden');
            qis.newQuestion();
            qis.setPlayers(playerNames.map(name => ({ name, score: 0 })));
        },
        newQuestion: () => {
            getEl('qis-question-display').textContent = drawTopic(themes['クイズいいセン行きまSHOW！'] || []) || HIRAGANA_MODE_UNAVAILABLE_TEXT;
            getEl('qis-calc-input').value = '';
            getEl('qis-calc-result').textContent = '';
        },
        calculate: () => {
            const input = getEl('qis-calc-input').value.trim();
            if (input === '') {
                getEl('qis-calc-result').textContent = byMode('数字を入力してください。', 'すうじを にゅうりょくしてください。');
                return;
            }
            const numbers = input.split(/[\s,，、]+/).map(n => parseFloat(n)).filter(n => !isNaN(n));
            if (numbers.length === 0) {
                getEl('qis-calc-result').textContent = byMode('有効な数字がありません。', 'つかえる すうじが ありません。');
                return;
            }
            numbers.sort((a, b) => a - b);
            const lowIndex = Math.floor((numbers.length - 1) / 2);
            const highIndex = Math.floor(numbers.length / 2);
            const low = numbers[lowIndex];
            const high = numbers[highIndex];
            const medianText = (low === high) ? `「${low}」` : `「${low}」と「${high}」`;
            getEl('qis-calc-result').textContent = `入力: [${numbers.join(', ')}] --- 中央値は${medianText}です。`;
        },
        resetGame: () => {
            qis.init();
        }
    };
    attachScoreboard(qis, { boardId: 'qis-scoreboard' });
    gameModules[qis.id] = qis;
    getEl('qis-start-setup').addEventListener('click', qis.startSetup);
    getEl('qis-new-question').addEventListener('click', qis.newQuestion);
    getEl('qis-calc-button').addEventListener('click', qis.calculate);
    getEl('qis-reset').addEventListener('click', qis.resetGame);

    const mt = {
        difficulty: 'easiest', currentNumbers: [], currentSolutions: [],
        init: (difficulty) => {
            if (!difficulty) return;
            mt.difficulty = difficulty;
            const modeText = { 'easiest': 'もっともかんたん', 'easy': 'かんたん', 'hard': 'むずかしい' }[difficulty];
            getEl('mt-header-title').textContent = `10パズル (${modeText})`;
            mt.draw();
        },
        draw: () => {
            // 解ける組み合わせが出るまで引き直す。理論上は必ず見つかるが、念のため上限を置く。
            const MAX_ATTEMPTS = 500;
            let solutions = [];
            let numbers = [];
            for (let attempt = 0; attempt < MAX_ATTEMPTS && solutions.length === 0; attempt++) {
                numbers = Array(4).fill(0).map(() => Math.floor(Math.random() * 9) + 1);
                solutions = mt.solve(numbers);
            }
            mt.currentNumbers = numbers;
            mt.currentSolutions = solutions;

            const numbersEl = getEl('mt-numbers');
            numbersEl.innerHTML = '';
            mt.currentNumbers.forEach(num => {
                const box = document.createElement('div');
                box.className = 'mt-number-box';
                box.textContent = num;
                numbersEl.appendChild(box);
            });
            getEl('mt-answer-area').classList.add('hidden');
            getEl('mt-show-answer').textContent = byMode('答えを見る', 'こたえを みる');
        },
        showAnswer: () => {
            const answerArea = getEl('mt-answer-area');
            if (!answerArea.classList.contains('hidden')) {
                answerArea.classList.add('hidden');
                getEl('mt-show-answer').textContent = byMode('答えを見る', 'こたえを みる');
                return;
            }
            const listEl = getEl('mt-answer-list');
            listEl.innerHTML = '';
            const solutions = mt.currentSolutions;
            if (solutions.length > 0) {
                solutions.forEach(sol => { const li = document.createElement('li'); li.textContent = sol; listEl.appendChild(li); });
            } else {
                const li = document.createElement('li');
                li.textContent = byMode('この難易度では解けません', 'この なんいどでは とけません');
                listEl.appendChild(li);
            }
            answerArea.classList.remove('hidden');
            getEl('mt-show-answer').textContent = byMode('答えを隠す', 'こたえを かくす');
        },
        solve: (numbers) => {
            const solutions = new Set();
            const permute = (arr, l) => {
                if (l === arr.length - 1) {
                    mt.calculate(arr).forEach(res => solutions.add(res));
                    return;
                }
                for (let i = l; i < arr.length; i++) {
                    [arr[l], arr[i]] = [arr[i], arr[l]];
                    permute(arr, l + 1);
                    [arr[l], arr[i]] = [arr[i], arr[l]];
                }
            };
            permute([...numbers], 0);
            return Array.from(solutions);
        },
        calculate: (nums) => {
            const operators = { 'easiest': ['+', '-'], 'easy': ['+', '-'], 'hard': ['+', '-', '*', '/'] }[mt.difficulty];
            const [a, b, c, d] = nums;
            const results = [];

            const performOp = (x, op, y) => {
                if (op === '+') return x + y;
                if (op === '-') return x - y;
                if (op === '*') return x * y;
                if (op === '/') return y !== 0 ? x / y : NaN;
                return NaN;
            };
            // もっともかんたんモードでは途中結果がマイナスになる式を使わせない。
            const valid = (v) => Number.isFinite(v) && !(mt.difficulty === 'easiest' && v < 0);
            const isTen = (v) => Math.abs(v - 10) < 1e-9;

            // 4数の括弧の入れ方は5通り。以前は2通りしか見ておらず、正解を取りこぼしていた。
            const shapes = [
                (o1, o2, o3) => {
                    const x = performOp(a, o1, b); if (!valid(x)) return null;
                    const y = performOp(x, o2, c); if (!valid(y)) return null;
                    return [performOp(y, o3, d), `((${a}${o1}${b})${o2}${c})${o3}${d}`];
                },
                (o1, o2, o3) => {
                    const x = performOp(b, o2, c); if (!valid(x)) return null;
                    const y = performOp(a, o1, x); if (!valid(y)) return null;
                    return [performOp(y, o3, d), `(${a}${o1}(${b}${o2}${c}))${o3}${d}`];
                },
                (o1, o2, o3) => {
                    const x = performOp(b, o2, c); if (!valid(x)) return null;
                    const y = performOp(x, o3, d); if (!valid(y)) return null;
                    return [performOp(a, o1, y), `${a}${o1}((${b}${o2}${c})${o3}${d})`];
                },
                (o1, o2, o3) => {
                    const x = performOp(c, o3, d); if (!valid(x)) return null;
                    const y = performOp(b, o2, x); if (!valid(y)) return null;
                    return [performOp(a, o1, y), `${a}${o1}(${b}${o2}(${c}${o3}${d}))`];
                },
                (o1, o2, o3) => {
                    const x = performOp(a, o1, b); if (!valid(x)) return null;
                    const y = performOp(c, o3, d); if (!valid(y)) return null;
                    return [performOp(x, o2, y), `(${a}${o1}${b})${o2}(${c}${o3}${d})`];
                }
            ];

            for (const o1 of operators) for (const o2 of operators) for (const o3 of operators) {
                for (const shape of shapes) {
                    const outcome = shape(o1, o2, o3);
                    if (outcome && valid(outcome[0]) && isTen(outcome[0])) results.push(outcome[1]);
                }
            }
            return results;
        }
    };
    getEl('mt-draw').addEventListener('click', mt.draw);
    getEl('mt-show-answer').addEventListener('click', mt.showAnswer);

    const settings = {
        activeGame: 'ワードスナイパー', activeSubKey: 'normal',
        init: () => { settings.switchTab('ワードスナイパー'); },
        currentList: () => {
            const gameData = themes[settings.activeGame];
            if (!gameData) return null;
            const list = settings.activeSubKey ? gameData[settings.activeSubKey] : gameData;
            return Array.isArray(list) ? list : null;
        },
        // ワードウルフだけは1件が [単語A, 単語B] のペアなので表示を分ける。
        labelFor: (theme, separator = ' / ') => Array.isArray(theme) ? theme.join(separator) : String(theme),
        renderList: () => {
            const listEl = getEl('settings-list');
            listEl.innerHTML = '';
            const listData = settings.currentList();
            if (!listData) return;
            listData.forEach((theme, index) => {
                const li = document.createElement('li');
                li.innerHTML = `<span class="theme-text">${escapeHtml(settings.labelFor(theme))}</span><div class="theme-actions"><button data-index="${index}" class="edit-btn">編集</button><button data-index="${index}" class="delete-btn">削除</button></div>`;
                listEl.appendChild(li);
            });
        },
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
        saveThemes: () => { localStorage.setItem(THEME_STORAGE_KEY, JSON.stringify(themes)); },
        addNewTheme: () => { const input = getEl('new-theme-input'); const newTheme = input.value.trim(); if (newTheme) { const listData = settings.currentList(); if(!listData) return; if(settings.activeGame === 'ワードウルフ'){ if(newTheme.split(/[,\s/]+/).length !== 2) { alert('「単語1, 単語2」のように、2つの単語をカンマやスペースで区切って入力してください。'); return; } listData.push(newTheme.split(/[,\s/]+/)); } else { listData.push(newTheme); } settings.saveThemes(); settings.renderList(); input.value = ''; } },
        editTheme: (rawIndex) => { const index = parseInt(rawIndex, 10); const listData = settings.currentList(); if(!listData) return; const oldTheme = settings.labelFor(listData[index], ', '); const newTheme = prompt('編集してください:', oldTheme); if (newTheme && newTheme.trim() !== oldTheme) { if(settings.activeGame === 'ワードウルフ'){ if(newTheme.split(/[,\s/]+/).length !== 2) { alert('「単語1, 単語2」のように、2つの単語をカンマやスペースで区切って入力してください。'); return; } listData[index] = newTheme.split(/[,\s/]+/); } else { listData[index] = newTheme.trim(); } settings.saveThemes(); settings.renderList(); } },
        deleteTheme: (rawIndex) => { const index = parseInt(rawIndex, 10); const listData = settings.currentList(); if(!listData) return; const themeText = settings.labelFor(listData[index]); if (confirm(`「${themeText}」を削除しますか？`)) { listData.splice(index, 1); settings.saveThemes(); settings.renderList(); } },
        exportCsv: () => { const listData = settings.currentList(); if(!listData) return; const filename = `${settings.activeGame}${settings.activeSubKey ? '_' + settings.activeSubKey : ''}.csv`; let csvData; if(settings.activeGame === 'ワードウルフ'){ csvData = listData.map(e => e.join(",")).join("\n"); } else { csvData = listData.join("\n"); } const bom = '\uFEFF'; const blob = new Blob([bom + csvData], { type: 'text/csv;charset=utf-8;' }); const url = URL.createObjectURL(blob); const link = document.createElement("a"); link.setAttribute("href", url); link.setAttribute("download", filename); document.body.appendChild(link); link.click(); document.body.removeChild(link); URL.revokeObjectURL(url); },
        importCsv: (e) => { const file = e.target.files[0]; if (!file) return; const reader = new FileReader(); reader.onload = (event) => { const listData = settings.currentList(); if(!listData) return; const currentThemes = new Set(listData.map(t => settings.activeGame === 'ワードウルフ' ? t.join(',') : t)); const newThemesRaw = event.target.result.split(/\r\n|\n/).filter(line => line.trim() !== ''); let addedCount = 0; newThemesRaw.forEach(theme => { if(settings.activeGame === 'ワードウルフ'){ const pair = theme.split(','); if(pair.length === 2 && !currentThemes.has(pair.join(','))){ listData.push(pair.map(p => p.trim())); addedCount++; } } else { const trimmedTheme = theme.trim(); if (trimmedTheme && !currentThemes.has(trimmedTheme)) { listData.push(trimmedTheme); addedCount++; } } }); settings.saveThemes(); alert(`${addedCount}件の新しいお題を追加しました！`); settings.renderList(); }; reader.readAsText(file); e.target.value = ''; }
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

    // ひらがなモードの切り替え（小学1年生レベルの漢字以外をひらがなに）
    const hiraganaMode = {
        enabled: false,
        textMap: {
            // 基本操作
            'オフラインで遊ぶ（ツール）': 'オフラインであそぶ（ツール）',
            'オンラインで対戦': 'オンラインでたいせん',
            '戻る': 'もどる',
            'どのゲーム？': 'どのゲーム？',
            'ゲーム開始': 'ゲームかいし',
            '次のカードをめくる': 'つぎのカードをめくる',
            '次のお題へ': 'つぎのおだいへ',
            '次のラウンド': 'つぎのラウンド',
            'もう一度遊ぶ': 'もういちどあそぶ',
            '新しいお題': 'あたらしいおだい',
            '確認しました': 'かくにんしました',
            '確定してゲームを始める': 'かくていしてゲームをはじめる',
            '確定して次へ': 'かくていしてつぎへ',
            
            // NGワードゲーム関連
            'NGワードゲーム': 'えぬじーわーどげーむ',
            'ゲームモード': 'げーむもーど',
            'ゲームモードを選択': 'げーむもーどをえらぶ',
            'ランダムモード': 'らんだむもーど',
            'カスタムモード': 'かすたむもーど',
            'タイマースタート': 'たいまーすたーと',
            '相手のワードを見る': 'あいてのわーどをみる',
            '準備完了': 'じゅんびかんりょう',
            '会話スタート': 'かいわすたーと',
            'プレイヤー名を入力してください': 'プレイヤーめいをにゅうりょくしてください',
            'プレイヤー名を入力': 'プレイヤーめいをにゅうりょく',
            'プレイヤーAの名前': 'プレイヤーAのなまえ',
            'プレイヤーBの名前': 'プレイヤーBのなまえ',
            'プレイヤー名を設定': 'プレイヤーめいをせってい',
            'NGワードを設定してください': 'えぬじーわーどをせっていしてください',
            'NGワードを入力': 'えぬじーわーどをにゅうりょく',
            '端末を受け取ってください': 'たんまつをうけとってください',
            '画面を隠して端末を渡してください': 'がめんをかくしてたんまつをわたしてください',
            '受け取ったら押す': 'うけとったらおす',
            '確認する': 'かくにんする',
            '言ってはいけない言葉': 'いってはいけないことば',
            'が言ってはいけない言葉': 'がいってはいけないことば',
            '表示されていません': 'ひょうじされていません',
            'あなたのNGワードは表示されていません': 'あなたのえぬじーわーどはひょうじされていません',
            '同じワードは設定できません': 'おなじわーどはせっていできません',
            '別のワードを入力してください': 'べつのわーどをにゅうりょくしてください',
            'お互いに相手のNGワードを確認しました': 'おたがいにあいてのえぬじーわーどをかくにんしました',
            '相手のワードを確認': 'あいてのわーどをかくにん',
            '決着をつける': 'けっちゃくをつける',
            '脱落記録': 'だつらくきろく',
            '脱落': 'だつらく',
            '生存': 'せいぞん',
            'ゲーム終了（結果表示）': 'げーむしゅうりょう（けっかひょうじ）',
            'が言った': 'がいった',
            '勝利': 'しょうり',
            'の勝利': 'のしょうり',
            '引き分け': 'ひきわけ',
            '両方': 'りょうほう',
            '勝者': 'しょうしゃ',
            '敗北': 'はいぼく',
            '結果': 'けっか',
            '公開': 'こうかい',
            'NGワード公開': 'えぬじーわーどこうかい',
            '相手': 'あいて',
            '長押し': 'ながおし',
            
            // 共通
            '参加人数': 'さんかにん数',
            'スコア': 'スコア',
            'プレイヤー': 'プレイヤー',
            'お題': 'おだい',
            '文字': 'もじ',
            '設定': 'せってい',
            '追加': 'ついか',
            '削除': 'さくじょ',
            '編集': 'へんしゅう',
            '保存': 'ほぞん',
            '読み込み': 'よみこみ',
            '初期化': 'しょきか',
            '閉じる': 'とじる',
            '開く': 'ひらく',
            
            // 動詞・形容詞
            '遊ぶ': 'あそぶ',
            '始める': 'はじめる',
            '終わる': 'おわる',
            '使う': 'つかう',
            '見る': 'みる',
            '言う': 'いう',
            '入力': 'にゅうりょく',
            '表示': 'ひょうじ',
            '非表示': 'ひひょうじ',
            '確認': 'かくにん',
            '選択': 'えらぶ',
            '設定する': 'せっていする',
            '変更': 'へんこう',
            '更新': 'こうしん',
            
            // 名詞
            '各自': 'かくじ',
            '指定': 'してい',
            '単語': 'たんご',
            '回答': 'かいとう',
            '連想': 'れんそう',
            '協力': 'きょうりょく',
            '全員': 'ぜんいん',
            '順番': 'じゅんばん',
            '数字': 'す字',
            '説明': 'せつめい',
            '役割': 'やくわり',
            '質問': 'しつもん',
            '範囲': 'はんい',
            '自由': 'じゆう',
            '計算': 'けいさん',
            '式': 'しき',
            '問題': 'もんだい',
            '答え': 'こたえ',
            '正解': 'せいかい',
            '不正解': 'ふせいかい',
            '状況': 'じょうきょう',
            '場合': 'ばあい',
            '制限時間': 'せいげんじかん',
            '時間': 'じかん',
            '秒': 'びょう',
            '分': 'ふん',
            '点': 'てん',
            '得点': 'とくてん',
            '合計': 'ごうけい',
            '人数': 'にん数',
            '番号': 'ばんごう',
            '名前': 'なまえ',
            '内容': 'ないよう',
            '方法': 'ほうほう',
            '場所': 'ばしょ',
            '途中': 'とちゅう',
            '最初': 'さいしょ',
            '最後': 'さいご',
            '以上': 'いじょう',
            '以下': 'いか',
            '必要': 'ひつよう',
            '特殊': 'とくしゅ',
            '通常': 'つうじょう',
            '全体': 'ぜんたい',
            '一部': 'いちぶ',
            '自分': 'じぶん',
            '他': 'ほか',
            '全て': 'すべて',
            
            // 助詞・接続詞
            '含む': 'ふくむ',
            '並べる': 'ならべる',
            '与える': 'あたえる',
            '見破る': 'みやぶる',
            '話し合う': 'はなしあう',
            '当てる': 'あてる',
            '作る': 'つくる',
            '置く': 'おく',
            '取る': 'とる',
            '配る': 'くばる',
            '重ねる': 'かさねる',
            '並ぶ': 'ならぶ',
            '切り抜ける': 'きりぬける',
            '乗り切る': 'のりきる',
            
            // ゲーム名
            'ワードスナイパー': 'わーどすないぱー',
            'ボブジテン': 'ぼぶじてん',
            'キャット＆チョコレート': 'きゃっとあんどちょこれーと',
            'ワードウルフ': 'わーどうるふ',
            'いいセン行きまSHOW': 'いいせんいきまSHOW',
            'クイズいいセン行きまSHOW': 'くいずいいせんいきまSHOW',
            'スタック三目並べ': 'すたっくさんもくならべ',
            'バトルライン': 'ばとるらいん',
            
            // その他固有名詞
            'ノーマル': 'のーまる',
            'キッズ': 'きっず',
            'モード': 'もーど',
            'カタカナ': 'かたかな',
            'ひらがな': 'ひらがな',
            '濁音': 'だくおん',
            '半濁音': 'はんだくおん',
            '拗音': 'ようおん',
            'インポート': 'いんぽーと',
            'エクスポート': 'えくすぽーと',
            'リセット': 'りせっと',
            'ゲームをリセット': 'げーむをりせっと',
            '次へ': 'つぎへ',
            
            // 設定画面関連
            '新しいお題/アイテムを入力': 'あたらしいおだい/あいてむをにゅうりょく',
            'CSVファイルでの入出力': 'しーえすぶいふぁいるでのにゅうしゅつりょく',
            'CSVをインポート': 'しーえすぶいをいんぽーと',
            'CSVをエクスポート': 'しーえすぶいをえくすぽーと',
            '初期データに戻す': 'しょきでーたにもどす',
            '表示中リストのみ': 'ひょうじちゅうりすとのみ',
            
            // ITOゲーム関連
            'プレイ人数を入力してください': 'ぷれいにん数をにゅうりょくしてください',
            'あなたの数字を見る': 'あなたのす字をみる',
            
            // ボブジテン関連
            '特殊お題': 'とくしゅおだい',
            '特殊お題あり': 'とくしゅおだいあり',
            
            // キャット＆チョコレート関連
            'イベント': 'いべんと',
            '必要アイテム数': 'ひつようあいてむ数',
            '手札アイテム': 'てふだあいてむ',
            'アイテムを追加': 'あいてむをついか',
            
            // ワードウルフ関連
            '制限時間': 'せいげんじかん',
            '投票': 'とうひょう',
            '少数派': 'しょうすうは',
            '多数派': 'たすうは',
            
            // いいセン関連
            '中央値': 'ちゅうおうち',
            '最大値': 'さいだいち',
            '最小値': 'さいしょうち',
            '平均値': 'へいきんち',
            
            // 共通UI
            'どのモードで遊びますか': 'どのもーどであそびますか',
            '参加': 'さんか',
            '現在': 'げんざい',
            '合計点': 'ごうけいてん',
            '総計': 'そうけい',
            '得点': 'とくてん',
            
            // 動詞活用形
            '遊びますか': 'あそびますか',
            '始めます': 'はじめます',
            '終わります': 'おわります',
            '考えます': 'かんがえます',
            '選びます': 'えらびます',
            '配ります': 'くばります',
            '発表されます': 'はっぴょうされます',
            '表現します': 'ひょうげんします',
            '説明します': 'せつめいします',
            '持っています': 'もっています',
            '見つけます': 'みつけます',
            '話し合います': 'はなしあいます',
            '当てます': 'あてます',
            '作ります': 'つくります',
            '配置します': 'はいちします',
            '確保します': 'かくほします',
            '重ねて置けます': 'かさねておけます',
            '並べた方': 'ならべたほう',
            '切り抜けるか': 'きりぬけるか',
            
            // よく使う複合語・形容詞
            '一番早く': 'いちばんはやく',
            '一番近い': 'いちばんちかい',
            '一切': 'いっさい',
            '過半数': 'かはんすう',
            '連続する': 'れんぞくする',
            '違う': 'ちがう',
            '少ない': 'すくない',
            '多い': 'おおい',
            '近い': 'ちかい',
            '遠い': 'とおい',
            '強い': 'つよい',
            '弱い': 'よわい',
            '正しい': 'ただしい',
            '間違い': 'まちがい',
            '例えて': 'たとえて',
            '沿った': 'そった',
            '縦': 'たて',
            '横': 'よこ',
            '斜め': 'ななめ',
            '戦場': 'せんじょう',
            '部隊': 'ぶたい',
            '役': 'やく',
            '駒': 'こま',
            'サイズ': 'さいず'
        },
        // 置換前の原文を覚えておき、モードを戻すときにリロードなしで復元する。
        originals: new WeakMap(),
        compiled: null,

        // 「間違い」より先に「違う」が当たると崩れるため、長いキーから順に適用する。
        rules() {
            if (!this.compiled) {
                const escapeRegExp = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                this.compiled = Object.keys(this.textMap)
                    .sort((a, b) => b.length - a.length)
                    .map(key => [new RegExp(escapeRegExp(key), 'g'), this.textMap[key]]);
            }
            return this.compiled;
        },

        toggle() {
            this.enabled = !this.enabled;
            this.apply();
            try {
                localStorage.setItem(HIRAGANA_STORAGE_KEY, String(this.enabled));
            } catch (e) {
                console.warn('Failed to store hiragana mode.', e);
            }
        },

        apply() {
            document.body.classList.toggle('hiragana-mode', this.enabled);
            if (this.enabled) {
                this.replaceText(document.body);
            } else {
                this.restoreText(document.body);
            }
        },

        textNodes(element) {
            const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT, null, false);
            const nodes = [];
            while (walker.nextNode()) nodes.push(walker.currentNode);
            return nodes;
        },

        replaceText(element) {
            const rules = this.rules();
            this.textNodes(element).forEach(node => {
                const source = this.originals.has(node) ? this.originals.get(node) : node.nodeValue;
                let text = source;
                rules.forEach(([pattern, replacement]) => { text = text.replace(pattern, replacement); });
                if (text !== node.nodeValue) {
                    if (!this.originals.has(node)) this.originals.set(node, source);
                    node.nodeValue = text;
                }
            });
        },

        // ゲーム進行中に切り替えても状態が飛ばないよう、リロードせず原文に戻す。
        restoreText(element) {
            this.textNodes(element).forEach(node => {
                if (this.originals.has(node)) node.nodeValue = this.originals.get(node);
            });
        }
    };

    const hiraganaCheckbox = getEl('hiragana-mode-checkbox');
    if (hiraganaCheckbox) {
        let saved = null;
        try {
            saved = localStorage.getItem(HIRAGANA_STORAGE_KEY);
        } catch (e) {
            console.warn('Failed to read hiragana mode.', e);
        }
        if (saved === 'true') {
            hiraganaCheckbox.checked = true;
            hiraganaMode.enabled = true;
            hiraganaMode.apply();
        }
        hiraganaCheckbox.addEventListener('change', () => hiraganaMode.toggle());
    }

    // ルール説明。漢字版とひらがな版を1件ずつ持つ（以前は別マップ2つに分かれていた）。
    const gameRules = {
        'word-sniper': {
            ja: 'ワードスナイパー\n\nお題に合った言葉を、指定された文字で始まる言葉で答えるゲームです。\n\n1. お題と文字が表示されます\n2. その文字で始まる、お題に合った言葉を考えます\n3. 一番早く答えた人が得点します',
            kana: 'わーどすないぱー\n\nおだいに合ったことばを、してい されたもじで始まることばで こたえるげーむです。\n\n1. おだいともじが ひょうじされます\n2. そのもじで始まる、おだいに合ったことばを かんがえます\n3. いちばん早く こたえた人が とくてんします'
        },
        'ito': {
            ja: 'I T O\n\n1～100の数字を使って、テーマに沿った大きさを表現するゲームです。\n\n1. 各プレイヤーに1～100の数字が配られます\n2. テーマが発表されます\n3. 自分の数字の大きさをテーマに例えて表現します\n4. 全員で数字の小さい順に並べます',
            kana: 'I T O\n\n1～100のす字を つかって、てーまに そった大きさを ひょうげんするげーむです。\n\n1. かく ぷれいやーに 1～100のす字が くばられます\n2. てーまが はっぴょうされます\n3. じぶんのす字の大きさを てーまに たとえて ひょうげんします\n4. ぜんいんで す字の小さいじゅんに ならべます'
        },
        'bob-jiten': {
            ja: 'ボブジテン\n\nカタカナ語を、カタカナを使わずに説明するゲームです。\n\n1. お題のカタカナ語が表示されます\n2. カタカナを一切使わずに説明します\n3. 他のプレイヤーが当てたら得点',
            kana: 'ぼぶじてん\n\nかたかなごを、かたかなを つかわずに せつめいするげーむです。\n\n1. おだいの かたかなごが ひょうじされます\n2. かたかなを いっさい つかわずに せつめいします\n3. ほかの ぷれいやーが あてたら とくてん'
        },
        'cat-choco': {
            ja: 'キャット＆チョコレート\n\nピンチな状況を、配られたアイテムで切り抜けるゲームです。\n\n1. イベント（ピンチな状況）が発表されます\n2. 必要なアイテム数が表示されます\n3. 手札のアイテムを使って、どう切り抜けるか説明します',
            kana: 'きゃっとあんどちょこれーと\n\nぴんちな じょうきょうを、くばられた あいてむで きりぬける げーむです。\n\n1. いべんと（ぴんちな じょうきょう）が はっぴょうされます\n2. ひつような あいてむ数が ひょうじされます\n3. てふだの あいてむを つかって、どう きりぬけるか せつめいします'
        },
        'stack-ttt': {
            ja: 'スタック三目並べ\n\n駒を重ねられる三目並べです。\n\n1. 各プレイヤーはS・M・Lサイズの駒を2個ずつ持っています\n2. 大きい駒は小さい駒の上に重ねて置けます\n3. 先に縦・横・斜めに3つ並べた方の勝ち',
            kana: 'すたっく 三もくならべ\n\nこまを かさねられる 三もくならべです。\n\n1. かく ぷれいやーは S・M・L さいずの こまを 2こずつ もっています\n2. 大きい こまは 小さい こまの上に かさねて おけます\n3. さきに たて・よこ・ななめに 3つ ならべた ほうの かち'
        },
        'word-wolf': {
            ja: 'ワードウルフ\n\n違うお題を持つ少数派を見つけるゲームです。\n\n1. 各プレイヤーにお題が配られます（1人だけ違うお題）\n2. 制限時間内で自分のお題について話し合います\n3. 投票で少数派（ウルフ）を当てます',
            kana: 'わーどうるふ\n\nちがう おだいを もつ しょうすうはを みつける げーむです。\n\n1. かく ぷれいやーに おだいが くばられます（1人だけ ちがう おだい）\n2. せいげんじかんないで じぶんの おだいに ついて はなしあいます\n3. とうひょうで しょうすうは（うるふ）を あてます'
        },
        'quiz-iisen': {
            ja: 'いいセン行きまSHOW！\n\n答えが数字の問題で、みんなの答えの中央値を当てるゲームです。\n\n1. お題が発表されます\n2. 各プレイヤーが数字で答えます\n3. 中央値に一番近い人が得点',
            kana: 'いいせん いきまSHOW！\n\nこたえが す字の もんだいで、みんなの こたえの ちゅうおうちを あてる げーむです。\n\n1. おだいが はっぴょうされます\n2. かく ぷれいやーが す字で こたえます\n3. ちゅうおうちに いちばん ちかい人が とくてん'
        },
        'make-ten': {
            ja: '10パズル\n\n4つの数字を使って、答えが10になる式を作るゲームです。\n\n1. 4つの数字が表示されます\n2. すべての数字を1回ずつ使います\n3. 四則演算（+、-、×、÷）で答えが10になる式を作ります',
            kana: '10ぱずる\n\n4つのす字を つかって、こたえが 10に なる しきを つくる げーむです。\n\n1. 4つのす字が ひょうじされます\n2. すべてのす字を 1かいずつ つかいます\n3. しそくえんざん（+、-、×、÷）で こたえが 10に なる しきを つくります'
        },
        'ng-word': {
            ja: 'NGワードゲーム\n\n各参加者に「言ってはいけない言葉（NGワード）」が割り当てられ、そのワードを会話中に言ってしまった人が脱落するゲームです。自分のNGワードは自分では見えず、他の人からは見えるのがポイントです。\n\n1. 人数を決めてNGワードを割り当てる（2〜4人）\n2. 端末を回して、各自が「他の人のNGワード」を確認する（画面を隠して渡す）\n3. 会話スタート\n4. NGワードを言ってしまった人は脱落\n5. 最後まで残った人が勝利',
            kana: 'えぬじーわーど げーむ\n\nかく にんに「いっては いけない ことば（えぬじーわーど）」が 1つ きまります。じぶんの えぬじーわーどは じぶんでは みえません（ほかの ひとからは みえます）。\n\n1. にんずうを きめて、えぬじーわーどを わりあてます（2〜4にん）\n2. たんまつを まわして、かくじが「ほかの ひとの えぬじーわーど」を かくにんします（がめんを かくして わたす）\n3. かいわを すたーとします\n4. えぬじーわーどを いってしまった ひとは だつらく\n5. さいごまで のこった ひとが しょうり'
        },
    };

    // alert() はスマホで読みづらいため、専用モーダルで表示する。
    const ruleModal = {
        overlay: getEl('rule-modal'),
        titleEl: getEl('rule-modal-title'),
        bodyEl: getEl('rule-modal-body'),
        closeBtn: getEl('rule-modal-close'),
        lastFocused: null,

        open(text) {
            const [title, ...rest] = text.split('\n');
            this.titleEl.textContent = title;
            this.bodyEl.textContent = rest.join('\n').trim();
            this.lastFocused = document.activeElement;
            this.overlay.classList.remove('hidden');
            this.closeBtn.focus();
        },

        close() {
            this.overlay.classList.add('hidden');
            if (this.lastFocused && typeof this.lastFocused.focus === 'function') this.lastFocused.focus();
        },

        isOpen() {
            return !this.overlay.classList.contains('hidden');
        }
    };

    if (ruleModal.overlay) {
        ruleModal.closeBtn.addEventListener('click', () => ruleModal.close());
        ruleModal.overlay.addEventListener('click', (e) => {
            if (e.target === ruleModal.overlay) ruleModal.close();
        });
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && ruleModal.isOpen()) ruleModal.close();
        });
    }

    document.querySelectorAll('.rule-button').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const rule = gameRules[btn.dataset.game];
            if (!rule) return;
            const text = byMode(rule.ja, rule.kana);
            if (ruleModal.overlay) ruleModal.open(text); else alert(text);
        });
    });


    // =============================================
    //  NGワードゲーム
    // =============================================
    const ngw = {
        // themes.js が読み込めない/お題が空の場合の保険。ひらがなモードでも使えるように、原則かな表記のみ。
        fallbackWordList: [
            'やきにく','すし','らーめん','うどん','そば','ぱすた','ぴざ','はんばーがー','おにぎり','ぱん',
            'かれー','しちゅー','おむらいす','はんばーぐ','やきとり','たこやき','おこのみやき','おでん','なべ','さらだ',
            'ぎょうざ','からあげ','てんぷら','やきそば','ちゃーはん','どーなつ','けーき','ぷりん','ぜりー','あいす',
            'ちょこれーと','くっきー','がむ','ぐみ','らむね','ぽてとちっぷす','ぽっぷこーん','かきごおり','たいやき','くれーぷ',
            'じゅーす','おちゃ','みず','こーら','さいだー','みるく','ここあ','こーひー','すーぷ','みそしる',
            'りんご','みかん','いちご','ぶどう','すいか','めろん','ばなな','れもん','もも','なし',
            'とまと','きゅうり','にんじん','じゃがいも','たまねぎ','ぴーまん','きゃべつ','れたす','ぶろっこりー','こーん',
            'たまご','ちーず','ばたー','はむ','そーせーじ','つな','さーもん','まぐろ','えび','かに',
            'ねこ','いぬ','うさぎ','はむすたー','りす','くま','らいおん','とら','きりん','ぞう',
            'ぺんぎん','ぱんだ','さる','いるか','くじら','かめ','とり','からす','すずめ','はと',
            'さかな','たこ','いか','かえる','へび','とかげ','かぶとむし','くわがた','ちょう','てんとうむし',
            'さっかー','やきゅう','ばすけ','てにす','ばどみんとん','どっじぼーる','すいえい','たいそう','らんにんぐ','すけーと',
            'げーむ','あにめ','まんが','てれび','らじお','えほん','ほん','のーと','えんぴつ','けしごむ',
            'くれよん','はさみ','のり','せろてーぷ','ものさし','らんどせる','つくえ','いす','とけい','かめら',
            'すまほ','たぶれっと','ぱそこん','きーぼーど','まうす','りもこん','いやほん','すぴーかー','でんち','らいと',
            'でんしゃ','ばす','くるま','じてんしゃ','ひこうき','ふね','しんかんせん','たくしー','しょうぼうしゃ','きゅうきゅうしゃ',
            'こうえん','としょかん','どうぶつえん','すいぞくかん','がっこう','きょうしつ','きゅうしょく','しゅくだい','てすと','うんどうかい',
            'はなび','おまつり','はろうぃん','くりすます','おしょうがつ','たんじょうび','なつやすみ','ふゆやすみ','はる','なつ',
            'あき','ふゆ','あめ','はれ','ゆき','かぜ','たいふう','にじ','ほし','つき'
        ],
        fallbackWordListHiragana: [],
        players: [], // { name, ngWord }
        mode: null, // 'random' | 'custom'
        customInputIndex: 0,
        currentCheckIndex: 0,
        eliminated: [],
        timerInterval: null,
        timeLeft: 180,

        init() {
            this.players = [];
            this.mode = null;
            this.customInputIndex = 0;
            this.currentCheckIndex = 0;
            this.eliminated = [];
            this.timeLeft = 180;
            this.stopTimer();

            // ひらがな用フォールバックが空なら、通常フォールバックと同じにする（かな表記のみを想定）
            if (!Array.isArray(this.fallbackWordListHiragana) || this.fallbackWordListHiragana.length === 0) {
                this.fallbackWordListHiragana = [...this.fallbackWordList];
            }

            this.bindOnce();
            this.renderPlayerInputs();
            this.updateSkipButton();
            this.showScreen('ngw-player-setup');
        },

        bindOnce() {
            const root = getEl('page-ng-word');
            if (!root || root.dataset.ngwListenerAdded) return;

            getEl('ngw-player-count').addEventListener('change', () => this.renderPlayerInputs());
            getEl('ngw-confirm-names').addEventListener('click', () => this.confirmNames());

            getEl('ngw-random-mode').addEventListener('click', () => this.setupRandomMode());
            getEl('ngw-custom-mode').addEventListener('click', () => this.setupCustomMode());

            getEl('ngw-custom-next').addEventListener('click', () => this.confirmCustomWord());

            getEl('ngw-pass-next').addEventListener('click', () => this.showCheckScreen());

            getEl('ngw-confirm-check').addEventListener('click', () => this.confirmCheck());
            getEl('ngw-start-game').addEventListener('click', () => this.startGame());
            getEl('ngw-skip-topic').addEventListener('click', () => this.skipTopic());
            getEl('ngw-change-topic').addEventListener('click', () => this.changeTopicDuringCheck());
            getEl('ngw-timer-start').addEventListener('click', () => this.startTimer());
            getEl('ngw-finish').addEventListener('click', () => this.finishGame());
            getEl('ngw-reset').addEventListener('click', () => this.init());

            // 確認フェーズ：長押しで相手のワード一覧を表示
            this.addLongPress(getEl('ngw-reveal-others'), () => this.showOthersForCurrentPlayer(), () => this.hideOthersDisplay());

            // 画面切り替えのタイミングで残っていた表示を消す保険
            document.addEventListener('visibilitychange', () => {
                if (document.hidden) {
                    this.hideOthersDisplay();
                    this.hideOpponentDisplay();
                }
            });

            root.dataset.ngwListenerAdded = 'true';
        },

        showScreen(screenId) {
            document.querySelectorAll('#ngw-main > div').forEach(div => div.classList.add('hidden'));
            getEl(screenId).classList.remove('hidden');

            if (screenId === 'ngw-ready') {
                this.updateSkipButton();
            }
            if (screenId === 'ngw-check') {
                this.updateChangeTopicButton();
            }
        },

        updateSkipButton() {
            const btn = getEl('ngw-skip-topic');
            if (!btn) return;

            const shouldShow = (this.mode === 'random' && this.players.length >= 2);
            btn.classList.toggle('hidden', !shouldShow);
            btn.disabled = !shouldShow;

            if (isKana()) {
                btn.textContent = 'おだいを すきっぷ（さいちゅうせん）';
            } else {
                btn.textContent = 'お題をスキップ（再抽選）';
            }
        },

        updateChangeTopicButton() {
            const btn = getEl('ngw-change-topic');
            if (!btn) return;

            const shouldShow = (this.mode === 'random');
            btn.classList.toggle('hidden', !shouldShow);
            btn.disabled = !shouldShow;

            if (isKana()) {
                btn.textContent = 'あいての えぬじーわーどを かえる（さいちゅうせん）';
            } else {
                btn.textContent = '相手のNGワードを変える（再抽選）';
            }
        },

        getRandomSource() {
            const pool = this.getWordPool();
            const extras = isKana()
                ? this.fallbackWordListHiragana
                : this.fallbackWordList;
            return Array.from(new Set([...(pool || []), ...(extras || [])]));
        },

        pickNewWord(excludedSet, previousWord) {
            const source = this.getRandomSource();
            if (source.length === 0) return null;

            const byUniqueAndDifferent = source.filter(w => !excludedSet.has(w) && w !== previousWord);
            if (byUniqueAndDifferent.length > 0) return shuffle(byUniqueAndDifferent)[0];

            const byUnique = source.filter(w => !excludedSet.has(w));
            if (byUnique.length > 0) return shuffle(byUnique)[0];

            const byDifferent = source.filter(w => w !== previousWord);
            if (byDifferent.length > 0) return shuffle(byDifferent)[0];

            return shuffle(source)[0];
        },

        rerollAllWords() {
            const source = this.getRandomSource();
            if (source.length < this.players.length) {
                alertByMode(
                    'お題（NGワード）の数が足りません。設定画面でお題を追加してください。',
                    'わーどが たりません。せっていがめんで ついかしてください。'
                );
                return false;
            }

            const picked = shuffle(source).slice(0, this.players.length);
            this.players.forEach((p, i) => p.ngWord = picked[i]);
            return true;
        },

        rerollOpponentsWords(viewerIndex) {
            // viewerIndex（確認している人）自身のNGは変えず、自分以外（相手側）のNGを再抽選する。
            if (viewerIndex < 0 || viewerIndex >= this.players.length) return false;

            const reserved = new Set();
            const myWord = this.players[viewerIndex]?.ngWord;
            if (myWord) reserved.add(myWord);

            for (let i = 0; i < this.players.length; i++) {
                if (i === viewerIndex) continue;

                const prev = this.players[i]?.ngWord || '';
                const next = this.pickNewWord(reserved, prev);
                if (!next) return false;
                this.players[i].ngWord = next;
                reserved.add(next);
            }

            return true;
        },

        renderPlayerInputs() {
            const count = parseInt(getEl('ngw-player-count').value, 10);
            const safeCount = Math.min(4, Math.max(2, isNaN(count) ? 4 : count));
            getEl('ngw-player-count').value = safeCount;

            const container = getEl('ngw-player-inputs');
            container.innerHTML = '';
            for (let i = 0; i < safeCount; i++) {
                const isHira = isKana();
                const labelText = isHira ? `ぷれいやー${i + 1}` : `プレイヤー${i + 1}`;
                const placeholderText = isHira ? `ぷれいやー${i + 1}の なまえ` : `プレイヤー${i + 1}の名前`;
                const wrap = document.createElement('div');
                wrap.style.margin = '14px 0';
                wrap.innerHTML = `
                    <label class="ngw-player-label" for="ngw-player-name-${i}">${escapeHtml(labelText)}</label>
                    <input type="text" id="ngw-player-name-${i}" class="ngw-player-input" placeholder="${escapeHtml(placeholderText)}" value="${escapeHtml(labelText)}">
                `;
                container.appendChild(wrap);
            }
        },

        confirmNames() {
            const count = parseInt(getEl('ngw-player-count').value, 10);
            if (isNaN(count) || count < 2 || count > 4) {
                alertByMode('2〜4人で設定してください。', '2〜4にんで せっていしてください。');
                return;
            }

            const names = [];
            for (let i = 0; i < count; i++) {
                const input = getEl(`ngw-player-name-${i}`);
                names.push((input?.value || '').trim() || `Player ${i + 1}`);
            }

            this.players = names.map(name => ({ name, ngWord: '' }));
            this.mode = null;
            this.updateSkipButton();
            this.showScreen('ngw-mode-select');
        },

        getWordPool() {
            const list = themes['NGワードゲーム'];
            let pool = (Array.isArray(list) && list.length > 0) ? list : this.fallbackWordList;
            if (isKana()) {
                pool = pool.filter(w => !containsKanji(w));
                if (pool.length === 0) pool = this.fallbackWordListHiragana;
            }
            return pool;
        },

        setupRandomMode() {
            this.mode = 'random';
            if (!this.rerollAllWords()) return;
            this.startCheckFlow();
        },

        setupCustomMode() {
            this.mode = 'custom';
            this.players.forEach(p => p.ngWord = '');
            this.customInputIndex = 0;
            getEl('ngw-custom-word').value = '';
            this.updateCustomInstruction();
            this.showScreen('ngw-custom-input');
        },

        skipTopic() {
            if (this.mode !== 'random') return;

            const ok = confirmByMode(
                'お題（NGワード）をスキップして再抽選しますか？\n※確認フェーズからやり直します',
                'おだい（えぬじーわーど）を すきっぷして さいちゅうせんしますか？\n※かくにんふぇーずから やりなおします'
            );
            if (!ok) return;

            if (!this.rerollAllWords()) return;
            this.startCheckFlow();
        },

        updateCustomInstruction() {
            const targetIndex = this.customInputIndex;
            const setterIndex = (targetIndex + 1) % this.players.length;
            const target = this.players[targetIndex];
            const setter = this.players[setterIndex];
            const targetName = escapeHtml(target.name);
            const setterName = escapeHtml(setter.name);
            getEl('ngw-custom-instruction').innerHTML = byMode(
                `${targetName}のNGワードを設定してください<br>（${setterName}が入力）`,
                `${targetName}の えぬじーわーどを せっていしてください<br>（${setterName}が にゅうりょく）`
            );
        },

        confirmCustomWord() {
            const input = getEl('ngw-custom-word').value.trim();
            if (!input) {
                alertByMode('NGワードを入力してください', 'えぬじーわーどを にゅうりょくしてください');
                return;
            }
            if (isKana() && containsKanji(input)) {
                alert('かんじは つかえません。ひらがな か かたかなで にゅうりょくしてください。');
                return;
            }
            const used = new Set(this.players.map(p => p.ngWord).filter(Boolean));
            if (used.has(input)) {
                alertByMode('同じワードは設定できません。別のワードを入力してください。', 'おなじわーどは せっていできません。べつのわーどを にゅうりょくしてください。');
                return;
            }

            this.players[this.customInputIndex].ngWord = input;
            getEl('ngw-custom-word').value = '';
            this.customInputIndex++;

            if (this.customInputIndex >= this.players.length) {
                this.startCheckFlow();
                return;
            }

            this.updateCustomInstruction();
        },

        startCheckFlow() {
            this.currentCheckIndex = 0;
            this.hideOthersDisplay();
            this.showPassScreen();
        },

        showPassScreen() {
            const current = this.players[this.currentCheckIndex];
            getEl('ngw-pass-player').textContent = current.name;
            this.showScreen('ngw-pass');
        },

        showCheckScreen() {
            const current = this.players[this.currentCheckIndex];
            getEl('ngw-check-player').textContent = current.name;
            this.hideOthersDisplay();
            this.showScreen('ngw-check');
        },

        changeTopicDuringCheck() {
            // ランダムモード中のみ
            if (this.mode !== 'random') return;

            const ok = confirmByMode(
                '相手のNGワードを再抽選しますか？\n※あなたが見える相手側のワードが変わります',
                'あいての えぬじーわーどを さいちゅうせんしますか？\n※あなたが みえる あいてがわの わーどが かわります'
            );
            if (!ok) return;

            // 即時に差し替え（確認の順番は維持）
            const okReroll = this.rerollOpponentsWords(this.currentCheckIndex);
            if (!okReroll) {
                alertByMode('再抽選できませんでした。お題が足りないかもしれません。', 'さいちゅうせん できませんでした。');
                return;
            }

            // 表示中なら一覧も即更新
            if (!getEl('ngw-others-display').classList.contains('hidden')) {
                this.showOthersForCurrentPlayer();
            }
            alertByMode('再抽選しました。続けて確認してください。', 'さいちゅうせんしました。つづけて かくにんしてください。');
        },

        showOthersForCurrentPlayer() {
            const meIndex = this.currentCheckIndex;
            const listEl = getEl('ngw-others-list');
            listEl.innerHTML = '';
            this.players.forEach((p, i) => {
                if (i === meIndex) return;
                const li = document.createElement('li');
                li.style.padding = '8px 0';
                li.style.borderBottom = '1px dashed var(--border-color)';
                li.innerHTML = `<span class="ngw-name">${escapeHtml(p.name)}</span>: ${escapeHtml(p.ngWord)}`;
                listEl.appendChild(li);
            });
            if (listEl.lastElementChild) listEl.lastElementChild.style.borderBottom = 'none';
            getEl('ngw-others-display').classList.remove('hidden');
        },

        hideOthersDisplay() {
            getEl('ngw-others-display').classList.add('hidden');
        },

        confirmCheck() {
            this.hideOthersDisplay();
            this.currentCheckIndex++;
            if (this.currentCheckIndex < this.players.length) {
                this.showPassScreen();
            } else {
                this.showScreen('ngw-ready');
            }
        },

        startGame() {
            this.eliminated = Array(this.players.length).fill(false);
            this.timeLeft = 180;
            this.updateTimerDisplay();

            const timerBtn = getEl('ngw-timer-start');
            timerBtn.textContent = byMode('タイマースタート', 'たいまーすたーと');
            timerBtn.disabled = false;

            this.renderGamePlayers();
            this.renderGameCheckButtons();
            this.renderOutButtons();
            this.hideOpponentDisplay();

            this.showScreen('ngw-game');
        },

        renderGamePlayers() {
            const grid = getEl('ngw-game-players');
            grid.innerHTML = '';
            this.players.forEach((p, i) => {
                const box = document.createElement('div');
                box.style.textAlign = 'center';
                box.style.padding = '8px 6px';
                box.style.border = '2px solid var(--border-color)';
                box.style.borderRadius = '8px';
                box.style.background = this.eliminated[i] ? 'var(--eliminated-bg)' : 'var(--card-bg-color)';

                const status = this.eliminated[i] ? '脱落' : '生存';
                const statusColor = this.eliminated[i] ? 'var(--danger-color)' : 'var(--success-color)';

                box.innerHTML = `
                    <div class="ngw-name">${escapeHtml(p.name)}</div>
                    <div class="ngw-status" style="color: ${statusColor};">${escapeHtml(status)}</div>
                `;
                grid.appendChild(box);
            });
        },

        renderGameCheckButtons() {
            const container = getEl('ngw-game-check-buttons');
            container.innerHTML = '';

            this.players.forEach((p, i) => {
                const btn = document.createElement('button');
                btn.className = 'sub-button';
                btn.style.width = '100%';
                btn.style.marginBottom = '10px';
                btn.textContent = `${p.name}: 相手のワードを見る（長押し）`;
                btn.dataset.playerIndex = String(i);
                container.appendChild(btn);

                this.addLongPress(
                    btn,
                    () => this.showOpponentWordsForPlayer(i),
                    () => this.hideOpponentDisplay()
                );
            });
        },

        showOpponentWordsForPlayer(meIndex) {
            const listEl = getEl('ngw-opponent-list');
            listEl.innerHTML = '';
            this.players.forEach((p, i) => {
                if (i === meIndex) return;
                const li = document.createElement('li');
                li.style.padding = '8px 0';
                li.style.borderBottom = '1px dashed var(--border-color)';
                li.innerHTML = `<span class="ngw-name">${escapeHtml(p.name)}</span>: ${escapeHtml(p.ngWord)}`;
                listEl.appendChild(li);
            });
            if (listEl.lastElementChild) listEl.lastElementChild.style.borderBottom = 'none';
            getEl('ngw-opponent-display').classList.remove('hidden');
        },

        hideOpponentDisplay() {
            getEl('ngw-opponent-display').classList.add('hidden');
        },

        renderOutButtons() {
            const container = getEl('ngw-out-buttons');
            container.innerHTML = '';
            this.players.forEach((p, i) => {
                const btn = document.createElement('button');
                btn.className = 'main-button';
                btn.style.width = '100%';
                btn.style.margin = '0 0 10px';
                btn.textContent = `${p.name}が言った（脱落）`;
                btn.disabled = this.eliminated[i];
                btn.addEventListener('click', () => this.markOut(i));
                container.appendChild(btn);
            });
        },

        markOut(index) {
            if (this.eliminated[index]) return;
            this.eliminated[index] = true;
            this.renderGamePlayers();
            this.renderOutButtons();

            const remaining = this.eliminated.filter(v => !v).length;
            if (remaining <= 1) {
                const winnerIndex = this.eliminated.findIndex(v => !v);
                this.declareWinner(winnerIndex);
            }
        },

        finishGame() {
            // 途中終了：残っている人を勝者扱い（複数なら引き分け）
            const aliveIndexes = this.eliminated.map((v, i) => ({ v, i })).filter(x => !x.v).map(x => x.i);
            if (aliveIndexes.length === 1) {
                this.declareWinner(aliveIndexes[0]);
                return;
            }
            this.stopTimer();
            const aliveNames = aliveIndexes.map(i => this.players[i].name);
            getEl('ngw-winner').textContent = aliveNames.length === 0 ? '全員脱落（引き分け）' : `引き分け（残り: ${aliveNames.join('、')}）`;
            this.renderResultList();
            this.showScreen('ngw-result');
        },

        declareWinner(winnerIndex) {
            this.stopTimer();

            if (winnerIndex < 0) {
                getEl('ngw-winner').textContent = '全員脱落（引き分け）';
            } else {
                getEl('ngw-winner').textContent = `${this.players[winnerIndex].name} の勝利！`;
            }

            this.renderResultList(winnerIndex);
            this.showScreen('ngw-result');
        },

        renderResultList(winnerIndex = -1) {
            const listEl = getEl('ngw-result-list');
            listEl.innerHTML = '';
            this.players.forEach((p, i) => {
                const li = document.createElement('li');
                li.style.padding = '10px 0';
                li.style.borderBottom = '1px dashed var(--border-color)';
                const status = this.eliminated[i] ? '脱落' : '生存';
                const statusColor = this.eliminated[i] ? 'var(--danger-color)' : 'var(--success-color)';
                const winnerMark = i === winnerIndex ? '【勝者】' : '';
                li.innerHTML = `<span class="ngw-name">${escapeHtml(p.name)}</span>${winnerMark ? ' ' + winnerMark : ''}: <span class="ngw-word">${escapeHtml(p.ngWord)}</span> <span style="color:${statusColor};">(${escapeHtml(status)})</span>`;
                listEl.appendChild(li);
            });
            if (listEl.lastElementChild) listEl.lastElementChild.style.borderBottom = 'none';
        },

        startTimer() {
            if (this.timerInterval) return;

            this.timerInterval = setInterval(() => {
                this.timeLeft--;
                this.updateTimerDisplay();
                if (this.timeLeft <= 0) {
                    this.stopTimer();
                    const btn = getEl('ngw-timer-start');
                    if (btn) { btn.textContent = byMode('タイマースタート', 'たいまーすたーと'); btn.disabled = false; }
                    alertByMode('時間切れです！', 'じかんぎれです！');
                }
            }, 1000);

            const btn = getEl('ngw-timer-start');
            btn.textContent = byMode('進行中...', 'しんこうちゅう...');
            btn.disabled = true;
        },

        stopTimer() {
            if (this.timerInterval) {
                clearInterval(this.timerInterval);
                this.timerInterval = null;
            }
        },

        updateTimerDisplay() {
            const minutes = Math.floor(this.timeLeft / 60);
            const seconds = this.timeLeft % 60;
            getEl('ngw-timer').textContent = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
        },

        addLongPress(el, onPress, onRelease) {
            if (!el) return;
            let pressTimer;
            const delay = 200;

            const start = (e) => {
                // スクロール抑制（押しっぱなし表示用）
                if (e && e.type === 'touchstart') e.preventDefault();
                clearTimeout(pressTimer);
                pressTimer = setTimeout(() => onPress(), delay);
            };
            const end = (e) => {
                if (e && (e.type === 'touchend' || e.type === 'touchcancel')) e.preventDefault();
                clearTimeout(pressTimer);
                onRelease();
            };

            el.addEventListener('mousedown', start);
            el.addEventListener('mouseup', end);
            el.addEventListener('mouseleave', end);
            el.addEventListener('touchstart', start, { passive: false });
            el.addEventListener('touchend', end, { passive: false });
            el.addEventListener('touchcancel', end, { passive: false });
        }
    };
    registerTimerOwner(ngw);

    // --- PWA: オフラインでも遊べるようにする ---------------------------------
    if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
            navigator.serviceWorker.register('sw.js').catch(err => {
                console.warn('Service worker registration failed.', err);
            });
        });
    }
});