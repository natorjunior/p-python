/* ===== FASE 1 — Primeiros Passos ===== */

(function () {
    "use strict";

    /* ===== CONFIG ===== */
    const TILE = 100;
    const COLS = 10;
    const ROWS = 6;
    const GAME_W = TILE * COLS;   // 1000
    const GAME_H = TILE * ROWS;   // 600
    const GROUND_ROW = 5;
    const MAX_COMMANDS = 4;
    const PLAYER_START = { col: 2, row: GROUND_ROW };
    const TREASURE_COL = PLAYER_START.col + MAX_COMMANDS;
    const PLAYER_W = 40;
    const PLAYER_H = 50;
    const GOAL_W = 42;
    const GOAL_H = 50;
    const SPEED_MAP = {
        slow: 2.1,
        fast: 5.8,
    };
    const LOSS_DELAY = 1200;
    const AVAILABLE_COMMANDS = ["step_right()", "step_left()"];

    /* ===== DOM ===== */
    const editorEl = document.getElementById("code-editor");
    const gutterEl = document.getElementById("gutter");
    const highlightEl = document.getElementById("code-highlight");
    const activeLineEl = document.getElementById("active-line-highlight");
    const runBtn = document.getElementById("run-btn");
    const resetBtn = document.getElementById("reset-btn");
    const speedSlowBtn = document.getElementById("speed-slow-btn");
    const speedFastBtn = document.getElementById("speed-fast-btn");
    const terminalOutput = document.getElementById("terminal-output");
    const sbLine = document.getElementById("sb-line");
    const sbCol = document.getElementById("sb-col");
    const sbErrors = document.getElementById("sb-errors");
    const sbErrorsText = document.getElementById("sb-errors-text");
    const victoryOverlay = document.getElementById("victory-overlay");
    const editorAreaEl = document.querySelector(".ide-editor-area");
    const autocompleteEl = document.createElement("div");
    autocompleteEl.className = "code-autocomplete";
    autocompleteEl.style.display = "none";
    if (editorAreaEl) {
        editorAreaEl.appendChild(autocompleteEl);
    }

    /* ===== STATE ===== */
    let isExecuting = false;
    let execId = 0;
    let hasWon = false;
    let currentHighlightLine = -1;
    let selectedSpeed = "slow";
    var autocompleteState = {
        visible: false,
        matches: [],
        selectedIndex: 0,
        replaceStart: 0,
        lineIndex: 0,
        colChars: 0,
    };
    var stepDots = {};

    /* ===== HELPERS ===== */
    function colToX(col) { return col * TILE; }
    function rowToY(row) { return row * TILE; }

    function termLog(msg, cls) {
        cls = cls || "term-output";
        terminalOutput.className = cls;
        terminalOutput.textContent = msg;
    }

    function termLogHtml(html) {
        terminalOutput.innerHTML = html;
    }

    /* ===== CRAFTY INIT ===== */
    Crafty.init(GAME_W, GAME_H, document.getElementById("game"));
    Crafty.viewport.clampToEntities = false;
    Crafty.background("#1a1b26");

    /* ===== BUILD SCENE ===== */
    function buildScene() {
        // --- Background gradient sky ---
        const skyColors = ["#1a1b26", "#1a1b2e", "#1e2030", "#24273a", "#363a4f"];
        for (let r = 0; r < GROUND_ROW; r++) {
            Crafty.e("2D, DOM, Color")
                .attr({ x: 0, y: r * TILE, w: GAME_W, h: TILE })
                .color(skyColors[r] || "#24273a");
        }

        // --- Stars ---
        const STAR_COUNT = 28;
        for (let s = 0; s < STAR_COUNT; s++) {
            const posX = 28 + Math.random() * (GAME_W - 56);
            const posY = 16 + Math.random() * (GROUND_ROW * TILE * 0.46);
            const size = 1 + Math.floor(Math.random() * 3);
            const star = Crafty.e("2D, DOM, Color")
                .attr({ x: posX, y: posY, w: size, h: size })
                .color("#cad3f5");
            star._baseAlpha = 0.3 + Math.random() * 0.5;
            star._speed = 0.01 + Math.random() * 0.02;
            star._phase = Math.random() * Math.PI * 2;
            star.css({ opacity: star._baseAlpha, "border-radius": "50%" });
            star.bind("EnterFrame", function (e) {
                var a = this._baseAlpha + Math.sin(e.frame * this._speed + this._phase) * 0.3;
                this.css({ opacity: Math.max(0.1, Math.min(1, a)) });
            });
        }

        // --- Moon ---
        Crafty.e("2D, DOM, Color")
            .attr({ x: GAME_W - 100, y: 30, w: 50, h: 50 })
            .color("#f5e0dc")
            .css({ "border-radius": "50%", "box-shadow": "0 0 30px rgba(245,224,220,0.15)" });
        // moon crater
        Crafty.e("2D, DOM, Color")
            .attr({ x: GAME_W - 88, y: 42, w: 10, h: 10 })
            .color("#dcd3cd")
            .css({ "border-radius": "50%", opacity: "0.5" });

        // --- Ground ---
        Crafty.e("2D, DOM, Color, Solid")
            .attr({ x: 0, y: GROUND_ROW * TILE, w: GAME_W, h: TILE })
            .color("#363a4f");

        // Ground top line
        Crafty.e("2D, DOM, Color")
            .attr({ x: 0, y: GROUND_ROW * TILE, w: GAME_W, h: 3 })
            .color("#a6e3a1")
            .css({ opacity: "0.4" });

        // --- Grid dots (subtle) ---
        for (let c = 0; c < COLS; c++) {
            for (let r = GROUND_ROW; r <= GROUND_ROW; r++) {
                Crafty.e("2D, DOM, Color")
                    .attr({ x: c * TILE + TILE / 2 - 1, y: r * TILE + TILE / 2 - 1, w: 2, h: 2 })
                    .color("#585b70")
                    .css({ "border-radius": "50%" });
            }
        }

        // --- Path markers (subtle dashes on ground) ---
        for (let c = PLAYER_START.col; c <= TREASURE_COL; c++) {
            Crafty.e("2D, DOM, Color")
                .attr({ x: c * TILE + 10, y: GROUND_ROW * TILE + TILE - 12, w: TILE - 20, h: 2 })
                .color("#45475a");
        }

        // --- Step indicators (small arrows/dots) ---
        for (let c = PLAYER_START.col + 1; c <= TREASURE_COL; c++) {
            stepDots[c] = Crafty.e("2D, DOM, Color")
                .attr({ x: c * TILE + TILE / 2 - 6, y: GROUND_ROW * TILE + 10, w: 12, h: 12, z: 18 })
                .color("#585b70")
                .css({
                    "border-radius": "50%",
                    opacity: "0.92",
                    "box-shadow": "0 0 0 2px rgba(137,180,250,0.22) inset, 0 0 0 1px rgba(17,17,27,0.55)"
                });
        }
    }

    buildScene();

    /* ===== GOAL (FLAG) ===== */
    var treasureX = colToX(TREASURE_COL) + (TILE - GOAL_W) / 2;
    var treasureY = rowToY(GROUND_ROW) - GOAL_H;

    var treasure = Crafty.e("2D, DOM, Image, Collision, Treasure")
        .attr({ x: treasureX, y: treasureY, w: GOAL_W, h: GOAL_H })
        .image("../assets/img/bandeira1.png", "no-repeat")
        .css({
            "background-size": "contain",
            "background-position": "center bottom",
            "image-rendering": "pixelated",
        });

    /* ===== PLAYER ===== */
    var playerStartX = colToX(PLAYER_START.col) + (TILE - PLAYER_W) / 2;
    var playerStartY = rowToY(GROUND_ROW) - PLAYER_H;

    var player = Crafty.e("2D, DOM, Image, Collision")
        .attr({ x: playerStartX, y: playerStartY, w: PLAYER_W, h: PLAYER_H })
        .image("../assets/img/player.png", "no-repeat")
        .css({
            "background-size": "contain",
            "background-position": "center bottom",
            "image-rendering": "pixelated",
            "transition": "none",
        });

    /* ===== SYNTAX HIGHLIGHTING ===== */
    var PY_KEYWORDS = /\b(def|class|if|elif|else|for|while|return|import|from|as|try|except|finally|with|yield|lambda|pass|break|continue|raise|in|not|and|or|is|global|nonlocal|assert|del|async|await)\b/g;
    var PY_BUILTINS = /\b(print|range|len|int|str|float|list|dict|set|tuple|type|input|open|enumerate|zip|map|filter|sorted|reversed|min|max|sum|abs|round|isinstance|hasattr|getattr|setattr)\b/g;
    var PY_BOOLNONE = /\b(True|False|None)\b/g;
    var PY_DECORATORS = /@\w+/g;
    var PY_NUMBERS = /\b\d+(\.\d+)?\b/g;
    var PY_STRINGS = /("""[\s\S]*?"""|'''[\s\S]*?'''|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*')/g;
    var PY_COMMENTS = /#.*/g;
    var PY_FUNCTIONS = /\b([a-zA-Z_]\w*)\s*(?=\()/g;
    var PY_SELF = /\bself\b/g;
    var PY_PARENS = /[()[\]{}]/g;

    function escapeHtml(text) {
        return text
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;");
    }

    function highlightPython(code) {
        // Tokenize with priorities: comments > strings > rest
        var tokens = [];
        var used = new Array(code.length);

        function markTokens(regex, cls) {
            var m;
            regex.lastIndex = 0;
            while ((m = regex.exec(code)) !== null) {
                var start = m.index;
                var end = start + m[0].length;
                var overlap = false;
                for (var i = start; i < end; i++) {
                    if (used[i]) { overlap = true; break; }
                }
                if (overlap) continue;
                for (var j = start; j < end; j++) used[j] = true;
                tokens.push({ start: start, end: end, cls: cls, text: m[0] });
            }
        }

        markTokens(PY_COMMENTS, "syn-comment");
        markTokens(PY_STRINGS, "syn-string");
        markTokens(PY_DECORATORS, "syn-decorator");
        markTokens(PY_KEYWORDS, "syn-keyword");
        markTokens(PY_BOOLNONE, "syn-bool");
        markTokens(PY_SELF, "syn-self");
        markTokens(PY_BUILTINS, "syn-builtin");
        markTokens(PY_FUNCTIONS, "syn-function");
        markTokens(PY_NUMBERS, "syn-number");
        markTokens(PY_PARENS, "syn-paren");

        tokens.sort(function (a, b) { return a.start - b.start; });

        var result = "";
        var cursor = 0;

        for (var t = 0; t < tokens.length; t++) {
            var tok = tokens[t];
            if (tok.start > cursor) {
                result += escapeHtml(code.substring(cursor, tok.start));
            }
            result += '<span class="' + tok.cls + '">' + escapeHtml(tok.text) + '</span>';
            cursor = tok.end;
        }

        if (cursor < code.length) {
            result += escapeHtml(code.substring(cursor));
        }

        return result;
    }

    /* ===== GUTTER / LINE NUMBERS ===== */
    function updateGutter() {
        var lines = editorEl.value.split("\n");
        var count = Math.max(lines.length, MAX_COMMANDS, 8);
        var cursorLine = getCurrentLine();
        var html = "";
        for (var i = 1; i <= count; i++) {
            var cls = i === cursorLine ? ' class="active-line"' : '';
            html += "<span" + cls + ">" + i + "</span>";
        }
        gutterEl.innerHTML = html;
    }

    /* ===== HIGHLIGHT OVERLAY ===== */
    function updateHighlight() {
        highlightEl.innerHTML = highlightPython(editorEl.value) + "\n";
    }

    /* ===== ACTIVE LINE ===== */
    function getCurrentLine() {
        var pos = editorEl.selectionStart;
        var text = editorEl.value.substring(0, pos);
        return text.split("\n").length;
    }

    function updateActiveLine() {
        var line = getCurrentLine();
        if (line === currentHighlightLine) return;
        currentHighlightLine = line;
        activeLineEl.style.top = ((line - 1) * 22 + 10) + "px";
        updateGutter();
    }

    /* ===== CURSOR POSITION IN STATUS BAR ===== */
    function updateCursorInfo() {
        var pos = editorEl.selectionStart;
        var before = editorEl.value.substring(0, pos);
        var lines = before.split("\n");
        var ln = lines.length;
        var col = lines[lines.length - 1].length + 1;
        sbLine.textContent = ln;
        sbCol.textContent = col;
        updateActiveLine();
        updateAutocomplete();
    }

    /* ===== AUTOCOMPLETE ===== */
    function hideAutocomplete() {
        autocompleteState.visible = false;
        autocompleteState.matches = [];
        autocompleteEl.style.display = "none";
        autocompleteEl.innerHTML = "";
    }

    function getAutocompleteContext() {
        if (!editorAreaEl) return null;
        if (editorEl.selectionStart !== editorEl.selectionEnd) return null;

        var pos = editorEl.selectionStart;
        var value = editorEl.value;
        var lineStart = value.lastIndexOf("\n", pos - 1) + 1;
        var beforeCursor = value.substring(lineStart, pos);
        var leadingSpaces = (beforeCursor.match(/^\s*/) || [""])[0];
        var token = beforeCursor.substring(leadingSpaces.length);

        if (!token) return null;
        if (token.charAt(0) === "#") return null;
        if (/\s/.test(token)) return null;
        if (!/^[a-z_()]*$/i.test(token)) return null;

        var matches = AVAILABLE_COMMANDS.filter(function (cmd) {
            return cmd.indexOf(token) === 0 && cmd !== token;
        });

        if (matches.length === 0) return null;

        return {
            matches: matches,
            replaceStart: lineStart + leadingSpaces.length,
            lineIndex: value.substring(0, pos).split("\n").length - 1,
            colChars: beforeCursor.length,
        };
    }

    function updateAutocompletePosition() {
        if (!autocompleteState.visible || !editorAreaEl) return;

        var approxCharWidth = 7.8;
        var top = 10 + autocompleteState.lineIndex * 22 + 24 - editorEl.scrollTop;
        var left = 16 + autocompleteState.colChars * approxCharWidth - editorEl.scrollLeft;
        var maxLeft = Math.max(10, editorAreaEl.clientWidth - 210);

        if (left > maxLeft) left = maxLeft;
        if (left < 10) left = 10;
        if (top < 8) top = 8;

        autocompleteEl.style.top = top + "px";
        autocompleteEl.style.left = left + "px";

        var boxHeight = autocompleteEl.offsetHeight || 0;
        if (top + boxHeight > editorAreaEl.clientHeight - 8) {
            var aboveTop = 10 + autocompleteState.lineIndex * 22 - boxHeight - 2 - editorEl.scrollTop;
            autocompleteEl.style.top = Math.max(8, aboveTop) + "px";
        }
    }

    function renderAutocomplete() {
        if (!autocompleteState.visible) return;

        var html = "";
        for (var i = 0; i < autocompleteState.matches.length; i++) {
            var activeClass = i === autocompleteState.selectedIndex ? " active" : "";
            html += '<button type="button" class="code-autocomplete-item' + activeClass + '" data-index="' + i + '">' +
                autocompleteState.matches[i] +
                "</button>";
        }

        autocompleteEl.innerHTML = html;
        autocompleteEl.style.display = "block";

        var items = autocompleteEl.querySelectorAll(".code-autocomplete-item");
        items.forEach(function (item) {
            item.addEventListener("mousedown", function (e) {
                e.preventDefault();
                autocompleteState.selectedIndex = Number(item.getAttribute("data-index")) || 0;
                applyAutocomplete();
            });
        });

        updateAutocompletePosition();
    }

    function updateAutocomplete() {
        var context = getAutocompleteContext();
        if (!context) {
            hideAutocomplete();
            return;
        }

        var previousSelected = autocompleteState.matches[autocompleteState.selectedIndex] || "";

        autocompleteState.visible = true;
        autocompleteState.matches = context.matches;
        autocompleteState.selectedIndex = 0;
        if (previousSelected) {
            var prevIndex = context.matches.indexOf(previousSelected);
            if (prevIndex >= 0) {
                autocompleteState.selectedIndex = prevIndex;
            }
        }
        autocompleteState.replaceStart = context.replaceStart;
        autocompleteState.lineIndex = context.lineIndex;
        autocompleteState.colChars = context.colChars;
        renderAutocomplete();
    }

    function applyAutocomplete() {
        if (!autocompleteState.visible) return false;
        var selected = autocompleteState.matches[autocompleteState.selectedIndex];
        if (!selected) return false;

        var start = autocompleteState.replaceStart;
        var end = editorEl.selectionStart;
        var value = editorEl.value;
        editorEl.value = value.substring(0, start) + selected + value.substring(end);
        editorEl.selectionStart = editorEl.selectionEnd = start + selected.length;
        hideAutocomplete();
        onEditorChange();
        return true;
    }

    function moveAutocompleteSelection(delta) {
        if (!autocompleteState.visible) return;
        var len = autocompleteState.matches.length;
        if (!len) return;
        autocompleteState.selectedIndex = (autocompleteState.selectedIndex + delta + len) % len;
        renderAutocomplete();
    }

    /* ===== RESET ===== */
    function resetPlayerPosition() {
        player.attr({ x: playerStartX, y: playerStartY });
    }

    function resetStepDots() {
        Object.keys(stepDots).forEach(function (col) {
            stepDots[col]
                .color("#585b70")
                .css({
                    opacity: "0.92",
                    "box-shadow": "0 0 0 2px rgba(137,180,250,0.22) inset, 0 0 0 1px rgba(17,17,27,0.55)"
                });
        });
    }

    function markStepPassed(col) {
        var dot = stepDots[col];
        if (!dot) return;
        dot.color("#a6e3a1");
        dot.css({
            opacity: "1",
            "box-shadow": "0 0 0 2px rgba(166,227,161,0.65) inset, 0 0 16px rgba(166,227,161,0.62)"
        });
    }

    function applySpeedSelection(mode) {
        selectedSpeed = mode === "fast" ? "fast" : "slow";
        speedSlowBtn.classList.toggle("active", selectedSpeed === "slow");
        speedFastBtn.classList.toggle("active", selectedSpeed === "fast");
        speedSlowBtn.setAttribute("aria-pressed", selectedSpeed === "slow" ? "true" : "false");
        speedFastBtn.setAttribute("aria-pressed", selectedSpeed === "fast" ? "true" : "false");
    }

    function setVictoryVisible(visible) {
        if (!victoryOverlay) return;
        if (visible) {
            victoryOverlay.classList.add("show");
            victoryOverlay.style.display = "flex";
        } else {
            victoryOverlay.classList.remove("show");
            victoryOverlay.style.display = "";
        }
    }

    function resetPlayer() {
        execId++;
        isExecuting = false;
        hasWon = false;
        resetPlayerPosition();
        resetStepDots();
        hideAutocomplete();
        runBtn.disabled = false;
        setVictoryVisible(false);
        termLog("Posição restaurada. Pronto.", "term-output");
        updateErrorStatus(0);
    }

    // expose globally for onclick
    window.resetPlayer = resetPlayer;

    /* ===== VICTORY CHECK ===== */
    function checkTreasure() {
        if (hasWon) return;
        var hit = player.hit("Treasure");
        if (!hit) return;
        for (var i = 0; i < hit.length; i++) {
            if (hit[i].obj[0] === treasure[0]) {
                hasWon = true;
                isExecuting = false;
                runBtn.disabled = false;
                termLog("✓ Vitória! Tesouro coletado.", "term-success");
                updateErrorStatus(0);
                setVictoryVisible(true);
                return;
            }
        }
    }

    player.bind("EnterFrame", checkTreasure);

    /* ===== MOVEMENT ===== */
    function moveToCol(targetCol, id, moveSpeed) {
        var targetX = colToX(targetCol) + (TILE - PLAYER_W) / 2;
        return new Promise(function (resolve) {
            var direction = targetX > player.x ? 1 : -1;
            var handler = function () {
                if (id !== execId || hasWon) {
                    player.unbind("EnterFrame", handler);
                    resolve();
                    return;
                }
                var diff = targetX - player.x;
                if (Math.abs(diff) <= moveSpeed) {
                    player.x = targetX;
                    player.unbind("EnterFrame", handler);
                    resolve();
                    return;
                }
                player.x += direction * moveSpeed;
            };
            player.bind("EnterFrame", handler);
        });
    }

    /* ===== PARSER ===== */
    function parseCode(code) {
        var commands = [];
        var lines = code.split("\n");
        for (var i = 0; i < lines.length; i++) {
            var original = lines[i];
            var line = original.trim();
            var lineNum = i + 1;
            if (!line || line.startsWith("#")) continue;

            if (/^step_right\s*\(\s*\)$/.test(line)) {
                commands.push({ type: "right", line: lineNum });
                continue;
            }
            if (/^step_left\s*\(\s*\)$/.test(line)) {
                commands.push({ type: "left", line: lineNum });
                continue;
            }
            throw new Error("Ln " + lineNum + ': comando inválido "' + line + '"');
        }
        if (commands.length === 0) throw new Error("Nenhum comando encontrado.");
        if (commands.length > MAX_COMMANDS) throw new Error("Máximo " + MAX_COMMANDS + " comandos permitidos.");
        return commands;
    }

    /* ===== EXECUTE ===== */
    function highlightEditorLine(lineNum) {
        // pulse gutter line
        var spans = gutterEl.querySelectorAll("span");
        spans.forEach(function (s) { s.classList.remove("active-line"); });
        if (lineNum > 0 && lineNum <= spans.length) {
            spans[lineNum - 1].classList.add("active-line");
        }
        activeLineEl.style.top = ((lineNum - 1) * 22 + 10) + "px";
    }

    async function runCommands(commands, id, moveSpeed) {
        var currentCol = PLAYER_START.col;
        for (var i = 0; i < commands.length; i++) {
            if (id !== execId || hasWon) return;
            var cmd = commands[i];
            highlightEditorLine(cmd.line);

            if (cmd.type === "right") {
                currentCol = Math.min(currentCol + 1, COLS - 1);
            } else {
                currentCol = Math.max(currentCol - 1, 0);
            }

            termLogHtml(
                '<span class="term-prompt">❯</span> ' +
                '<span class="term-cmd">Executando linha ' + cmd.line + ':</span> ' +
                (cmd.type === "right" ? "step_right()" : "step_left()")
            );

            await moveToCol(currentCol, id, moveSpeed);
            markStepPassed(currentCol);
        }
    }

    function updateErrorStatus(count) {
        if (count > 0) {
            sbErrors.className = "sb-item sb-errors";
            sbErrorsText.textContent = count + " erro(s)";
        } else {
            sbErrors.className = "sb-item sb-ok";
            sbErrorsText.textContent = "0 erros";
        }
    }

    async function executeProgram() {
        var commands;
        try {
            commands = parseCode(editorEl.value);
            updateErrorStatus(0);
        } catch (err) {
            termLog("✗ " + err.message, "term-error");
            updateErrorStatus(1);
            return;
        }

        execId++;
        var localId = execId;
        isExecuting = true;
        hasWon = false;
        runBtn.disabled = true;
        setVictoryVisible(false);
        resetPlayerPosition();
        resetStepDots();
        hideAutocomplete();
        var moveSpeed = SPEED_MAP[selectedSpeed];

        termLog("▶ Executando programa (" + selectedSpeed.toUpperCase() + ")...", "term-cmd");

        await runCommands(commands, localId, moveSpeed);

        if (localId !== execId) return;
        isExecuting = false;
        runBtn.disabled = false;

        if (!hasWon) {
            var isFinal = commands.length === MAX_COMMANDS;
            if (isFinal) {
                termLog("✗ Tesouro não coletado. Reiniciando...", "term-error");
                runBtn.disabled = true;
                setTimeout(function () {
                    if (localId !== execId || hasWon) return;
                    resetPlayerPosition();
                    resetStepDots();
                    isExecuting = false;
                    runBtn.disabled = false;
                    termLog("↺ Resetado. Tente novamente.", "term-error");
                }, LOSS_DELAY);
            } else {
                var remaining = MAX_COMMANDS - commands.length;
                termLog("… Faltam " + remaining + " comando(s).", "term-output");
            }
        }
    }

    /* ===== EVENTS ===== */
    function onEditorChange() {
        updateGutter();
        updateHighlight();
        updateCursorInfo();
    }

    editorEl.addEventListener("input", onEditorChange);
    editorEl.addEventListener("click", updateCursorInfo);
    editorEl.addEventListener("keyup", function (e) {
        if (autocompleteState.visible && (
            e.key === "ArrowDown" ||
            e.key === "ArrowUp" ||
            e.key === "Enter" ||
            e.key === "Tab" ||
            e.key === "Escape"
        )) {
            return;
        }
        updateCursorInfo();
    });
    editorEl.addEventListener("keydown", function (e) {
        if (autocompleteState.visible) {
            if (e.key === "ArrowDown") {
                e.preventDefault();
                moveAutocompleteSelection(1);
                return;
            }
            if (e.key === "ArrowUp") {
                e.preventDefault();
                moveAutocompleteSelection(-1);
                return;
            }
            if (e.key === "Enter" || e.key === "Tab") {
                e.preventDefault();
                applyAutocomplete();
                return;
            }
            if (e.key === "Escape") {
                e.preventDefault();
                hideAutocomplete();
                return;
            }
        }

        // Tab support
        if (e.key === "Tab") {
            e.preventDefault();
            var start = editorEl.selectionStart;
            var end = editorEl.selectionEnd;
            var val = editorEl.value;
            editorEl.value = val.substring(0, start) + "    " + val.substring(end);
            editorEl.selectionStart = editorEl.selectionEnd = start + 4;
            onEditorChange();
        }
    });

    editorEl.addEventListener("scroll", function () {
        gutterEl.scrollTop = editorEl.scrollTop;
        highlightEl.scrollTop = editorEl.scrollTop;
        updateAutocompletePosition();
    });

    document.addEventListener("mousedown", function (e) {
        if (e.target === editorEl) return;
        if (autocompleteEl.contains(e.target)) return;
        hideAutocomplete();
    });

    runBtn.addEventListener("click", function () {
        executeProgram();
    });

    resetBtn.addEventListener("click", resetPlayer);
    speedSlowBtn.addEventListener("click", function () { applySpeedSelection("slow"); });
    speedFastBtn.addEventListener("click", function () { applySpeedSelection("fast"); });

    /* ===== INIT ===== */
    applySpeedSelection("slow");
    updateGutter();
    updateHighlight();
    updateCursorInfo();

})();
