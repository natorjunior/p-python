/* ===== FASE 6 — Operadores Aritméticos: Desafio Completo ===== */

(function () {
    "use strict";

    /* ===== CONFIG ===== */
    const TILE = 60;
    const COLS = 16;
    const ROWS = 7;
    const GAME_W = TILE * COLS;
    const GAME_H = TILE * ROWS;
    const GROUND_ROW = 6;

    const MAX_COMMANDS = 16;
    const PLAYER_START = { col: 1, row: GROUND_ROW };

    /* Mapa (16 colunas):
       col  0  1  2  3  4  5  6  7  8  9 10 11 12 13 14 15
            .  P  .  .  B1 .  .  🔮  .  .  B2 .  💎  .  🏁  .
       Salto1: col 3 → col 5 (pula B1 na col 4, pega cristal alto sobre B1)
       Portal: col 7 (transformação — deve ter cristal alto primeiro)
       Salto2: col 9 → col 11 (pula B2 na col 10)
       Cristal solo: col 12
       Bandeira: col 14
    */

    const OBSTACLE1_COL = 4;
    const JUMP1_FROM = 3;
    const JUMP1_TO = 5;

    const TRANSFORM_COL = 7;

    const OBSTACLE2_COL = 10;
    const JUMP2_FROM = 9;
    const JUMP2_TO = 11;

    const GROUND_CRYSTAL_COL = 12;
    const GOAL_COL = 14;

    const PLAYER_W = 38;
    const PLAYER_H = 50;
    const CRYSTAL_W = 30;
    const CRYSTAL_H = 34;
    const GOAL_W = 36;
    const GOAL_H = 44;
    const PLAYER_INIT_IMG = "../assets/img/player.png";
    const PLAYER_DEV_BABY_IMG = "../assets/img/player2.png";

    const SPEED_MAP = {
        slow: 2.0,
        fast: 5.5,
    };
    const LOSS_DELAY = 1400;
    const AVAILABLE_COMMANDS = [
        "move_right(var)",
        "move_left(var)",
        "jump()",
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
    var collectedHighCrystal = false;
    var transformedDevBaby = false;
    var collectedGroundCrystal = false;
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
    var obstacle1Parts = [];
    var obstacle2Parts = [];
    var sceneSkyLayers = [];
    var sceneStars = [];
    var sceneColumns = [];
    var moonDisc = null;
    var moonCrater = null;
    var groundBase = null;
    var groundLine = null;
    var horizonGlow = null;
    var hudPanel = null;

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
        sceneSkyLayers = [];
        sceneStars = [];
        sceneColumns = [];

        /* Sky gradient rows */
        var skyColors = ["#1a1b26", "#1a1b2e", "#1e2030", "#24273a", "#363a4f"];
        for (var r = 0; r < GROUND_ROW; r++) {
            var skyLayer = Crafty.e("2D, DOM, Color")
                .attr({ x: 0, y: r * TILE, w: GAME_W, h: TILE })
                .color(skyColors[r] || "#24273a");
            sceneSkyLayers.push(skyLayer);
        }

        /* Stars */
        var STAR_COUNT = 40;
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
            sceneStars.push(star);
        }

        /* Moon */
        moonDisc = Crafty.e("2D, DOM, Color")
            .attr({ x: GAME_W - 100, y: 24, w: 44, h: 44 })
            .color("#f5e0dc")
            .css({ "border-radius": "50%", "box-shadow": "0 0 30px rgba(245,224,220,0.15)" });
        moonCrater = Crafty.e("2D, DOM, Color")
            .attr({ x: GAME_W - 88, y: 36, w: 8, h: 8 })
            .color("#dcd3cd")
            .css({ "border-radius": "50%", opacity: "0.5" });

        /* Ground */
        groundBase = Crafty.e("2D, DOM, Color, Solid")
            .attr({ x: 0, y: GROUND_ROW * TILE, w: GAME_W, h: TILE })
            .color("#363a4f");
        groundLine = Crafty.e("2D, DOM, Color")
            .attr({ x: 0, y: GROUND_ROW * TILE, w: GAME_W, h: 3 })
            .color("#a6e3a1")
            .css({ opacity: "0.4" });
        horizonGlow = Crafty.e("2D, DOM, Color")
            .attr({ x: 0, y: GROUND_ROW * TILE - 14, w: GAME_W, h: 14, z: 6 })
            .color("#89b4fa")
            .css({ opacity: "0.025" });

        /* Ground center dots */
        for (var c = 0; c < COLS; c++) {
            Crafty.e("2D, DOM, Color")
                .attr({ x: c * TILE + TILE / 2 - 1, y: GROUND_ROW * TILE + TILE / 2 - 1, w: 2, h: 2 })
                .color("#585b70")
                .css({ "border-radius": "50%" });
        }

        /* Step dots above ground */
        for (var p = 1; p <= COLS - 2; p++) {
            stepDots[p] = Crafty.e("2D, DOM, Color")
                .attr({ x: p * TILE + TILE / 2 - 5, y: GROUND_ROW * TILE + 8, w: 10, h: 10, z: 18 })
                .color("#585b70")
                .css({
                    "border-radius": "50%",
                    opacity: "0.92",
                    "box-shadow": "0 0 0 2px rgba(137,180,250,0.22) inset, 0 0 0 1px rgba(17,17,27,0.55)",
                });
        }

        /* Column numbers for visualization */
        for (var cn = 1; cn <= COLS - 2; cn++) {
            var columnLabel = Crafty.e("2D, DOM, Text")
                .attr({ x: cn * TILE + TILE / 2 - 8, y: GROUND_ROW * TILE + 22, w: 20, h: 14, z: 18 })
                .text(String(cn))
                .textColor("#494d64")
                .textFont({ size: "9px", weight: "600", family: "Consolas" });
            sceneColumns.push(columnLabel);
        }

        /* HUD */
        hudPanel = Crafty.e("2D, DOM, Color")
            .attr({ x: 10, y: 56, w: 520, h: 24, z: 29 })
            .color("#11111b")
            .css({
                opacity: "0.4",
                "border-radius": "8px",
                "box-shadow": "0 0 12px rgba(17,17,27,0.42)",
            });

        objectiveHud = Crafty.e("2D, DOM, Text")
            .attr({ x: 16, y: 61, w: 505, h: 16, z: 30 })
            .text("Alto:… | Portal:… | Solo:… | Meta:🔒")
            .textColor("#a6adc8")
            .textFont({ size: "11px", weight: "700", family: "Consolas" });

        /* ===== OBSTACLE 1 (col 4) ===== */
        buildObstacle(OBSTACLE1_COL, obstacle1Parts, "#5b6078", "?");

        /* ===== OBSTACLE 2 (col 10) ===== */
        buildObstacle(OBSTACLE2_COL, obstacle2Parts, "#6e5078", "!");
    }

    function buildObstacle(col, partsArray, bodyColor, symbol) {
        var obstacleX = colToX(col) + (TILE - 40) / 2;
        var obstacleY = rowToY(GROUND_ROW) - 48;

        var body = Crafty.e("2D, DOM, Color, Solid")
            .attr({ x: obstacleX, y: obstacleY, w: 40, h: 48, z: 20 })
            .color(bodyColor)
            .css({ "border-radius": "8px" });

        var stripe = Crafty.e("2D, DOM, Color")
            .attr({ x: obstacleX + 5, y: obstacleY + 7, w: 30, h: 7, z: 21 })
            .color("#7f849c")
            .css({ "border-radius": "5px", opacity: "0.7" });

        var top = Crafty.e("2D, DOM, Color")
            .attr({ x: obstacleX - 3, y: obstacleY - 2, w: 46, h: 4, z: 22 })
            .color("#f38ba8")
            .css({ opacity: "0.55", "border-radius": "2px" });

        Crafty.e("2D, DOM, Text")
            .attr({ x: obstacleX + 10, y: obstacleY + 18, w: 20, h: 14, z: 23 })
            .text(symbol)
            .textColor("#f9e2af")
            .textFont({ size: "14px", weight: "700", family: "Consolas" });

        partsArray.push(
            { ent: body, baseX: obstacleX },
            { ent: stripe, baseX: obstacleX + 5 },
            { ent: top, baseX: obstacleX - 3 }
        );
    }

    buildScene();

    function updateStars(color, minAlpha, maxAlpha) {
        for (var i = 0; i < sceneStars.length; i++) {
            var star = sceneStars[i];
            star.color(color);
            star._baseAlpha = minAlpha + Math.random() * (maxAlpha - minAlpha);
        }
    }

    function applySceneTheme(themeMode) {
        var palette;
        var starColor;
        var starAlphaMin;
        var starAlphaMax;
        var moonColor;
        var moonGlow;
        var groundColor;
        var lineColor;
        var glowColor;
        var columnColor;
        var hudOpacity;
        var portalColor;
        var portalGlow;
        var obstacle1Color;
        var obstacle2Color;
        var topColor;

        if (themeMode === "mastered") {
            palette = ["#16223f", "#203257", "#2b456d", "#355782", "#3f6b95", "#4a7ca8", "#5689b1"];
            starColor = "#f9e2af";
            starAlphaMin = 0.45;
            starAlphaMax = 0.95;
            moonColor = "#f5e0dc";
            moonGlow = "0 0 36px rgba(245,224,220,0.38)";
            groundColor = "#3a4862";
            lineColor = "#f9e2af";
            glowColor = "#f9e2af";
            columnColor = "#b5a67a";
            hudOpacity = "0.6";
            portalColor = "#89dceb";
            portalGlow = "0 0 22px rgba(137,220,235,0.65)";
            obstacle1Color = "#62739c";
            obstacle2Color = "#7b6a9a";
            topColor = "#f9e2af";
        } else if (themeMode === "evolved") {
            palette = ["#10213f", "#173059", "#1f3c67", "#294a76", "#315684", "#3a6390", "#466e97"];
            starColor = "#89dceb";
            starAlphaMin = 0.4;
            starAlphaMax = 0.88;
            moonColor = "#89dceb";
            moonGlow = "0 0 34px rgba(137,220,235,0.3)";
            groundColor = "#33425e";
            lineColor = "#89dceb";
            glowColor = "#89dceb";
            columnColor = "#7aa8bc";
            hudOpacity = "0.58";
            portalColor = "#a6e3a1";
            portalGlow = "0 0 24px rgba(166,227,161,0.62)";
            obstacle1Color = "#5e708f";
            obstacle2Color = "#786690";
            topColor = "#89dceb";
        } else {
            palette = ["#1a1b26", "#1a1b2e", "#1e2030", "#24273a", "#2b3047", "#323955", "#363a4f"];
            starColor = "#cad3f5";
            starAlphaMin = 0.28;
            starAlphaMax = 0.78;
            moonColor = "#f5e0dc";
            moonGlow = "0 0 30px rgba(245,224,220,0.15)";
            groundColor = "#363a4f";
            lineColor = "#a6e3a1";
            glowColor = "#89b4fa";
            columnColor = "#494d64";
            hudOpacity = "0.5";
            portalColor = "#7dc4e4";
            portalGlow = "0 0 16px rgba(125,196,228,0.45)";
            obstacle1Color = "#5b6078";
            obstacle2Color = "#6e5078";
            topColor = "#f38ba8";
        }

        for (var s = 0; s < sceneSkyLayers.length; s++) {
            sceneSkyLayers[s].color(palette[s] || palette[palette.length - 1]);
        }
        updateStars(starColor, starAlphaMin, starAlphaMax);

        if (moonDisc) {
            moonDisc.color(moonColor);
            moonDisc.css({ "box-shadow": moonGlow });
        }
        if (moonCrater) {
            moonCrater.css({ opacity: themeMode === "evolved" ? "0.3" : "0.5" });
        }

        if (groundBase) groundBase.color(groundColor);
        if (groundLine) groundLine.color(lineColor);
        if (horizonGlow) {
            horizonGlow.color(glowColor);
            horizonGlow.css({ opacity: themeMode === "base" ? "0.025" : "0.065" });
        }

        for (var c = 0; c < sceneColumns.length; c++) {
            sceneColumns[c].textColor(columnColor);
        }

        if (hudPanel) {
            hudPanel.css({
                opacity: hudOpacity,
                "box-shadow": themeMode === "base"
                    ? "0 0 12px rgba(17,17,27,0.42)"
                    : "0 0 16px rgba(137,220,235,0.24)",
            });
        }

        if (transformZone) {
            transformZone.color(portalColor);
            transformZone.css({ "box-shadow": portalGlow });
        }

        if (obstacle1Parts[0]) obstacle1Parts[0].ent.color(obstacle1Color);
        if (obstacle2Parts[0]) obstacle2Parts[0].ent.color(obstacle2Color);
        if (obstacle1Parts[2]) obstacle1Parts[2].ent.color(topColor);
        if (obstacle2Parts[2]) obstacle2Parts[2].ent.color(topColor);
    }

    function playEvolutionPulse() {
        var flash = Crafty.e("2D, DOM, Color")
            .attr({ x: 0, y: 0, w: GAME_W, h: GAME_H, z: 45 })
            .color("#89dceb")
            .css({ opacity: "0.16" });

        var flashLife = 12;
        flash.bind("EnterFrame", function () {
            flashLife -= 1;
            if (flashLife <= 0) {
                this.destroy();
                return;
            }
            this.css({ opacity: String(0.16 * (flashLife / 12)) });
        });

        var centerX = player.x + player.w / 2;
        var centerY = player.y + player.h / 2;
        for (var i = 0; i < 12; i++) {
            var angle = (Math.PI * 2 * i) / 12 + Math.random() * 0.25;
            var speed = 1.6 + Math.random() * 1.7;
            var life = 30 + Math.floor(Math.random() * 10);
            var vx = Math.cos(angle) * speed;
            var vy = Math.sin(angle) * speed;
            var particle = Crafty.e("2D, DOM, Color")
                .attr({ x: centerX, y: centerY, w: 4, h: 4, z: 46 })
                .color("#a6e3a1")
                .css({ "border-radius": "50%", opacity: "0.95", "box-shadow": "0 0 8px rgba(166,227,161,0.7)" });

            particle._vx = vx;
            particle._vy = vy;
            particle._life = life;
            particle.bind("EnterFrame", function () {
                this._life -= 1;
                if (this._life <= 0) {
                    this.destroy();
                    return;
                }
                this.x += this._vx;
                this.y += this._vy;
                this._vy += 0.02;
                this.css({ opacity: String(Math.max(0.1, this._life / 40)) });
            });
        }
    }

    function updateObjectiveHud() {
        if (!objectiveHud) return;
        var parts = [];
        parts.push("Alto:" + (collectedHighCrystal ? "✓" : "…"));
        parts.push("Portal:" + (transformedDevBaby ? "✓" : "…"));
        parts.push("Solo:" + (collectedGroundCrystal ? "✓" : "…"));
        parts.push("Meta:" + (goalUnlocked ? "✓" : "🔒"));
        objectiveHud.text(parts.join(" | "));
        objectiveHud.textColor(goalUnlocked ? "#a6e3a1" : "#a6adc8");
    }

    /* ===== GOAL (col 14) ===== */
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
        .attr({ x: goalX - 8, y: goalY - 18, w: 100, h: 14, z: 30 })
        .text("🔒 LOCK")
        .textColor("#f38ba8")
        .textFont({ size: "11px", weight: "700", family: "Consolas" });

    function setGoalUnlocked(unlocked) {
        goalUnlocked = !!unlocked;
        if (goalUnlocked) {
            goal.css({ opacity: "1", filter: "none", "box-shadow": "0 0 18px rgba(166,227,161,0.5)" });
            goalLockText.text("🔓 OPEN");
            goalLockText.textColor("#a6e3a1");
            applySceneTheme("mastered");
        } else {
            goal.css({ opacity: "0.35", filter: "grayscale(0.75)", "box-shadow": "none" });
            goalLockText.text("🔒 LOCK");
            goalLockText.textColor("#f38ba8");
            applySceneTheme(transformedDevBaby ? "evolved" : "base");
        }
        updateObjectiveHud();
    }

    /* ===== INTERACTIONS ===== */
    /* High crystal — floats above obstacle 1 (col 4) */
    var highCrystalX = colToX(OBSTACLE1_COL) + (TILE - CRYSTAL_W) / 2;
    var highCrystalY = rowToY(GROUND_ROW) - TILE - CRYSTAL_H + 10;

    var highCrystal = Crafty.e("2D, DOM, Image, Collision, CrystalHigh")
        .attr({ x: highCrystalX, y: highCrystalY, w: CRYSTAL_W, h: CRYSTAL_H, z: 24 })
        .image("../assets/img/cristal.png", "no-repeat")
        .css({
            "background-size": "contain",
            "background-position": "center bottom",
            "image-rendering": "pixelated",
            opacity: "1",
            "box-shadow": "0 0 16px rgba(137,180,250,0.45)",
        });

    /* Ground crystal (col 12) */
    var groundCrystalX = colToX(GROUND_CRYSTAL_COL) + (TILE - CRYSTAL_W) / 2;
    var groundCrystalY = rowToY(GROUND_ROW) - CRYSTAL_H;

    var groundCrystal = Crafty.e("2D, DOM, Image, Collision, CrystalGround")
        .attr({ x: groundCrystalX, y: groundCrystalY, w: CRYSTAL_W, h: CRYSTAL_H, z: 24 })
        .image("../assets/img/cristal.png", "no-repeat")
        .css({
            "background-size": "contain",
            "background-position": "center bottom",
            "image-rendering": "pixelated",
            opacity: "1",
            filter: "hue-rotate(25deg)",
            "box-shadow": "0 0 16px rgba(249,226,175,0.45)",
        });

    /* Labels */
    var highCrystalTag = Crafty.e("2D, DOM, Text")
        .attr({ x: highCrystal.x - 8, y: highCrystal.y - 14, w: 70, h: 14, z: 30 })
        .text("ALTO")
        .textColor("#89b4fa")
        .textFont({ size: "10px", weight: "700", family: "Consolas" });

    var groundCrystalTag = Crafty.e("2D, DOM, Text")
        .attr({ x: groundCrystal.x - 8, y: groundCrystal.y - 14, w: 70, h: 14, z: 30 })
        .text("SOLO")
        .textColor("#f9e2af")
        .textFont({ size: "10px", weight: "700", family: "Consolas" });

    /* Portal (col 7) */
    var transformZoneX = colToX(TRANSFORM_COL) + (TILE - 36) / 2;
    var transformZoneY = rowToY(GROUND_ROW) - 50;

    var transformZone = Crafty.e("2D, DOM, Color, Collision, TransformZone")
        .attr({ x: transformZoneX, y: transformZoneY, w: 36, h: 50, z: 23 })
        .color("#7dc4e4")
        .css({
            opacity: "0.25",
            "border-radius": "10px",
            "box-shadow": "0 0 16px rgba(125,196,228,0.45)",
        });

    var transformZoneTag = Crafty.e("2D, DOM, Text")
        .attr({ x: transformZoneX - 12, y: transformZoneY - 14, w: 80, h: 14, z: 30 })
        .text("PORTAL")
        .textColor("#89dceb")
        .textFont({ size: "10px", weight: "700", family: "Consolas" });

    /* ===== Interaction Logic ===== */
    function resetInteractionVisuals() {
        highCrystal.css({ opacity: "1", filter: "none", "box-shadow": "0 0 16px rgba(137,180,250,0.45)" });
        groundCrystal.css({ opacity: "1", filter: "hue-rotate(25deg)", "box-shadow": "0 0 16px rgba(249,226,175,0.45)" });
        highCrystalTag.css({ opacity: "1" });
        groundCrystalTag.css({ opacity: "1" });
        transformZone.css({ opacity: "0.25", "box-shadow": "0 0 16px rgba(125,196,228,0.45)" });
    }

    function collectHighCrystal() {
        if (collectedHighCrystal) return;
        collectedHighCrystal = true;
        highCrystal.css({ opacity: "0", "box-shadow": "none" });
        highCrystalTag.css({ opacity: "0" });
        termLog("✓ Cristal alto coletado com jump()!", "term-success");
        updateObjectiveHud();
    }

    function applyDevBabyTransformation() {
        if (transformedDevBaby || !collectedHighCrystal) return;
        transformedDevBaby = true;
        player.image(PLAYER_DEV_BABY_IMG, "no-repeat");
        player.css({
            "background-size": "contain",
            "background-position": "center bottom",
            "image-rendering": "pixelated",
            "transition": "none",
        });
        transformZone.css({ opacity: "0.45", "box-shadow": "0 0 20px rgba(166,227,161,0.52)" });
        applySceneTheme("evolved");
        playEvolutionPulse();
        termLog("✓ Você virou deve baby!", "term-success");
        updateObjectiveHud();
    }

    function collectGroundCrystal() {
        if (collectedGroundCrystal || !transformedDevBaby || !collectedHighCrystal) return;
        collectedGroundCrystal = true;
        groundCrystal.css({ opacity: "0", "box-shadow": "none" });
        groundCrystalTag.css({ opacity: "0" });
        termLog("✓ Cristal do solo coletado!", "term-success");
        updateObjectiveHud();
    }

    function checkCheckpointCollisions() {
        /* High crystal */
        if (!collectedHighCrystal) {
            var hitHigh = player.hit("CrystalHigh");
            if (hitHigh && hitHigh.length) {
                collectHighCrystal();
            }
        }

        /* Portal */
        var hitTransform = player.hit("TransformZone");
        if (hitTransform && hitTransform.length) {
            if (!collectedHighCrystal) {
                var now1 = Date.now();
                if (now1 - lastOrderWarnAt > 900) {
                    lastOrderWarnAt = now1;
                    termLog("✗ Ordem incorreta: pegue o cristal alto antes do portal.", "term-error");
                }
            } else if (!transformedDevBaby) {
                applyDevBabyTransformation();
            }
        }

        /* Ground crystal */
        if (!collectedGroundCrystal) {
            var hitGround = player.hit("CrystalGround");
            if (hitGround && hitGround.length) {
                if (!collectedHighCrystal) {
                    var w1 = Date.now();
                    if (w1 - lastOrderWarnAt > 900) { lastOrderWarnAt = w1; termLog("✗ Primeiro pegue o cristal alto.", "term-error"); }
                } else if (!transformedDevBaby) {
                    var w2 = Date.now();
                    if (w2 - lastOrderWarnAt > 900) { lastOrderWarnAt = w2; termLog("✗ Passe no portal antes de pegar o cristal solo.", "term-error"); }
                } else {
                    collectGroundCrystal();
                }
            }
        }

        /* Unlock goal */
        if (collectedHighCrystal && transformedDevBaby && collectedGroundCrystal && !goalUnlocked) {
            setGoalUnlocked(true);
            termLog("✓ Ordem completa! Bandeira liberada!", "term-success");
        }
    }

    function resetObjectives() {
        collectedHighCrystal = false;
        transformedDevBaby = false;
        collectedGroundCrystal = false;
        lastOrderWarnAt = 0;
        setGoalUnlocked(false);
        resetInteractionVisuals();
        applySceneTheme("base");
        updateObjectiveHud();
    }

    /* ===== PLAYER ===== */
    var playerStartX = colToX(PLAYER_START.col) + (TILE - PLAYER_W) / 2;
    var playerStartY = rowToY(GROUND_ROW) - PLAYER_H - 2;

    var player = Crafty.e("2D, DOM, Image, Collision")
        .attr({ x: playerStartX, y: playerStartY, w: PLAYER_W, h: PLAYER_H, z: 26 })
        .image(PLAYER_INIT_IMG, "no-repeat")
        .css({
            "background-size": "contain",
            "background-position": "center bottom",
            "image-rendering": "pixelated",
            "transition": "none",
        });

    function resetRuntimeVariables() {
        runtimeVariables = {};
        player.image(PLAYER_INIT_IMG, "no-repeat");
        player.css({
            "background-size": "contain",
            "background-position": "center bottom",
            "image-rendering": "pixelated",
            "transition": "none",
        });
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
        return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
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

    /* ===== GUTTER / LINE NUMBERS ===== */
    function updateGutter() {
        var lines = editorEl.value.split("\n");
        var count = Math.max(lines.length, MAX_COMMANDS, 10);
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
        sbLine.textContent = lines.length;
        sbCol.textContent = lines[lines.length - 1].length + 1;
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
                autocompleteState.matches[i] + "</button>";
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
        if (!context) { hideAutocomplete(); return; }
        var previousSelected = autocompleteState.matches[autocompleteState.selectedIndex] || "";
        autocompleteState.visible = true;
        autocompleteState.matches = context.matches;
        autocompleteState.selectedIndex = 0;
        if (previousSelected) {
            var prevIndex = context.matches.indexOf(previousSelected);
            if (prevIndex >= 0) autocompleteState.selectedIndex = prevIndex;
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
            stepDots[col].color("#585b70").css({
                opacity: "0.92",
                "box-shadow": "0 0 0 2px rgba(137,180,250,0.22) inset, 0 0 0 1px rgba(17,17,27,0.55)",
            });
        });
    }

    function markStepPassed(col) {
        var dot = stepDots[col];
        if (!dot) return;
        dot.color("#a6e3a1").css({
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
        termLog("Posição restaurada. Calcule as distâncias e siga a ordem!", "term-output");
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
                termLog("✗ Bandeira bloqueada. Complete: cristal alto → portal → cristal solo.", "term-error");
            }
            goal.css({ "box-shadow": "0 0 22px rgba(243,139,168,0.4)" });
            setTimeout(function () { if (!goalUnlocked) goal.css({ "box-shadow": "none" }); }, 250);
            return;
        }

        for (var i = 0; i < hit.length; i++) {
            if (hit[i].obj[0] === goal[0]) {
                hasWon = true;
                isExecuting = false;
                runBtn.disabled = false;
                termLog("✓ Vitória! Operadores, 2 saltos e ordem executados!", "term-success");
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
    function isBlockedCol(col) {
        return col === OBSTACLE1_COL || col === OBSTACLE2_COL;
    }

    function moveToCol(targetCol, id, moveSpeed) {
        var targetX = colToX(targetCol) + (TILE - PLAYER_W) / 2;
        return new Promise(function (resolve) {
            var direction = targetX > player.x ? 1 : -1;
            var handler = function () {
                if (id !== execId || hasWon) {
                    player.y = playerStartY;
                    player.unbind("EnterFrame", handler);
                    resolve();
                    return;
                }
                var diff = targetX - player.x;
                if (Math.abs(diff) <= moveSpeed) {
                    player.x = targetX;
                    player.y = playerStartY;
                    player.unbind("EnterFrame", handler);
                    resolve();
                    return;
                }
                player.x += direction * moveSpeed;
                player.y = playerStartY;
                checkCheckpointCollisions();
            };
            player.bind("EnterFrame", handler);
        });
    }

    function jumpToCol(targetCol, id, moveSpeed) {
        var startX = player.x;
        var targetX = colToX(targetCol) + (TILE - PLAYER_W) / 2;
        var jumpHeight = 72;
        var progress = 0;
        var step = Math.max(0.04, moveSpeed / 60);

        return new Promise(function (resolve) {
            var handler = function () {
                if (id !== execId || hasWon) {
                    player.y = playerStartY;
                    player.unbind("EnterFrame", handler);
                    resolve();
                    return;
                }
                progress += step;
                if (progress >= 1) {
                    player.x = targetX;
                    player.y = playerStartY;
                    checkCheckpointCollisions();
                    player.unbind("EnterFrame", handler);
                    resolve();
                    return;
                }
                player.x = startX + (targetX - startX) * progress;
                player.y = playerStartY - Math.sin(progress * Math.PI) * jumpHeight;
                checkCheckpointCollisions();
            };
            player.bind("EnterFrame", handler);
        });
    }

    function bumpBlocked(direction, id) {
        return new Promise(function (resolve) {
            var originX = player.x;
            var nudge = direction === "right" ? 8 : -8;
            var frameCount = 0;
            var handler = function () {
                if (id !== execId || hasWon) {
                    player.x = originX;
                    player.y = playerStartY;
                    player.unbind("EnterFrame", handler);
                    resolve();
                    return;
                }
                frameCount += 1;
                if (frameCount <= 4) {
                    player.x = originX + nudge;
                } else {
                    player.x = originX;
                    player.y = playerStartY;
                    player.unbind("EnterFrame", handler);
                    resolve();
                }
            };
            player.bind("EnterFrame", handler);
        });
    }

    function animateObstacleHit(id, partsArray) {
        return new Promise(function (resolve) {
            var frame = 0;
            var totalFrames = 12;
            var topPart = partsArray[2] ? partsArray[2].ent : null;
            var handler = function () {
                if (id !== execId || hasWon) {
                    partsArray.forEach(function (part) { part.ent.x = part.baseX; });
                    if (topPart) topPart.color("#f38ba8");
                    Crafty.unbind("EnterFrame", handler);
                    resolve();
                    return;
                }
                frame += 1;
                var pulse = frame % 2 === 0 ? -3 : 3;
                if (frame > 8) pulse = 0;
                partsArray.forEach(function (part) { part.ent.x = part.baseX + pulse; });
                if (topPart) topPart.color(frame % 2 === 0 ? "#f38ba8" : "#f7768e");
                if (frame >= totalFrames) {
                    partsArray.forEach(function (part) { part.ent.x = part.baseX; });
                    if (topPart) topPart.color("#f38ba8");
                    Crafty.unbind("EnterFrame", handler);
                    resolve();
                }
            };
            Crafty.bind("EnterFrame", handler);
        });
    }

    function getObstaclePartsForCol(col) {
        if (col === OBSTACLE1_COL) return obstacle1Parts;
        if (col === OBSTACLE2_COL) return obstacle2Parts;
        return obstacle1Parts;
    }

    function pauseMs(ms) {
        return new Promise(function (resolve) { setTimeout(resolve, ms); });
    }

    /* ===== PARSER ===== */
    function resolveIntToken(token, variables, lineNum) {
        if (/^-?\d+$/.test(token)) return parseInt(token, 10);
        if (!/^[a-zA-Z_]\w*$/.test(token)) throw new Error("Ln " + lineNum + ": token inválido na expressão.");
        if (!variables[token]) throw new Error("Ln " + lineNum + ': variável "' + token + '" não declarada.');
        if (variables[token].type !== "int") throw new Error("Ln " + lineNum + ': variável "' + token + '" deve ser int.');
        return variables[token].value;
    }

    function tokenizeIntExpression(raw, lineNum) {
        var tokens = [];
        var i = 0;
        while (i < raw.length) {
            var ch = raw.charAt(i);
            if (/\s/.test(ch)) { i++; continue; }
            if (ch === "+" || ch === "-" || ch === "*") { tokens.push(ch); i++; continue; }
            if (/\d/.test(ch)) {
                var nStart = i; i++;
                while (i < raw.length && /\d/.test(raw.charAt(i))) i++;
                tokens.push(raw.slice(nStart, i)); continue;
            }
            if (/[a-zA-Z_]/.test(ch)) {
                var vStart = i; i++;
                while (i < raw.length && /[a-zA-Z0-9_]/.test(raw.charAt(i))) i++;
                tokens.push(raw.slice(vStart, i)); continue;
            }
            throw new Error("Ln " + lineNum + ": expressão inválida. Use int, variáveis, +, - e *.");
        }
        return tokens;
    }

    function evaluateIntExpression(valueRaw, variables, lineNum) {
        var tokens = tokenizeIntExpression(valueRaw, lineNum);
        if (!tokens.length) throw new Error("Ln " + lineNum + ": valor vazio.");
        if (tokens.length % 2 === 0) throw new Error("Ln " + lineNum + ": expressão incompleta.");
        if (tokens.length > 1 && (tokens[0] === "+" || tokens[0] === "-" || tokens[0] === "*")) {
            throw new Error("Ln " + lineNum + ": comece com número ou variável.");
        }

        var hasAddition = false, hasSubtraction = false, hasMultiplication = false;
        var usesVariable = false;

        var values = [];
        var ops = [];
        for (var i = 0; i < tokens.length; i++) {
            if (i % 2 === 0) {
                values.push(resolveIntToken(tokens[i], variables, lineNum));
                if (!/^\d+$/.test(tokens[i])) usesVariable = true;
            } else {
                var opToken = tokens[i];
                if (opToken !== "+" && opToken !== "-" && opToken !== "*") {
                    throw new Error("Ln " + lineNum + ": operador inválido.");
                }
                ops.push(opToken);
            }
        }

        /* Multiplication first (precedence) */
        var reducedValues = [values[0]];
        var reducedOps = [];
        for (var j = 0; j < ops.length; j++) {
            if (ops[j] === "*") {
                hasMultiplication = true;
                reducedValues[reducedValues.length - 1] *= values[j + 1];
            } else {
                if (ops[j] === "+") hasAddition = true;
                if (ops[j] === "-") hasSubtraction = true;
                reducedOps.push(ops[j]);
                reducedValues.push(values[j + 1]);
            }
        }

        var result = reducedValues[0];
        for (var k = 0; k < reducedOps.length; k++) {
            if (reducedOps[k] === "+") result += reducedValues[k + 1];
            else result -= reducedValues[k + 1];
        }

        var isSingleLiteral = tokens.length === 1 && /^\d+$/.test(tokens[0]);
        return {
            value: result,
            isCalculated: !isSingleLiteral,
            hasAddition: hasAddition,
            hasSubtraction: hasSubtraction,
            hasMultiplication: hasMultiplication,
            usesVariable: usesVariable,
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
            hasMultiplication: evalResult.hasMultiplication,
            usesVariable: evalResult.usesVariable,
        };
    }

    function parseCode(code) {
        var commands = [];
        var lines = code.split("\n");
        var variables = {};
        var moveCount = 0;
        var jumpCount = 0;
        var hasAddition = false;
        var hasSubtraction = false;
        var hasMultiplication = false;
        var hasChainedVariable = false;
        var distinctOperators = 0;

        for (var i = 0; i < lines.length; i++) {
            var line = lines[i].trim();
            var lineNum = i + 1;
            if (!line || line.startsWith("#")) continue;

            var assignCmd = parseAssignment(line, lineNum, variables);
            if (assignCmd) {
                if (moveCount > 0) throw new Error("Ln " + lineNum + ": declare variáveis antes dos movimentos.");
                if (assignCmd.hasAddition) hasAddition = true;
                if (assignCmd.hasSubtraction) hasSubtraction = true;
                if (assignCmd.hasMultiplication) hasMultiplication = true;
                if (assignCmd.usesVariable) hasChainedVariable = true;
                commands.push(assignCmd);
                continue;
            }

            var moveRight = line.match(/^move_right\s*\(\s*([a-zA-Z_]\w*)\s*\)$/);
            if (moveRight) {
                var rightVar = moveRight[1];
                if (!variables[rightVar]) throw new Error("Ln " + lineNum + ': variável "' + rightVar + '" não declarada.');
                if (variables[rightVar].type !== "int") throw new Error("Ln " + lineNum + ": move_right() exige variável int.");
                commands.push({ type: "move_right", line: lineNum, varName: rightVar, steps: Math.abs(variables[rightVar].value) });
                moveCount += 1;
                continue;
            }

            var moveLeft = line.match(/^move_left\s*\(\s*([a-zA-Z_]\w*)\s*\)$/);
            if (moveLeft) {
                var leftVar = moveLeft[1];
                if (!variables[leftVar]) throw new Error("Ln " + lineNum + ': variável "' + leftVar + '" não declarada.');
                if (variables[leftVar].type !== "int") throw new Error("Ln " + lineNum + ": move_left() exige variável int.");
                commands.push({ type: "move_left", line: lineNum, varName: leftVar, steps: Math.abs(variables[leftVar].value) });
                moveCount += 1;
                continue;
            }

            if (/^jump\s*\(\s*\)$/.test(line)) {
                commands.push({ type: "jump", line: lineNum });
                jumpCount += 1;
                continue;
            }

            throw new Error("Ln " + lineNum + ': comando inválido "' + line + '"');
        }

        if (commands.length === 0) throw new Error("Nenhum comando encontrado.");
        if (commands.length > MAX_COMMANDS) throw new Error("Máximo " + MAX_COMMANDS + " comandos permitidos.");

        /* Validation — more demanding */
        var varNames = Object.keys(variables);
        if (varNames.length < 2) throw new Error("Declare ao menos 2 variáveis int (ex: base e rota).");

        distinctOperators = (hasAddition ? 1 : 0) + (hasSubtraction ? 1 : 0) + (hasMultiplication ? 1 : 0);
        if (distinctOperators < 2) throw new Error("Use ao menos 2 operadores diferentes (+, - ou *).");

        if (!hasChainedVariable) throw new Error("Pelo menos 1 variável deve referenciar outra (ex: rota = base * 2).");

        if (moveCount < 1) throw new Error("Use ao menos um comando de movimento.");
        if (jumpCount < 2) throw new Error("Use jump() ao menos 2 vezes (há 2 obstáculos).");

        return commands;
    }

    /* ===== EXECUTION ===== */
    function highlightEditorLine(lineNum) {
        var spans = gutterEl.querySelectorAll("span");
        spans.forEach(function (s) { s.classList.remove("active-line"); });
        if (lineNum > 0 && lineNum <= spans.length) spans[lineNum - 1].classList.add("active-line");
        activeLineEl.style.top = ((lineNum - 1) * 22 + 10) + "px";
    }

    function getJumpTarget(currentCol) {
        if (currentCol === JUMP1_FROM) return JUMP1_TO;
        if (currentCol === JUMP2_FROM) return JUMP2_TO;
        return null;
    }

    async function runCommands(commands, id, moveSpeed) {
        var currentCol = PLAYER_START.col;

        for (var i = 0; i < commands.length; i++) {
            if (id !== execId || hasWon) return;

            var cmd = commands[i];
            highlightEditorLine(cmd.line);

            if (cmd.type === "assign") {
                runtimeVariables[cmd.varName] = cmd.value;
                termLog("✓ " + cmd.varName + " = " + cmd.value + (cmd.isCalculated ? " (calculado)" : ""), "term-success");
                await pauseMs(selectedSpeed === "fast" ? 100 : 220);
                continue;
            }

            if (cmd.type === "move_right") {
                termLogHtml(
                    '<span class="term-prompt">❯</span> ' +
                    '<span class="term-cmd">Ln ' + cmd.line + ':</span> move_right(' + cmd.varName + ') → ' + cmd.steps + ' passos'
                );

                for (var r = 0; r < cmd.steps; r++) {
                    var nextRight = Math.min(currentCol + 1, COLS - 1);
                    if (nextRight === currentCol) break;

                    if (isBlockedCol(nextRight)) {
                        var parts = getObstaclePartsForCol(nextRight);
                        await animateObstacleHit(id, parts);
                        await bumpBlocked("right", id);
                        termLog("✗ Bateu no bloco (col " + nextRight + "). Use jump() antes!", "term-error");
                        break;
                    }

                    currentCol = nextRight;
                    await moveToCol(currentCol, id, moveSpeed);
                    markStepPassed(currentCol);
                    checkCheckpointCollisions();
                    checkGoal();
                    if (hasWon || id !== execId) return;
                }
                continue;
            }

            if (cmd.type === "move_left") {
                termLogHtml(
                    '<span class="term-prompt">❯</span> ' +
                    '<span class="term-cmd">Ln ' + cmd.line + ':</span> move_left(' + cmd.varName + ') → ' + cmd.steps + ' passos'
                );

                for (var l = 0; l < cmd.steps; l++) {
                    var nextLeft = Math.max(currentCol - 1, 0);
                    if (nextLeft === currentCol) break;

                    if (isBlockedCol(nextLeft)) {
                        var partsL = getObstaclePartsForCol(nextLeft);
                        await animateObstacleHit(id, partsL);
                        await bumpBlocked("left", id);
                        termLog("✗ Bloco no caminho (col " + nextLeft + ").", "term-error");
                        break;
                    }

                    currentCol = nextLeft;
                    await moveToCol(currentCol, id, moveSpeed);
                    markStepPassed(currentCol);
                    checkCheckpointCollisions();
                    checkGoal();
                    if (hasWon || id !== execId) return;
                }
                continue;
            }

            if (cmd.type === "jump") {
                termLogHtml(
                    '<span class="term-prompt">❯</span> ' +
                    '<span class="term-cmd">Ln ' + cmd.line + ':</span> jump()'
                );

                var jumpTarget = getJumpTarget(currentCol);
                if (!jumpTarget) {
                    var closestJump = "";
                    if (currentCol < OBSTACLE1_COL) closestJump = "col " + JUMP1_FROM;
                    else if (currentCol < OBSTACLE2_COL) closestJump = "col " + JUMP2_FROM;
                    else closestJump = "uma coluna de salto";

                    var partsJ = currentCol < OBSTACLE2_COL ? obstacle1Parts : obstacle2Parts;
                    await animateObstacleHit(id, partsJ);
                    await bumpBlocked("right", id);
                    termLog("✗ jump() deve ser usado na posição correta (vá até " + closestJump + ").", "term-error");
                    continue;
                }

                var obstacleBetween = (currentCol === JUMP1_FROM) ? OBSTACLE1_COL : OBSTACLE2_COL;
                await jumpToCol(jumpTarget, id, moveSpeed);
                currentCol = jumpTarget;
                markStepPassed(obstacleBetween);
                markStepPassed(jumpTarget);
                checkCheckpointCollisions();
                checkGoal();
                if (hasWon || id !== execId) return;
                continue;
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

        termLog("▶ Executando (" + selectedSpeed.toUpperCase() + ")...", "term-cmd");

        await runCommands(commands, localId, moveSpeed);

        if (localId !== execId) return;
        isExecuting = false;
        runBtn.disabled = false;

        if (!hasWon) {
            termLog("✗ Não completou a rota. Reiniciando...", "term-error");
            runBtn.disabled = true;
            setTimeout(function () {
                if (localId !== execId || hasWon) return;
                resetPlayerPosition();
                resetStepDots();
                resetRuntimeVariables();
                resetObjectives();
                isExecuting = false;
                runBtn.disabled = false;
                termLog("↺ Tente outra estratégia. Lembre: 2 operadores diferentes + variável encadeada.", "term-error");
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
            e.key === "ArrowDown" || e.key === "ArrowUp" ||
            e.key === "Enter" || e.key === "Tab" || e.key === "Escape"
        )) return;
        updateCursorInfo();
    });

    editorEl.addEventListener("keydown", function (e) {
        if (autocompleteState.visible) {
            if (e.key === "ArrowDown") { e.preventDefault(); moveAutocompleteSelection(1); return; }
            if (e.key === "ArrowUp") { e.preventDefault(); moveAutocompleteSelection(-1); return; }
            if (e.key === "Enter" || e.key === "Tab") { e.preventDefault(); applyAutocomplete(); return; }
            if (e.key === "Escape") { e.preventDefault(); hideAutocomplete(); return; }
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

    runBtn.addEventListener("click", function () { executeProgram(); });
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
