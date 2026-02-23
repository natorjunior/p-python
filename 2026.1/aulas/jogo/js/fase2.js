/* ===== FASE 2 — Rota de Coleta ===== */

(function () {
    "use strict";

    /* ===== CONFIG ===== */
    const TILE = 96;
    const COLS = 11;
    const ROWS = 6;
    const GAME_W = TILE * COLS;
    const GAME_H = TILE * ROWS;
    const GROUND_ROW = 5;

    const MAX_COMMANDS = 8;
    const PLAYER_START = { col: 2, row: GROUND_ROW };
    const CRYSTAL_COLS = [4, 7];
    const CHEST_COL = 5;

    const PLAYER_W = 40;
    const PLAYER_H = 50;
    const CRYSTAL_SIZE = 28;

    const SPEED_MAP = {
        slow: 2.2,
        fast: 6.0,
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
    let collectedCrystals = 0;
    let chestUnlockedLogged = false;
    var autocompleteState = {
        visible: false,
        matches: [],
        selectedIndex: 0,
        replaceStart: 0,
        lineIndex: 0,
        colChars: 0,
    };

    const stepDots = {};
    const stepPassCount = {};
    const crystalEntities = [];

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
    let chestGoal;
    let chestSprite;

    function buildScene() {
        const skyColors = ["#1a1b26", "#1a1b2e", "#1e2030", "#24273a", "#363a4f"];
        for (let r = 0; r < GROUND_ROW; r++) {
            Crafty.e("2D, DOM, Color")
                .attr({ x: 0, y: r * TILE, w: GAME_W, h: TILE })
                .color(skyColors[r] || "#24273a");
        }

        const STAR_COUNT = 32;
        for (let s = 0; s < STAR_COUNT; s++) {
            const posX = 20 + Math.random() * (GAME_W - 40);
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

        const minPathCol = Math.min(PLAYER_START.col, CHEST_COL, CRYSTAL_COLS[0], CRYSTAL_COLS[1]);
        const maxPathCol = Math.max(PLAYER_START.col, CHEST_COL, CRYSTAL_COLS[0], CRYSTAL_COLS[1]);

        for (let c = minPathCol; c <= maxPathCol; c++) {
            Crafty.e("2D, DOM, Color")
                .attr({ x: c * TILE + 10, y: GROUND_ROW * TILE + TILE - 12, w: TILE - 20, h: 2 })
                .color("#45475a");
        }

        for (let c = 1; c <= COLS - 2; c++) {
            stepDots[c] = Crafty.e("2D, DOM, Color")
                .attr({ x: c * TILE + TILE / 2 - 6, y: GROUND_ROW * TILE + 10, w: 12, h: 12, z: 18 })
                .color("#585b70")
                .css({
                    "border-radius": "50%",
                    opacity: "0.9",
                    "box-shadow": "0 0 0 2px rgba(137,180,250,0.22) inset, 0 0 0 1px rgba(17,17,27,0.55)"
                });
        }
    }

    buildScene();

    /* ===== CRYSTALS ===== */
    function createCrystal(col) {
        const x = colToX(col) + (TILE - CRYSTAL_SIZE) / 2;
        const y = rowToY(GROUND_ROW) - (CRYSTAL_SIZE + 8);

        const crystal = Crafty.e("2D, DOM, Image, Collision, Crystal")
            .attr({ x: x, y: y, w: CRYSTAL_SIZE, h: CRYSTAL_SIZE })
            .image("../assets/img/cristal.png", "no-repeat")
            .css({
                "background-size": "contain",
                "background-position": "center bottom",
                "image-rendering": "pixelated",
                opacity: "1"
            });
        crystal._collected = false;
        crystal._spawn = { x: x, y: y, w: CRYSTAL_SIZE, h: CRYSTAL_SIZE };

        crystalEntities.push({ col: col, crystal: crystal });
    }

    CRYSTAL_COLS.forEach(createCrystal);

    /* ===== CHEST ===== */
    const chestX = colToX(CHEST_COL) + (TILE - 38) / 2;
    const chestY = rowToY(GROUND_ROW) - 40;

    chestSprite = Crafty.e("2D, DOM, Image")
        .attr({ x: chestX - 4, y: chestY + 1, w: 46, h: 40, z: 22 })
        .image("../assets/img/bau.png", "no-repeat")
        .css({
            "background-size": "contain",
            "background-position": "center bottom",
            "image-rendering": "pixelated",
            display: "none",
            opacity: "1"
        });

    chestGoal = Crafty.e("2D, DOM, Color, Collision, ChestGoal")
        .attr({ x: chestX - 4, y: chestY, w: 0, h: 0 })
        .color("transparent");

    function setChestVisible(visible) {
        if (visible) {
            chestSprite.css({ display: "block", opacity: "1" });
            chestGoal.attr({ x: chestX - 4, y: chestY, w: 46, h: 42 });
        } else {
            chestSprite.css({ display: "none" });
            chestGoal.attr({ x: chestX - 4, y: chestY, w: 0, h: 0 });
        }
    }

    setChestVisible(false);

    /* ===== PLAYER ===== */
    const playerStartX = colToX(PLAYER_START.col) + (TILE - PLAYER_W) / 2;
    const playerStartY = rowToY(GROUND_ROW) - PLAYER_H;

    const player = Crafty.e("2D, DOM, Image, Collision")
        .attr({ x: playerStartX, y: playerStartY, w: PLAYER_W, h: PLAYER_H })
        .image("../assets/img/player.png", "no-repeat")
        .css({
            "background-size": "contain",
            "background-position": "center bottom",
            "image-rendering": "pixelated",
            "transition": "none"
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
            if (tok.start > cursor) result += escapeHtml(code.substring(cursor, tok.start));
            result += '<span class="' + tok.cls + '">' + escapeHtml(tok.text) + "</span>";
            cursor = tok.end;
        }

        if (cursor < code.length) result += escapeHtml(code.substring(cursor));
        return result;
    }

    /* ===== GUTTER / CURSOR ===== */
    function updateGutter() {
        var lines = editorEl.value.split("\n");
        var count = Math.max(lines.length, MAX_COMMANDS, 8);
        var cursorLine = getCurrentLine();
        var html = "";
        for (var i = 1; i <= count; i++) {
            var cls = i === cursorLine ? ' class="active-line"' : "";
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

    /* ===== RESET VISUALS ===== */
    function resetPlayerPosition() {
        player.attr({ x: playerStartX, y: playerStartY });
    }

    function resetStepDots() {
        Object.keys(stepDots).forEach(function (col) {
            stepPassCount[col] = 0;
            stepDots[col]
                .color("#585b70")
                .css({
                    opacity: "0.9",
                    "box-shadow": "0 0 0 2px rgba(137,180,250,0.22) inset, 0 0 0 1px rgba(17,17,27,0.55)"
                });
        });
    }

    function markStepPassed(col) {
        var key = String(col);
        var dot = stepDots[key];
        if (!dot) return;

        stepPassCount[key] = (stepPassCount[key] || 0) + 1;

        if (stepPassCount[key] === 1) {
            // Primeira vez no ponto
            dot.color("#a6e3a1");
            dot.css({
                opacity: "1",
                "box-shadow": "0 0 0 2px rgba(166,227,161,0.65) inset, 0 0 16px rgba(166,227,161,0.62)"
            });
            return;
        }

        // Repassagem (volta): cor diferente para didática
        dot.color("#f9e2af");
        dot.css({
            opacity: "1",
            "box-shadow": "0 0 0 2px rgba(249,226,175,0.72) inset, 0 0 16px rgba(249,226,175,0.55)"
        });
    }

    function resetCrystals() {
        collectedCrystals = 0;
        chestUnlockedLogged = false;

        crystalEntities.forEach(function (item) {
            item.crystal._collected = false;
            item.crystal.attr(item.crystal._spawn);
            item.crystal.css({ display: "block", opacity: "1" });
        });

        setChestVisible(false);
    }

    function applySpeedSelection(mode) {
        selectedSpeed = mode === "fast" ? "fast" : "slow";
        speedSlowBtn.classList.toggle("active", selectedSpeed === "slow");
        speedFastBtn.classList.toggle("active", selectedSpeed === "fast");
        speedSlowBtn.setAttribute("aria-pressed", selectedSpeed === "slow" ? "true" : "false");
        speedFastBtn.setAttribute("aria-pressed", selectedSpeed === "fast" ? "true" : "false");
    }

    function resetPlayer() {
        execId++;
        isExecuting = false;
        hasWon = false;
        resetPlayerPosition();
        resetStepDots();
        resetCrystals();
        hideAutocomplete();
        runBtn.disabled = false;
        victoryOverlay.classList.remove("show");
        termLog("Posição restaurada. Pronto para nova rota.", "term-output");
        updateErrorStatus(0);
    }

    window.resetPlayer = resetPlayer;

    /* ===== GOAL CHECK ===== */
    function checkObjectives() {
        if (hasWon) return;

        var crystalHits = player.hit("Crystal");
        if (crystalHits) {
            for (var i = 0; i < crystalHits.length; i++) {
                var crystal = crystalHits[i].obj;
                if (!crystal._collected) {
                    crystal._collected = true;
                    collectedCrystals += 1;

                    var found = crystalEntities.find(function (item) { return item.crystal[0] === crystal[0]; });
                    if (found) {
                        found.crystal.css({ display: "none" });
                        found.crystal.attr({ w: 0, h: 0 });
                    }

                    termLog("✓ Cristal coletado (" + collectedCrystals + "/" + CRYSTAL_COLS.length + ").", "term-success");

                    if (collectedCrystals === CRYSTAL_COLS.length && !chestUnlockedLogged) {
                        setChestVisible(true);
                        chestUnlockedLogged = true;
                        termLog("✓ Cristais completos! O baú apareceu.", "term-success");
                    }
                }
            }
        }

        if (collectedCrystals < CRYSTAL_COLS.length) return;

        var chestHit = player.hit("ChestGoal");
        if (!chestHit) return;

        for (var c = 0; c < chestHit.length; c++) {
            if (chestHit[c].obj[0] === chestGoal[0]) {
                hasWon = true;
                isExecuting = false;
                runBtn.disabled = false;
                termLog("✓ Vitória! Cristais coletados e baú aberto.", "term-success");
                updateErrorStatus(0);
                victoryOverlay.classList.add("show");
                return;
            }
        }
    }

    player.bind("EnterFrame", checkObjectives);

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
            var line = lines[i].trim();
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
        victoryOverlay.classList.remove("show");
        resetPlayerPosition();
        resetStepDots();
        resetCrystals();
        hideAutocomplete();
        var moveSpeed = SPEED_MAP[selectedSpeed];

        termLog("▶ Executando rota (" + selectedSpeed.toUpperCase() + ")...", "term-cmd");

        await runCommands(commands, localId, moveSpeed);

        if (localId !== execId) return;

        isExecuting = false;
        runBtn.disabled = false;

        if (!hasWon) {
            var missingCrystals = CRYSTAL_COLS.length - collectedCrystals;
            var reason = missingCrystals > 0
                ? "Você não coletou todos os cristais."
                : "Você não voltou ao baú para concluir.";

            termLog("✗ Você perdeu. " + reason + " Reiniciando fase...", "term-error");
            runBtn.disabled = true;

            setTimeout(function () {
                if (localId !== execId || hasWon) return;
                resetPlayerPosition();
                resetStepDots();
                resetCrystals();
                isExecuting = false;
                runBtn.disabled = false;
                termLog("↺ Fase resetada. Ajuste sua sequência e tente novamente.", "term-error");
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

    /* ===== INIT ===== */
    applySpeedSelection("slow");
    updateGutter();
    updateHighlight();
    updateCursorInfo();
})();
