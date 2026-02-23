/* ===== FASE 8 — Cenário Dinâmico + Câmera ===== */

(function () {
    "use strict";

    /* ===== CONFIG ===== */
    const TILE = 64;
    const VIEW_COLS = 16;
    const WORLD_COLS = 56;
    const ROWS = 10;
    const VIEW_W = TILE * VIEW_COLS;
    const WORLD_W = TILE * WORLD_COLS;
    const GAME_H = TILE * ROWS;
    const GROUND_ROW = 9;
    const OBJECTIVE_HUD_W = Math.min(760, VIEW_W - 28);
    const OBJECTIVE_HUD_Y = 18;

    const MAX_COMMANDS = 40;
    const MAX_MOVE_STEPS = 12;
    const PLAYER_START = { col: 2, row: GROUND_ROW };
    const GOAL_COL = 54;
    const OBSTACLE_COLS = [14, 33, 47];
    const OBSTACLE_SET = OBSTACLE_COLS.reduce(function (acc, col) {
        acc[col] = true;
        return acc;
    }, {});

    const PLAYER_W = 40;
    const PLAYER_H = 52;
    const GOAL_W = 40;
    const GOAL_H = 48;

    const SPEED_MAP = {
        slow: 2.0,
        fast: 5.8,
    };

    const LOSS_DELAY = 1400;
    const AVAILABLE_COMMANDS = [
        "move_right(1)",
        "move_left(1)",
        "jump()",
        "interact()",
        "answer(True)",
        "answer(False)",
        "answer(\"==\")",
        "answer(\"and\")",
    ];

    /* ===== DOM ===== */
    const editorEl = document.getElementById("code-editor");
    const gutterEl = document.getElementById("gutter");
    const highlightEl = document.getElementById("code-highlight");
    const activeLineEl = document.getElementById("active-line-highlight");
    const runBtn = document.getElementById("run-btn");
    const stepBtn = document.getElementById("step-btn");
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

    let currentCol = PLAYER_START.col;
    let facing = 1;

    var autocompleteState = {
        visible: false,
        matches: [],
        selectedIndex: 0,
        replaceStart: 0,
        lineIndex: 0,
        colChars: 0,
    };
    var stepSession = null;

    var stepDots = {};
    var obstacleParts = {};
    var parallaxItems = [];
    var interactions = [];

    var goal = null;
    var goalLock = null;
    var goalAura = null;
    var goalLocked = true;
    var activeQuiz = null;

    var objectiveHudPanel = null;
    var objectiveHudText = null;
    var playerDialogPanel = null;
    var playerDialogTail = null;
    var playerDialogTitle = null;
    var playerDialogBody = null;
    var dialogHideTimer = null;
    var playerDialogWidth = 560;
    var playerDialogHeight = 170;
    var playerDialogBadge = null;
    var playerDialogDivider = null;
    var playerDialogHint = null;
    var playerDialogProgress = null;
    var playerDialogProgressBar = null;

    /* ===== HELPERS ===== */
    function colToX(col) { return col * TILE; }
    function rowToY(row) { return row * TILE; }

    function clamp(value, min, max) {
        return Math.max(min, Math.min(max, value));
    }

    function sleep(ms) {
        return new Promise(function (resolve) {
            setTimeout(resolve, ms);
        });
    }

    function termLog(msg, cls) {
        cls = cls || "term-output";
        terminalOutput.className = cls;
        terminalOutput.textContent = msg;
    }

    function termLogHtml(html) {
        terminalOutput.innerHTML = html;
    }

    function groundPlayerY() {
        return rowToY(GROUND_ROW) - PLAYER_H;
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
    Crafty.init(VIEW_W, GAME_H, document.getElementById("game"));
    Crafty.viewport.clampToEntities = false;
    Crafty.background("#060b1a");

    function registerParallax(entity, factor) {
        parallaxItems.push({
            entity: entity,
            baseX: entity.x,
            factor: factor,
        });
    }

    function updateParallax() {
        var cameraOffset = -Crafty.viewport.x;
        for (var i = 0; i < parallaxItems.length; i++) {
            var item = parallaxItems[i];
            item.entity.x = item.baseX + cameraOffset * item.factor;
        }
    }

    function cameraTargetX() {
        var center = player.x + player.w / 2;
        var raw = -(center - VIEW_W / 2);
        return clamp(raw, VIEW_W - WORLD_W, 0);
    }

    function syncOverlayWithCamera() {
        if (!objectiveHudPanel || !objectiveHudText) return;
        var panelX = Math.round(-Crafty.viewport.x + (VIEW_W - OBJECTIVE_HUD_W) / 2);
        objectiveHudPanel.attr({ x: panelX, y: OBJECTIVE_HUD_Y });
        objectiveHudText.attr({ x: panelX + 12, y: OBJECTIVE_HUD_Y + 6, w: OBJECTIVE_HUD_W - 24 });
    }

    function setCameraImmediate() {
        Crafty.viewport.x = cameraTargetX();
        Crafty.viewport.y = 0;
        updateParallax();
        syncOverlayWithCamera();
    }

    function updateCameraSmooth() {
        var targetX = cameraTargetX();
        Crafty.viewport.x += (targetX - Crafty.viewport.x) * 0.16;
        if (Math.abs(targetX - Crafty.viewport.x) < 0.4) {
            Crafty.viewport.x = targetX;
        }
        Crafty.viewport.y = 0;
        updateParallax();
        syncOverlayWithCamera();
    }

    /* ===== SCENE ===== */
    function buildScene() {
        // Sky gradient bands
        var sky = ["#060b1a", "#081227", "#0d1b34", "#13274a", "#1b3260", "#2b4474"];
        for (var r = 0; r < GROUND_ROW; r++) {
            Crafty.e("2D, DOM, Color")
                .attr({ x: 0, y: r * TILE, w: WORLD_W, h: TILE })
                .color(sky[r] || sky[sky.length - 1]);
        }

        // Distant glow
        Crafty.e("2D, DOM, Color")
            .attr({ x: 180, y: 22, w: 220, h: 220, z: 1 })
            .color("#89b4fa")
            .css({ "border-radius": "50%", opacity: "0.06", filter: "blur(1px)" });

        Crafty.e("2D, DOM, Color")
            .attr({ x: WORLD_W - 380, y: 42, w: 180, h: 180, z: 1 })
            .color("#f9e2af")
            .css({ "border-radius": "50%", opacity: "0.05", filter: "blur(1px)" });

        // Stars with twinkle
        for (var s = 0; s < 120; s++) {
            var size = 1 + Math.floor(Math.random() * 3);
            var star = Crafty.e("2D, DOM, Color")
                .attr({
                    x: 8 + Math.random() * (WORLD_W - 16),
                    y: 10 + Math.random() * (GROUND_ROW * TILE * 0.52),
                    w: size,
                    h: size,
                    z: 2,
                })
                .color("#dce4ff");

            star._baseAlpha = 0.24 + Math.random() * 0.55;
            star._speed = 0.008 + Math.random() * 0.02;
            star._phase = Math.random() * Math.PI * 2;
            star.css({ "border-radius": "50%", opacity: star._baseAlpha });
            star.bind("EnterFrame", function (e) {
                var alpha = this._baseAlpha + Math.sin(e.frame * this._speed + this._phase) * 0.3;
                this.css({ opacity: clamp(alpha, 0.08, 1) });
            });

            registerParallax(star, 0.24);
        }

        // Layered mountains (parallax)
        for (var m1 = 0; m1 < WORLD_COLS + 8; m1++) {
            var hillFar = Crafty.e("2D, DOM, Color")
                .attr({
                    x: m1 * 110 - 40,
                    y: rowToY(GROUND_ROW) - 92 - (m1 % 3) * 14,
                    w: 150,
                    h: 92,
                    z: 4,
                })
                .color("#1d2f4f")
                .css({
                    "clip-path": "polygon(0% 100%, 35% 34%, 62% 12%, 100% 100%)",
                    opacity: "0.65",
                });
            registerParallax(hillFar, 0.32);
        }

        for (var m2 = 0; m2 < WORLD_COLS + 8; m2++) {
            var hillNear = Crafty.e("2D, DOM, Color")
                .attr({
                    x: m2 * 98 - 30,
                    y: rowToY(GROUND_ROW) - 66 - (m2 % 2) * 8,
                    w: 136,
                    h: 68,
                    z: 5,
                })
                .color("#233d63")
                .css({
                    "clip-path": "polygon(0% 100%, 28% 46%, 56% 20%, 100% 100%)",
                    opacity: "0.82",
                });
            registerParallax(hillNear, 0.56);
        }

        // Ground and lane markers
        Crafty.e("2D, DOM, Color, Solid")
            .attr({ x: 0, y: rowToY(GROUND_ROW), w: WORLD_W, h: TILE, z: 10 })
            .color("#2b354c");

        Crafty.e("2D, DOM, Color")
            .attr({ x: 0, y: rowToY(GROUND_ROW), w: WORLD_W, h: 3, z: 11 })
            .color("#6ee7ff")
            .css({ opacity: "0.45" });

        Crafty.e("2D, DOM, Color")
            .attr({ x: 0, y: rowToY(GROUND_ROW) + TILE - 8, w: WORLD_W, h: 8, z: 10 })
            .color("#1a2236");

        for (var c = 0; c < WORLD_COLS; c++) {
            Crafty.e("2D, DOM, Color")
                .attr({ x: c * TILE + TILE / 2 - 1, y: rowToY(GROUND_ROW) + TILE / 2 - 1, w: 2, h: 2, z: 11 })
                .color("#6b7390")
                .css({ "border-radius": "50%" });

            if (c > PLAYER_START.col && c < GOAL_COL + 1) {
                stepDots[c] = Crafty.e("2D, DOM, Color")
                    .attr({ x: c * TILE + TILE / 2 - 5, y: rowToY(GROUND_ROW) + 8, w: 10, h: 10, z: 20 })
                    .color("#4b5678")
                    .css({
                        "border-radius": "50%",
                        opacity: "0.95",
                        "box-shadow": "0 0 0 2px rgba(110,231,255,0.18) inset",
                    });
            }
        }

        for (var i = 0; i < OBSTACLE_COLS.length; i++) {
            buildObstacle(OBSTACLE_COLS[i]);
        }

        buildInteractions();

        objectiveHudPanel = Crafty.e("2D, DOM, Color")
            .attr({ x: 12, y: OBJECTIVE_HUD_Y, w: OBJECTIVE_HUD_W, h: 30, z: 80 })
            .color("#0b1225")
            .css({
                opacity: "0.62",
                "border-radius": "10px",
                "box-shadow": "0 10px 20px rgba(0,0,0,0.25)",
                border: "1px solid rgba(110,231,255,0.18)",
            });

        objectiveHudText = Crafty.e("2D, DOM, Text")
            .attr({ x: 24, y: OBJECTIVE_HUD_Y + 6, w: OBJECTIVE_HUD_W - 24, h: 16, z: 81 })
            .textColor("#c9d7ff")
            .textFont({ size: "11px", weight: "700", family: "Consolas" });

    }

    function createJumpMarker(col, yTop) {
        var centerX = colToX(col) + TILE / 2;
        var bg = Crafty.e("2D, DOM, Color")
            .attr({ x: centerX - 32, y: yTop, w: 64, h: 15, z: 25 })
            .color("#321b38")
            .css({
                "border-radius": "8px",
                border: "1px solid rgba(243,139,168,0.45)",
                opacity: "0.92",
            });

        var text = Crafty.e("2D, DOM, Text")
            .attr({ x: centerX - 32, y: yTop + 2, w: 64, h: 11, z: 26 })
            .text("JUMP")
            .textColor("#f38ba8")
            .textFont({ size: "9px", weight: "700", family: "Consolas" })
            .css({ "text-align": "center" });

        return { bg: bg, text: text };
    }

    function createInteractionMarker(col, yTop, label) {
        var centerX = colToX(col) + TILE / 2;
        var isQuiz = label && label.indexOf("QUIZ") >= 0;
        var markerW = 76;
        var accentColor = isQuiz ? "#ebcb8b" : "#88c0d0";
        var accentBorder = isQuiz ? "rgba(235,203,139,0.45)" : "rgba(136,192,208,0.40)";
        var bgColor = "#0d1117";

        var bg = Crafty.e("2D, DOM, Color")
            .attr({ x: centerX - markerW / 2, y: yTop, w: markerW, h: 18, z: 33 })
            .color(bgColor)
            .css({
                "border-radius": "4px",
                border: "1px solid " + accentBorder,
                opacity: "0.95",
            });

        var text = Crafty.e("2D, DOM, Text")
            .attr({ x: centerX - markerW / 2, y: yTop + 3, w: markerW, h: 12, z: 34 })
            .text(label || "INTERACT")
            .textColor(accentColor)
            .textFont({ size: "9px", weight: "800", family: "Consolas, monospace" })
            .css({ "text-align": "center", "letter-spacing": "0.08em" });

        var pulse = Crafty.e("2D, DOM, Color")
            .attr({ x: centerX - 16, y: rowToY(GROUND_ROW) + 2, w: 32, h: 8, z: 29 })
            .color(accentColor)
            .css({ opacity: "0.18", "border-radius": "50%" });

        return { bg: bg, text: text, pulse: pulse, label: label || "INTERACT" };
    }

    function setInteractionMarkerState(marker, state) {
        if (!marker) return;

        if (state === "done") {
            marker.bg.color("#0d1117").css({ opacity: "0.95", border: "1px solid rgba(163,190,140,0.50)" });
            marker.text.text("DONE").textColor("#a3be8c");
            marker.pulse.color("#a3be8c").css({ opacity: "0.40" });
            return;
        }

        if (state === "focus") {
            marker.bg.color("#0d1117").css({ opacity: "1", border: "1px solid rgba(235,203,139,0.60)" });
            marker.text.text("> " + marker.label).textColor("#ebcb8b");
            marker.pulse.color("#ebcb8b").css({ opacity: "0.45" });
            return;
        }

        var isQuiz = marker.label && marker.label.indexOf("QUIZ") >= 0;
        var defaultBorder = isQuiz ? "rgba(235,203,139,0.45)" : "rgba(136,192,208,0.40)";
        var defaultColor = isQuiz ? "#ebcb8b" : "#88c0d0";
        marker.bg.color("#0d1117").css({ opacity: "0.95", border: "1px solid " + defaultBorder });
        marker.text.text(marker.label).textColor(defaultColor);
        marker.pulse.color(defaultColor).css({ opacity: "0.18" });
    }

    function buildObstacle(col) {
        var baseX = colToX(col) + (TILE - 34) / 2;
        var baseY = rowToY(GROUND_ROW) - 46;
        var jumpMarker = createJumpMarker(col, baseY - 18);

        var body = Crafty.e("2D, DOM, Color, Solid")
            .attr({ x: baseX, y: baseY, w: 34, h: 46, z: 22 })
            .color("#65466f")
            .css({ "border-radius": "8px" });

        var cap = Crafty.e("2D, DOM, Color")
            .attr({ x: baseX + 3, y: baseY + 3, w: 28, h: 8, z: 23 })
            .color("#f38ba8")
            .css({ "border-radius": "4px", opacity: "0.85" });

        var symbol = Crafty.e("2D, DOM, Text")
            .attr({ x: baseX, y: baseY + 14, w: 34, h: 16, z: 24 })
            .text("!")
            .textColor("#f9e2af")
            .textFont({ size: "16px", weight: "700", family: "Consolas" })
            .css({ "text-align": "center" });

        obstacleParts[col] = [body, cap, symbol, jumpMarker.bg, jumpMarker.text];
    }

    function createInteractionNpc(col, label, accentColor) {
        var npc = Crafty.e("2D, DOM, Image")
            .attr({ x: colToX(col) + 10, y: rowToY(GROUND_ROW) - 54, w: 44, h: 54, z: 30 })
            .image("../assets/img/player3.png", "no-repeat")
            .css({ "background-size": "contain", "background-position": "center bottom", "image-rendering": "pixelated" });

        var aura = Crafty.e("2D, DOM, Color")
            .attr({ x: colToX(col) + 10, y: rowToY(GROUND_ROW) + 2, w: 44, h: 10, z: 29 })
            .color(accentColor)
            .css({ opacity: "0.16", "border-radius": "50%" });

        return {
            npc: npc,
            aura: aura,
        };
    }

    function buildInteractions() {
        interactions = [];

        // INFO RELACIONAL
        var relationalInfoNpc = createInteractionNpc(7, "INFO", "#7dcfff");
        var relationalInfoMarker = createInteractionMarker(7, rowToY(GROUND_ROW) - 60, "INFO REL");

        interactions.push({
            id: "info_rel",
            label: "Totem Relacional",
            col: 7,
            marker: relationalInfoMarker,
            type: "info",
            lesson: {
                title: "OPERADORES RELACIONAIS",
                body: "Em Python, operadores relacionais comparam\ndois valores e retornam True ou False.\n\n>  maior que        <  menor que\n>= maior ou igual   <= menor ou igual\n== igual a          != diferente de",
                example: "10 > 3   resulta True\n4 == 9   resulta False\n5 != 5   resulta False\n7 >= 7   resulta True",
                hint: "Sempre que usar if ou while, a condicao usa esses operadores.",
            },
            done: false,
            activate: function () {
                relationalInfoNpc.npc.css({ filter: "drop-shadow(0 0 12px rgba(166,227,161,0.55)) saturate(0.85)" });
                relationalInfoNpc.aura.color("#a6e3a1").css({ opacity: "0.52" });
                setInteractionMarkerState(relationalInfoMarker, "done");
            },
            reset: function () {
                relationalInfoNpc.npc.css({ filter: "none" });
                relationalInfoNpc.aura.color("#7dcfff").css({ opacity: "0.16" });
                setInteractionMarkerState(relationalInfoMarker, "default");
            },
        });

        // QUIZ RELACIONAL
        var relationalQuizNpc = createInteractionNpc(20, "QUIZ", "#f9e2af");
        var relationalQuizMarker = createInteractionMarker(20, rowToY(GROUND_ROW) - 64, "QUIZ REL");

        interactions.push({
            id: "quiz_rel",
            label: "Quiz Relacional",
            col: 20,
            marker: relationalQuizMarker,
            type: "quiz",
            question:
                "Avalie a expressao abaixo:\n\n  (8 > 3) and (4 == 4)\n\nDesmembrando:\n  8 > 3  -->  True\n  4 == 4 -->  True\n  True and True --> ?\n\nDigite answer(True) ou answer(False).",
            acceptedAnswers: ["true"],
            successText: "Correto! Cada lado e True, e True and True = True.",
            lesson: {
                title: "QUIZ RELACIONAL",
                body: "Avalie cada comparacao separadamente\ne depois combine com o operador logico.\n\n  (8 > 3) and (4 == 4) = ?",
                example: "8 > 3  -->  True\n4 == 4 -->  True\nTrue and True --> True",
                hint: "Resolva cada lado do 'and' antes de combinar.",
            },
            done: false,
            activate: function () {
                relationalQuizNpc.npc.css({ filter: "drop-shadow(0 0 12px rgba(166,227,161,0.55)) saturate(0.85)" });
                relationalQuizNpc.aura.color("#a6e3a1").css({ opacity: "0.52" });
                setInteractionMarkerState(relationalQuizMarker, "done");
            },
            reset: function () {
                relationalQuizNpc.npc.css({ filter: "none" });
                relationalQuizNpc.aura.color("#f9e2af").css({ opacity: "0.16" });
                setInteractionMarkerState(relationalQuizMarker, "default");
            },
        });

        // INFO LÓGICO
        var logicalInfoNpc = createInteractionNpc(31, "INFO", "#89dceb");
        var logicalInfoMarker = createInteractionMarker(31, rowToY(GROUND_ROW) - 72, "INFO LOG");

        interactions.push({
            id: "info_log",
            label: "Guia Lógico",
            col: 31,
            marker: logicalInfoMarker,
            type: "info",
            lesson: {
                title: "OPERADORES LOGICOS",
                body: "Operadores logicos combinam valores\nbooleanos (True / False):\n\nand --> True se AMBOS forem True\nor  --> True se PELO MENOS UM for True\nnot --> inverte: True vira False e vice-versa",
                example: "True and True   --> True\nTrue and False  --> False\nTrue or  False  --> True\nnot False       --> True",
                hint: "Resolva as comparacoes primeiro, depois aplique and/or/not.",
            },
            done: false,
            activate: function () {
                logicalInfoNpc.npc.css({ filter: "drop-shadow(0 0 12px rgba(166,227,161,0.55)) saturate(0.85)" });
                logicalInfoNpc.aura.color("#a6e3a1").css({ opacity: "0.52" });
                setInteractionMarkerState(logicalInfoMarker, "done");
            },
            reset: function () {
                logicalInfoNpc.npc.css({ filter: "none" });
                logicalInfoNpc.aura.color("#89dceb").css({ opacity: "0.16" });
                setInteractionMarkerState(logicalInfoMarker, "default");
            },
        });

        // QUIZ LÓGICO
        var logicalQuizNpc = createInteractionNpc(42, "QUIZ", "#fab387");
        var logicalQuizMarker = createInteractionMarker(42, rowToY(GROUND_ROW) - 62, "QUIZ LOG");

        interactions.push({
            id: "quiz_log",
            label: "Quiz Lógico",
            col: 42,
            marker: logicalQuizMarker,
            type: "quiz",
            question:
                "Avalie a expressao abaixo:\n\n  not (True and False)\n\nDesmembrando:\n  True and False --> False\n  not False      --> ?\n\nDigite answer(True) ou answer(False).",
            acceptedAnswers: ["true"],
            successText: "Correto! True and False da False, e not False da True.",
            lesson: {
                title: "QUIZ LOGICO",
                body: "Resolva de dentro para fora:\n\n  not (True and False) = ?",
                example: "Passo 1: True and False --> False\nPasso 2: not False      --> True",
                hint: "Resolva o que esta dentro dos parenteses primeiro.",
            },
            done: false,
            activate: function () {
                logicalQuizNpc.npc.css({ filter: "drop-shadow(0 0 12px rgba(166,227,161,0.55)) saturate(0.85)" });
                logicalQuizNpc.aura.color("#a6e3a1").css({ opacity: "0.52" });
                setInteractionMarkerState(logicalQuizMarker, "done");
            },
            reset: function () {
                logicalQuizNpc.npc.css({ filter: "none" });
                logicalQuizNpc.aura.color("#fab387").css({ opacity: "0.16" });
                setInteractionMarkerState(logicalQuizMarker, "default");
            },
        });
    }

    buildScene();

    /* ===== GOAL ===== */
    goal = Crafty.e("2D, DOM, Image")
        .attr({
            x: colToX(GOAL_COL) + (TILE - GOAL_W) / 2,
            y: rowToY(GROUND_ROW) - GOAL_H,
            w: GOAL_W,
            h: GOAL_H,
            z: 35,
        })
        .image("../assets/img/bandeira1.png", "no-repeat")
        .css({
            "background-size": "contain",
            "background-position": "center bottom",
            "image-rendering": "pixelated",
            filter: "grayscale(100%)",
            opacity: "0.65",
        });

    goalLock = Crafty.e("2D, DOM, Color")
        .attr({
            x: colToX(GOAL_COL) + (TILE - GOAL_W) / 2 - 2,
            y: rowToY(GROUND_ROW) - GOAL_H - 2,
            w: GOAL_W + 4,
            h: GOAL_H + 4,
            z: 36,
        })
        .color("#0f1528")
        .css({ opacity: "0.42", "border-radius": "8px", border: "1px solid rgba(255,255,255,0.08)" });

    goalAura = Crafty.e("2D, DOM, Color")
        .attr({
            x: colToX(GOAL_COL) + (TILE - 52) / 2,
            y: rowToY(GROUND_ROW) - 12,
            w: 52,
            h: 12,
            z: 34,
        })
        .color("#89dceb")
        .css({ opacity: "0.18", "border-radius": "50%" });

    /* ===== PLAYER ===== */
    var playerStartX = colToX(PLAYER_START.col) + (TILE - PLAYER_W) / 2;
    var playerStartY = groundPlayerY();

    var player = Crafty.e("2D, DOM, Image")
        .attr({ x: playerStartX, y: playerStartY, w: PLAYER_W, h: PLAYER_H, z: 40 })
        .image("../assets/img/player2.png", "no-repeat")
        .css({
            "background-size": "contain",
            "background-position": "center bottom",
            "image-rendering": "pixelated",
            "transition": "none",
        });

    player.bind("EnterFrame", function () {
        updateCameraSmooth();
        positionPlayerDialog();
    });

    /* ===== HUD STATE ===== */
    function wrapDialogText(text, maxChars, maxLines) {
        var source = String(text || "").trim();
        if (!source) return "";

        // Preservar quebras de linha explícitas
        var paragraphs = source.split("\n");
        var lines = [];

        for (var p = 0; p < paragraphs.length; p++) {
            var para = paragraphs[p].replace(/\s+/g, " ").trim();
            if (!para) {
                lines.push("");
                continue;
            }
            var words = para.split(" ");
            var current = "";

            for (var i = 0; i < words.length; i++) {
                var word = words[i];
                var candidate = current ? (current + " " + word) : word;

                if (candidate.length <= maxChars) {
                    current = candidate;
                } else {
                    if (current) lines.push(current);
                    current = word;
                }
            }
            if (current) lines.push(current);
        }

        if (lines.length > maxLines) {
            lines = lines.slice(0, maxLines);
            var last = lines[maxLines - 1];
            lines[maxLines - 1] = last.length > maxChars - 3 ? last.substring(0, maxChars - 3) + "..." : (last + "...");
        }

        return lines.join("\n");
    }

    function createPlayerDialogEntities() {
        /* — Panel (fundo do balão) — */
        playerDialogPanel = Crafty.e("2D, DOM, Color")
            .attr({ x: 0, y: 0, w: playerDialogWidth, h: playerDialogHeight, z: 90 })
            .color("#0d1117")
            .css({
                opacity: "0",
                "border-radius": "12px",
                border: "1px solid rgba(136,192,208,0.45)",
                "box-shadow": "0 10px 40px rgba(0,0,0,0.75), inset 0 1px 0 rgba(255,255,255,0.04)",
                display: "none",
                transition: "opacity 0.22s ease-out",
            });

        /* — Tail (seta para o player) — */
        playerDialogTail = Crafty.e("2D, DOM, Color")
            .attr({ x: 0, y: 0, w: 12, h: 12, z: 89 })
            .color("#0d1117")
            .css({
                border: "1px solid rgba(136,192,208,0.45)",
                "border-left": "none",
                "border-top": "none",
                transform: "rotate(45deg)",
                display: "none",
            });

        /* — Badge (tarja colorida com tipo) — */
        playerDialogBadge = Crafty.e("2D, DOM, Text")
            .attr({ x: 0, y: 0, w: 72, h: 18, z: 92 })
            .text("INFO")
            .textColor("#0d1117")
            .textFont({ size: "10px", weight: "800", family: "'Segoe UI', Consolas, monospace" })
            .css({
                "text-align": "center",
                "letter-spacing": "0.12em",
                "border-radius": "4px",
                background: "#88c0d0",
                padding: "2px 0",
                display: "none",
            });

        /* — Title — */
        playerDialogTitle = Crafty.e("2D, DOM, Text")
            .attr({ x: 0, y: 0, w: playerDialogWidth - 120, h: 18, z: 91 })
            .text("")
            .textColor("#eceff4")
            .textFont({ size: "13px", weight: "700", family: "'Segoe UI', Consolas, monospace" })
            .css({ "text-align": "left", "letter-spacing": "0.03em", display: "none" });

        /* — Divider — */
        playerDialogDivider = Crafty.e("2D, DOM, Color")
            .attr({ x: 0, y: 0, w: playerDialogWidth - 32, h: 1, z: 91 })
            .color("#3b4252")
            .css({ display: "none" });

        /* — Body (conteúdo principal) — */
        playerDialogBody = Crafty.e("2D, DOM, Text")
            .attr({ x: 0, y: 0, w: playerDialogWidth - 32, h: 80, z: 91 })
            .text("")
            .textColor("#d8dee9")
            .textFont({ size: "13px", weight: "400", family: "Consolas, 'Courier New', monospace" })
            .css({
                "text-align": "left",
                display: "none",
                "line-height": "1.7",
                "white-space": "pre-line",
                "overflow-y": "auto",
                "overflow-x": "hidden",
                "scrollbar-width": "thin",
                "scrollbar-color": "#4c566a #2e3440",
            });

        /* — Hint (dica de rodapé) — */
        playerDialogHint = Crafty.e("2D, DOM, Text")
            .attr({ x: 0, y: 0, w: playerDialogWidth - 32, h: 16, z: 91 })
            .text("")
            .textColor("#81a1c1")
            .textFont({ size: "11px", weight: "400", family: "'Segoe UI', Consolas, monospace" })
            .css({ "text-align": "left", display: "none", "font-style": "italic" });

        /* — Progress bar track — */
        playerDialogProgress = Crafty.e("2D, DOM, Color")
            .attr({ x: 0, y: 0, w: playerDialogWidth - 32, h: 3, z: 91 })
            .color("#2e3440")
            .css({ "border-radius": "2px", display: "none" });

        /* — Progress bar fill — */
        playerDialogProgressBar = Crafty.e("2D, DOM, Color")
            .attr({ x: 0, y: 0, w: 0, h: 3, z: 92 })
            .color("#88c0d0")
            .css({ "border-radius": "2px", display: "none", transition: "width 0.9s linear" });
    }

    function positionPlayerDialog() {
        if (!playerDialogPanel || !playerDialogTail || !playerDialogTitle || !playerDialogBody) return;

        var w = playerDialogPanel.w || playerDialogWidth;
        var h = playerDialogPanel.h || playerDialogHeight;
        var pad = 16;

        /* limitar altura ao espaço disponível acima do player */
        var maxH = player.y - 24;
        if (h > maxH && maxH > 120) h = maxH;

        var bubbleX = clamp(player.x + player.w / 2 - w / 2, 8, WORLD_W - w - 8);
        var bubbleY = Math.max(4, player.y - h - 16);
        var tailX = clamp(player.x + player.w / 2 - 6, bubbleX + 18, bubbleX + w - 24);
        var tailY = bubbleY + h - 7;

        playerDialogPanel.attr({ x: bubbleX, y: bubbleY, h: h });
        playerDialogTail.attr({ x: tailX, y: tailY });

        /* header row: badge + title */
        if (playerDialogBadge) playerDialogBadge.attr({ x: bubbleX + pad, y: bubbleY + 11 });
        playerDialogTitle.attr({ x: bubbleX + pad + 82, y: bubbleY + 11, w: w - pad - 98 });

        /* divider */
        if (playerDialogDivider) playerDialogDivider.attr({ x: bubbleX + pad, y: bubbleY + 33, w: w - pad * 2 });

        /* body (scrollable area) */
        var bodyTop = 40;
        var bodyBottom = (h > 160) ? 34 : 30;
        playerDialogBody.attr({ x: bubbleX + pad, y: bubbleY + bodyTop, w: w - pad * 2, h: h - bodyTop - bodyBottom });

        /* hint */
        if (playerDialogHint) playerDialogHint.attr({ x: bubbleX + pad, y: bubbleY + h - 30, w: w - pad * 2 });

        /* progress */
        if (playerDialogProgress) playerDialogProgress.attr({ x: bubbleX + pad, y: bubbleY + h - 12, w: w - pad * 2 });
        if (playerDialogProgressBar) playerDialogProgressBar.attr({ x: bubbleX + pad, y: bubbleY + h - 12 });
    }

    function setPlayerDialogVisible(visible) {
        var mode = visible ? "block" : "none";
        if (playerDialogPanel) {
            playerDialogPanel.css({ display: mode });
            if (visible) {
                setTimeout(function () { playerDialogPanel.css({ opacity: "0.97" }); }, 16);
            } else {
                playerDialogPanel.css({ opacity: "0" });
            }
        }
        if (playerDialogTail) playerDialogTail.css({ display: mode });
        if (playerDialogBadge) playerDialogBadge.css({ display: mode });
        if (playerDialogTitle) playerDialogTitle.css({ display: mode });
        if (playerDialogDivider) playerDialogDivider.css({ display: mode });
        if (playerDialogBody) playerDialogBody.css({ display: mode });
        if (playerDialogHint) playerDialogHint.css({ display: mode });
        if (!visible) {
            if (playerDialogProgress) playerDialogProgress.css({ display: "none" });
            if (playerDialogProgressBar) playerDialogProgressBar.css({ display: "none" });
        }
    }

    function showPlayerDialog(message, tone, durationMs, options) {
        if (!playerDialogPanel || !playerDialogTail || !playerDialogTitle || !playerDialogBody) return;
        options = options || {};

        if (dialogHideTimer) {
            clearTimeout(dialogHideTimer);
            dialogHideTimer = null;
        }

        /* — Paleta por tipo (Nord-inspired, sem emojis) — */
        var palettes = {
            info: {
                bg: "#0d1117",
                border: "rgba(136,192,208,0.40)",
                shadow: "0 10px 40px rgba(0,0,0,0.75)",
                badge: "#88c0d0", badgeText: "#0d1117", badgeLabel: "INFO",
                title: "#eceff4",
                text: "#d8dee9",
                divider: "#3b4252",
                hint: "#81a1c1",
                progressTrack: "#2e3440", progressFill: "#88c0d0",
            },
            quiz: {
                bg: "#0d1117",
                border: "rgba(235,203,139,0.40)",
                shadow: "0 10px 40px rgba(0,0,0,0.75)",
                badge: "#ebcb8b", badgeText: "#0d1117", badgeLabel: "QUIZ",
                title: "#eceff4",
                text: "#d8dee9",
                divider: "#3b4252",
                hint: "#d08770",
                progressTrack: "#2e3440", progressFill: "#ebcb8b",
            },
            success: {
                bg: "#0d1117",
                border: "rgba(163,190,140,0.45)",
                shadow: "0 10px 40px rgba(0,0,0,0.75)",
                badge: "#a3be8c", badgeText: "#0d1117", badgeLabel: "OK",
                title: "#eceff4",
                text: "#d8dee9",
                divider: "#3b4252",
                hint: "#a3be8c",
                progressTrack: "#2e3440", progressFill: "#a3be8c",
            },
            error: {
                bg: "#0d1117",
                border: "rgba(191,97,106,0.45)",
                shadow: "0 10px 40px rgba(0,0,0,0.75)",
                badge: "#bf616a", badgeText: "#eceff4", badgeLabel: "ERRO",
                title: "#eceff4",
                text: "#d8dee9",
                divider: "#3b4252",
                hint: "#bf616a",
                progressTrack: "#2e3440", progressFill: "#bf616a",
            },
        };
        var p = palettes[tone || "info"] || palettes.info;

        var titleText = options.title || "";
        var hintText = options.hint || "";
        var badgeLabel = options.badge || p.badgeLabel;
        var bodyText = wrapDialogText(message || "", 52, 14);
        var lineCount = bodyText ? bodyText.split("\n").length : 1;
        var hasHint = hintText.length > 0;
        var dynamicHeight = clamp(78 + lineCount * 22 + (hasHint ? 26 : 0), 120, 420);

        /* — Apply — */
        playerDialogPanel.attr({ w: playerDialogWidth, h: dynamicHeight });
        playerDialogPanel.color(p.bg);
        playerDialogPanel.css({
            border: "1px solid " + p.border,
            "box-shadow": p.shadow,
        });

        playerDialogTail.color(p.bg);
        playerDialogTail.css({
            border: "1px solid " + p.border,
            "border-left": "none",
            "border-top": "none",
        });

        if (playerDialogBadge) {
            playerDialogBadge.text(badgeLabel).textColor(p.badgeText);
            playerDialogBadge.css({ background: p.badge });
        }

        playerDialogTitle.text(titleText).textColor(p.title);
        if (playerDialogDivider) playerDialogDivider.color(p.divider);
        playerDialogBody.text(bodyText).textColor(p.text);

        if (playerDialogHint) {
            if (hasHint) {
                playerDialogHint.text(hintText).textColor(p.hint).css({ display: "block" });
            } else {
                playerDialogHint.css({ display: "none" });
            }
        }

        if (playerDialogProgress) playerDialogProgress.color(p.progressTrack).css({ display: "none" });
        if (playerDialogProgressBar) playerDialogProgressBar.color(p.progressFill).css({ display: "none" });

        positionPlayerDialog();
        setPlayerDialogVisible(true);

        if (durationMs && durationMs > 0) {
            dialogHideTimer = setTimeout(function () {
                hidePlayerDialog();
            }, durationMs);
        }
    }

    function hidePlayerDialog() {
        if (dialogHideTimer) {
            clearTimeout(dialogHideTimer);
            dialogHideTimer = null;
        }
        setPlayerDialogVisible(false);
    }

    createPlayerDialogEntities();

    function allInteractionsDone() {
        for (var i = 0; i < interactions.length; i++) {
            if (!interactions[i].done) return false;
        }
        return true;
    }

    function normalizeAnswer(value) {
        var normalized = String(value || "").trim();
        if (
            (normalized.charAt(0) === "\"" && normalized.charAt(normalized.length - 1) === "\"") ||
            (normalized.charAt(0) === "'" && normalized.charAt(normalized.length - 1) === "'")
        ) {
            normalized = normalized.substring(1, normalized.length - 1);
        }
        return normalized.trim().toLowerCase();
    }

    function buildInfoDialogMessage(item) {
        var body = item && item.lesson && item.lesson.body ? item.lesson.body : "Conceito registrado.";
        var example = item && item.lesson && item.lesson.example ? ("\n\n" + item.lesson.example) : "";
        return body + example;
    }

    function getInfoHint(item) {
        return item && item.lesson && item.lesson.hint ? item.lesson.hint : "";
    }

    async function runInfoReadingCountdown(item, seconds) {
        var total = Math.max(1, Number(seconds) || 5);
        var title = item && item.lesson && item.lesson.title ? item.lesson.title : "INFO";
        var hint = getInfoHint(item);
        var message = buildInfoDialogMessage(item);
        var progressMaxW = playerDialogWidth - 32;

        showPlayerDialog(message, "info", null, {
            title: title,
            hint: hint,
            badge: "INFO",
        });

        if (playerDialogProgress && playerDialogProgressBar) {
            playerDialogProgress.css({ display: "block" });
            playerDialogProgressBar.attr({ w: 0 }).css({ display: "block", transition: "none" });
            positionPlayerDialog();
        }

        for (var left = total; left >= 1; left--) {
            if (!isExecuting || hasWon) return;

            var elapsed = total - left;
            var fraction = elapsed / total;
            var barW = Math.round(progressMaxW * fraction);

            playerDialogTitle.text(title + "  [" + left + "s]");

            if (playerDialogProgressBar) {
                playerDialogProgressBar.attr({ w: barW });
                playerDialogProgressBar.css({ transition: "width 0.9s linear" });
            }

            await sleep(1000);
        }

        if (playerDialogProgressBar) {
            playerDialogProgressBar.attr({ w: progressMaxW });
        }

        showPlayerDialog("Leitura concluida. Continue para o proximo ponto.", "success", 1800, {
            title: "INFO CONCLUIDA",
            hint: "Siga em frente para o proximo desafio.",
            badge: "OK",
        });
    }

    function countInteractionsByType(type) {
        var total = 0;
        var done = 0;

        for (var i = 0; i < interactions.length; i++) {
            if (interactions[i].type !== type) continue;
            total++;
            if (interactions[i].done) done++;
        }

        return { total: total, done: done };
    }

    function getClosestPendingInteraction() {
        var nearest = null;
        var nearestDist = Infinity;

        for (var i = 0; i < interactions.length; i++) {
            var item = interactions[i];
            if (item.done) continue;
            var dist = Math.abs(item.col - currentCol);
            if (dist < nearestDist) {
                nearest = item;
                nearestDist = dist;
            }
        }

        return nearest;
    }

    function updateInteractionGuidance() {
        var focus = activeQuiz || getClosestPendingInteraction();
        for (var i = 0; i < interactions.length; i++) {
            var item = interactions[i];
            if (item.done) {
                setInteractionMarkerState(item.marker, "done");
            } else if (focus && item.id === focus.id) {
                setInteractionMarkerState(item.marker, "focus");
            } else {
                setInteractionMarkerState(item.marker, "default");
            }
        }
    }

    function updateObjectiveHud() {
        var infoStats = countInteractionsByType("info");
        var quizStats = countInteractionsByType("quiz");
        var nextInteraction = getClosestPendingInteraction();
        var pendingLabel = activeQuiz ? activeQuiz.id + " (responda com answer)" : "nenhum";

        objectiveHudText.text(
            "INFO " + infoStats.done + "/" + infoStats.total +
            " | QUIZ " + quizStats.done + "/" + quizStats.total +
            " | Próx: " + (nextInteraction ? nextInteraction.id : "meta liberada") +
            " | Pendente: " + pendingLabel +
            " | Obstáculos: JUMP (jump())" +
            " | Col " + currentCol +
            " | Meta " + (goalLocked ? "🔒" : "✅")
        );
    }

    function updateGoalVisual() {
        if (goalLocked) {
            goal.css({ filter: "grayscale(100%)", opacity: "0.65" });
            goalLock.css({ opacity: "0.42" });
            goalAura.color("#89dceb");
            goalAura.css({ opacity: "0.18" });
            return;
        }

        goal.css({ filter: "none", opacity: "1" });
        goalLock.css({ opacity: "0" });
        goalAura.color("#a6e3a1");
        goalAura.css({ opacity: "0.48" });
    }

    function unlockGoalIfReady() {
        if (!goalLocked) return;
        if (!allInteractionsDone()) return;

        goalLocked = false;
        updateGoalVisual();
        showPlayerDialog("Meta liberada! Avance ate a bandeira.", "success", 3200, {
            title: "OBJETIVO DESBLOQUEADO",
            hint: "Use move_right() para chegar ate a bandeira.",
            badge: "OK",
        });
        termLog("✓ Todos os pontos ativados. Bandeira desbloqueada!", "term-success");
        updateObjectiveHud();
    }

    function checkVictory() {
        if (hasWon || goalLocked) return false;
        if (currentCol !== GOAL_COL) return false;

        hasWon = true;
        isExecuting = false;
        runBtn.disabled = false;
        showPlayerDialog("Fase 8 concluida!\nOperadores relacionais e logicos dominados.", "success", 3600, {
            title: "VITORIA",
            hint: "Parabens, voce dominou os operadores!",
            badge: "FIM",
        });
        termLog("✓ Vitória! Fase 8 concluída.", "term-success");
        updateErrorStatus(0);
        setVictoryVisible(true);
        return true;
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
            result += '<span class="' + tok.cls + '">' + escapeHtml(tok.text) + '</span>';
            cursor = tok.end;
        }

        if (cursor < code.length) {
            result += escapeHtml(code.substring(cursor));
        }

        return result;
    }

    /* ===== EDITOR HELPERS ===== */
    function updateGutter() {
        var lines = editorEl.value.split("\n");
        var count = Math.max(lines.length, 12);
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
        if (!/^[a-z_()0-9,]*$/i.test(token)) return null;

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

    /* ===== GAME STATE RESET ===== */
    function resetStepDots() {
        Object.keys(stepDots).forEach(function (col) {
            stepDots[col]
                .color("#4b5678")
                .css({
                    opacity: "0.95",
                    "box-shadow": "0 0 0 2px rgba(110,231,255,0.18) inset",
                });
        });
    }

    function markStepPassed(col) {
        var dot = stepDots[col];
        if (!dot) return;
        dot.color("#a6e3a1");
        dot.css({
            opacity: "1",
            "box-shadow": "0 0 0 2px rgba(166,227,161,0.55) inset, 0 0 14px rgba(166,227,161,0.55)",
        });
    }

    function markObstaclePassed(col) {
        var parts = obstacleParts[col];
        if (!parts) return;

        for (var i = 0; i < parts.length; i++) {
            parts[i].css({ filter: "saturate(0.65)" });
        }

        parts[0].color("#4f5d73");
        parts[1].color("#a6e3a1");
        parts[2].text("✓");
        parts[2].textColor("#a6e3a1");
        if (parts[3]) parts[3].color("#20394a");
        if (parts[4]) parts[4].text("JUMP ✓").textColor("#a6e3a1");
    }

    function resetObstacles() {
        for (var i = 0; i < OBSTACLE_COLS.length; i++) {
            var col = OBSTACLE_COLS[i];
            var parts = obstacleParts[col];
            if (!parts) continue;

            for (var p = 0; p < parts.length; p++) {
                parts[p].css({ filter: "none" });
            }

            parts[0].color("#65466f");
            parts[1].color("#f38ba8");
            parts[2].text("!").textColor("#f9e2af");
            if (parts[3]) {
                parts[3].color("#321b38").css({ border: "1px solid rgba(243,139,168,0.45)", opacity: "0.92" });
            }
            if (parts[4]) {
                parts[4].text("JUMP").textColor("#f38ba8");
            }
        }
    }

    function resetInteractions() {
        activeQuiz = null;
        for (var i = 0; i < interactions.length; i++) {
            interactions[i].done = false;
            interactions[i].reset();
        }
        updateInteractionGuidance();
    }

    function resetPlayerPosition() {
        currentCol = PLAYER_START.col;
        facing = 1;
        player.attr({
            x: colToX(currentCol) + (TILE - PLAYER_W) / 2,
            y: groundPlayerY(),
        });

        setCameraImmediate();
        updateInteractionGuidance();
        updateObjectiveHud();
        hidePlayerDialog();
    }

    function applySpeedSelection(mode) {
        selectedSpeed = mode === "fast" ? "fast" : "slow";
        speedSlowBtn.classList.toggle("active", selectedSpeed === "slow");
        speedFastBtn.classList.toggle("active", selectedSpeed === "fast");
        speedSlowBtn.setAttribute("aria-pressed", selectedSpeed === "slow" ? "true" : "false");
        speedFastBtn.setAttribute("aria-pressed", selectedSpeed === "fast" ? "true" : "false");
    }

    function updateStepButtonState() {
        if (!stepBtn) return;

        if (!stepSession) {
            stepBtn.textContent = "⏭ Step";
            stepBtn.classList.remove("active");
            return;
        }

        var total = stepSession.commands.length;
        if (stepSession.index >= total) {
            stepBtn.textContent = "✓ Step";
            stepBtn.classList.add("active");
            return;
        }

        stepBtn.textContent = "⏭ Step " + (stepSession.index + 1) + "/" + total;
        stepBtn.classList.add("active");
    }

    function clearStepSession() {
        stepSession = null;
        updateStepButtonState();
    }

    function resetPlayer() {
        execId++;
        isExecuting = false;
        hasWon = false;
        clearStepSession();

        goalLocked = true;
        updateGoalVisual();

        resetInteractions();
        resetObstacles();
        resetStepDots();
        resetPlayerPosition();
        hideAutocomplete();

        runBtn.disabled = false;
        if (stepBtn) stepBtn.disabled = false;
        setVictoryVisible(false);
        termLog("Fase resetada. Pronto para novo teste.", "term-output");
        updateErrorStatus(0);
    }

    window.resetPlayer = resetPlayer;

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

    function jumpToCol(targetCol, id, moveSpeed) {
        var startX = player.x;
        var startY = groundPlayerY();
        var targetX = colToX(targetCol) + (TILE - PLAYER_W) / 2;
        var distance = Math.max(1, Math.abs(targetX - startX));
        var direction = targetX >= startX ? 1 : -1;
        var jumpSpeed = Math.max(4, moveSpeed * 1.75);

        return new Promise(function (resolve) {
            var handler = function () {
                if (id !== execId || hasWon) {
                    player.y = startY;
                    player.unbind("EnterFrame", handler);
                    resolve();
                    return;
                }

                var diff = targetX - player.x;
                if (Math.abs(diff) <= jumpSpeed) {
                    player.x = targetX;
                    player.y = startY;
                    player.unbind("EnterFrame", handler);
                    resolve();
                    return;
                }

                player.x += direction * jumpSpeed;

                var progress = Math.abs(player.x - startX) / distance;
                var arc = 4 * progress * (1 - progress);
                player.y = startY - arc * 78;
            };

            player.bind("EnterFrame", handler);
        });
    }

    function hopInPlace(id) {
        var startY = groundPlayerY();
        var frame = 0;
        var totalFrames = 20;

        return new Promise(function (resolve) {
            var handler = function () {
                if (id !== execId || hasWon) {
                    player.y = startY;
                    player.unbind("EnterFrame", handler);
                    resolve();
                    return;
                }

                frame++;
                var t = frame / totalFrames;
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

    async function moveSteps(direction, steps, id, moveSpeed, lineNum) {
        for (var s = 0; s < steps; s++) {
            if (id !== execId || hasWon) return;

            var nextCol = clamp(currentCol + direction, 0, WORLD_COLS - 1);
            if (nextCol === currentCol) {
                termLog("… Limite do mapa atingido na linha " + lineNum + ".", "term-output");
                return;
            }

            if (OBSTACLE_SET[nextCol]) {
                throw new Error("Ln " + lineNum + ": colisão na coluna " + nextCol + ". Use jump() para passar.");
            }

            await moveToCol(nextCol, id, moveSpeed);
            currentCol = nextCol;
            facing = direction;
            markStepPassed(currentCol);
            updateInteractionGuidance();
            updateObjectiveHud();

            if (checkVictory()) return;
        }
    }

    async function runJump(id, moveSpeed, lineNum) {
        var obstacleCol = currentCol + facing;
        var landingCol = currentCol + facing * 2;

        if (!OBSTACLE_SET[obstacleCol]) {
            await hopInPlace(id);
            termLog("… Ln " + lineNum + ": jump() sem obstáculo à frente.", "term-output");
            return;
        }

        if (landingCol < 0 || landingCol >= WORLD_COLS) {
            throw new Error("Ln " + lineNum + ": sem espaço para aterrissar após o salto.");
        }
        if (OBSTACLE_SET[landingCol]) {
            throw new Error("Ln " + lineNum + ": destino bloqueado. Ajuste a rota.");
        }

        await jumpToCol(landingCol, id, moveSpeed);
        currentCol = landingCol;
        markStepPassed(currentCol);
        markObstaclePassed(obstacleCol);
        updateInteractionGuidance();
        updateObjectiveHud();
    }

    function getNearestInteraction() {
        var nearest = null;
        var nearestDist = Infinity;
        for (var i = 0; i < interactions.length; i++) {
            var item = interactions[i];
            if (item.done) continue;
            var dist = Math.abs(item.col - currentCol);
            if (dist <= 1 && dist < nearestDist) {
                nearest = item;
                nearestDist = dist;
            }
        }
        return nearest;
    }

    async function runInteract(lineNum) {
        var item = getNearestInteraction();
        if (!item) {
            showPlayerDialog("Aproxime-se de um NPC para interagir.\nProcure os pontos marcados como INFO ou QUIZ.", "error", 2400, {
                title: "SEM ALVO",
                hint: "Use move_right(...) ou move_left(...) para se alinhar ao NPC.",
                badge: "ERRO",
            });
            termLog("… Ln " + lineNum + ": aproxime-se de um NPC INFO/QUIZ.", "term-output");
            return;
        }

        if (activeQuiz && activeQuiz.id !== item.id) {
            showPlayerDialog("Finalize o quiz pendente antes de interagir.\nUse answer(True) ou answer(False).", "quiz", 2600, {
                title: "QUIZ PENDENTE",
                hint: "Cada quiz precisa de uma resposta antes de abrir o proximo.",
                badge: "QUIZ",
            });
            termLog("… Ln " + lineNum + ": responda primeiro o quiz ativo com answer(...).", "term-output");
            return;
        }

        if (item.type === "info") {
            item.done = true;
            item.activate();
            activeQuiz = null;
            updateInteractionGuidance();
            updateObjectiveHud();

            if (stepSession) {
                showPlayerDialog(buildInfoDialogMessage(item), "info", null, {
                    title: item.lesson ? item.lesson.title : item.label,
                    hint: getInfoHint(item),
                    badge: "INFO",
                });
                termLog("✓ Info lida: " + item.label + " (modo Step sem contador).", "term-success");
            } else {
                termLog("✓ Info lida: " + item.label + ". Aguardando 5s para leitura.", "term-success");
                await runInfoReadingCountdown(item, 5);
            }

            unlockGoalIfReady();
            return;
        }

        if (item.type === "quiz") {
            activeQuiz = item;
            updateInteractionGuidance();
            updateObjectiveHud();
            showPlayerDialog(item.question || "Quiz aberto. Responda com answer(...).", "quiz", null, {
                title: item.lesson && item.lesson.title ? item.lesson.title : "QUIZ",
                hint: item.lesson && item.lesson.hint ? ("Dica: " + item.lesson.hint) : "Escreva answer(valor) no codigo.",
                badge: "QUIZ",
            });
            termLog("❓ Quiz aberto: responda com answer(...).", "term-output");
            await sleep(120);
            return;
        }
    }

    function runAnswer(rawAnswer, lineNum) {
        if (!activeQuiz) {
            showPlayerDialog("Nao ha quiz ativo no momento.\nUse interact() proximo a um NPC QUIZ.", "error", 2800, {
                title: "SEM QUIZ ATIVO",
                hint: "Primeiro interaja com interact() em um ponto QUIZ.",
                badge: "ERRO",
            });
            termLog("… Ln " + lineNum + ": não há quiz ativo. Use interact() em um NPC QUIZ.", "term-output");
            return;
        }

        var normalized = normalizeAnswer(rawAnswer);
        var accepted = activeQuiz.acceptedAnswers || [];
        var isCorrect = false;

        for (var i = 0; i < accepted.length; i++) {
            if (normalized === normalizeAnswer(accepted[i])) {
                isCorrect = true;
                break;
            }
        }

        if (!isCorrect) {
            var retryMessage = "Resposta incorreta!\nReleia a pergunta com calma.";
            if (activeQuiz.lesson && activeQuiz.lesson.example) {
                retryMessage += "\n\n" + activeQuiz.lesson.example;
            }

            showPlayerDialog(retryMessage, "error", 4000, {
                title: "TENTE NOVAMENTE",
                hint: activeQuiz.lesson && activeQuiz.lesson.hint ? activeQuiz.lesson.hint : "Revise o conceito e tente answer(...) de novo.",
                badge: "ERRO",
            });
            termLog("✗ Resposta incorreta. Tente novamente com answer(...).", "term-error");
            return;
        }

        activeQuiz.done = true;
        activeQuiz.activate();
        showPlayerDialog((activeQuiz.successText || "Resposta correta!") + "\nContinue para o proximo desafio.", "success", 3200, {
            title: "QUIZ CONCLUIDO",
            hint: "Otimo trabalho! Siga em frente.",
            badge: "OK",
        });
        termLog("✓ " + (activeQuiz.successText || "Resposta correta!"), "term-success");
        activeQuiz = null;
        updateInteractionGuidance();
        updateObjectiveHud();
        unlockGoalIfReady();
    }

    /* ===== PARSER ===== */
    function parseCode(code) {
        var commands = [];
        var lines = code.split("\n");

        for (var i = 0; i < lines.length; i++) {
            var lineNum = i + 1;
            var line = lines[i].trim();
            if (!line || line.startsWith("#")) continue;

            var rightMatch = line.match(/^move_right\s*\(\s*(\d+)\s*\)$/);
            if (rightMatch) {
                var rightSteps = Number(rightMatch[1]);
                if (rightSteps < 1 || rightSteps > MAX_MOVE_STEPS) {
                    throw new Error("Ln " + lineNum + ": move_right(n) deve usar n entre 1 e " + MAX_MOVE_STEPS + ".");
                }
                commands.push({ type: "right", steps: rightSteps, line: lineNum });
                continue;
            }

            var leftMatch = line.match(/^move_left\s*\(\s*(\d+)\s*\)$/);
            if (leftMatch) {
                var leftSteps = Number(leftMatch[1]);
                if (leftSteps < 1 || leftSteps > MAX_MOVE_STEPS) {
                    throw new Error("Ln " + lineNum + ": move_left(n) deve usar n entre 1 e " + MAX_MOVE_STEPS + ".");
                }
                commands.push({ type: "left", steps: leftSteps, line: lineNum });
                continue;
            }

            if (/^jump\s*\(\s*\)$/.test(line)) {
                commands.push({ type: "jump", line: lineNum });
                continue;
            }

            if (/^interact\s*\(\s*\)$/.test(line)) {
                commands.push({ type: "interact", line: lineNum });
                continue;
            }

            var answerMatch = line.match(/^answer\s*\(\s*(.+)\s*\)$/);
            if (answerMatch) {
                commands.push({ type: "answer", value: answerMatch[1], line: lineNum });
                continue;
            }

            throw new Error("Ln " + lineNum + ': comando inválido "' + line + '"');
        }

        if (commands.length === 0) {
            throw new Error("Nenhum comando encontrado.");
        }

        if (commands.length > MAX_COMMANDS) {
            throw new Error("Máximo de " + MAX_COMMANDS + " comandos permitidos nesta fase.");
        }

        return commands;
    }

    /* ===== EXECUTION ===== */
    function highlightEditorLine(lineNum) {
        var spans = gutterEl.querySelectorAll("span");
        spans.forEach(function (s) { s.classList.remove("active-line"); });

        if (lineNum > 0 && lineNum <= spans.length) {
            spans[lineNum - 1].classList.add("active-line");
        }

        activeLineEl.style.top = ((lineNum - 1) * 22 + 10) + "px";
    }

    async function executeCommand(cmd, id, moveSpeed) {
        if (id !== execId || hasWon) return;
        highlightEditorLine(cmd.line);

        if (cmd.type === "right") {
            termLogHtml(
                '<span class="term-prompt">❯</span> ' +
                '<span class="term-cmd">Linha ' + cmd.line + ':</span> move_right(' + cmd.steps + ')'
            );
            await moveSteps(1, cmd.steps, id, moveSpeed, cmd.line);
        } else if (cmd.type === "left") {
            termLogHtml(
                '<span class="term-prompt">❯</span> ' +
                '<span class="term-cmd">Linha ' + cmd.line + ':</span> move_left(' + cmd.steps + ')'
            );
            await moveSteps(-1, cmd.steps, id, moveSpeed, cmd.line);
        } else if (cmd.type === "jump") {
            termLogHtml(
                '<span class="term-prompt">❯</span> ' +
                '<span class="term-cmd">Linha ' + cmd.line + ':</span> jump()'
            );
            await runJump(id, moveSpeed, cmd.line);
        } else if (cmd.type === "interact") {
            termLogHtml(
                '<span class="term-prompt">❯</span> ' +
                '<span class="term-cmd">Linha ' + cmd.line + ':</span> interact()'
            );
            await runInteract(cmd.line);
        } else if (cmd.type === "answer") {
            termLogHtml(
                '<span class="term-prompt">❯</span> ' +
                '<span class="term-cmd">Linha ' + cmd.line + ':</span> answer(' + cmd.value + ')'
            );
            runAnswer(cmd.value, cmd.line);
        }

        checkVictory();
    }

    async function runCommands(commands, id, moveSpeed) {
        for (var i = 0; i < commands.length; i++) {
            if (id !== execId || hasWon) return;
            await executeCommand(commands[i], id, moveSpeed);
            if (hasWon) return;
        }
    }

    function parseCommandsWithFeedback() {
        try {
            var commands = parseCode(editorEl.value);
            updateErrorStatus(0);
            return commands;
        } catch (err) {
            termLog("✗ " + err.message, "term-error");
            updateErrorStatus(1);
            return null;
        }
    }

    function resetWorldForExecution() {
        hasWon = false;
        setVictoryVisible(false);

        goalLocked = true;
        updateGoalVisual();
        resetInteractions();
        resetObstacles();
        resetStepDots();
        resetPlayerPosition();
        hideAutocomplete();
    }

    function createStepSessionFromEditor() {
        var commands = parseCommandsWithFeedback();
        if (!commands) return null;

        execId++;
        var localId = execId;

        resetWorldForExecution();
        stepSession = {
            commands: commands,
            index: 0,
            id: localId,
            source: editorEl.value,
        };
        updateStepButtonState();

        termLog("⏭ Modo Step iniciado. Clique em Step para avançar comando a comando.", "term-cmd");
        return stepSession;
    }

    async function executeNextStep() {
        if (isExecuting) return;

        // Em modo Step, ao avançar para o próximo comando, limpa o balão anterior.
        hidePlayerDialog();

        if (!stepSession || stepSession.source !== editorEl.value || stepSession.id !== execId) {
            clearStepSession();
            if (!createStepSessionFromEditor()) return;
        }

        if (!stepSession) return;
        if (stepSession.index >= stepSession.commands.length) {
            if (!hasWon) {
                if (goalLocked) {
                    termLog("… Step concluído, mas ainda faltam interações para liberar a bandeira.", "term-output");
                } else {
                    termLog("… Step concluído. Bandeira liberada; siga até a coluna " + GOAL_COL + ".", "term-output");
                }
            }
            return;
        }

        var localSession = stepSession;
        var moveSpeed = SPEED_MAP[selectedSpeed];
        var cmd = localSession.commands[localSession.index];

        isExecuting = true;
        runBtn.disabled = true;
        if (stepBtn) stepBtn.disabled = true;

        try {
            await executeCommand(cmd, localSession.id, moveSpeed);
        } catch (errRun) {
            if (localSession.id !== execId) return;
            termLog("✗ " + errRun.message + " Reiniciando...", "term-error");
            updateErrorStatus(1);
            runBtn.disabled = true;
            if (stepBtn) stepBtn.disabled = true;
            clearStepSession();

            setTimeout(function () {
                if (localSession.id !== execId) return;
                resetPlayer();
            }, LOSS_DELAY);
            return;
        } finally {
            if (localSession.id === execId) {
                isExecuting = false;
                runBtn.disabled = false;
                if (stepBtn) stepBtn.disabled = false;
            }
        }

        if (localSession.id !== execId || !stepSession) return;
        stepSession.index++;
        updateStepButtonState();

        if (hasWon) {
            clearStepSession();
            return;
        }

        if (stepSession.index >= stepSession.commands.length) {
            if (goalLocked) {
                termLog("… Fim dos comandos no Step. Faltam interações para liberar a bandeira.", "term-output");
            } else {
                termLog("… Fim dos comandos no Step. Bandeira liberada na coluna " + GOAL_COL + ".", "term-output");
            }
        }
    }

    async function executeProgram() {
        var commands = parseCommandsWithFeedback();
        if (!commands) return;
        clearStepSession();

        execId++;
        var localId = execId;
        var moveSpeed = SPEED_MAP[selectedSpeed];

        isExecuting = true;
        runBtn.disabled = true;
        if (stepBtn) stepBtn.disabled = true;
        resetWorldForExecution();
        termLog("▶ Executando fase (" + selectedSpeed.toUpperCase() + ")...", "term-cmd");

        try {
            await runCommands(commands, localId, moveSpeed);
        } catch (errRun) {
            if (localId !== execId) return;
            termLog("✗ " + errRun.message + " Reiniciando...", "term-error");
            updateErrorStatus(1);
            runBtn.disabled = true;
            if (stepBtn) stepBtn.disabled = true;

            setTimeout(function () {
                if (localId !== execId) return;
                resetPlayer();
            }, LOSS_DELAY);
            return;
        }

        if (localId !== execId) return;

        isExecuting = false;
        runBtn.disabled = false;
        if (stepBtn) stepBtn.disabled = false;

        if (!hasWon) {
            if (goalLocked) {
                termLog("… Faltam interações para liberar a bandeira.", "term-output");
            } else {
                termLog("… Bandeira liberada. Vá até a coluna " + GOAL_COL + ".", "term-output");
            }
        }
    }

    /* ===== EVENTS ===== */
    function onEditorChange() {
        updateGutter();
        updateHighlight();
        updateCursorInfo();
        if (stepSession && stepSession.source !== editorEl.value) {
            clearStepSession();
        }
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
            var value = editorEl.value;
            editorEl.value = value.substring(0, start) + "    " + value.substring(end);
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
    if (stepBtn) {
        stepBtn.addEventListener("click", function () {
            executeNextStep();
        });
    }

    resetBtn.addEventListener("click", resetPlayer);
    speedSlowBtn.addEventListener("click", function () { applySpeedSelection("slow"); });
    speedFastBtn.addEventListener("click", function () { applySpeedSelection("fast"); });

    /* ===== INIT ===== */
    applySpeedSelection("slow");
    updateGoalVisual();
    resetInteractions();
    resetStepDots();
    resetPlayerPosition();

    updateGutter();
    updateHighlight();
    updateCursorInfo();
    updateObjectiveHud();
    updateErrorStatus(0);
    updateStepButtonState();
})();
