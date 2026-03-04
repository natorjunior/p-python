"""
Contador Flip – Timer & Cronômetro
UI moderna, limpa, responsiva e com modo tela-cheia.
"""

import sys
import time
import platform
import tkinter as tk
from tkinter import font as tkfont

# ═══════════════════════════════════════════════════════════════════
#  PALETA DE CORES
# ═══════════════════════════════════════════════════════════════════
COLORS = {
    "bg":           "#0d1117",
    "surface":      "#161b22",
    "card":         "#1c2333",
    "card_top":     "#222b3a",
    "card_border":  "#2a3345",
    "digit":        "#e6edf3",
    "digit_dim":    "#8b949e",
    "label":        "#7d8590",
    "separator":    "#3b4252",
    "line":         "#0d1117",
    "accent":       "#58a6ff",
    "green":        "#3fb950",
    "green_hover":  "#46d160",
    "red":          "#f85149",
    "red_hover":    "#ff6a63",
    "amber":        "#d29922",
    "btn_surface":  "#21262d",
    "btn_hover":    "#30363d",
    "btn_text":     "#f0f6fc",
    "input_bg":     "#0d1117",
    "input_border": "#30363d",
    "input_focus":  "#58a6ff",
    "hint":         "#484f58",
    "preset_bg":    "#1c2333",
    "preset_hover": "#272e3b",
    "divider":      "#21262d",
}

WINDOW_MIN_W = 900
WINDOW_MIN_H = 660
MAX_HOURS = 99
TICK_MS = 80
IS_MAC = platform.system() == "Darwin"


# ═══════════════════════════════════════════════════════════════════
#  UTILIDADES
# ═══════════════════════════════════════════════════════════════════
def _brighten(hex_color: str, amount: int = 20) -> str:
    hex_color = hex_color.lstrip("#")
    r = max(0, min(255, int(hex_color[0:2], 16) + amount))
    g = max(0, min(255, int(hex_color[2:4], 16) + amount))
    b = max(0, min(255, int(hex_color[4:6], 16) + amount))
    return f"#{r:02x}{g:02x}{b:02x}"


def _secs_to_hms(secs: int):
    h = secs // 3600
    m = (secs % 3600) // 60
    s = secs % 60
    return h, m, s


