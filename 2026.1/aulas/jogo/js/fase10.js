/* ===== FASE 10 — Decisão com If ===== */

(function () {
    "use strict";

    /* ===== CONFIG ===== */
    const TILE = 96;
    const COLS = 12;
    const ROWS = 6;
    const GAME_W = TILE * COLS;
    const GAME_H = TILE * ROWS;
    const GROUND_ROW = 5;

    const MAX_COMMANDS = 16;
    const MAX_MOVE_STEPS = 6;
    const PLAYER_START = { col: 2, row: GROUND_ROW };
    const RANDOM_EVENT_COL = 4;
    const GOAL_COL = 9;

    const PLAYER_W = 40;
    const PLAYER_H = 50;
    const GOAL_W = 42;
    const GOAL_H = 50;

    const SPEED_MAP = {
        slow: 2.2,
        fast: 6.0,
    };

    const LOSS_DELAY = 1200;
    const AVAILABLE_COMMANDS = [
        "move_right(1)",
        "move_left(1)",
        "interact()",
        "jump()",
        "if is_crystal_ahead():",
        "else:",
    ];

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
    let selectedSpeed = "slow";
    let currentHighlightLine = -1;
    let currentCol = PLAYER_START.col;

    const stepDots = {};

    const autocompleteState = {
        visible: false,
        matches: [],
        selectedIndex: 0,
        replaceStart: 0,
        lineIndex: 0,
        colChars: 0,
    };

    const randomEvent = {
        type: "crystal",
        resolved: false,
        crystal: null,
        obstacleBody: null,
        obstacleCap: null,
        obstacleSymbol: null,
        markerBg: null,
        markerText: null,
    };
    let nextRandomEventType = Math.random() < 0.5 ? "crystal" : "obstacle";

    /* ===== HELPERS ===== */
    function colToX(col) { return col * TILE; }
    function rowToY(row) { return row * TILE; }

    function clamp(value, min, max) {
        return Math.max(min, Math.min(max, value));
    }

    function termLog(msg, cls) {
        cls = cls || "term-output";
        terminalOutput.className = cls;
        terminalOutput.textContent = msg;
    }

    function termLogHtml(html) {
        terminalOutput.innerHTML = html;
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

    function setEntityVisible(entity, visible) {
        if (!entity) return;
        entity.css({ display: visible ? "block" : "none" });
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

    /* ===== CRAFTY INIT ===== */
    Crafty.init(GAME_W, GAME_H, document.getElementById("game"));
    Crafty.viewport.clampToEntities = false;
    Crafty.background("#1a1b26");

    /* ===== SCENE ===== */
    function buildScene() {
        const skyColors = ["#1a1b26", "#1a1b2e", "#1e2030", "#24273a", "#363a4f"];
        for (let r = 0; r < GROUND_ROW; r++) {
            Crafty.e("2D, DOM, Color")
                .attr({ x: 0, y: r * TILE, w: GAME_W, h: TILE })
                .color(skyColors[r] || "#24273a");
        }

        for (let s = 0; s < 28; s++) {
            const posX = 20 + Math.random() * (GAME_W - 40);
            const posY = 16 + Math.random() * (GROUND_ROW * TILE * 0.45);
            const size = 1 + Math.floor(Math.random() * 3);
            const star = Crafty.e("2D, DOM, Color")
                .attr({ x: posX, y: posY, w: size, h: size })
                .color("#cad3f5");
            star._baseAlpha = 0.3 + Math.random() * 0.5;
            star._speed = 0.01 + Math.random() * 0.02;
            star._phase = Math.random() * Math.PI * 2;
            star.css({ opacity: star._baseAlpha, "border-radius": "50%" });
            star.bind("EnterFrame", function (e) {
                const a = this._baseAlpha + Math.sin(e.frame * this._speed + this._phase) * 0.3;
                this.css({ opacity: Math.max(0.1, Math.min(1, a)) });
            });
        }

        Crafty.e("2D, DOM, Color")
            .attr({ x: GAME_W - 108, y: 30, w: 52, h: 52 })
            .color("#f5e0dc")
            .css({ "border-radius": "50%", "box-shadow": "0 0 30px rgba(245,224,220,0.15)" });

        Crafty.e("2D, DOM, Color")
            .attr({ x: GAME_W - 94, y: 44, w: 10, h: 10 })
            .color("#dcd3cd")
            .css({ "border-radius": "50%", opacity: "0.5" });

        Crafty.e("2D, DOM, Color, Solid")
            .attr({ x: 0, y: GROUND_ROW * TILE, w: GAME_W, h: TILE })
            .color("#363a4f");

        Crafty.e("2D, DOM, Color")
            .attr({ x: 0, y: GROUND_ROW * TILE, w: GAME_W, h: 3 })
            .color("#a6e3a1")
            .css({ opacity: "0.4" });

        for (let c = 0; c < COLS; c++) {
            Crafty.e("2D, DOM, Color")
                .attr({ x: c * TILE + TILE / 2 - 1, y: GROUND_ROW * TILE + TILE / 2 - 1, w: 2, h: 2 })
                .color("#585b70")
                .css({ "border-radius": "50%" });
        }

        for (let c = PLAYER_START.col; c <= GOAL_COL; c++) {
            Crafty.e("2D, DOM, Color")
                .attr({ x: c * TILE + 10, y: GROUND_ROW * TILE + TILE - 12, w: TILE - 20, h: 2 })
                .color("#45475a");
        }

        for (let c = PLAYER_START.col + 1; c <= GOAL_COL; c++) {
            stepDots[c] = Crafty.e("2D, DOM, Color")
                .attr({ x: c * TILE + TILE / 2 - 6, y: GROUND_ROW * TILE + 10, w: 12, h: 12, z: 18 })
                .color("#585b70")
                .css({
                    "border-radius": "50%",
                    opacity: "0.9",
                    "box-shadow": "0 0 0 2px rgba(137,180,250,0.22) inset, 0 0 0 1px rgba(17,17,27,0.55)",
                });
        }
    }

    buildScene();

    /* ===== RANDOM EVENT ===== */
    function buildRandomEvent() {
        const crystalX = colToX(RANDOM_EVENT_COL) + (TILE - 30) / 2;
        const crystalY = rowToY(GROUND_ROW) - 38;
        randomEvent.crystal = Crafty.e("2D, DOM, Image")
            .attr({ x: crystalX, y: crystalY, w: 30, h: 30, z: 30 })
            .image("../assets/img/cristal.png", "no-repeat")
            .css({
                "background-size": "contain",
                "background-position": "center",
                "image-rendering": "pixelated",
            });

        const baseX = colToX(RANDOM_EVENT_COL) + (TILE - 34) / 2;
        const baseY = rowToY(GROUND_ROW) - 46;
        randomEvent.obstacleBody = Crafty.e("2D, DOM, Color")
            .attr({ x: baseX, y: baseY, w: 34, h: 46, z: 30 })
            .color("#65466f")
            .css({ "border-radius": "8px" });

        randomEvent.obstacleCap = Crafty.e("2D, DOM, Color")
            .attr({ x: baseX + 3, y: baseY + 3, w: 28, h: 8, z: 31 })
            .color("#f38ba8")
            .css({ "border-radius": "4px", opacity: "0.85" });

        randomEvent.obstacleSymbol = Crafty.e("2D, DOM, Text")
            .attr({ x: baseX, y: baseY + 14, w: 34, h: 16, z: 32 })
            .text("!")
            .textColor("#f9e2af")
            .textFont({ size: "16px", weight: "700", family: "Consolas" })
            .css({ "text-align": "center" });

        randomEvent.markerBg = Crafty.e("2D, DOM, Color")
            .attr({ x: colToX(RANDOM_EVENT_COL) + 6, y: baseY - 18, w: TILE - 12, h: 16, z: 33 })
            .color("#0e233a")
            .css({ "border-radius": "8px", border: "1px solid rgba(137,220,235,0.38)", opacity: "0.92" });

        randomEvent.markerText = Crafty.e("2D, DOM, Text")
            .attr({ x: colToX(RANDOM_EVENT_COL) + 6, y: baseY - 15, w: TILE - 12, h: 12, z: 34 })
            .text("EVENTO")
            .textColor("#89dceb")
            .textFont({ size: "9px", weight: "700", family: "Consolas" })
            .css({ "text-align": "center" });
    }

    function refreshRandomEventVisual() {
        if (randomEvent.resolved) {
            randomEvent.markerBg.color("#16352b").css({ border: "1px solid rgba(166,227,161,0.55)", opacity: "0.95" });
            randomEvent.markerText.text("RESOLVIDO").textColor("#a6e3a1");
            if (randomEvent.type === "crystal") {
                setEntityVisible(randomEvent.crystal, true);
                setEntityVisible(randomEvent.obstacleBody, false);
                setEntityVisible(randomEvent.obstacleCap, false);
                setEntityVisible(randomEvent.obstacleSymbol, false);
                randomEvent.crystal.css({ opacity: "0.35", filter: "saturate(0.7)" });
            } else {
                setEntityVisible(randomEvent.crystal, false);
                setEntityVisible(randomEvent.obstacleBody, true);
                setEntityVisible(randomEvent.obstacleCap, true);
                setEntityVisible(randomEvent.obstacleSymbol, true);
                randomEvent.obstacleBody.color("#4f5d73");
                randomEvent.obstacleCap.color("#a6e3a1");
                randomEvent.obstacleSymbol.text("✓").textColor("#a6e3a1");
            }
            return;
        }

        randomEvent.markerBg.color("#0e233a").css({ border: "1px solid rgba(137,220,235,0.38)", opacity: "0.92" });
        if (randomEvent.type === "crystal") {
            randomEvent.markerText.text("CRISTAL: interact()").textColor("#89dceb");
            setEntityVisible(randomEvent.crystal, true);
            setEntityVisible(randomEvent.obstacleBody, false);
            setEntityVisible(randomEvent.obstacleCap, false);
            setEntityVisible(randomEvent.obstacleSymbol, false);
            randomEvent.crystal.css({ opacity: "1", filter: "none" });
        } else {
            randomEvent.markerText.text("OBSTÁCULO: jump()").textColor("#f38ba8");
            setEntityVisible(randomEvent.crystal, false);
            setEntityVisible(randomEvent.obstacleBody, true);
            setEntityVisible(randomEvent.obstacleCap, true);
            setEntityVisible(randomEvent.obstacleSymbol, true);
            randomEvent.obstacleBody.color("#65466f").css({ filter: "none" });
            randomEvent.obstacleCap.color("#f38ba8").css({ filter: "none" });
            randomEvent.obstacleSymbol.text("!").textColor("#f9e2af").css({ filter: "none" });
        }
    }

    function rotateRandomEventType() {
        randomEvent.type = nextRandomEventType;
        nextRandomEventType = nextRandomEventType === "crystal" ? "obstacle" : "crystal";
        randomEvent.resolved = false;
        refreshRandomEventVisual();
    }

    function resetRandomEventSameType() {
        randomEvent.resolved = false;
        refreshRandomEventVisual();
    }

    function resolveRandomEvent(mode) {
        if (randomEvent.resolved) return;
        randomEvent.resolved = true;
        refreshRandomEventVisual();
        if (mode === "interact") {
            termLog("✓ Checkpoint resolvido: cristal coletado.", "term-success");
        } else {
            termLog("✓ Checkpoint resolvido: obstáculo desviado.", "term-success");
        }
    }

    buildRandomEvent();

    /* ===== GOAL ===== */
    const goal = Crafty.e("2D, DOM, Image")
        .attr({
            x: colToX(GOAL_COL) + (TILE - GOAL_W) / 2,
            y: rowToY(GROUND_ROW) - GOAL_H,
            w: GOAL_W,
            h: GOAL_H,
            z: 30,
        })
        .image("../assets/img/bandeira1.png", "no-repeat")
        .css({
            "background-size": "contain",
            "background-position": "center bottom",
            "image-rendering": "pixelated",
        });

    /* ===== PLAYER ===== */
    const playerStartX = colToX(PLAYER_START.col) + (TILE - PLAYER_W) / 2;
    const playerStartY = rowToY(GROUND_ROW) - PLAYER_H;

    const player = Crafty.e("2D, DOM, Image")
        .attr({ x: playerStartX, y: playerStartY, w: PLAYER_W, h: PLAYER_H, z: 40 })
        .image("../assets/img/player2.png", "no-repeat")
        .css({
            "background-size": "contain",
            "background-position": "center bottom",
            "image-rendering": "pixelated",
            "transition": "none",
        });

    /* ===== SYNTAX HIGHLIGHT ===== */
    const PY_KEYWORDS = /\b(def|class|if|elif|else|for|while|return|import|from|as|try|except|finally|with|yield|lambda|pass|break|continue|raise|in|not|and|or|is|global|nonlocal|assert|del|async|await)\b/g;
    const PY_BUILTINS = /\b(print|range|len|int|str|float|list|dict|set|tuple|type|input|open|enumerate|zip|map|filter|sorted|reversed|min|max|sum|abs|round|isinstance|hasattr|getattr|setattr)\b/g;
    const PY_BOOLNONE = /\b(True|False|None)\b/g;
    const PY_DECORATORS = /@\w+/g;
    const PY_NUMBERS = /\b\d+(\.\d+)?\b/g;
    const PY_STRINGS = /("""[\s\S]*?"""|'''[\s\S]*?'''|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*')/g;
    const PY_COMMENTS = /#.*/g;
    const PY_FUNCTIONS = /\b([a-zA-Z_]\w*)\s*(?=\()/g;
    const PY_SELF = /\bself\b/g;
    const PY_PARENS = /[()[\]{}]/g;

    function escapeHtml(text) {
        return text
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;");
    }

    function highlightPython(code) {
        const tokens = [];
        const used = new Array(code.length);

        function markTokens(regex, cls) {
            let m;
            regex.lastIndex = 0;
            while ((m = regex.exec(code)) !== null) {
                const start = m.index;
                const end = start + m[0].length;
                let overlap = false;
                for (let i = start; i < end; i++) {
                    if (used[i]) { overlap = true; break; }
                }
                if (overlap) continue;
                for (let j = start; j < end; j++) used[j] = true;
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

        let result = "";
        let cursor = 0;

        for (let t = 0; t < tokens.length; t++) {
            const tok = tokens[t];
            if (tok.start > cursor) result += escapeHtml(code.substring(cursor, tok.start));
            result += '<span class="' + tok.cls + '">' + escapeHtml(tok.text) + "</span>";
            cursor = tok.end;
        }

        if (cursor < code.length) result += escapeHtml(code.substring(cursor));
        return result;
    }

    /* ===== EDITOR HELPERS ===== */
    function getCurrentLine() {
        const pos = editorEl.selectionStart;
        return editorEl.value.substring(0, pos).split("\n").length;
    }

    function updateGutter() {
        const lines = editorEl.value.split("\n");
        const count = Math.max(lines.length, MAX_COMMANDS, 8);
        const cursorLine = getCurrentLine();
        let html = "";
        for (let i = 1; i <= count; i++) {
            const cls = i === cursorLine ? ' class="active-line"' : "";
            html += "<span" + cls + ">" + i + "</span>";
        }
        gutterEl.innerHTML = html;
    }

    function updateHighlight() {
        highlightEl.innerHTML = highlightPython(editorEl.value) + "\n";
    }

    function updateCursorInfo() {
        const pos = editorEl.selectionStart;
        const before = editorEl.value.substring(0, pos);
        const lines = before.split("\n");
        const ln = lines.length;
        const col = lines[lines.length - 1].length + 1;

        sbLine.textContent = ln;
        sbCol.textContent = col;

        updateActiveLine();
        updateAutocomplete();
    }

    function updateActiveLine() {
        const line = getCurrentLine();
        if (line === currentHighlightLine) return;
        currentHighlightLine = line;

        const spans = gutterEl.querySelectorAll("span");
        spans.forEach(function (s) { s.classList.remove("active-line"); });
        if (line > 0 && line <= spans.length) spans[line - 1].classList.add("active-line");

        activeLineEl.style.top = ((line - 1) * 22 + 10) + "px";
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

        const pos = editorEl.selectionStart;
        const value = editorEl.value;
        const lineStart = value.lastIndexOf("\n", pos - 1) + 1;
        const beforeCursor = value.substring(lineStart, pos);
        const leadingSpaces = (beforeCursor.match(/^\s*/) || [""])[0];
        const token = beforeCursor.substring(leadingSpaces.length);

        if (!token) return null;
        if (token.charAt(0) === "#") return null;
        if (/\s/.test(token)) return null;
        if (!/^[a-z_()0-9,:]*$/i.test(token)) return null;

        const matches = AVAILABLE_COMMANDS.filter(function (cmd) {
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

        const approxCharWidth = 7.8;
        let top = 10 + autocompleteState.lineIndex * 22 + 24 - editorEl.scrollTop;
        let left = 16 + autocompleteState.colChars * approxCharWidth - editorEl.scrollLeft;
        const maxLeft = Math.max(10, editorAreaEl.clientWidth - 210);

        if (left > maxLeft) left = maxLeft;
        if (left < 10) left = 10;
        if (top < 8) top = 8;

        autocompleteEl.style.top = top + "px";
        autocompleteEl.style.left = left + "px";

        const boxHeight = autocompleteEl.offsetHeight || 0;
        if (top + boxHeight > editorAreaEl.clientHeight - 8) {
            const aboveTop = 10 + autocompleteState.lineIndex * 22 - boxHeight - 2 - editorEl.scrollTop;
            autocompleteEl.style.top = Math.max(8, aboveTop) + "px";
        }
    }

    function renderAutocomplete() {
        if (!autocompleteState.visible) return;

        let html = "";
        for (let i = 0; i < autocompleteState.matches.length; i++) {
            const activeClass = i === autocompleteState.selectedIndex ? " active" : "";
            html += '<button type="button" class="code-autocomplete-item' + activeClass + '" data-index="' + i + '">' +
                autocompleteState.matches[i] +
                "</button>";
        }

        autocompleteEl.innerHTML = html;
        autocompleteEl.style.display = "block";

        const items = autocompleteEl.querySelectorAll(".code-autocomplete-item");
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
        const context = getAutocompleteContext();
        if (!context) {
            hideAutocomplete();
            return;
        }

        const previousSelected = autocompleteState.matches[autocompleteState.selectedIndex] || "";

        autocompleteState.visible = true;
        autocompleteState.matches = context.matches;
        autocompleteState.selectedIndex = 0;
        if (previousSelected) {
            const prevIndex = context.matches.indexOf(previousSelected);
            if (prevIndex >= 0) autocompleteState.selectedIndex = prevIndex;
        }

        autocompleteState.replaceStart = context.replaceStart;
        autocompleteState.lineIndex = context.lineIndex;
        autocompleteState.colChars = context.colChars;
        renderAutocomplete();
    }

    function applyAutocomplete() {
        if (!autocompleteState.visible) return false;
        const selected = autocompleteState.matches[autocompleteState.selectedIndex];
        if (!selected) return false;

        const start = autocompleteState.replaceStart;
        const end = editorEl.selectionStart;
        const value = editorEl.value;
        editorEl.value = value.substring(0, start) + selected + value.substring(end);
        editorEl.selectionStart = editorEl.selectionEnd = start + selected.length;

        hideAutocomplete();
        onEditorChange();
        return true;
    }

    function moveAutocompleteSelection(delta) {
        if (!autocompleteState.visible) return;
        const len = autocompleteState.matches.length;
        if (!len) return;
        autocompleteState.selectedIndex = (autocompleteState.selectedIndex + delta + len) % len;
        renderAutocomplete();
    }

    /* ===== GAME STATE ===== */
    function markStepPassed(col) {
        const dot = stepDots[col];
        if (!dot) return;
        dot.color("#a6e3a1");
        dot.css({
            opacity: "1",
            "box-shadow": "0 0 0 2px rgba(166,227,161,0.65) inset, 0 0 16px rgba(166,227,161,0.62)",
        });
    }

    function resetStepDots() {
        Object.keys(stepDots).forEach(function (col) {
            stepDots[col]
                .color("#585b70")
                .css({
                    opacity: "0.9",
                    "box-shadow": "0 0 0 2px rgba(137,180,250,0.22) inset, 0 0 0 1px rgba(17,17,27,0.55)",
                });
        });
    }

    function resetPlayerPosition() {
        currentCol = PLAYER_START.col;
        player.attr({ x: playerStartX, y: playerStartY });
    }

    function applySpeedSelection(mode) {
        selectedSpeed = mode === "fast" ? "fast" : "slow";
        speedSlowBtn.classList.toggle("active", selectedSpeed === "slow");
        speedFastBtn.classList.toggle("active", selectedSpeed === "fast");
        speedSlowBtn.setAttribute("aria-pressed", selectedSpeed === "slow" ? "true" : "false");
        speedFastBtn.setAttribute("aria-pressed", selectedSpeed === "fast" ? "true" : "false");
    }

    function resetWorldForExecution(rotateType) {
        hasWon = false;
        setVictoryVisible(false);
        resetStepDots();
        resetPlayerPosition();
        if (rotateType) {
            rotateRandomEventType();
        } else {
            resetRandomEventSameType();
        }
        hideAutocomplete();
    }

    function resetPlayer() {
        execId++;
        isExecuting = false;
        runBtn.disabled = false;
        resetWorldForExecution(false);
        termLog("Fase resetada. Pronto para novo teste.", "term-output");
        updateErrorStatus(0);
    }

    window.resetPlayer = resetPlayer;

    function checkVictory() {
        if (hasWon) return true;
        if (!randomEvent.resolved) return false;
        if (currentCol < GOAL_COL) return false;

        hasWon = true;
        isExecuting = false;
        runBtn.disabled = false;
        termLog("✓ Vitória! Decisão correta e percurso finalizado.", "term-success");
        updateErrorStatus(0);
        setVictoryVisible(true);
        return true;
    }

    /* ===== MOVEMENT ===== */
    function moveToCol(targetCol, id, moveSpeed) {
        const targetX = colToX(targetCol) + (TILE - PLAYER_W) / 2;

        return new Promise(function (resolve) {
            const direction = targetX > player.x ? 1 : -1;
            const handler = function () {
                if (id !== execId || hasWon) {
                    player.unbind("EnterFrame", handler);
                    resolve();
                    return;
                }
                const diff = targetX - player.x;
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

    function hopInPlace(id) {
        const startY = playerStartY;
        let frame = 0;
        const totalFrames = 20;

        return new Promise(function (resolve) {
            const handler = function () {
                if (id !== execId || hasWon) {
                    player.y = startY;
                    player.unbind("EnterFrame", handler);
                    resolve();
                    return;
                }

                frame++;
                const t = frame / totalFrames;
                if (t >= 1) {
                    player.y = startY;
                    player.unbind("EnterFrame", handler);
                    resolve();
                    return;
                }

                player.y = startY - Math.sin(Math.PI * t) * 26;
            };

            player.bind("EnterFrame", handler);
        });
    }

    function jumpToCol(targetCol, id, moveSpeed) {
        const startX = player.x;
        const startY = playerStartY;
        const targetX = colToX(targetCol) + (TILE - PLAYER_W) / 2;
        const distance = Math.max(1, Math.abs(targetX - startX));
        const direction = targetX >= startX ? 1 : -1;
        const jumpSpeed = Math.max(4, moveSpeed * 1.75);

        return new Promise(function (resolve) {
            const handler = function () {
                if (id !== execId || hasWon) {
                    player.y = startY;
                    player.unbind("EnterFrame", handler);
                    resolve();
                    return;
                }

                const diff = targetX - player.x;
                if (Math.abs(diff) <= jumpSpeed) {
                    player.x = targetX;
                    player.y = startY;
                    player.unbind("EnterFrame", handler);
                    resolve();
                    return;
                }

                player.x += direction * jumpSpeed;
                const progress = Math.abs(player.x - startX) / distance;
                const arc = 4 * progress * (1 - progress);
                player.y = startY - arc * 72;
            };

            player.bind("EnterFrame", handler);
        });
    }

    function isCrystalAhead() {
        return !randomEvent.resolved &&
            randomEvent.type === "crystal" &&
            currentCol + 1 === RANDOM_EVENT_COL;
    }

    function isObstacleAhead() {
        return !randomEvent.resolved &&
            randomEvent.type === "obstacle" &&
            currentCol + 1 === RANDOM_EVENT_COL;
    }

    async function moveSteps(direction, steps, id, moveSpeed, lineNum) {
        for (let s = 0; s < steps; s++) {
            if (id !== execId || hasWon) return;

            const nextCol = clamp(currentCol + direction, 0, COLS - 1);
            if (nextCol === currentCol) {
                termLog("… Limite do mapa atingido na linha " + lineNum + ".", "term-output");
                return;
            }

            if (direction > 0 && !randomEvent.resolved) {
                if (randomEvent.type === "obstacle" && nextCol === RANDOM_EVENT_COL) {
                    throw new Error("Ln " + lineNum + ": obstáculo à frente. Use jump() ou if/else para desviar.");
                }
                if (randomEvent.type === "obstacle" && nextCol > RANDOM_EVENT_COL + 1) {
                    throw new Error("Ln " + lineNum + ": resolva o obstáculo aleatório antes de avançar.");
                }
                if (randomEvent.type === "crystal" && nextCol > RANDOM_EVENT_COL) {
                    throw new Error("Ln " + lineNum + ": colete o cristal com interact() antes de avançar.");
                }
            }

            await moveToCol(nextCol, id, moveSpeed);
            currentCol = nextCol;
            markStepPassed(currentCol);

            if (checkVictory()) return;
        }
    }

    async function runInteract(lineNum, id, moveSpeed) {
        if (!randomEvent.resolved && randomEvent.type === "crystal" && Math.abs(currentCol - RANDOM_EVENT_COL) <= 1) {
            resolveRandomEvent("interact");
            checkVictory();
            return;
        }

        termLog("… Ln " + lineNum + ": não há cristal para interagir aqui.", "term-output");
    }

    async function runJump(lineNum, id, moveSpeed) {
        if (isObstacleAhead()) {
            const landingCol = currentCol + 2;
            if (landingCol >= COLS) {
                throw new Error("Ln " + lineNum + ": sem espaço para aterrissar após o salto.");
            }

            await jumpToCol(landingCol, id, moveSpeed);
            currentCol = landingCol;
            markStepPassed(currentCol);
            resolveRandomEvent("jump");
            checkVictory();
            return;
        }

        if (isCrystalAhead()) {
            await hopInPlace(id);
            termLog("… Ln " + lineNum + ": à frente é cristal. Use interact().", "term-output");
            return;
        }

        await hopInPlace(id);
        termLog("… Ln " + lineNum + ": jump() sem obstáculo à frente.", "term-output");
    }

    /* ===== PARSER ===== */
    function parseIndentedCommand(rawLine, lineNum, ifLine) {
        if (!/^\s+/.test(rawLine)) {
            throw new Error("Ln " + lineNum + ": bloco do if na linha " + ifLine + " exige indentação.");
        }

        const line = rawLine.trim();

        const rightMatch = line.match(/^move_right\s*\(\s*(\d+)\s*\)$/);
        if (rightMatch) {
            const steps = Number(rightMatch[1]);
            if (steps < 1 || steps > MAX_MOVE_STEPS) {
                throw new Error("Ln " + lineNum + ": move_right(n) deve usar n entre 1 e " + MAX_MOVE_STEPS + ".");
            }
            return { type: "right", steps: steps, line: lineNum };
        }

        const leftMatch = line.match(/^move_left\s*\(\s*(\d+)\s*\)$/);
        if (leftMatch) {
            const steps = Number(leftMatch[1]);
            if (steps < 1 || steps > MAX_MOVE_STEPS) {
                throw new Error("Ln " + lineNum + ": move_left(n) deve usar n entre 1 e " + MAX_MOVE_STEPS + ".");
            }
            return { type: "left", steps: steps, line: lineNum };
        }

        if (/^interact\s*\(\s*\)$/.test(line)) {
            return { type: "interact", line: lineNum };
        }

        if (/^jump\s*\(\s*\)$/.test(line)) {
            return { type: "jump", line: lineNum };
        }

        throw new Error("Ln " + lineNum + ": comando inválido dentro do bloco if: \"" + line + "\"");
    }

    function parseCode(code) {
        const commands = [];
        const lines = code.split("\n");

        for (let i = 0; i < lines.length; i++) {
            const lineNum = i + 1;
            const line = lines[i].trim();
            if (!line || line.startsWith("#")) continue;

            const rightMatch = line.match(/^move_right\s*\(\s*(\d+)\s*\)$/);
            if (rightMatch) {
                const steps = Number(rightMatch[1]);
                if (steps < 1 || steps > MAX_MOVE_STEPS) {
                    throw new Error("Ln " + lineNum + ": move_right(n) deve usar n entre 1 e " + MAX_MOVE_STEPS + ".");
                }
                commands.push({ type: "right", steps: steps, line: lineNum });
                continue;
            }

            const leftMatch = line.match(/^move_left\s*\(\s*(\d+)\s*\)$/);
            if (leftMatch) {
                const steps = Number(leftMatch[1]);
                if (steps < 1 || steps > MAX_MOVE_STEPS) {
                    throw new Error("Ln " + lineNum + ": move_left(n) deve usar n entre 1 e " + MAX_MOVE_STEPS + ".");
                }
                commands.push({ type: "left", steps: steps, line: lineNum });
                continue;
            }

            if (/^interact\s*\(\s*\)$/.test(line)) {
                commands.push({ type: "interact", line: lineNum });
                continue;
            }

            if (/^jump\s*\(\s*\)$/.test(line)) {
                commands.push({ type: "jump", line: lineNum });
                continue;
            }

            if (/^if\s+is_crystal_ahead\s*\(\s*\)\s*:\s*$/.test(line)) {
                const ifIndent = (lines[i].match(/^\s*/) || [""])[0].length;
                let j = i + 1;
                let elseLineNum = -1;
                const thenCommands = [];

                while (j < lines.length) {
                    const rawThen = lines[j];
                    const trimmedThen = rawThen.trim();
                    const indentThen = (rawThen.match(/^\s*/) || [""])[0].length;

                    if (!trimmedThen || trimmedThen.startsWith("#")) {
                        j++;
                        continue;
                    }

                    if (trimmedThen === "else:" && indentThen === ifIndent) {
                        elseLineNum = j + 1;
                        break;
                    }

                    if (indentThen <= ifIndent) {
                        throw new Error("Ln " + (j + 1) + ": esperado bloco indentado ou else: após if is_crystal_ahead().");
                    }

                    thenCommands.push(parseIndentedCommand(rawThen, j + 1, lineNum));
                    j++;
                }

                if (elseLineNum < 0) {
                    throw new Error("Ln " + lineNum + ": if is_crystal_ahead() exige um else:.");
                }

                j += 1; // primeira linha do else
                const elseCommands = [];

                while (j < lines.length) {
                    const rawElse = lines[j];
                    const trimmedElse = rawElse.trim();
                    const indentElse = (rawElse.match(/^\s*/) || [""])[0].length;

                    if (!trimmedElse || trimmedElse.startsWith("#")) {
                        j++;
                        continue;
                    }

                    if (indentElse <= ifIndent) {
                        break;
                    }

                    elseCommands.push(parseIndentedCommand(rawElse, j + 1, lineNum));
                    j++;
                }

                if (thenCommands.length === 0) {
                    throw new Error("Ln " + lineNum + ": bloco do if não pode ficar vazio.");
                }
                if (elseCommands.length === 0) {
                    throw new Error("Ln " + elseLineNum + ": bloco do else não pode ficar vazio.");
                }

                commands.push({
                    type: "if_else_crystal_block",
                    line: lineNum,
                    elseLine: elseLineNum,
                    thenCommands: thenCommands,
                    elseCommands: elseCommands,
                });

                i = j - 1;
                continue;
            }

            throw new Error("Ln " + lineNum + ': comando inválido "' + line + '"');
        }

        if (commands.length === 0) throw new Error("Nenhum comando encontrado.");
        if (commands.length > MAX_COMMANDS) {
            throw new Error("Máximo de " + MAX_COMMANDS + " comandos permitidos nesta fase.");
        }

        return commands;
    }

    /* ===== EXECUTION ===== */
    function highlightEditorLine(lineNum) {
        const spans = gutterEl.querySelectorAll("span");
        spans.forEach(function (s) { s.classList.remove("active-line"); });

        if (lineNum > 0 && lineNum <= spans.length) {
            spans[lineNum - 1].classList.add("active-line");
        }

        activeLineEl.style.top = ((lineNum - 1) * 22 + 10) + "px";
    }

    async function executeSimpleCommand(cmd, id, moveSpeed) {
        highlightEditorLine(cmd.line);

        if (cmd.type === "interact") {
            termLogHtml(
                '<span class="term-prompt">❯</span> ' +
                '<span class="term-cmd">Linha ' + cmd.line + ':</span> interact()'
            );
            await runInteract(cmd.line, id, moveSpeed);
            return;
        }

        if (cmd.type === "jump") {
            termLogHtml(
                '<span class="term-prompt">❯</span> ' +
                '<span class="term-cmd">Linha ' + cmd.line + ':</span> jump()'
            );
            await runJump(cmd.line, id, moveSpeed);
            return;
        }

        if (cmd.type === "right") {
            termLogHtml(
                '<span class="term-prompt">❯</span> ' +
                '<span class="term-cmd">Linha ' + cmd.line + ':</span> move_right(' + cmd.steps + ')'
            );
            await moveSteps(1, cmd.steps, id, moveSpeed, cmd.line);
            return;
        }

        if (cmd.type === "left") {
            termLogHtml(
                '<span class="term-prompt">❯</span> ' +
                '<span class="term-cmd">Linha ' + cmd.line + ':</span> move_left(' + cmd.steps + ')'
            );
            await moveSteps(-1, cmd.steps, id, moveSpeed, cmd.line);
            return;
        }

        throw new Error("Ln " + cmd.line + ": comando não suportado neste bloco.");
    }

    async function executeCommand(cmd, id, moveSpeed) {
        if (id !== execId || hasWon) return;
        highlightEditorLine(cmd.line);

        if (cmd.type === "right" || cmd.type === "left" || cmd.type === "interact" || cmd.type === "jump") {
            await executeSimpleCommand(cmd, id, moveSpeed);
        } else if (cmd.type === "if_else_crystal_block") {
            termLogHtml(
                '<span class="term-prompt">❯</span> ' +
                '<span class="term-cmd">Linha ' + cmd.line + ':</span> if is_crystal_ahead():'
            );

            if (isCrystalAhead()) {
                for (let i = 0; i < cmd.thenCommands.length; i++) {
                    await executeSimpleCommand(cmd.thenCommands[i], id, moveSpeed);
                    if (hasWon || id !== execId) return;
                }
            } else {
                highlightEditorLine(cmd.elseLine);
                termLogHtml(
                    '<span class="term-prompt">❯</span> ' +
                    '<span class="term-cmd">Linha ' + cmd.elseLine + ':</span> else:'
                );
                for (let j = 0; j < cmd.elseCommands.length; j++) {
                    await executeSimpleCommand(cmd.elseCommands[j], id, moveSpeed);
                    if (hasWon || id !== execId) return;
                }
            }
        }

        checkVictory();
    }

    async function runCommands(commands, id, moveSpeed) {
        for (let i = 0; i < commands.length; i++) {
            if (id !== execId || hasWon) return;
            await executeCommand(commands[i], id, moveSpeed);
            if (hasWon) return;
        }
    }

    async function executeProgram() {
        let commands;
        try {
            commands = parseCode(editorEl.value);
            updateErrorStatus(0);
        } catch (err) {
            termLog("✗ " + err.message, "term-error");
            updateErrorStatus(1);
            return;
        }

        execId++;
        const localId = execId;

        isExecuting = true;
        runBtn.disabled = true;
        resetWorldForExecution(true);

        const moveSpeed = SPEED_MAP[selectedSpeed];
        termLog("▶ Executando fase (" + selectedSpeed.toUpperCase() + ")...", "term-cmd");

        try {
            await runCommands(commands, localId, moveSpeed);
        } catch (errRun) {
            if (localId !== execId) return;
            termLog("✗ " + errRun.message + " Reiniciando...", "term-error");
            updateErrorStatus(1);
            runBtn.disabled = true;

            setTimeout(function () {
                if (localId !== execId) return;
                resetPlayer();
            }, LOSS_DELAY);
            return;
        }

        if (localId !== execId) return;

        isExecuting = false;
        runBtn.disabled = false;

        if (!hasWon) {
            if (!randomEvent.resolved) {
                termLog("… Resolva o evento aleatório usando if/else.", "term-output");
            } else {
                termLog("… Evento resolvido. Avance até a coluna " + GOAL_COL + ".", "term-output");
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

        if (e.key === "Tab") {
            e.preventDefault();
            const start = editorEl.selectionStart;
            const end = editorEl.selectionEnd;
            const val = editorEl.value;
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
    resetWorldForExecution(false);
    updateGutter();
    updateHighlight();
    updateCursorInfo();
    updateErrorStatus(0);
})();
