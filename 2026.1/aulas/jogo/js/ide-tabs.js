/* ===== IDE Tabs: code <-> readme ===== */

(function () {
    "use strict";

    function createReadmePanel(editorBody) {
        var panel = document.createElement("div");
        panel.className = "ide-readme-panel";
        panel.id = "ide-readme-panel";
        panel.style.display = "none";

        var head = document.createElement("div");
        head.className = "ide-readme-head";
        var title = document.createElement("span");
        title.className = "ide-readme-title";
        title.textContent = "README.md";

        var actions = document.createElement("div");
        actions.className = "ide-readme-actions";

        var renderBtn = document.createElement("button");
        renderBtn.type = "button";
        renderBtn.className = "ide-readme-btn";
        renderBtn.id = "ide-readme-render-btn";
        renderBtn.textContent = "Renderizar MD";

        var backBtn = document.createElement("button");
        backBtn.type = "button";
        backBtn.className = "ide-readme-btn";
        backBtn.id = "ide-readme-back-btn";
        backBtn.textContent = "Voltar";

        actions.appendChild(renderBtn);
        actions.appendChild(backBtn);
        head.appendChild(title);
        head.appendChild(actions);

        var pre = document.createElement("pre");
        pre.className = "ide-readme-content";
        pre.id = "ide-readme-content";
        pre.textContent = "Selecione a aba README para carregar as instruções da fase.";

        var rendered = document.createElement("div");
        rendered.className = "ide-readme-rendered";
        rendered.id = "ide-readme-rendered";
        rendered.style.display = "none";

        panel.appendChild(head);
        panel.appendChild(pre);
        panel.appendChild(rendered);
        editorBody.appendChild(panel);
        return panel;
    }

    function escapeHtml(text) {
        return text
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;");
    }

    function renderInlineMarkdown(text) {
        return text
            .replace(/`([^`]+)`/g, "<code>$1</code>")
            .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
            .replace(/\*([^*]+)\*/g, "<em>$1</em>");
    }

    function markdownToHtml(mdText) {
        var lines = escapeHtml(mdText || "").replace(/\r\n/g, "\n").split("\n");
        var html = [];
        var inList = false;

        function closeList() {
            if (inList) {
                html.push("</ul>");
                inList = false;
            }
        }

        for (var i = 0; i < lines.length; i++) {
            var line = lines[i];
            var heading = line.match(/^(#{1,6})\s+(.+)$/);
            var bullet = line.match(/^\s*-\s+(.+)$/);

            if (!line.trim()) {
                closeList();
                continue;
            }

            if (heading) {
                closeList();
                var level = heading[1].length;
                html.push("<h" + level + ">" + renderInlineMarkdown(heading[2]) + "</h" + level + ">");
                continue;
            }

            if (bullet) {
                if (!inList) {
                    html.push("<ul>");
                    inList = true;
                }
                html.push("<li>" + renderInlineMarkdown(bullet[1]) + "</li>");
                continue;
            }

            closeList();
            html.push("<p>" + renderInlineMarkdown(line) + "</p>");
        }

        closeList();
        return html.join("\n");
    }

    function setActiveTab(tabs, target) {
        for (var i = 0; i < tabs.length; i++) {
            var tab = tabs[i];
            tab.classList.toggle("active", tab.getAttribute("data-tab-target") === target);
        }
    }

    function initIdeTabs() {
        var tabs = document.querySelectorAll(".ide-tab[data-tab-target]");
        if (!tabs.length) return;

        var codeTab = document.querySelector('.ide-tab[data-tab-target="code"]');
        var readmeTab = document.querySelector('.ide-tab[data-tab-target="readme"]');
        var editorBody = document.querySelector(".ide-editor-body");
        var gutter = document.getElementById("gutter");
        var editorArea = document.querySelector(".ide-editor-area");

        if (!codeTab || !readmeTab || !editorBody || !gutter || !editorArea) return;

        var readmePanel = document.getElementById("ide-readme-panel") || createReadmePanel(editorBody);
        var readmeContent = document.getElementById("ide-readme-content");
        var readmeRendered = document.getElementById("ide-readme-rendered");
        var readmeRenderBtn = document.getElementById("ide-readme-render-btn");
        var readmeBackBtn = document.getElementById("ide-readme-back-btn");
        var readmeLoaded = false;
        var readmeText = "";
        var readmeIsRendered = false;

        function setRenderMode(renderedMode) {
            readmeIsRendered = !!renderedMode;
            readmeContent.style.display = readmeIsRendered ? "none" : "block";
            readmeRendered.style.display = readmeIsRendered ? "block" : "none";
            readmeRenderBtn.textContent = readmeIsRendered ? "Mostrar texto" : "Renderizar MD";

            if (readmeIsRendered) {
                readmeRendered.innerHTML = markdownToHtml(readmeText);
            }
        }

        function showCode() {
            setActiveTab(tabs, "code");
            editorBody.classList.remove("ide-readme-open");
            gutter.style.display = "";
            editorArea.style.display = "";
            readmePanel.style.display = "none";
        }

        function showReadme() {
            setActiveTab(tabs, "readme");
            editorBody.classList.add("ide-readme-open");
            gutter.style.display = "none";
            editorArea.style.display = "none";
            readmePanel.style.display = "block";
        }

        function loadReadme() {
            if (readmeLoaded) return;

            var src = readmeTab.getAttribute("data-readme-src");
            if (!src) {
                readmeText = "README da fase não configurado.";
                readmeContent.textContent = readmeText;
                readmeRendered.innerHTML = markdownToHtml(readmeText);
                readmeLoaded = true;
                return;
            }

            readmeContent.textContent = "Carregando README...";

            fetch(src)
                .then(function (res) {
                    if (!res.ok) {
                        throw new Error("Falha ao carregar README (" + res.status + ")");
                    }
                    return res.text();
                })
                .then(function (text) {
                    readmeText = text;
                    readmeContent.textContent = readmeText;
                    readmeRendered.innerHTML = markdownToHtml(readmeText);
                    readmeLoaded = true;
                })
                .catch(function (err) {
                    readmeText = "Não foi possível abrir o README desta fase.\n\n" + err.message;
                    readmeContent.textContent = readmeText;
                    readmeRendered.innerHTML = markdownToHtml(readmeText);
                });
        }

        codeTab.addEventListener("click", function () {
            showCode();
        });

        readmeTab.addEventListener("click", function () {
            showReadme();
            loadReadme();
        });

        readmeRenderBtn.addEventListener("click", function () {
            setRenderMode(!readmeIsRendered);
        });

        readmeBackBtn.addEventListener("click", function () {
            showCode();
        });

        setRenderMode(false);
        showCode();
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", initIdeTabs);
    } else {
        initIdeTabs();
    }
})();