# ═══════════════════════════════════════════════════════════════════
#  FLIP DIGIT – Dígito com efeito de profundidade
# ═══════════════════════════════════════════════════════════════════
class FlipDigit(tk.Canvas):
    """Um único dígito estilo flip-clock desenhado em canvas."""

    def __init__(self, parent, size=100, **kw):
        super().__init__(
            parent, width=size, height=int(size * 1.25),
            bg=COLORS["bg"], bd=0, highlightthickness=0, **kw,
        )
        self._size = size
        self._h = int(size * 1.25)
        self._value = ""
        self._font = tkfont.Font(
            family="Helvetica Neue", size=int(size * 0.68), weight="bold"
        )
        self._draw("0")

    def _draw(self, digit: str):
        self.delete("all")
        s, h = self._size, self._h
        r = 8

        # Sombra traseira (profundidade)
        self._rounded_rect(2, 3, s - 2, h - 1, r, fill="#0a0e14", outline="")

        # Metade inferior
        self._rounded_rect(0, h // 2, s, h - 3, r, fill=COLORS["card"], outline="")

        # Metade superior (tom mais claro)
        self._rounded_rect(0, 0, s, h // 2 + 2, r, fill=COLORS["card_top"], outline="")

        # Borda fina
        self._rounded_rect(0, 0, s, h - 3, r, fill="", outline=COLORS["card_border"], width=1)

        # Linha central (sulco do flip)
        self.create_line(4, h // 2, s - 4, h // 2, fill=COLORS["line"], width=2)

        # Pontinhos nas laterais (eixos do flip)
        for x in (8, s - 8):
            self.create_oval(
                x - 2, h // 2 - 2, x + 2, h // 2 + 2,
                fill=COLORS["card_border"], outline=""
            )

        # Dígito
        self.create_text(
            s // 2, h // 2 - 2,
            text=digit, font=self._font, fill=COLORS["digit"],
        )

    def _rounded_rect(self, x1, y1, x2, y2, r, **kw):
        pts = [
            x1 + r, y1, x2 - r, y1, x2, y1, x2, y1 + r,
            x2, y2 - r, x2, y2, x2 - r, y2, x1 + r, y2,
            x1, y2, x1, y2 - r, x1, y1 + r, x1, y1,
        ]
        return self.create_polygon(pts, smooth=True, **kw)

    def set(self, digit: str):
        if digit != self._value:
            self._value = digit
            self._draw(digit)


# ═══════════════════════════════════════════════════════════════════
#  FLIP UNIT – Par de dígitos + rótulo
# ═══════════════════════════════════════════════════════════════════
class FlipUnit(tk.Frame):
    def __init__(self, parent, label: str, digit_size=100, **kw):
        super().__init__(parent, bg=COLORS["bg"], **kw)
        self._digits: list[FlipDigit] = []

        row = tk.Frame(self, bg=COLORS["bg"])
        row.pack()

        for _ in range(2):
            d = FlipDigit(row, size=digit_size)
            d.pack(side=tk.LEFT, padx=2)
            self._digits.append(d)

        tk.Label(
            self, text=label,
            font=("Helvetica Neue", 10, "bold"),
            fg=COLORS["label"], bg=COLORS["bg"],
        ).pack(pady=(6, 0))

    def set(self, value: int):
        s = str(max(0, value)).zfill(2)
        self._digits[0].set(s[0])
        self._digits[1].set(s[1])


# ═══════════════════════════════════════════════════════════════════
#  BOTÃO COM CANTOS ARREDONDADOS
# ═══════════════════════════════════════════════════════════════════
class StyledButton(tk.Canvas):
    def __init__(self, parent, text="", width=140, height=42,
                 bg_color="#21262d", fg_color="#f0f6fc",
                 hover_color=None, font_spec=None,
                 command=None, **kw):
        super().__init__(
            parent, width=width, height=height,
            bg=COLORS["bg"], bd=0, highlightthickness=0, **kw,
        )
        self._w = width
        self._h = height
        self._bg = bg_color
        self._fg = fg_color
        self._hover_bg = hover_color or _brighten(bg_color, 15)
        self._font = font_spec or ("Helvetica Neue", 12, "bold")
        self._cmd = command
        self._text = text
        self._current_bg = bg_color
        self._enabled = True

        self._render()
        self.bind("<Enter>", self._on_enter)
        self.bind("<Leave>", self._on_leave)
        self.bind("<Button-1>", self._on_click)

    def _render(self):
        try:
            self.delete("all")
        except tk.TclError:
            return  # widget já foi destruído
        r, w, h = 10, self._w, self._h
        # Sombra
        self._rrect(1, 2, w - 1, h, r, fill="#080b10", outline="")
        # Corpo
        self._rrect(0, 0, w - 1, h - 2, r,
                     fill=self._current_bg,
                     outline=_brighten(self._current_bg, 8))
        # Texto
        self.create_text(
            w // 2, (h - 2) // 2, text=self._text,
            font=self._font, fill=self._fg,
        )

    def _rrect(self, x1, y1, x2, y2, r, **kw):
        pts = [
            x1 + r, y1, x2 - r, y1, x2, y1, x2, y1 + r,
            x2, y2 - r, x2, y2, x2 - r, y2, x1 + r, y2,
            x1, y2, x1, y2 - r, x1, y1 + r, x1, y1,
        ]
        return self.create_polygon(pts, smooth=True, **kw)

    def _on_enter(self, _):
        if self._enabled:
            self._current_bg = self._hover_bg
            self._render()
            self.config(cursor="hand2")

    def _on_leave(self, _):
        self._current_bg = self._bg
        self._render()

    def _on_click(self, _):
        if self._enabled and self._cmd:
            self._cmd()

    def configure_style(self, bg=None, hover=None, text=None, fg=None, enabled=True):
        if bg:
            self._bg = bg
            self._current_bg = bg
        if hover:
            self._hover_bg = hover
        if text is not None:
            self._text = text
        if fg:
            self._fg = fg
        self._enabled = enabled
        self._render()


# ═══════════════════════════════════════════════════════════════════
#  APLICAÇÃO PRINCIPAL
# ═══════════════════════════════════════════════════════════════════
class FlipClockApp:
    def __init__(self, root: tk.Tk):
        self.root = root
        self.root.title("Contador Flip")
        self.root.configure(bg=COLORS["bg"])
        self.root.minsize(WINDOW_MIN_W, WINDOW_MIN_H)
        self.root.geometry(f"{WINDOW_MIN_W}x{WINDOW_MIN_H}")
        self.root.resizable(True, True)

        # Estado
        self.mode = "countdown"
        self.running = False
        self.total_seconds = 0
        self.remaining_seconds = 0
        self.elapsed_seconds = 0
        self._target_time = None
        self._base_elapsed = 0
        self._job = None
        self._is_fullscreen = False

        self._date_var = tk.StringVar()
        self._status_var = tk.StringVar(value="Pronto")

        self._build_ui()
        self._bind_shortcuts()
        self._update_clock()
        self._refresh_display()
        self._update_controls()

    # ─── CONSTRUÇÃO DA UI ────────────────────────────────────────
    def _build_ui(self):
        self._main = tk.Frame(self.root, bg=COLORS["bg"])
        self._main.pack(fill=tk.BOTH, expand=True)

        # ── Barra superior ──────────────────────────────────────
        header = tk.Frame(self._main, bg=COLORS["surface"])
        header.pack(fill=tk.X, padx=20, pady=(16, 0), ipady=12)

        left = tk.Frame(header, bg=COLORS["surface"])
        left.pack(side=tk.LEFT, padx=20, fill=tk.Y)

        tk.Label(
            left, text="CONTADOR FLIP",
            font=("Helvetica Neue", 15, "bold"),
            fg=COLORS["digit"], bg=COLORS["surface"],
        ).pack(anchor="w")

        tk.Label(
            left, textvariable=self._date_var,
            font=("Courier", 11), fg=COLORS["label"], bg=COLORS["surface"],
        ).pack(anchor="w", pady=(2, 0))

        right = tk.Frame(header, bg=COLORS["surface"])
        right.pack(side=tk.RIGHT, padx=16, fill=tk.Y)

        # Status dot
        self._status_dot = tk.Canvas(
            right, width=10, height=10,
            bg=COLORS["surface"], bd=0, highlightthickness=0,
        )
        self._status_dot.pack(side=tk.LEFT, padx=(0, 6), pady=2)
        self._dot_id = self._status_dot.create_oval(1, 1, 9, 9, fill=COLORS["green"], outline="")

        self._status_lbl = tk.Label(
            right, textvariable=self._status_var,
            font=("Helvetica Neue", 11), fg=COLORS["green"], bg=COLORS["surface"],
        )
        self._status_lbl.pack(side=tk.LEFT)

        # Fullscreen button
        fs = tk.Label(
            right, text="⤢", font=("Helvetica Neue", 18),
            fg=COLORS["label"], bg=COLORS["surface"], cursor="hand2",
        )
        fs.pack(side=tk.LEFT, padx=(16, 0))
        fs.bind("<Button-1>", lambda _: self._toggle_fullscreen())
        fs.bind("<Enter>", lambda _: fs.config(fg=COLORS["accent"]))
        fs.bind("<Leave>", lambda _: fs.config(fg=COLORS["label"]))
        self._fs_btn = fs

        # ── Abas ────────────────────────────────────────────────
        tab_frame = tk.Frame(self._main, bg=COLORS["bg"])
        tab_frame.pack(pady=(20, 0))

        self._tabs = {}
        for mode, label in [("countdown", "  Contagem regressiva  "), ("stopwatch", "  Cronômetro  ")]:
            t = tk.Label(
                tab_frame, text=label, padx=18, pady=7,
                font=("Helvetica Neue", 11), cursor="hand2",
            )
            t.pack(side=tk.LEFT, padx=4)
            t.bind("<Button-1>", lambda _, m=mode: self._set_mode(m))
            self._tabs[mode] = t

        self._style_all_tabs()

        # ── Display flip ────────────────────────────────────────
        display = tk.Frame(self._main, bg=COLORS["bg"])
        display.pack(pady=(28, 0))

        self._unit_h = FlipUnit(display, "HORAS", digit_size=90)
        self._unit_h.pack(side=tk.LEFT, padx=10)

        tk.Label(
            display, text=":", font=("Helvetica Neue", 52, "bold"),
            fg=COLORS["separator"], bg=COLORS["bg"],
        ).pack(side=tk.LEFT, padx=4, pady=(0, 28))

        self._unit_m = FlipUnit(display, "MIN", digit_size=90)
        self._unit_m.pack(side=tk.LEFT, padx=10)

        tk.Label(
            display, text=":", font=("Helvetica Neue", 52, "bold"),
            fg=COLORS["separator"], bg=COLORS["bg"],
        ).pack(side=tk.LEFT, padx=4, pady=(0, 28))

        self._unit_s = FlipUnit(display, "SEG", digit_size=90)
        self._unit_s.pack(side=tk.LEFT, padx=10)

        # ── Controles ──────────────────────────────────────────
        self._control_frame = tk.Frame(self._main, bg=COLORS["bg"])
        self._control_frame.pack(pady=(20, 0))

        self._input_frame = tk.Frame(self._control_frame, bg=COLORS["bg"])
        self._input_frame.pack()
        self._build_input_panel()

        action = tk.Frame(self._control_frame, bg=COLORS["bg"])
        action.pack(pady=(16, 0))

        self._btn_start = StyledButton(
            action, text="▶  Iniciar", width=160, height=44,
            bg_color=COLORS["green"], hover_color=COLORS["green_hover"],
            fg_color="#ffffff", font_spec=("Helvetica Neue", 13, "bold"),
            command=self._toggle,
        )
        self._btn_start.pack(side=tk.LEFT, padx=8)

        self._btn_reset = StyledButton(
            action, text="↺  Resetar", width=140, height=44,
            bg_color=COLORS["btn_surface"], hover_color=COLORS["btn_hover"],
            fg_color=COLORS["btn_text"], font_spec=("Helvetica Neue", 12),
            command=self._reset,
        )
        self._btn_reset.pack(side=tk.LEFT, padx=8)

        # Dica de atalhos
        shortcut_text = (
            "Espaço: iniciar/parar  ·  R: resetar  ·  ⌘↵ / F11: tela cheia  ·  Esc: sair"
            if IS_MAC else
            "Espaço: iniciar/parar  ·  R: resetar  ·  F11: tela cheia  ·  Esc: sair"
        )
        tk.Label(
            self._main,
            text=shortcut_text,
            font=("Helvetica Neue", 10), fg=COLORS["hint"], bg=COLORS["bg"],
        ).pack(pady=(16, 10))

    # ── Painel de entrada ───────────────────────────────────────
    def _build_input_panel(self):
        for w in self._input_frame.winfo_children():
            w.destroy()

        if self.mode != "countdown":
            return

        row1 = tk.Frame(self._input_frame, bg=COLORS["bg"])
        row1.pack(pady=(0, 8))

        entry_cfg = dict(
            width=3,
            font=("Courier", 16, "bold"),
            justify="center",
            bg=COLORS["input_bg"],
            fg=COLORS["digit"],
            insertbackground=COLORS["accent"],
            relief="flat",
            highlightthickness=2,
            highlightbackground=COLORS["input_border"],
            highlightcolor=COLORS["input_focus"],
            selectbackground=COLORS["accent"],
            selectforeground="#ffffff",
        )

        self._h_var = tk.StringVar(value="00")
        self._m_var = tk.StringVar(value="00")
        self._s_var = tk.StringVar(value="00")

        for i, (var, suffix) in enumerate([
            (self._h_var, "h"), (self._m_var, "m"), (self._s_var, "s")
        ]):
            e = tk.Entry(row1, textvariable=var, **entry_cfg)
            e.pack(side=tk.LEFT, padx=(0, 2))
            e.bind("<FocusIn>", lambda _, w=e: w.select_range(0, tk.END))
            e.bind("<FocusOut>", lambda _, v=var, ix=i: self._sanitize(v, ix))

            tk.Label(
                row1, text=suffix, font=("Helvetica Neue", 12),
                fg=COLORS["label"], bg=COLORS["bg"],
            ).pack(side=tk.LEFT, padx=(0, 10))

        apply_btn = StyledButton(
            row1, text="Aplicar", width=90, height=38,
            bg_color=COLORS["btn_surface"], hover_color=COLORS["btn_hover"],
            font_spec=("Helvetica Neue", 11), command=self._apply_input,
        )
        apply_btn.pack(side=tk.LEFT, padx=(10, 0))

        # Presets
        row2 = tk.Frame(self._input_frame, bg=COLORS["bg"])
        row2.pack(pady=(4, 0))

        presets = [
            ("1 min", 60), ("5 min", 300), ("10 min", 600),
            ("15 min", 900), ("25 min", 1500), ("45 min", 2700),
        ]
        for text, secs in presets:
            b = StyledButton(
                row2, text=text, width=72, height=32,
                bg_color=COLORS["preset_bg"], hover_color=COLORS["preset_hover"],
                font_spec=("Helvetica Neue", 10),
                command=lambda s=secs: self._set_preset(s),
            )
            b.pack(side=tk.LEFT, padx=3)

    # ── Estilo das abas ─────────────────────────────────────────
    def _style_all_tabs(self):
        for mode, tab in self._tabs.items():
            if mode == self.mode:
                tab.config(bg=COLORS["accent"], fg="#ffffff")
            else:
                tab.config(bg=COLORS["btn_surface"], fg=COLORS["digit"])

    # ── Atalhos ─────────────────────────────────────────────────
    def _bind_shortcuts(self):
        # Espaço e Enter só funcionam quando o foco NÃO está num Entry
        self.root.bind("<space>", self._on_space)
        self.root.bind("<Return>", self._on_enter)
        self.root.bind("<r>", self._on_r_key)
        self.root.bind("<R>", self._on_r_key)
        self.root.bind("<F11>", lambda _: self._toggle_fullscreen())
        self.root.bind("<Escape>", lambda _: self._exit_fullscreen())
        if IS_MAC:
            self.root.bind("<Command-f>", lambda _: self._toggle_fullscreen())
            self.root.bind("<Command-Return>", lambda _: self._toggle_fullscreen())

    def _on_space(self, event):
        """Espaço: iniciar/parar, MAS não se estiver digitando num Entry."""
        if isinstance(event.widget, tk.Entry):
            return  # deixa o comportamento normal do Entry
        self._toggle()
        return "break"

    def _on_enter(self, event):
        """Enter: aplica o tempo digitado."""
        if self.mode == "countdown" and not self.running:
            self._apply_input()
        return "break"

    def _on_r_key(self, event):
        """R: reseta, MAS não se estiver digitando num Entry."""
        if isinstance(event.widget, tk.Entry):
            return  # deixa digitar normalmente
        self._reset()
        return "break"

    # ── Tela cheia ──────────────────────────────────────────────
    def _toggle_fullscreen(self):
        self._is_fullscreen = not self._is_fullscreen
        if IS_MAC:
            # No macOS, -fullscreen pode causar crash dependendo da versão.
            # Usamos -zoomed + escondemos a barra de título como alternativa
            # segura, ou tentamos -fullscreen com fallback.
            try:
                self.root.attributes("-fullscreen", self._is_fullscreen)
            except tk.TclError:
                # Fallback: maximiza a janela
                self.root.attributes("-zoomed", self._is_fullscreen)
        else:
            self.root.attributes("-fullscreen", self._is_fullscreen)
        self._fs_btn.config(text="✕" if self._is_fullscreen else "⤢")

    def _exit_fullscreen(self):
        if self._is_fullscreen:
            self._is_fullscreen = False
            try:
                self.root.attributes("-fullscreen", False)
            except tk.TclError:
                self.root.attributes("-zoomed", False)
            self._fs_btn.config(text="⤢")

    # ─── LÓGICA ──────────────────────────────────────────────────
    def _set_mode(self, mode: str):
        if self.mode == mode:
            return
        self._stop_silent()
        self.mode = mode
        self.remaining_seconds = 0
        self.elapsed_seconds = 0
        self.total_seconds = 0

        self._style_all_tabs()
        self._build_input_panel()
        self._refresh_display()
        self._update_controls()

        if mode == "countdown":
            self._set_status("Contagem regressiva", COLORS["green"])
        else:
            self._set_status("Cronômetro", COLORS["accent"])

    def _sanitize(self, var: tk.StringVar, idx: int):
        raw = (var.get() or "0").strip()
        if not raw.isdigit():
            raw = "0"
        limit = MAX_HOURS if idx == 0 else 59
        var.set(str(max(0, min(limit, int(raw)))).zfill(2))

    def _apply_input(self):
        if self.mode != "countdown" or self.running:
            return
        for i, v in enumerate([self._h_var, self._m_var, self._s_var]):
            self._sanitize(v, i)

        h, m, s = int(self._h_var.get()), int(self._m_var.get()), int(self._s_var.get())
        secs = h * 3600 + m * 60 + s
        self.total_seconds = secs
        self.remaining_seconds = secs

        if secs <= 0:
            self._set_status("Defina um tempo válido", COLORS["amber"])
        else:
            self._set_status(f"Tempo: {h:02d}:{m:02d}:{s:02d}", COLORS["green"])

        self._refresh_display()
        self._update_controls()

    def _set_preset(self, seconds: int):
        if self.running or self.mode != "countdown":
            return
        self.total_seconds = seconds
        self.remaining_seconds = seconds
        h, m, s = _secs_to_hms(seconds)
        self._h_var.set(f"{h:02d}")
        self._m_var.set(f"{m:02d}")
        self._s_var.set(f"{s:02d}")
        self._set_status(f"Tempo: {h:02d}:{m:02d}:{s:02d}", COLORS["green"])
        self._refresh_display()
        self._update_controls()

    def _toggle(self):
        if self.running:
            self._stop()
        else:
            self._start()

    def _start(self):
        if self.mode == "countdown":
            if self.remaining_seconds <= 0:
                if not self.total_seconds:
                    self._apply_input()
                if self.remaining_seconds <= 0:
                    self._set_status("Defina um tempo primeiro", COLORS["amber"])
                    return
            self._target_time = time.monotonic() + self.remaining_seconds
            self._set_status("Contagem em andamento…", COLORS["green"])
        else:
            self._target_time = time.monotonic()
            self._base_elapsed = self.elapsed_seconds
            self._set_status("Cronômetro rodando…", COLORS["accent"])

        self.running = True
        self._update_controls()
        self._tick()

    def _stop(self):
        self._stop_silent()
        self._set_status("Pausado", COLORS["amber"])
        self._update_controls()
        self._refresh_display()

    def _stop_silent(self):
        if self.mode == "stopwatch" and self.running and self._target_time is not None:
            self.elapsed_seconds = max(0, int(round(
                self._base_elapsed + (time.monotonic() - self._target_time)
            )))
        self.running = False
        if self._job is not None:
            self.root.after_cancel(self._job)
            self._job = None

    def _reset(self):
        self._stop_silent()
        self.total_seconds = 0
        self.remaining_seconds = 0
        self.elapsed_seconds = 0
        self._target_time = None
        self._base_elapsed = 0

        if self.mode == "countdown" and hasattr(self, "_h_var"):
            self._h_var.set("00")
            self._m_var.set("00")
            self._s_var.set("00")

        self._set_status("Pronto", COLORS["green"])
        self._refresh_display()
        self._update_controls()

    def _tick(self):
        if not self.running:
            return

        now = time.monotonic()

        if self.mode == "countdown":
            left = max(0, int(self._target_time - now))
            self.remaining_seconds = left
            self._refresh_display()

            if left <= 0:
                self.running = False
                self._job = None
                self.total_seconds = 0
                self._update_controls()
                self._set_status("✓  Tempo finalizado!", COLORS["red"])
                self._flash_finish()
                self.root.bell()
                return
        else:
            elapsed_now = int(round(self._base_elapsed + (now - self._target_time)))
            self.elapsed_seconds = max(0, elapsed_now)
            self._refresh_display()

        self._job = self.root.after(TICK_MS, self._tick)

    def _refresh_display(self):
        secs = self.remaining_seconds if self.mode == "countdown" else self.elapsed_seconds
        h, m, s = _secs_to_hms(secs)
        self._unit_h.set(h)
        self._unit_m.set(m)
        self._unit_s.set(s)

    def _update_controls(self):
        if self.running:
            self._btn_start.configure_style(
                bg=COLORS["red"], hover=COLORS["red_hover"],
                text="■  Parar", fg="#ffffff",
            )
        else:
            can = self.mode == "stopwatch" or self.remaining_seconds > 0
            if not can and self.mode == "countdown" and hasattr(self, "_h_var"):
                for i, v in enumerate([self._h_var, self._m_var, self._s_var]):
                    self._sanitize(v, i)
                h = int(self._h_var.get())
                m = int(self._m_var.get())
                s = int(self._s_var.get())
                can = (h * 3600 + m * 60 + s) > 0

            self._btn_start.configure_style(
                bg=COLORS["green"] if can else "#30363d",
                hover=COLORS["green_hover"] if can else "#30363d",
                text="▶  Iniciar", fg="#ffffff", enabled=can,
            )

    def _set_status(self, text: str, color: str):
        self._status_var.set(text)
        self._status_lbl.config(fg=color)
        self._status_dot.itemconfig(self._dot_id, fill=color)

    def _flash_finish(self):
        palette = [COLORS["digit"], COLORS["red"]] * 3 + [COLORS["digit"]]
        for i, c in enumerate(palette):
            self.root.after(i * 200, lambda col=c: self._set_digit_color(col))

    def _set_digit_color(self, color: str):
        for unit in (self._unit_h, self._unit_m, self._unit_s):
            for d in unit._digits:
                for item in d.find_all():
                    if d.type(item) == "text":
                        d.itemconfig(item, fill=color)

    def _update_clock(self):
        self._date_var.set(time.strftime("%d/%m/%Y  %H:%M:%S"))
        self.root.after(1000, self._update_clock)


# ═══════════════════════════════════════════════════════════════════
#  ENTRY POINT
# ═══════════════════════════════════════════════════════════════════
if __name__ == "__main__":
    root = tk.Tk()
    root.update_idletasks()
    sw, sh = root.winfo_screenwidth(), root.winfo_screenheight()
    x = (sw - WINDOW_MIN_W) // 2
    y = (sh - WINDOW_MIN_H) // 2
    root.geometry(f"{WINDOW_MIN_W}x{WINDOW_MIN_H}+{x}+{y}")

    app = FlipClockApp(root)
    root.mainloop()
