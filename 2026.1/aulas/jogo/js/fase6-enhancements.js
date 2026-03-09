/* ===== FASE 6 — UX Enhancements ===== */
(function () {
    "use strict";

    if (!document.body.classList.contains("fase6-page")) return;

    const editorEl = document.getElementById("code-editor");
    const runBtn = document.getElementById("run-btn");
    const resetBtn = document.getElementById("reset-btn");
    const speedSlowBtn = document.getElementById("speed-slow-btn");
    const speedFastBtn = document.getElementById("speed-fast-btn");
    const quickBarEl = document.querySelector(".ide-quickbar");

    if (!editorEl || !runBtn || !resetBtn) return;

    const SNIPPETS = {
        move_right: "move_right(1)",
        interact: "interact()",
        jump: "jump()",
        if_else: "if is_crystal_ahead():\n    interact()\nelse:\n    jump()",
    };

    function dispatchEditorInput() {
        editorEl.dispatchEvent(new Event("input", { bubbles: true }));
    }

    function replaceSelection(text) {
        const start = editorEl.selectionStart;
        const end = editorEl.selectionEnd;
        const before = editorEl.value.slice(0, start);
        const after = editorEl.value.slice(end);
        editorEl.value = before + text + after;
        const nextPos = start + text.length;
        editorEl.selectionStart = nextPos;
        editorEl.selectionEnd = nextPos;
        dispatchEditorInput();
    }

    function insertSnippet(snippetKey) {
        const snippet = SNIPPETS[snippetKey];
        if (!snippet) return;

        const start = editorEl.selectionStart;
        const lineStart = editorEl.value.lastIndexOf("\n", start - 1) + 1;
        const linePrefix = editorEl.value.slice(lineStart, start);
        const baseIndent = (linePrefix.match(/^[ \t]*/) || [""])[0].replace(/\t/g, "    ");

        const normalized = snippet
            .split("\n")
            .map(function (line, idx) {
                if (idx === 0) return line;
                return baseIndent + line;
            })
            .join("\n");

        replaceSelection(normalized);
        editorEl.focus();
    }

    function smartEnterIndent() {
        const start = editorEl.selectionStart;
        const end = editorEl.selectionEnd;
        if (start !== end) return false;

        const value = editorEl.value;
        const lineStart = value.lastIndexOf("\n", start - 1) + 1;
        const lineText = value.slice(lineStart, start);
        const baseIndent = (lineText.match(/^[ \t]*/) || [""])[0].replace(/\t/g, "    ");
        const trimmed = lineText.trimEnd();
        const extraIndent = trimmed.endsWith(":") ? "    " : "";

        replaceSelection("\n" + baseIndent + extraIndent);
        return true;
    }

    function unindentSelection() {
        const value = editorEl.value;
        const selStart = editorEl.selectionStart;
        const selEnd = editorEl.selectionEnd;

        const blockStart = value.lastIndexOf("\n", selStart - 1) + 1;
        let blockEnd = value.indexOf("\n", selEnd);
        if (blockEnd === -1) blockEnd = value.length;

        const block = value.slice(blockStart, blockEnd);
        const lines = block.split("\n");

        let removedBeforeStart = 0;
        let removedTotal = 0;

        const updatedBlock = lines
            .map(function (line, idx) {
                if (line.startsWith("    ")) {
                    if (idx === 0) removedBeforeStart = 4;
                    removedTotal += 4;
                    return line.slice(4);
                }
                if (line.startsWith("\t")) {
                    if (idx === 0) removedBeforeStart = 1;
                    removedTotal += 1;
                    return line.slice(1);
                }
                return line;
            })
            .join("\n");

        editorEl.value = value.slice(0, blockStart) + updatedBlock + value.slice(blockEnd);

        const nextStart = Math.max(blockStart, selStart - removedBeforeStart);
        const nextEnd = Math.max(nextStart, selEnd - removedTotal);
        editorEl.selectionStart = nextStart;
        editorEl.selectionEnd = nextEnd;

        dispatchEditorInput();
    }

    function isTypingTarget(target) {
        if (!target) return false;
        if (target === editorEl) return true;
        const tag = target.tagName;
        return tag === "INPUT" || tag === "TEXTAREA" || target.isContentEditable;
    }

    editorEl.addEventListener("keydown", function (e) {
        const autocompleteEl = document.querySelector(".code-autocomplete");
        const autocompleteVisible = !!(
            autocompleteEl &&
            autocompleteEl.style.display !== "none" &&
            autocompleteEl.childElementCount > 0
        );

        if (e.shiftKey && e.key === "Tab") {
            e.preventDefault();
            e.stopImmediatePropagation();
            unindentSelection();
            return;
        }

        if (e.shiftKey && e.key === "Enter") {
            e.preventDefault();
            runBtn.click();
            return;
        }

        if (
            e.key === "Enter" &&
            !e.shiftKey &&
            !e.altKey &&
            !e.ctrlKey &&
            !e.metaKey &&
            !autocompleteVisible
        ) {
            e.preventDefault();
            smartEnterIndent();
        }
    }, true);

    document.addEventListener("keydown", function (e) {
        const typing = isTypingTarget(e.target);

        if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
            e.preventDefault();
            runBtn.click();
            return;
        }

        if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === "R" || e.key === "r")) {
            e.preventDefault();
            resetBtn.click();
            return;
        }

        if (typing) return;

        if (e.altKey && e.key === "1" && speedSlowBtn) {
            e.preventDefault();
            speedSlowBtn.click();
            return;
        }

        if (e.altKey && e.key === "2" && speedFastBtn) {
            e.preventDefault();
            speedFastBtn.click();
        }
    });

    if (quickBarEl) {
        quickBarEl.addEventListener("click", function (e) {
            const btn = e.target.closest("[data-snippet]");
            if (!btn) return;
            insertSnippet(btn.getAttribute("data-snippet"));
        });
    }
})();
