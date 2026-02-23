/* ===== FASE 9 — Voo e Interação de Ambiente ===== */

(function () {
    "use strict";

    /* ===== CONFIG ===== */
    const TILE = 64;
    const VIEW_COLS = 16;
    const WORLD_COLS = 62;
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
    const GOAL_COL = 58;
    const GOAL_ROW = 4;
    const MOUNT_COL = 10;
    const AIR_ROW_MIN = 2;
    const AIR_ROW_MAX = 7;
    const AIR_START_ROW = 5;
    const OBSTACLE_COLS = [7];
    const OBSTACLE_SET = OBSTACLE_COLS.reduce(function (acc, col) {
        acc[col] = true;
        return acc;
    }, {});
    const FLIGHT_EVENT_CONFIG = [
        { id: "orb_a", col: 18, row: 5, type: "crystal", label: "Orbital A" },
        { id: "vento", col: 28, row: 4, type: "totem", label: "Torre de Vento" },
        { id: "ninho", col: 40, row: 6, type: "nest", label: "Ninho Celeste" },
        { id: "orb_b", col: 52, row: 3, type: "crystal", label: "Orbital B" },
    ];

    const PLAYER_W = 40;
    const PLAYER_H = 52;
    const PLAYER_MOUNT_W = 68;
    const PLAYER_MOUNT_H = 88;
    const PLAYER_MOUNT_Y_OFFSET = -14;
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
        "flap()",
        "glide()",
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
    let currentRow = PLAYER_START.row;
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
    var mountPoint = null;
    var isMounted = false;

    var goal = null;
    var goalLock = null;
    var goalAura = null;
    var goalLocked = true;

    var objectiveHudPanel = null;
    var objectiveHudText = null;
    var playerDialogPanel = null;
    var playerDialogTail = null;
    var playerDialogBadge = null;
    var playerDialogTitle = null;
    var playerDialogDivider = null;
    var playerDialogBody = null;
    var playerDialogHint = null;
    var playerDialogProgress = null;
    var playerDialogProgressBar = null;
    var dialogHideTimer = null;
    var playerDialogWidth = 360;
    var playerDialogHeight = 84;

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

    function rowToPlayerY(row) {
        if (row >= GROUND_ROW) return groundPlayerY();
        if (isMounted) return rowToY(row) + PLAYER_MOUNT_Y_OFFSET;
        return rowToY(row) + 8;
    }

    function playerXForCol(col) {
        return colToX(col) + Math.round((TILE - player.w) / 2);
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

        for (var lane = AIR_ROW_MIN; lane <= AIR_ROW_MAX; lane++) {
            Crafty.e("2D, DOM, Color")
                .attr({ x: 0, y: rowToY(lane) + TILE / 2, w: WORLD_W, h: 1, z: 8 })
                .color("#7dcfff")
                .css({ opacity: "0.08" });
        }

        for (var i = 0; i < OBSTACLE_COLS.length; i++) {
            buildObstacle(OBSTACLE_COLS[i]);
        }

        buildMountPoint();
        buildFlightInteractions();

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

    function createInteractionMarker(col, yTop, label, pulseY) {
        var centerX = colToX(col) + TILE / 2;

        var bg = Crafty.e("2D, DOM, Color")
            .attr({ x: centerX - 41, y: yTop, w: 82, h: 16, z: 33 })
            .color("#0e233a")
            .css({
                "border-radius": "8px",
                border: "1px solid rgba(137,220,235,0.38)",
                opacity: "0.9",
            });

        var text = Crafty.e("2D, DOM, Text")
            .attr({ x: centerX - 41, y: yTop + 2, w: 82, h: 12, z: 34 })
            .text(label || "INTERACT")
            .textColor("#89dceb")
            .textFont({ size: "9px", weight: "700", family: "Consolas" })
            .css({ "text-align": "center" });

        var pulse = Crafty.e("2D, DOM, Color")
            .attr({ x: centerX - 18, y: typeof pulseY === "number" ? pulseY : rowToY(GROUND_ROW) + 2, w: 36, h: 10, z: 29 })
            .color("#89dceb")
            .css({ opacity: "0.16", "border-radius": "50%" });

        return { bg: bg, text: text, pulse: pulse, label: label || "INTERACT" };
    }

    function setInteractionMarkerState(marker, state) {
        if (!marker) return;

        if (state === "done") {
            marker.bg.color("#16352b").css({ opacity: "0.95", border: "1px solid rgba(166,227,161,0.55)" });
            marker.text.text("ATIVADO").textColor("#a6e3a1");
            marker.pulse.color("#a6e3a1").css({ opacity: "0.42" });
            return;
        }

        if (state === "focus") {
            marker.bg.color("#1b3852").css({ opacity: "1", border: "1px solid rgba(249,226,175,0.62)" });
            marker.text.text(marker.label).textColor("#f9e2af");
            marker.pulse.color("#f9e2af").css({ opacity: "0.48" });
            return;
        }

        marker.bg.color("#0e233a").css({ opacity: "0.9", border: "1px solid rgba(137,220,235,0.38)" });
        marker.text.text(marker.label).textColor("#89dceb");
        marker.pulse.color("#89dceb").css({ opacity: "0.16" });
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

    function buildMountPoint() {
        var w = 52;
        var h = 42;
        var x = colToX(MOUNT_COL) + Math.round((TILE - w) / 2);
        var y = rowToY(GROUND_ROW) - h + 2;

        var npc = Crafty.e("2D, DOM, Image")
            .attr({ x: x, y: y, w: w, h: h, z: 30 })
            .image("../assets/img/pterossauro.png", "no-repeat")
            .css({
                "background-size": "contain",
                "background-position": "center bottom",
                "image-rendering": "pixelated",
            });

        var aura = Crafty.e("2D, DOM, Color")
            .attr({ x: x + 2, y: rowToY(GROUND_ROW) + 2, w: w - 4, h: 10, z: 29 })
            .color("#89dceb")
            .css({ opacity: "0.2", "border-radius": "50%" });

        var marker = createInteractionMarker(MOUNT_COL, y - 20, "INTERACT");

        mountPoint = {
            id: "mount",
            col: MOUNT_COL,
            marker: marker,
            npc: npc,
            aura: aura,
            done: false,
            activate: function () {
                npc.css({ opacity: "0.22", filter: "grayscale(100%)" });
                aura.color("#a6e3a1").css({ opacity: "0.5" });
                setInteractionMarkerState(marker, "done");
            },
            reset: function () {
                npc.css({ opacity: "1", filter: "none" });
                aura.color("#89dceb").css({ opacity: "0.2" });
                setInteractionMarkerState(marker, "default");
            },
        };
    }

    function buildFlightInteractions() {
        interactions = [];

        for (var i = 0; i < FLIGHT_EVENT_CONFIG.length; i++) {
            (function (cfg) {
                var pulseY = rowToY(cfg.row) + TILE - 10;
                var marker = createInteractionMarker(cfg.col, rowToY(cfg.row) - 20, "INTERACT", pulseY);

                var entity = null;
                var aura = Crafty.e("2D, DOM, Color")
                    .attr({ x: colToX(cfg.col) + 10, y: pulseY, w: 44, h: 8, z: 27 })
                    .color("#7dcfff")
                    .css({ opacity: "0.2", "border-radius": "50%" });

                var decorA = null;
                var decorB = null;

                if (cfg.type === "crystal") {
                    entity = Crafty.e("2D, DOM, Image")
                        .attr({ x: colToX(cfg.col) + 16, y: rowToY(cfg.row) + 10, w: 32, h: 44, z: 28 })
                        .image("../assets/img/cristal.png", "no-repeat")
                        .css({
                            "background-size": "contain",
                            "background-position": "center",
                            "image-rendering": "pixelated",
                        });
                } else if (cfg.type === "totem") {
                    entity = Crafty.e("2D, DOM, Color")
                        .attr({ x: colToX(cfg.col) + 16, y: rowToY(cfg.row) + 14, w: 32, h: 36, z: 28 })
                        .color("#2b4474")
                        .css({ "border-radius": "8px", border: "1px solid rgba(137,220,235,0.42)" });
                    decorA = Crafty.e("2D, DOM, Text")
                        .attr({ x: colToX(cfg.col) + 16, y: rowToY(cfg.row) + 22, w: 32, h: 14, z: 29 })
                        .text("~")
                        .textColor("#7dcfff")
                        .textFont({ size: "14px", weight: "700", family: "Consolas" })
                        .css({ "text-align": "center" });
                } else {
                    entity = Crafty.e("2D, DOM, Color")
                        .attr({ x: colToX(cfg.col) + 14, y: rowToY(cfg.row) + 18, w: 36, h: 28, z: 28 })
                        .color("#44526d")
                        .css({ "border-radius": "12px", border: "1px solid rgba(201,215,255,0.3)" });
                    decorA = Crafty.e("2D, DOM, Color")
                        .attr({ x: colToX(cfg.col) + 8, y: rowToY(cfg.row) + 28, w: 10, h: 10, z: 28 })
                        .color("#60779c")
                        .css({ "border-radius": "50%" });
                    decorB = Crafty.e("2D, DOM, Color")
                        .attr({ x: colToX(cfg.col) + 46, y: rowToY(cfg.row) + 24, w: 8, h: 8, z: 28 })
                        .color("#60779c")
                        .css({ "border-radius": "50%" });
                }

                interactions.push({
                    id: cfg.id,
                    col: cfg.col,
                    row: cfg.row,
                    label: cfg.label,
                    marker: marker,
                    entity: entity,
                    aura: aura,
                    decorA: decorA,
                    decorB: decorB,
                    done: false,
                    hinted: false,
                    activate: function () {
                        entity.css({ opacity: "0.45", filter: "saturate(0.7)" });
                        if (decorA) decorA.css({ opacity: "0.55" });
                        if (decorB) decorB.css({ opacity: "0.55" });
                        aura.color("#a6e3a1").css({ opacity: "0.5" });
                        setInteractionMarkerState(marker, "done");
                    },
                    reset: function () {
                        this.hinted = false;
                        entity.css({ opacity: "1", filter: "none" });
                        if (decorA) decorA.css({ opacity: "1" });
                        if (decorB) decorB.css({ opacity: "1" });
                        aura.color("#7dcfff").css({ opacity: "0.2" });
                        setInteractionMarkerState(marker, "default");
                    },
                });
            })(FLIGHT_EVENT_CONFIG[i]);
        }
    }

    function getNearestFlightInteraction(maxDist) {
        var nearest = null;
        var nearestDist = Infinity;
        var limit = typeof maxDist === "number" ? maxDist : 1;

        for (var i = 0; i < interactions.length; i++) {
            var item = interactions[i];
            if (item.done) continue;

            var colDist = Math.abs(item.col - currentCol);
            var rowDist = Math.abs(item.row - currentRow);
            var dist = colDist + rowDist;

            if (colDist <= limit && rowDist <= 1 && dist < nearestDist) {
                nearest = item;
                nearestDist = dist;
            }
        }

        return nearest;
    }

    buildScene();

    /* ===== GOAL ===== */
    goal = Crafty.e("2D, DOM, Image")
        .attr({
            x: colToX(GOAL_COL) + (TILE - GOAL_W) / 2,
            y: rowToY(GOAL_ROW) + 8,
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
            y: rowToY(GOAL_ROW) + 6,
            w: GOAL_W + 4,
            h: GOAL_H + 4,
            z: 36,
        })
        .color("#0f1528")
        .css({ opacity: "0.42", "border-radius": "8px", border: "1px solid rgba(255,255,255,0.08)" });

    goalAura = Crafty.e("2D, DOM, Color")
        .attr({
            x: colToX(GOAL_COL) + (TILE - 52) / 2,
            y: rowToY(GOAL_ROW) + TILE - 12,
            w: 52,
            h: 12,
            z: 34,
        })
        .color("#89dceb")
        .css({ opacity: "0.18", "border-radius": "50%" });

    /* ===== PLAYER ===== */
    var playerStartX = colToX(PLAYER_START.col) + (TILE - PLAYER_W) / 2;
    var playerStartY = rowToPlayerY(PLAYER_START.row);

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

        playerDialogBadge = Crafty.e("2D, DOM, Text")
            .attr({ x: 0, y: 0, w: 72, h: 18, z: 92 })
            .text("INFO")
            .textColor("#0d1117")
            .textFont({ size: "10px", weight: "800", family: "'Segoe UI', Consolas, monospace" })
            .css({
                "text-align": "center",
                "letter-spacing": "0.08em",
                "border-radius": "4px",
                background: "#88c0d0",
                padding: "2px 0",
                display: "none",
            });

        playerDialogTitle = Crafty.e("2D, DOM, Text")
            .attr({ x: 0, y: 0, w: playerDialogWidth - 120, h: 18, z: 91 })
            .text("")
            .textColor("#eceff4")
            .textFont({ size: "13px", weight: "700", family: "'Segoe UI', Consolas, monospace" })
            .css({ "text-align": "left", "letter-spacing": "0.03em", display: "none" });

        playerDialogDivider = Crafty.e("2D, DOM, Color")
            .attr({ x: 0, y: 0, w: playerDialogWidth - 32, h: 1, z: 91 })
            .color("#3b4252")
            .css({ display: "none" });

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
            });

        playerDialogHint = Crafty.e("2D, DOM, Text")
            .attr({ x: 0, y: 0, w: playerDialogWidth - 32, h: 16, z: 91 })
            .text("")
            .textColor("#81a1c1")
            .textFont({ size: "11px", weight: "400", family: "'Segoe UI', Consolas, monospace" })
            .css({ "text-align": "left", display: "none", "font-style": "italic" });

        playerDialogProgress = Crafty.e("2D, DOM, Color")
            .attr({ x: 0, y: 0, w: playerDialogWidth - 32, h: 3, z: 91 })
            .color("#2e3440")
            .css({ "border-radius": "2px", display: "none" });

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
        var maxH = player.y - 24;
        if (h > maxH && maxH > 120) h = maxH;

        var bubbleX = clamp(player.x + player.w / 2 - w / 2, 8, WORLD_W - w - 8);
        var bubbleY = Math.max(4, player.y - h - 16);
        var tailX = clamp(player.x + player.w / 2 - 6, bubbleX + 18, bubbleX + w - 24);
        var tailY = bubbleY + h - 7;

        playerDialogPanel.attr({ x: bubbleX, y: bubbleY, h: h });
        playerDialogTail.attr({ x: tailX, y: tailY });
        if (playerDialogBadge) playerDialogBadge.attr({ x: bubbleX + pad, y: bubbleY + 11 });
        playerDialogTitle.attr({ x: bubbleX + pad + 82, y: bubbleY + 11, w: w - pad - 98 });
        if (playerDialogDivider) playerDialogDivider.attr({ x: bubbleX + pad, y: bubbleY + 33, w: w - pad * 2 });

        var bodyTop = 40;
        var bodyBottom = 30;
        playerDialogBody.attr({ x: bubbleX + pad, y: bubbleY + bodyTop, w: w - pad * 2, h: h - bodyTop - bodyBottom });
        if (playerDialogHint) playerDialogHint.attr({ x: bubbleX + pad, y: bubbleY + h - 30, w: w - pad * 2 });
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

        var palettes = {
            info: {
                bg: "#0d1117",
                border: "rgba(136,192,208,0.40)",
                badge: "#88c0d0",
                badgeText: "#0d1117",
                badgeLabel: "INFO",
                title: "#eceff4",
                text: "#d8dee9",
                divider: "#3b4252",
                hint: "#81a1c1",
            },
            success: {
                bg: "#0d1117",
                border: "rgba(163,190,140,0.45)",
                badge: "#a3be8c",
                badgeText: "#0d1117",
                badgeLabel: "OK",
                title: "#eceff4",
                text: "#d8dee9",
                divider: "#3b4252",
                hint: "#a3be8c",
            },
            error: {
                bg: "#0d1117",
                border: "rgba(191,97,106,0.45)",
                badge: "#bf616a",
                badgeText: "#eceff4",
                badgeLabel: "ERRO",
                title: "#eceff4",
                text: "#d8dee9",
                divider: "#3b4252",
                hint: "#bf616a",
            },
        };
        var p = palettes[tone || "info"] || palettes.info;

        var titleText = options.title || "";
        var hintText = options.hint || "";
        var badgeLabel = options.badge || p.badgeLabel;
        var bodyText = wrapDialogText(message || "", 52, 10);
        var lineCount = bodyText ? bodyText.split("\n").length : 1;
        var hasHint = hintText.length > 0;
        var dynamicHeight = clamp(78 + lineCount * 22 + (hasHint ? 26 : 0), 120, 300);

        playerDialogPanel.attr({ w: playerDialogWidth, h: dynamicHeight });
        playerDialogPanel.color(p.bg);
        playerDialogPanel.css({ border: "1px solid " + p.border });
        playerDialogTail.color(p.bg);
        playerDialogTail.css({ border: "1px solid " + p.border, "border-left": "none", "border-top": "none" });

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
        if (!isMounted) return false;
        for (var i = 0; i < interactions.length; i++) {
            if (!interactions[i].done) return false;
        }
        return true;
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
        var focus = isMounted ? getClosestPendingInteraction() : null;

        if (mountPoint) {
            if (mountPoint.done) {
                setInteractionMarkerState(mountPoint.marker, "done");
            } else if (!isMounted && Math.abs(mountPoint.col - currentCol) <= 1) {
                setInteractionMarkerState(mountPoint.marker, "focus");
            } else {
                setInteractionMarkerState(mountPoint.marker, "default");
            }
        }

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
        var doneCount = 0;
        var nextInteraction = isMounted ? getClosestPendingInteraction() : null;

        for (var i = 0; i < interactions.length; i++) {
            if (interactions[i].done) doneCount++;
        }

        objectiveHudText.text(
            "Modo: " + (isMounted ? "VOO" : "SOLO") +
            " | Montaria: " + (isMounted ? "✅" : "⏳ interact()") +
            " | INT: " + doneCount + "/" + interactions.length +
            " | Próx: " + (isMounted
                ? (nextInteraction ? nextInteraction.id : "meta liberada")
                : "coletar pterossauro") +
            " | Ação: interact()" +
            " | Alt " + currentRow +
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
        showPlayerDialog("Todos os pontos de ambiente foram ativados. Voe até a bandeira final.", "success", 3000, {
            title: "META LIBERADA",
            hint: "Use move_right() para alcançar a bandeira aérea.",
        });
        termLog("✓ Todas as interações do ambiente resolvidas. Bandeira desbloqueada!", "term-success");
        updateObjectiveHud();
    }

    function checkVictory() {
        if (hasWon || goalLocked) return false;
        if (!isMounted) return false;
        if (currentCol !== GOAL_COL) return false;
        if (Math.abs(currentRow - GOAL_ROW) > 1) return false;

        hasWon = true;
        isExecuting = false;
        runBtn.disabled = false;
        showPlayerDialog("Você coletou a montaria, ativou os pontos do ambiente e concluiu o voo.", "success", 3400, {
            title: "VITÓRIA",
            hint: "Fase 9 finalizada com sucesso.",
        });
        termLog("✓ Vitória! Fase 9 concluída.", "term-success");
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
        if (mountPoint) {
            mountPoint.done = false;
            mountPoint.reset();
        }
        for (var i = 0; i < interactions.length; i++) {
            interactions[i].done = false;
            interactions[i].reset();
        }
        updateInteractionGuidance();
    }

    function resetPlayerPosition() {
        currentCol = PLAYER_START.col;
        currentRow = PLAYER_START.row;
        facing = 1;
        isMounted = false;
        player.image("../assets/img/player2.png", "no-repeat");
        player.css({ "background-size": "contain", "background-position": "center bottom", "image-rendering": "pixelated" });
        player.attr({
            w: PLAYER_W,
            h: PLAYER_H,
            x: colToX(currentCol) + (TILE - PLAYER_W) / 2,
            y: rowToPlayerY(currentRow),
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
        var targetX = playerXForCol(targetCol);

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
        var targetX = playerXForCol(targetCol);
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

    function moveToRow(targetRow, id, moveSpeed) {
        var targetY = rowToPlayerY(targetRow);
        var verticalSpeed = Math.max(2, moveSpeed * 1.3);

        return new Promise(function (resolve) {
            var direction = targetY > player.y ? 1 : -1;

            var handler = function () {
                if (id !== execId || hasWon) {
                    player.unbind("EnterFrame", handler);
                    resolve();
                    return;
                }

                var diff = targetY - player.y;
                if (Math.abs(diff) <= verticalSpeed) {
                    player.y = targetY;
                    player.unbind("EnterFrame", handler);
                    resolve();
                    return;
                }

                player.y += direction * verticalSpeed;
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

            if (!isMounted && nextCol > MOUNT_COL + 1) {
                throw new Error("Ln " + lineNum + ": colete o pterossauro com interact() antes de avançar para o trecho aéreo.");
            }

            if (!isMounted && OBSTACLE_SET[nextCol]) {
                throw new Error("Ln " + lineNum + ": colisão na coluna " + nextCol + ". Use jump() para passar.");
            }

            await moveToCol(nextCol, id, moveSpeed);
            currentCol = nextCol;
            facing = direction;
            markStepPassed(currentCol);

            var pendingHere = isMounted ? getNearestFlightInteraction(0) : null;
            if (pendingHere && !pendingHere.hinted) {
                pendingHere.hinted = true;
                showPlayerDialog(
                    "Ponto de ambiente detectado: " + pendingHere.label + ".",
                    "info",
                    2200,
                    {
                        title: "INTERAÇÃO AÉREA",
                        hint: "Use interact() para ativar este ponto.",
                    }
                );
            }

            updateInteractionGuidance();
            updateObjectiveHud();
            if (checkVictory()) return;
        }
    }

    async function runJump(id, moveSpeed, lineNum) {
        if (isMounted) {
            throw new Error("Ln " + lineNum + ": em voo use flap()/glide(), não jump().");
        }

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

    async function runInteract(lineNum, id, moveSpeed) {
        if (isMounted) {
            var flightPoint = getNearestFlightInteraction(1);
            if (!flightPoint) {
                showPlayerDialog("Aproxime-se de um ponto de ambiente para usar interact().", "error", 2300, {
                    title: "INTERAÇÃO AÉREA",
                    hint: "Alinhe coluna e altura com flap()/glide().",
                });
                return;
            }

            flightPoint.done = true;
            flightPoint.activate();
            updateInteractionGuidance();
            updateObjectiveHud();
            showPlayerDialog("Interação ativada: " + flightPoint.label + ".", "success", 2200, {
                title: "AMBIENTE ATIVADO",
                hint: "Siga para o próximo ponto do céu.",
            });
            termLog("✓ Interação aérea ativada: " + flightPoint.label + ".", "term-success");
            unlockGoalIfReady();
            await sleep(100);
            return;
        }

        if (!mountPoint || mountPoint.done || Math.abs(currentCol - MOUNT_COL) > 1) {
            showPlayerDialog("Aproxime-se do pterossauro para usar interact().", "error", 2400, {
                title: "INTERAÇÃO",
                hint: "Pare perto do marcador INTERACT da montaria.",
            });
            termLog("… Ln " + lineNum + ": aproxime-se do pterossauro para usar interact().", "term-output");
            return;
        }

        mountPoint.done = true;
        mountPoint.activate();
        isMounted = true;
        var takeoffTargetRow = AIR_START_ROW;
        currentRow = GROUND_ROW;
        player.image("../assets/img/player4.gif", "no-repeat");
        player.css({ "background-size": "contain", "background-position": "center bottom", "image-rendering": "pixelated" });
        player.attr({
            w: PLAYER_MOUNT_W,
            h: PLAYER_MOUNT_H,
            x: playerXForCol(currentCol),
            y: rowToPlayerY(currentRow),
        });
        await moveToRow(takeoffTargetRow, id, Math.max(1.6, moveSpeed * 0.9));
        currentRow = takeoffTargetRow;

        showPlayerDialog(
            "Montaria ativada. Agora você está em voo.",
            "success",
            3000,
            {
                title: "PTEROSSAURO COLETADO",
                hint: "Use flap()/glide() e interact() nos pontos do ambiente.",
            }
        );
        termLog("✓ Montaria coletada. Modo voo ativado.", "term-success");
        updateInteractionGuidance();
        updateObjectiveHud();
        await sleep(120);
    }

    async function runFlap(id, moveSpeed, lineNum) {
        if (!isMounted) throw new Error("Ln " + lineNum + ": flap() só pode ser usado após interact() com o pterossauro.");
        if (currentRow <= AIR_ROW_MIN) {
            termLog("… Ln " + lineNum + ": altitude máxima atingida.", "term-output");
            return;
        }
        currentRow -= 1;
        await moveToRow(currentRow, id, moveSpeed);
        updateObjectiveHud();
    }

    async function runGlide(id, moveSpeed, lineNum) {
        if (!isMounted) throw new Error("Ln " + lineNum + ": glide() só pode ser usado após interact() com o pterossauro.");
        if (currentRow >= AIR_ROW_MAX) {
            termLog("… Ln " + lineNum + ": altitude mínima atingida.", "term-output");
            return;
        }
        currentRow += 1;
        await moveToRow(currentRow, id, moveSpeed);
        updateObjectiveHud();
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

            if (/^flap\s*\(\s*\)$/.test(line)) {
                commands.push({ type: "flap", line: lineNum });
                continue;
            }

            if (/^glide\s*\(\s*\)$/.test(line)) {
                commands.push({ type: "glide", line: lineNum });
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
            await runInteract(cmd.line, id, moveSpeed);
        } else if (cmd.type === "flap") {
            termLogHtml(
                '<span class="term-prompt">❯</span> ' +
                '<span class="term-cmd">Linha ' + cmd.line + ':</span> flap()'
            );
            await runFlap(id, moveSpeed, cmd.line);
        } else if (cmd.type === "glide") {
            termLogHtml(
                '<span class="term-prompt">❯</span> ' +
                '<span class="term-cmd">Linha ' + cmd.line + ':</span> glide()'
            );
            await runGlide(id, moveSpeed, cmd.line);
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

        hidePlayerDialog();

        if (!stepSession || stepSession.source !== editorEl.value || stepSession.id !== execId) {
            clearStepSession();
            if (!createStepSessionFromEditor()) return;
        }

        if (!stepSession) return;
        if (stepSession.index >= stepSession.commands.length) {
            if (!hasWon) {
                if (goalLocked) {
                    termLog("… Step concluído, mas ainda faltam interações de ambiente para liberar a bandeira.", "term-output");
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
                termLog("… Fim dos comandos no Step. Faltam interações de ambiente para liberar a bandeira.", "term-output");
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
                termLog("… Faltam interações de ambiente para liberar a bandeira.", "term-output");
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
