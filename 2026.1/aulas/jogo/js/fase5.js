/* ===== FASE 5 — Calculo de Rota com Variaveis ===== */

(function () {
    "use strict";

    /* ===== CONFIG ===== */
    const TILE = 96;
    const COLS = 12;
    const ROWS = 6;
    const GAME_W = TILE * COLS;
    const GAME_H = TILE * ROWS;
    const GROUND_ROW = 5;

    const MAX_COMMANDS = 10;
    const PLAYER_START = { col: 1, row: GROUND_ROW };
    const CHECKPOINT_A_COL = 6;
    const CHECKPOINT_B_COL = 3;
    const GOAL_COL = 9;

    const PLAYER_W = 40;
    const PLAYER_H = 50;
    const CRYSTAL_W = 34;
    const CRYSTAL_H = 38;
    const GOAL_W = 42;
    const GOAL_H = 50;
    const PLAYER_IMG = "../assets/img/player.png";

    const SPEED_MAP = {
        slow: 2.2,
        fast: 6.0,
    };
    const LOSS_DELAY = 1200;
    const AVAILABLE_COMMANDS = [
        "move_right()",
        "move_left()",
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
    let currentHighlightLine = -1;
    let selectedSpeed = "slow";
    let lastLockedGoalWarnAt = 0;
    let lastOrderWarnAt = 0;

    var runtimeVariables = {};
    var collectedA = false;
    var collectedB = false;
    var goalUnlocked = false;

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

    /* ===== SCENE ===== */
    var objectiveHud = null;

    function buildScene() {
        var skyColors = ["#1a1b26", "#1a1b2e", "#1e2030", "#24273a", "#363a4f"];
        for (var r = 0; r < GROUND_ROW; r++) {
            Crafty.e("2D, DOM, Color")
                .attr({ x: 0, y: r * TILE, w: GAME_W, h: TILE })
                .color(skyColors[r] || "#24273a");
        }

        var STAR_COUNT = 32;
        for (var s = 0; s < STAR_COUNT; s++) {
            var posX = 20 + Math.random() * (GAME_W - 40);
            var posY = 16 + Math.random() * (GROUND_ROW * TILE * 0.46);
            var size = 1 + Math.floor(Math.random() * 3);
            var star = Crafty.e("2D, DOM, Color")
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

        for (var c = 0; c < COLS; c++) {
            Crafty.e("2D, DOM, Color")
                .attr({ x: c * TILE + TILE / 2 - 1, y: GROUND_ROW * TILE + TILE / 2 - 1, w: 2, h: 2 })
                .color("#585b70")
                .css({ "border-radius": "50%" });
        }

        for (var p = 1; p <= COLS - 2; p++) {
            stepDots[p] = Crafty.e("2D, DOM, Color")
                .attr({ x: p * TILE + TILE / 2 - 6, y: GROUND_ROW * TILE + 10, w: 12, h: 12, z: 18 })
                .color("#585b70")
                .css({
                    "border-radius": "50%",
                    opacity: "0.92",
                    "box-shadow": "0 0 0 2px rgba(137,180,250,0.22) inset, 0 0 0 1px rgba(17,17,27,0.55)",
                });
        }

        Crafty.e("2D, DOM, Text")
            .attr({ x: 18, y: 16, w: 520, h: 16, z: 30 })
            .text("Fase 5: calcule distancias com variaveis int usando + e -")
            .textColor("#cdd6f4")
            .textFont({ size: "12px", weight: "700", family: "Consolas" });

        objectiveHud = Crafty.e("2D, DOM, Text")
            .attr({ x: 18, y: 34, w: 520, h: 16, z: 30 })
            .text("Cristal A: pendente | Cristal B: pendente")
            .textColor("#a6adc8")
            .textFont({ size: "12px", weight: "700", family: "Consolas" });
    }

    buildScene();

    function updateObjectiveHud() {
        if (!objectiveHud) return;
        var statusA = collectedA ? "coletado" : "pendente";
        var statusB = collectedB ? "coletado" : "pendente";
        var text = "Ordem: A -> B | Cristal A: " + statusA + " | Cristal B: " + statusB;
        if (goalUnlocked) {
            text += " | Bandeira: liberada";
        }
        objectiveHud.text(text);
        objectiveHud.textColor(goalUnlocked ? "#a6e3a1" : "#a6adc8");
    }

    /* ===== GOAL ===== */
    var goalX = colToX(GOAL_COL) + (TILE - GOAL_W) / 2;
    var goalY = rowToY(GROUND_ROW) - GOAL_H;

    var goal = Crafty.e("2D, DOM, Image, Collision, Goal")
        .attr({ x: goalX, y: goalY, w: GOAL_W, h: GOAL_H, z: 24 })
        .image("../assets/img/bandeira1.png", "no-repeat")
        .css({
            "background-size": "contain",
            "background-position": "center bottom",
            "image-rendering": "pixelated",
            opacity: "0.35",
            filter: "grayscale(0.75)",
        });

    var goalLockText = Crafty.e("2D, DOM, Text")
        .attr({ x: goalX - 10, y: goalY - 20, w: 120, h: 16, z: 30 })
        .text("LOCK")
        .textColor("#f38ba8")
        .textFont({ size: "12px", weight: "700", family: "Consolas" });

    function setGoalUnlocked(unlocked) {
        goalUnlocked = !!unlocked;
        if (goalUnlocked) {
            goal.css({
                opacity: "1",
                filter: "none",
                "box-shadow": "0 0 18px rgba(166,227,161,0.5)",
            });
            goalLockText.text("OPEN");
            goalLockText.textColor("#a6e3a1");
        } else {
            goal.css({
                opacity: "0.35",
                filter: "grayscale(0.75)",
                "box-shadow": "none",
            });
            goalLockText.text("LOCK");
            goalLockText.textColor("#f38ba8");
        }
        updateObjectiveHud();
    }

    /* ===== CHECKPOINTS ===== */
    var checkpointAY = rowToY(GROUND_ROW) - CRYSTAL_H;
    var checkpointBY = rowToY(GROUND_ROW) - CRYSTAL_H;

    var checkpointA = Crafty.e("2D, DOM, Image, Collision, CheckpointA")
        .attr({ x: colToX(CHECKPOINT_A_COL) + (TILE - CRYSTAL_W) / 2, y: checkpointAY, w: CRYSTAL_W, h: CRYSTAL_H, z: 24 })
        .image("../assets/img/cristal.png", "no-repeat")
        .css({
            "background-size": "contain",
            "background-position": "center bottom",
            "image-rendering": "pixelated",
            opacity: "1",
        });

    var checkpointB = Crafty.e("2D, DOM, Image, Collision, CheckpointB")
        .attr({ x: colToX(CHECKPOINT_B_COL) + (TILE - CRYSTAL_W) / 2, y: checkpointBY, w: CRYSTAL_W, h: CRYSTAL_H, z: 24 })
        .image("../assets/img/cristal.png", "no-repeat")
        .css({
            "background-size": "contain",
            "background-position": "center bottom",
            "image-rendering": "pixelated",
            opacity: "1",
            filter: "hue-rotate(42deg)",
        });

    var checkpointATag = Crafty.e("2D, DOM, Text")
        .attr({ x: checkpointA.x - 7, y: checkpointA.y - 16, w: 64, h: 14, z: 30 })
        .text("A")
        .textColor("#89b4fa")
        .textFont({ size: "12px", weight: "700", family: "Consolas" });

    var checkpointBTag = Crafty.e("2D, DOM, Text")
        .attr({ x: checkpointB.x - 7, y: checkpointB.y - 16, w: 64, h: 14, z: 30 })
        .text("B")
        .textColor("#f9e2af")
        .textFont({ size: "12px", weight: "700", family: "Consolas" });

    function resetCheckpointsVisual() {
        checkpointA.css({
            opacity: "1",
            filter: "none",
            "box-shadow": "none",
        });
        checkpointB.css({
            opacity: "1",
            filter: "hue-rotate(42deg)",
            "box-shadow": "none",
        });
        checkpointATag.css({ opacity: "1" });
        checkpointBTag.css({ opacity: "1" });
    }

    function collectCheckpoint(id) {
        if (id === "A" && !collectedA) {
            collectedA = true;
            checkpointA.css({
                opacity: "0",
                "box-shadow": "none",
            });
            checkpointATag.css({ opacity: "0" });
            termLog("✓ Cristal A coletado.", "term-success");
            updateObjectiveHud();
        }

        if (id === "B" && collectedA && !collectedB) {
            collectedB = true;
            checkpointB.css({
                opacity: "0",
                "box-shadow": "none",
            });
            checkpointBTag.css({ opacity: "0" });
            termLog("✓ Cristal B coletado.", "term-success");
            updateObjectiveHud();
        }

        if (collectedA && collectedB && !goalUnlocked) {
            setGoalUnlocked(true);
            termLog("✓ Dois cristais coletados. Bandeira liberada!", "term-success");
        }
    }

    function checkCheckpointCollisions() {
        if (!collectedA) {
            var hitA = player.hit("CheckpointA");
            if (hitA && hitA.length) collectCheckpoint("A");
        }

        if (collectedA && !collectedB) {
            var hitB = player.hit("CheckpointB");
            if (hitB && hitB.length) collectCheckpoint("B");
        } else if (!collectedA && !collectedB) {
            var hitBFirst = player.hit("CheckpointB");
            if (hitBFirst && hitBFirst.length) {
                var now = Date.now();
                if (now - lastOrderWarnAt > 900) {
                    lastOrderWarnAt = now;
                    termLog("✗ Ordem incorreta: colete primeiro o cristal A.", "term-error");
                }
            }
        }
    }

    function resetObjectives() {
        collectedA = false;
        collectedB = false;
        lastOrderWarnAt = 0;
        setGoalUnlocked(false);
        resetCheckpointsVisual();
        updateObjectiveHud();
    }

    /* ===== PLAYER ===== */
    var playerStartX = colToX(PLAYER_START.col) + (TILE - PLAYER_W) / 2;
    var playerStartY = rowToY(GROUND_ROW) - PLAYER_H;

    var player = Crafty.e("2D, DOM, Image, Collision")
        .attr({ x: playerStartX, y: playerStartY, w: PLAYER_W, h: PLAYER_H })
        .image(PLAYER_IMG, "no-repeat")
        .css({
            "background-size": "contain",
            "background-position": "center bottom",
            "image-rendering": "pixelated",
            "transition": "none",
        });

    function resetRuntimeVariables() {
        runtimeVariables = {};
    }

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
            result += '<span class="' + tok.cls + '">' + escapeHtml(tok.text) + "</span>";
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

    function updateHighlight() {
        highlightEl.innerHTML = highlightPython(editorEl.value) + "\n";
    }

    function getCurrentLine() {
        var pos = editorEl.selectionStart;
        return editorEl.value.substring(0, pos).split("\n").length;
    }

    function updateActiveLine() {
        var line = getCurrentLine();
        if (line === currentHighlightLine) return;
        currentHighlightLine = line;
        activeLineEl.style.top = ((line - 1) * 22 + 10) + "px";
        updateGutter();
    }

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
                    "box-shadow": "0 0 0 2px rgba(137,180,250,0.22) inset, 0 0 0 1px rgba(17,17,27,0.55)",
                });
        });
    }

    function markStepPassed(col) {
        var dot = stepDots[col];
        if (!dot) return;
        dot.color("#a6e3a1");
        dot.css({
            opacity: "1",
            "box-shadow": "0 0 0 2px rgba(166,227,161,0.65) inset, 0 0 16px rgba(166,227,161,0.62)",
        });
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
        resetRuntimeVariables();
        resetObjectives();
        hideAutocomplete();
        runBtn.disabled = false;
        setVictoryVisible(false);
        termLog("Posicao restaurada. Calcule nova rota e tente novamente.", "term-output");
        updateErrorStatus(0);
    }

    window.resetPlayer = resetPlayer;

    /* ===== VICTORY CHECK ===== */
    function checkGoal() {
        if (hasWon) return;

        var hit = player.hit("Goal");
        if (!hit) return;

        if (!goalUnlocked) {
            var now = Date.now();
            if (now - lastLockedGoalWarnAt > 800) {
                lastLockedGoalWarnAt = now;
                termLog("✗ A bandeira esta bloqueada. Colete os 2 cristais primeiro.", "term-error");
            }
            goal.css({ "box-shadow": "0 0 22px rgba(243,139,168,0.4)" });
            setTimeout(function () {
                if (!goalUnlocked) goal.css({ "box-shadow": "none" });
            }, 250);
            return;
        }

        for (var i = 0; i < hit.length; i++) {
            if (hit[i].obj[0] === goal[0]) {
                hasWon = true;
                isExecuting = false;
                runBtn.disabled = false;
                termLog("✓ Vitoria! Rota calculada com variaveis.", "term-success");
                updateErrorStatus(0);
                setVictoryVisible(true);
                return;
            }
        }
    }

    player.bind("EnterFrame", function () {
        checkCheckpointCollisions();
        checkGoal();
    });

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

    function pauseMs(ms) {
        return new Promise(function (resolve) {
            setTimeout(resolve, ms);
        });
    }

    /* ===== PARSER ===== */
    function resolveIntToken(token, variables, lineNum) {
        if (/^-?\d+$/.test(token)) {
            return parseInt(token, 10);
        }

        if (!/^[a-zA-Z_]\w*$/.test(token)) {
            throw new Error("Ln " + lineNum + ": token invalido na expressao int.");
        }

        if (!variables[token]) {
            throw new Error("Ln " + lineNum + ': variavel "' + token + '" nao declarada.');
        }

        if (variables[token].type !== "int") {
            throw new Error("Ln " + lineNum + ': variavel "' + token + '" deve ser int para calculo.');
        }

        return variables[token].value;
    }

    function tokenizeIntExpression(raw, lineNum) {
        var tokens = [];
        var i = 0;
        while (i < raw.length) {
            var ch = raw.charAt(i);

            if (/\s/.test(ch)) {
                i++;
                continue;
            }

            if (ch === "+" || ch === "-") {
                tokens.push(ch);
                i++;
                continue;
            }

            if (/\d/.test(ch)) {
                var nStart = i;
                i++;
                while (i < raw.length && /\d/.test(raw.charAt(i))) i++;
                tokens.push(raw.slice(nStart, i));
                continue;
            }

            if (/[a-zA-Z_]/.test(ch)) {
                var vStart = i;
                i++;
                while (i < raw.length && /[a-zA-Z0-9_]/.test(raw.charAt(i))) i++;
                tokens.push(raw.slice(vStart, i));
                continue;
            }

            throw new Error("Ln " + lineNum + ": expressao invalida. Use apenas int, variaveis, + e -.");
        }

        return tokens;
    }

    function evaluateIntExpression(valueRaw, variables, lineNum) {
        var tokens = tokenizeIntExpression(valueRaw, lineNum);
        if (!tokens.length) {
            throw new Error("Ln " + lineNum + ": valor vazio para variavel.");
        }
        if (tokens.length % 2 === 0) {
            throw new Error("Ln " + lineNum + ": expressao incompleta.");
        }
        if (tokens.length > 1 && (tokens[0] === "+" || tokens[0] === "-")) {
            throw new Error("Ln " + lineNum + ": comece a expressao com numero ou variavel.");
        }

        var hasAddition = false;
        var hasSubtraction = false;

        var result = resolveIntToken(tokens[0], variables, lineNum);
        for (var i = 1; i < tokens.length; i += 2) {
            var op = tokens[i];
            var rhsToken = tokens[i + 1];
            if (op !== "+" && op !== "-") {
                throw new Error("Ln " + lineNum + ": operador invalido na expressao.");
            }
            if (rhsToken === "+" || rhsToken === "-") {
                throw new Error("Ln " + lineNum + ": expressao incompleta.");
            }

            var rhs = resolveIntToken(rhsToken, variables, lineNum);
            if (op === "+") {
                hasAddition = true;
                result += rhs;
            } else {
                hasSubtraction = true;
                result -= rhs;
            }
        }

        var isSingleLiteral = tokens.length === 1 && /^\d+$/.test(tokens[0]);
        return {
            value: result,
            isCalculated: !isSingleLiteral,
            hasAddition: hasAddition,
            hasSubtraction: hasSubtraction,
        };
    }

    function parseAssignment(line, lineNum, variables) {
        var assignMatch = line.match(/^([a-zA-Z_]\w*)\s*=\s*(.+)$/);
        if (!assignMatch) return null;

        var varName = assignMatch[1];
        var valueRaw = assignMatch[2].trim();

        var evalResult = evaluateIntExpression(valueRaw, variables, lineNum);

        variables[varName] = {
            name: varName,
            type: "int",
            value: evalResult.value,
            isCalculated: evalResult.isCalculated,
            line: lineNum,
            raw: valueRaw,
        };

        return {
            type: "assign",
            line: lineNum,
            varName: varName,
            valueType: "int",
            valueRaw: valueRaw,
            value: evalResult.value,
            isCalculated: evalResult.isCalculated,
            hasAddition: evalResult.hasAddition,
            hasSubtraction: evalResult.hasSubtraction,
        };
    }

    function parseCode(code) {
        var commands = [];
        var lines = code.split("\n");
        var variables = {};
        var moveCount = 0;
        var hasAddition = false;
        var hasSubtraction = false;

        for (var i = 0; i < lines.length; i++) {
            var line = lines[i].trim();
            var lineNum = i + 1;
            if (!line || line.startsWith("#")) continue;

            var assignCmd = parseAssignment(line, lineNum, variables);
            if (assignCmd) {
                if (moveCount > 0) {
                    throw new Error("Ln " + lineNum + ": declare variaveis antes dos movimentos.");
                }
                if (assignCmd.hasAddition) hasAddition = true;
                if (assignCmd.hasSubtraction) hasSubtraction = true;
                commands.push(assignCmd);
                continue;
            }

            var moveRight = line.match(/^move_right\s*\(\s*([a-zA-Z_]\w*)\s*\)$/);
            if (moveRight) {
                var rightVar = moveRight[1];
                if (!variables[rightVar]) {
                    throw new Error("Ln " + lineNum + ': variavel "' + rightVar + '" nao declarada.');
                }
                if (variables[rightVar].type !== "int") {
                    throw new Error("Ln " + lineNum + ": move_right() exige variavel int.");
                }
                var rightSteps = Math.abs(variables[rightVar].value);

                commands.push({
                    type: "move_right",
                    line: lineNum,
                    varName: rightVar,
                    steps: rightSteps,
                });
                moveCount += 1;
                continue;
            }

            var moveLeft = line.match(/^move_left\s*\(\s*([a-zA-Z_]\w*)\s*\)$/);
            if (moveLeft) {
                var leftVar = moveLeft[1];
                if (!variables[leftVar]) {
                    throw new Error("Ln " + lineNum + ': variavel "' + leftVar + '" nao declarada.');
                }
                if (variables[leftVar].type !== "int") {
                    throw new Error("Ln " + lineNum + ": move_left() exige variavel int.");
                }
                var leftSteps = Math.abs(variables[leftVar].value);

                commands.push({
                    type: "move_left",
                    line: lineNum,
                    varName: leftVar,
                    steps: leftSteps,
                });
                moveCount += 1;
                continue;
            }

            throw new Error("Ln " + lineNum + ': comando invalido "' + line + '"');
        }

        if (commands.length === 0) throw new Error("Nenhum comando encontrado.");
        if (commands.length > MAX_COMMANDS) throw new Error("Maximo " + MAX_COMMANDS + " comandos permitidos.");

        var varNames = Object.keys(variables);
        if (varNames.length < 1) throw new Error("Declare ao menos 1 variavel int.");
        if (!hasAddition || !hasSubtraction) throw new Error("Use operacoes de soma (+) e subtracao (-).");
        if (moveCount < 1) throw new Error("Use ao menos um comando de movimento.");

        return commands;
    }

    /* ===== EXECUTION ===== */
    function highlightEditorLine(lineNum) {
        var spans = gutterEl.querySelectorAll("span");
        spans.forEach(function (s) { s.classList.remove("active-line"); });
        if (lineNum > 0 && lineNum <= spans.length) spans[lineNum - 1].classList.add("active-line");
        activeLineEl.style.top = ((lineNum - 1) * 22 + 10) + "px";
    }

    async function runCommands(commands, id, moveSpeed) {
        var currentCol = PLAYER_START.col;

        for (var i = 0; i < commands.length; i++) {
            if (id !== execId || hasWon) return;

            var cmd = commands[i];
            highlightEditorLine(cmd.line);

            if (cmd.type === "assign") {
                runtimeVariables[cmd.varName] = cmd.value;
                termLog(
                    "✓ " + cmd.varName + " = " + cmd.value + (cmd.isCalculated ? " (calculado)" : ""),
                    "term-success"
                );
                await pauseMs(selectedSpeed === "fast" ? 110 : 240);
                continue;
            }

            if (cmd.type === "move_right" || cmd.type === "move_left") {
                var direction = cmd.type === "move_right" ? 1 : -1;
                var label = cmd.type === "move_right"
                    ? "move_right(" + cmd.varName + ")"
                    : "move_left(" + cmd.varName + ")";

                termLogHtml(
                    '<span class="term-prompt">❯</span> ' +
                    '<span class="term-cmd">Executando linha ' + cmd.line + ':</span> ' +
                    label
                );

                for (var s = 0; s < cmd.steps; s++) {
                    var nextCol = currentCol + direction;
                    if (nextCol < 0) nextCol = 0;
                    if (nextCol > COLS - 1) nextCol = COLS - 1;

                    if (nextCol === currentCol) break;

                    currentCol = nextCol;
                    await moveToCol(currentCol, id, moveSpeed);
                    markStepPassed(currentCol);
                    checkCheckpointCollisions();
                    checkGoal();

                    if (hasWon || id !== execId) return;
                }
            }
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
        hideAutocomplete();
        resetPlayerPosition();
        resetStepDots();
        resetRuntimeVariables();
        resetObjectives();
        var moveSpeed = SPEED_MAP[selectedSpeed];

        termLog("▶ Executando programa (" + selectedSpeed.toUpperCase() + ")...", "term-cmd");

        await runCommands(commands, localId, moveSpeed);

        if (localId !== execId) return;
        isExecuting = false;
        runBtn.disabled = false;

        if (!hasWon) {
            termLog("✗ Voce perdeu. Nao completou a rota calculada. Reiniciando...", "term-error");
            runBtn.disabled = true;
            setTimeout(function () {
                if (localId !== execId || hasWon) return;
                resetPlayerPosition();
                resetStepDots();
                resetRuntimeVariables();
                resetObjectives();
                isExecuting = false;
                runBtn.disabled = false;
                termLog("↺ Fase resetada. Recalcule as distancias.", "term-error");
            }, LOSS_DELAY);
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

    function applySpeedSelection(mode) {
        selectedSpeed = mode === "fast" ? "fast" : "slow";
        speedSlowBtn.classList.toggle("active", selectedSpeed === "slow");
        speedFastBtn.classList.toggle("active", selectedSpeed === "fast");
        speedSlowBtn.setAttribute("aria-pressed", selectedSpeed === "slow" ? "true" : "false");
        speedFastBtn.setAttribute("aria-pressed", selectedSpeed === "fast" ? "true" : "false");
    }

    /* ===== INIT ===== */
    applySpeedSelection("slow");
    resetRuntimeVariables();
    resetObjectives();
    updateGutter();
    updateHighlight();
    updateCursorInfo();

})();
