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

WINDOW_MIN_W = 320
WINDOW_MIN_H = 220
BASE_W = 900
BASE_H = 660
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
        self._digit_h = int(size * 1.25)
        self._value = ""
        self._font = tkfont.Font(
            family="Helvetica Neue", size=int(size * 0.68), weight="bold"
        )
        self._draw("0")

    def _draw(self, digit: str):
        self.delete("all")
        self._value = digit
        s, h = self._size, self._digit_h
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
            self._draw(digit)

    def resize(self, size: int):
        size = max(26, min(210, int(size)))
        if size == self._size:
            return
        self._size = size
        self._digit_h = int(size * 1.25)
        self._font.configure(size=int(size * 0.68))
        self.config(width=self._size, height=self._digit_h)
        self._draw(self._value or "0")


# ═══════════════════════════════════════════════════════════════════
#  FLIP UNIT – Par de dígitos + rótulo
# ═══════════════════════════════════════════════════════════════════
class FlipUnit(tk.Frame):
    def __init__(self, parent, label: str, digit_size=100, **kw):
        super().__init__(parent, bg=COLORS["bg"], **kw)
        self._digits: list[FlipDigit] = []
        self._digit_pad = 2

        row = tk.Frame(self, bg=COLORS["bg"])
        row.pack()
        self._row = row

        for _ in range(2):
            d = FlipDigit(row, size=digit_size)
            d.pack(side=tk.LEFT, padx=self._digit_pad)
            self._digits.append(d)

        self._label_font = tkfont.Font(family="Helvetica Neue", size=10, weight="bold")
        self._label = tk.Label(
            self, text=label,
            font=self._label_font,
            fg=COLORS["label"], bg=COLORS["bg"],
        )
        self._label.pack(pady=(6, 0))

    def set(self, value: int):
        s = str(max(0, value)).zfill(2)
        self._digits[0].set(s[0])
        self._digits[1].set(s[1])

    def resize(self, digit_size: int, label_size: int, digit_pad: int):
        for d in self._digits:
            d.resize(digit_size)
            d.pack_configure(padx=digit_pad)
        self._label_font.configure(size=max(8, int(label_size)))
        self._label.pack_configure(pady=(max(4, int(digit_pad) + 2), 0))


# ═══════════════════════════════════════════════════════════════════
#  FOCUS CARD – visual imersivo (estilo print de referência)
# ═══════════════════════════════════════════════════════════════════
class FocusCard(tk.Canvas):
    def __init__(self, parent, width=500, height=420, **kw):
        super().__init__(
            parent,
            width=width,
            height=height,
            bg=COLORS["bg"],
            bd=0,
            highlightthickness=0,
            **kw,
        )
        self._card_w = width
        self._card_h = height
        self._value = "00"
        self._corner = ""
        self._font = tkfont.Font(family="Helvetica Neue", size=180, weight="bold")
        self._corner_font = tkfont.Font(family="Helvetica Neue", size=28, weight="bold")
        self._draw()

    def _rounded_rect(self, x1, y1, x2, y2, r, **kw):
        pts = [
            x1 + r, y1, x2 - r, y1, x2, y1, x2, y1 + r,
            x2, y2 - r, x2, y2, x2 - r, y2, x1 + r, y2,
            x1, y2, x1, y2 - r, x1, y1 + r, x1, y1,
        ]
        return self.create_polygon(pts, smooth=True, **kw)

    def _draw(self):
        self.delete("all")
        w, h = self._card_w, self._card_h
        pad = max(2, int(min(w, h) * 0.01))
        radius = max(14, int(min(w, h) * 0.08))
        line_w = max(2, int(h * 0.010))

        # Sombra traseira
        self._rounded_rect(
            pad + 2, pad + 3, w - pad + 2, h - pad + 1, radius,
            fill="#03050a", outline="",
        )
        # Card principal
        self._rounded_rect(
            pad, pad, w - pad, h - pad, radius,
            fill="#0a0e16", outline="#141a26", width=1,
        )
        # Linha central do flip
        self.create_line(
            pad + 6, h // 2, w - pad - 6, h // 2,
            fill="#060a0f", width=line_w,
        )
        # Pontinhos de eixo
        for x in (pad + 12, w - pad - 12):
            self.create_oval(x - 2, h // 2 - 2, x + 2, h // 2 + 2,
                             fill="#1a2030", outline="")
        # Dígito principal
        self.create_text(
            w // 2, int(h * 0.50),
            text=self._value, font=self._font, fill="#c8cdd3",
        )
        # Canto inferior direito (segundos)
        if self._corner:
            margin = max(12, int(min(w, h) * 0.06))
            self.create_text(
                w - pad - margin, h - pad - margin,
                text=self._corner, anchor="se",
                font=self._corner_font, fill="#5a5d64",
            )

    def set(self, value: str, corner: str = ""):
        value = str(value).zfill(2)[-2:]
        if value == self._value and corner == self._corner:
            return
        self._value = value
        self._corner = corner
        self._draw()

    def resize(self, width: int, height: int, font_size: int, corner_size: int):
        self._card_w = max(56, int(width))
        self._card_h = max(52, int(height))
        self.config(width=self._card_w, height=self._card_h)
        self._font.configure(size=max(10, int(font_size)))
        self._corner_font.configure(size=max(6, int(corner_size)))
        self._draw()


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
        self._btn_w = width
        self._btn_h = height
        self._bg = bg_color
        self._fg = fg_color
        self._hover_bg = hover_color or _brighten(bg_color, 15)
        if isinstance(font_spec, tkfont.Font):
            self._font = font_spec
        else:
            self._font = tkfont.Font(font=font_spec or ("Helvetica Neue", 12, "bold"))
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
        r, w, h = 10, self._btn_w, self._btn_h
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

    def resize(self, width=None, height=None, font_size=None):
        if width is not None:
            self._btn_w = max(56, int(width))
            self.config(width=self._btn_w)
        if height is not None:
            self._btn_h = max(26, int(height))
            self.config(height=self._btn_h)
        if font_size is not None:
            self._font.configure(size=max(8, int(font_size)))
        self._render()


# ═══════════════════════════════════════════════════════════════════
#  APLICAÇÃO PRINCIPAL
# ═══════════════════════════════════════════════════════════════════
class FlipClockApp:
    def __init__(self, root: tk.Tk):
        self.root = root
        self.root.title("Contador Flip")
        self.root.configure(bg=COLORS["bg"])
        self._setup_window_icon()
        self.root.minsize(WINDOW_MIN_W, WINDOW_MIN_H)
        self.root.geometry(f"{WINDOW_MIN_W}x{WINDOW_MIN_H}")
        self.root.resizable(True, True)

        # Estado
        self.mode = "stopwatch"
        self.running = False
        self.total_seconds = 0
        self.remaining_seconds = 0
        self.elapsed_seconds = 0
        self._target_time = None
        self._base_elapsed = 0
        self._job = None
        self._is_fullscreen = False
        self._resize_job = None
        self._immersive_stopwatch = False
        self._settings_open = False

        self._date_var = tk.StringVar()
        self._status_var = tk.StringVar(value="Cronômetro")
        self._cfg_show_corner_seconds = tk.BooleanVar(value=True)
        self._cfg_digit_scale = tk.DoubleVar(value=1.0)
        self._cfg_gap_scale = tk.DoubleVar(value=1.0)
        self._cfg_cd_h = tk.StringVar(value="00")
        self._cfg_cd_m = tk.StringVar(value="00")
        self._cfg_cd_s = tk.StringVar(value="00")

        self._build_ui()
        self._bind_shortcuts()
        self.root.bind("<Configure>", self._on_window_configure)
        self._update_clock()
        self._refresh_display()
        self._update_controls()
        self.root.after(80, self._apply_responsive_layout)

    def _setup_window_icon(self):
        """Cria um ícone simples do app sem depender de arquivo externo."""
        try:
            icon = tk.PhotoImage(width=32, height=32)
            icon.put(COLORS["bg"], to=(0, 0, 32, 32))
            icon.put("#111a2b", to=(2, 2, 30, 30))
            icon.put(COLORS["accent"], to=(4, 4, 28, 28))
            icon.put("#0f1626", to=(6, 6, 26, 26))
            # Ponteiros do relógio
            icon.put(COLORS["digit"], to=(15, 9, 17, 17))
            icon.put(COLORS["digit"], to=(16, 15, 23, 17))
            # Pequeno marcador
            icon.put(COLORS["green"], to=(7, 7, 10, 10))
            self._icon_image = icon
            self.root.iconphoto(True, self._icon_image)
        except tk.TclError:
            pass

    # ─── CONSTRUÇÃO DA UI ────────────────────────────────────────
    def _build_ui(self):
        self._main = tk.Frame(self.root, bg=COLORS["bg"])
        self._main.pack(fill=tk.BOTH, expand=True)

        # ── Barra superior ──────────────────────────────────────
        header = tk.Frame(self._main, bg=COLORS["surface"])
        header.pack(fill=tk.X, padx=20, pady=(16, 0), ipady=12)
        self._header = header

        left = tk.Frame(header, bg=COLORS["surface"])
        left.pack(side=tk.LEFT, padx=20, fill=tk.Y)

        self._title_font = tkfont.Font(family="Helvetica Neue", size=15, weight="bold")
        self._date_font = tkfont.Font(family="Courier", size=11)
        self._status_font = tkfont.Font(family="Helvetica Neue", size=11)
        self._tab_font = tkfont.Font(family="Helvetica Neue", size=11)
        self._sep_font = tkfont.Font(family="Helvetica Neue", size=52, weight="bold")
        self._shortcut_font = tkfont.Font(family="Helvetica Neue", size=10)

        self._title_lbl = tk.Label(
            left, text="CONTADOR FLIP",
            font=self._title_font,
            fg=COLORS["digit"], bg=COLORS["surface"],
        )
        self._title_lbl.pack(anchor="w")

        self._date_lbl = tk.Label(
            left, textvariable=self._date_var,
            font=self._date_font, fg=COLORS["label"], bg=COLORS["surface"],
        )
        self._date_lbl.pack(anchor="w", pady=(2, 0))

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
            font=self._status_font, fg=COLORS["green"], bg=COLORS["surface"],
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
        self._tab_frame = tab_frame

        self._tabs = {}
        for mode, label in [("countdown", "  Contagem regressiva  "), ("stopwatch", "  Cronômetro  ")]:
            t = tk.Label(
                tab_frame, text=label, padx=18, pady=7,
                font=self._tab_font, cursor="hand2",
            )
            t.pack(side=tk.LEFT, padx=4)
            t.bind("<Button-1>", lambda _, m=mode: self._set_mode(m))
            self._tabs[mode] = t

        self._style_all_tabs()

        # ── Display flip ────────────────────────────────────────
        display = tk.Frame(self._main, bg=COLORS["bg"])
        display.pack(pady=(28, 0))
        self._display = display

        self._unit_h = FlipUnit(display, "HORAS", digit_size=90)
        self._unit_h.pack(side=tk.LEFT, padx=10)

        self._sep1 = tk.Label(
            display, text=":", font=self._sep_font,
            fg=COLORS["separator"], bg=COLORS["bg"],
        )
        self._sep1.pack(side=tk.LEFT, padx=4, pady=(0, 28))

        self._unit_m = FlipUnit(display, "MIN", digit_size=90)
        self._unit_m.pack(side=tk.LEFT, padx=10)

        self._sep2 = tk.Label(
            display, text=":", font=self._sep_font,
            fg=COLORS["separator"], bg=COLORS["bg"],
        )
        self._sep2.pack(side=tk.LEFT, padx=4, pady=(0, 28))

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
        self._shortcut_lbl = tk.Label(
            self._main,
            text=shortcut_text,
            font=self._shortcut_font, fg=COLORS["hint"], bg=COLORS["bg"],
        )
        self._shortcut_lbl.pack(pady=(16, 10))

        # Área imersiva para cronômetro (referência dos prints)
        self._focus_container = tk.Frame(self._main, bg=COLORS["bg"])
        self._focus_left = FocusCard(self._focus_container)
        self._focus_right = FocusCard(self._focus_container)
        self._app_icon_lbl = tk.Label(
            self._focus_container,
            text="⏱",
            font=("Helvetica Neue", 16),
            fg=COLORS["label"],
            bg=COLORS["bg"],
        )
        self._build_settings_area()
        self._apply_mode_visibility()

    # ── Painel de entrada ───────────────────────────────────────
    def _build_input_panel(self):
        for w in self._input_frame.winfo_children():
            w.destroy()
        self._input_entries = []
        self._input_suffix_labels = []
        self._preset_buttons = []
        self._apply_btn = None

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
            self._input_entries.append(e)

            suffix_lbl = tk.Label(
                row1, text=suffix, font=("Helvetica Neue", 12),
                fg=COLORS["label"], bg=COLORS["bg"],
            )
            suffix_lbl.pack(side=tk.LEFT, padx=(0, 10))
            self._input_suffix_labels.append(suffix_lbl)

        apply_btn = StyledButton(
            row1, text="Aplicar", width=90, height=38,
            bg_color=COLORS["btn_surface"], hover_color=COLORS["btn_hover"],
            font_spec=("Helvetica Neue", 11), command=self._apply_input,
        )
        apply_btn.pack(side=tk.LEFT, padx=(10, 0))
        self._apply_btn = apply_btn

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
            self._preset_buttons.append(b)

    # ── Estilo das abas ─────────────────────────────────────────
    def _style_all_tabs(self):
        for mode, tab in self._tabs.items():
            if mode == self.mode:
                tab.config(bg=COLORS["accent"], fg="#ffffff")
            else:
                tab.config(bg=COLORS["btn_surface"], fg=COLORS["digit"])

    def _apply_mode_visibility(self):
        # Modo imersivo sempre ativo
        want_immersive = True

        if want_immersive == self._immersive_stopwatch:
            if want_immersive:
                self._position_settings_widgets()
            return

        self._immersive_stopwatch = want_immersive
        if want_immersive:
            for w in (self._header, self._tab_frame, self._display, self._control_frame, self._shortcut_lbl):
                if w.winfo_manager():
                    w.pack_forget()
            if not self._focus_container.winfo_manager():
                self._focus_container.pack(fill=tk.BOTH, expand=True, padx=16, pady=16)
            self._position_settings_widgets()
        else:
            self._focus_container.pack_forget()
            if not self._header.winfo_manager():
                self._header.pack(fill=tk.X, padx=20, pady=(16, 0), ipady=12)
            if not self._tab_frame.winfo_manager():
                self._tab_frame.pack(pady=(20, 0))
            if not self._display.winfo_manager():
                self._display.pack(pady=(28, 0))
            if not self._control_frame.winfo_manager():
                self._control_frame.pack(pady=(20, 0))
            if not self._shortcut_lbl.winfo_manager():
                self._shortcut_lbl.pack(pady=(16, 10))

    def _layout_focus_cards(self):
        if not self._focus_container.winfo_manager():
            return

        self._focus_left.place_forget()
        self._focus_right.place_forget()

        self._focus_container.update_idletasks()
        w = max(self._focus_container.winfo_width(), 1)
        h = max(self._focus_container.winfo_height(), 1)

        gap_scale = max(0.5, min(2.0, float(self._cfg_gap_scale.get() or 1.0)))
        digit_scale = max(0.5, min(1.5, float(self._cfg_digit_scale.get() or 1.0)))

        gap = max(4, int(min(w, h) * 0.022 * gap_scale))

        side_reserved = 0
        if self._settings_open and w >= 560:
            panel_w = max(220, min(320, int(w * 0.38)))
            side_reserved = panel_w + gap

        usable_w = max(84, w - side_reserved)
        landscape = usable_w >= int(h * 1.18)

        if landscape:
            card_w = max(84, int((usable_w - (gap * 3)) / 2))
            card_h = max(70, int(h * 0.78))
            y = max(gap, (h - card_h) // 2)
            x1 = gap
            x2 = x1 + card_w + gap

            # Tamanho base do font limitado ao card, depois aplica escala
            base_font = min(int(card_w * 0.72), int(card_h * 0.70))
            font_size = max(20, int(base_font * digit_scale))
            corner_size = max(8, int(font_size * 0.16))

            self._focus_left.resize(card_w, card_h, font_size, corner_size)
            self._focus_right.resize(card_w, card_h, font_size, corner_size)
            self._focus_left.place(x=x1, y=y, width=card_w, height=card_h)
            self._focus_right.place(x=x2, y=y, width=card_w, height=card_h)
        else:
            card_w = max(76, int(usable_w * 0.88))
            card_h = max(68, int((h - (gap * 3)) / 2))
            x = max(gap, (usable_w - card_w) // 2)
            y1 = gap
            y2 = y1 + card_h + gap

            base_font = min(int(card_w * 0.68), int(card_h * 0.66))
            font_size = max(20, int(base_font * digit_scale))
            corner_size = max(8, int(font_size * 0.16))

            self._focus_left.resize(card_w, card_h, font_size, corner_size)
            self._focus_right.resize(card_w, card_h, font_size, corner_size)
            self._focus_left.place(x=x, y=y1, width=card_w, height=card_h)
            self._focus_right.place(x=x, y=y2, width=card_w, height=card_h)

    # ── Slider customizado (Canvas) ──────────────────────────────
    def _create_custom_slider(self, parent, variable, from_=0.0, to=1.0,
                               resolution=0.05, label_text="", on_change=None):
        """Cria um slider bonito usando Canvas, sem tk.Scale nativo."""
        frame = tk.Frame(parent, bg=COLORS["surface"])

        # Label + valor
        top_row = tk.Frame(frame, bg=COLORS["surface"])
        top_row.pack(fill=tk.X, padx=0)
        lbl = tk.Label(top_row, text=label_text,
                       font=("Helvetica Neue", 10), fg=COLORS["label"],
                       bg=COLORS["surface"])
        lbl.pack(side=tk.LEFT)
        val_lbl = tk.Label(top_row, text=f"{variable.get():.2f}",
                           font=("Courier", 10, "bold"), fg=COLORS["accent"],
                           bg=COLORS["surface"])
        val_lbl.pack(side=tk.RIGHT)

        track_h = 6
        thumb_r = 8
        canvas_h = thumb_r * 2 + 4
        canvas = tk.Canvas(frame, height=canvas_h, bg=COLORS["surface"],
                           bd=0, highlightthickness=0)
        canvas.pack(fill=tk.X, pady=(4, 0))

        slider_data = {"dragging": False}

        def _val_to_x(val):
            cw = max(canvas.winfo_width(), 60)
            margin = thumb_r + 2
            frac = (val - from_) / max(0.001, to - from_)
            return margin + frac * (cw - 2 * margin)

        def _x_to_val(x):
            cw = max(canvas.winfo_width(), 60)
            margin = thumb_r + 2
            frac = (x - margin) / max(1, cw - 2 * margin)
            frac = max(0.0, min(1.0, frac))
            raw = from_ + frac * (to - from_)
            steps = round((raw - from_) / resolution)
            return from_ + steps * resolution

        def _draw_slider(_event=None):
            canvas.delete("all")
            cw = max(canvas.winfo_width(), 60)
            margin = thumb_r + 2
            cy = canvas_h // 2
            val = variable.get()

            # Trilho (fundo)
            canvas.create_line(margin, cy, cw - margin, cy,
                               fill=COLORS["btn_surface"], width=track_h,
                               capstyle="round")
            # Trilho (preenchido)
            tx = _val_to_x(val)
            canvas.create_line(margin, cy, tx, cy,
                               fill=COLORS["accent"], width=track_h,
                               capstyle="round")
            # Thumb
            canvas.create_oval(tx - thumb_r, cy - thumb_r,
                               tx + thumb_r, cy + thumb_r,
                               fill=COLORS["digit"], outline=COLORS["accent"],
                               width=2, tags="thumb")

        def _on_press(event):
            slider_data["dragging"] = True
            _update_from_x(event.x)

        def _on_drag(event):
            if slider_data["dragging"]:
                _update_from_x(event.x)

        def _on_release(_event):
            slider_data["dragging"] = False

        def _update_from_x(x):
            val = _x_to_val(x)
            val = max(from_, min(to, val))
            variable.set(round(val, 2))
            val_lbl.config(text=f"{val:.2f}")
            _draw_slider()
            if on_change:
                on_change()

        canvas.bind("<ButtonPress-1>", _on_press)
        canvas.bind("<B1-Motion>", _on_drag)
        canvas.bind("<ButtonRelease-1>", _on_release)
        canvas.bind("<Configure>", _draw_slider)

        # Guardar referência para redimensionamento
        frame._slider_canvas = canvas
        frame._slider_draw = _draw_slider

        return frame

    # ── Toggle customizado (Canvas) ──────────────────────────────
    def _create_custom_toggle(self, parent, variable, label_text="", on_change=None):
        """Cria um toggle switch bonito usando Canvas."""
        frame = tk.Frame(parent, bg=COLORS["surface"])

        toggle_w, toggle_h = 40, 22
        canvas = tk.Canvas(frame, width=toggle_w, height=toggle_h,
                           bg=COLORS["surface"], bd=0, highlightthickness=0)
        canvas.pack(side=tk.LEFT, padx=(0, 8))

        lbl = tk.Label(frame, text=label_text,
                       font=("Helvetica Neue", 10), fg=COLORS["digit"],
                       bg=COLORS["surface"], cursor="hand2")
        lbl.pack(side=tk.LEFT)

        def _draw_toggle():
            canvas.delete("all")
            on = variable.get()
            bg_c = COLORS["accent"] if on else COLORS["btn_surface"]
            thumb_x = toggle_w - 12 if on else 12
            # Track
            r = toggle_h // 2
            canvas.create_oval(1, 1, toggle_h - 1, toggle_h - 1,
                               fill=bg_c, outline="")
            canvas.create_oval(toggle_w - toggle_h + 1, 1,
                               toggle_w - 1, toggle_h - 1,
                               fill=bg_c, outline="")
            canvas.create_rectangle(r, 1, toggle_w - r, toggle_h - 1,
                                    fill=bg_c, outline="")
            # Thumb
            canvas.create_oval(thumb_x - 8, toggle_h // 2 - 8,
                               thumb_x + 8, toggle_h // 2 + 8,
                               fill="#ffffff", outline="")

        def _on_click(_event=None):
            variable.set(not variable.get())
            _draw_toggle()
            if on_change:
                on_change()

        canvas.bind("<Button-1>", _on_click)
        lbl.bind("<Button-1>", _on_click)
        canvas.config(cursor="hand2")

        _draw_toggle()
        frame._toggle_draw = _draw_toggle
        return frame

    # ── Botão plano estilizado ───────────────────────────────────
    def _flat_btn(self, parent, text, command, accent=False, full_width=False):
        """Cria um botão plano com estilo consistente."""
        bg = COLORS["accent"] if accent else COLORS["btn_surface"]
        hover = _brighten(bg, 18)
        fg = "#ffffff" if accent else COLORS["btn_text"]

        btn = tk.Label(
            parent, text=text,
            font=("Helvetica Neue", 10, "bold" if accent else "normal"),
            fg=fg, bg=bg,
            padx=14, pady=6,
            cursor="hand2",
        )

        def _enter(_): btn.config(bg=hover)
        def _leave(_): btn.config(bg=bg)
        def _click(_): command()

        btn.bind("<Enter>", _enter)
        btn.bind("<Leave>", _leave)
        btn.bind("<Button-1>", _click)

        return btn

    def _build_settings_area(self):
        # ── Botão de engrenagem ─────────────────────────────
        self._settings_btn = tk.Label(
            self._focus_container,
            text="⚙",
            font=("Helvetica Neue", 18),
            fg=COLORS["label"],
            bg=COLORS["bg"],
            cursor="hand2",
        )
        self._settings_btn.bind("<Button-1>", lambda _: self._toggle_settings())
        self._settings_btn.bind("<Enter>", lambda _: self._settings_btn.config(fg=COLORS["accent"]))
        self._settings_btn.bind("<Leave>", lambda _: self._settings_btn.config(fg=COLORS["label"]))

        # ── Painel principal ────────────────────────────────
        self._settings_panel = tk.Frame(
            self._focus_container,
            bg=COLORS["surface"],
            highlightthickness=0,
        )

        # Scrollable interior
        inner = tk.Frame(self._settings_panel, bg=COLORS["surface"])
        inner.pack(fill=tk.BOTH, expand=True, padx=0, pady=0)
        self._settings_inner = inner

        # ── Cabeçalho ───────────────────────────────────────
        hdr = tk.Frame(inner, bg=COLORS["surface"])
        hdr.pack(fill=tk.X, padx=16, pady=(14, 4))

        tk.Label(hdr, text="⚙", font=("Helvetica Neue", 14),
                 fg=COLORS["accent"], bg=COLORS["surface"]
                 ).pack(side=tk.LEFT, padx=(0, 6))
        tk.Label(hdr, text="Configurações",
                 font=("Helvetica Neue", 13, "bold"),
                 fg=COLORS["digit"], bg=COLORS["surface"]
                 ).pack(side=tk.LEFT)

        close_x = tk.Label(hdr, text="✕", font=("Helvetica Neue", 14),
                           fg=COLORS["label"], bg=COLORS["surface"],
                           cursor="hand2")
        close_x.pack(side=tk.RIGHT)
        close_x.bind("<Button-1>", lambda _: self._toggle_settings())
        close_x.bind("<Enter>", lambda _: close_x.config(fg=COLORS["red"]))
        close_x.bind("<Leave>", lambda _: close_x.config(fg=COLORS["label"]))

        # Linha divisória fina
        tk.Frame(inner, bg=COLORS["divider"], height=1).pack(fill=tk.X, padx=12, pady=(8, 0))

        # ── Seção: Aparência ────────────────────────────────
        sec1 = tk.Label(inner, text="APARÊNCIA",
                        font=("Helvetica Neue", 9, "bold"),
                        fg=COLORS["hint"], bg=COLORS["surface"])
        sec1.pack(anchor="w", padx=16, pady=(14, 6))

        # Toggle: Mostrar segundos
        self._toggle_corner = self._create_custom_toggle(
            inner, self._cfg_show_corner_seconds,
            label_text="Segundos no canto",
            on_change=self._on_settings_change,
        )
        self._toggle_corner.pack(anchor="w", padx=16, pady=(0, 10))

        # Slider: Escala dos dígitos
        self._slider_digit = self._create_custom_slider(
            inner, self._cfg_digit_scale,
            from_=0.5, to=1.5, resolution=0.05,
            label_text="Escala dos dígitos",
            on_change=self._on_settings_change,
        )
        self._slider_digit.pack(fill=tk.X, padx=16, pady=(0, 8))

        # Slider: Espaçamento
        self._slider_gap = self._create_custom_slider(
            inner, self._cfg_gap_scale,
            from_=0.5, to=2.0, resolution=0.05,
            label_text="Espaçamento",
            on_change=self._on_settings_change,
        )
        self._slider_gap.pack(fill=tk.X, padx=16, pady=(0, 6))

        # Linha divisória
        tk.Frame(inner, bg=COLORS["divider"], height=1).pack(fill=tk.X, padx=12, pady=(6, 0))

        # ── Seção: Modo ─────────────────────────────────────
        sec2 = tk.Label(inner, text="MODO",
                        font=("Helvetica Neue", 9, "bold"),
                        fg=COLORS["hint"], bg=COLORS["surface"])
        sec2.pack(anchor="w", padx=16, pady=(12, 6))

        mode_row = tk.Frame(inner, bg=COLORS["surface"])
        mode_row.pack(fill=tk.X, padx=16, pady=(0, 6))

        self._mode_btn_sw = self._flat_btn(mode_row, "⏱  Cronômetro",
                                            lambda: self._set_mode("stopwatch"))
        self._mode_btn_sw.pack(side=tk.LEFT, padx=(0, 6))
        self._mode_btn_cd = self._flat_btn(mode_row, "⏳  Regressivo",
                                            lambda: self._set_mode("countdown"))
        self._mode_btn_cd.pack(side=tk.LEFT)

        # Linha divisória
        tk.Frame(inner, bg=COLORS["divider"], height=1).pack(fill=tk.X, padx=12, pady=(8, 0))

        # ── Seção: Tempo regressivo ─────────────────────────
        sec3 = tk.Label(inner, text="TEMPO REGRESSIVO",
                        font=("Helvetica Neue", 9, "bold"),
                        fg=COLORS["hint"], bg=COLORS["surface"])
        sec3.pack(anchor="w", padx=16, pady=(12, 6))

        cd_row = tk.Frame(inner, bg=COLORS["surface"])
        cd_row.pack(fill=tk.X, padx=16, pady=(0, 8))

        entry_cfg = dict(
            width=3,
            justify="center",
            font=("Courier", 13, "bold"),
            bg=COLORS["input_bg"],
            fg=COLORS["digit"],
            insertbackground=COLORS["accent"],
            relief="flat",
            highlightthickness=2,
            highlightbackground=COLORS["input_border"],
            highlightcolor=COLORS["input_focus"],
        )
        self._cfg_entry_h = tk.Entry(cd_row, textvariable=self._cfg_cd_h, **entry_cfg)
        self._cfg_entry_m = tk.Entry(cd_row, textvariable=self._cfg_cd_m, **entry_cfg)
        self._cfg_entry_s = tk.Entry(cd_row, textvariable=self._cfg_cd_s, **entry_cfg)
        for entry, suffix in ((self._cfg_entry_h, "h"), (self._cfg_entry_m, "m"), (self._cfg_entry_s, "s")):
            entry.pack(side=tk.LEFT, padx=(0, 1))
            tk.Label(cd_row, text=suffix,
                     font=("Helvetica Neue", 10, "bold"),
                     fg=COLORS["label"], bg=COLORS["surface"]
                     ).pack(side=tk.LEFT, padx=(0, 8))

        apply_cd = self._flat_btn(inner, "↳  Aplicar tempo",
                                   self._apply_countdown_from_settings, accent=True)
        apply_cd.pack(anchor="w", padx=16, pady=(0, 8))

        # Presets
        preset_frame = tk.Frame(inner, bg=COLORS["surface"])
        preset_frame.pack(fill=tk.X, padx=16, pady=(0, 6))
        for label, secs in (("1 min", 60), ("5 min", 300), ("10 min", 600), ("25 min", 1500)):
            b = self._flat_btn(preset_frame, label,
                                lambda s=secs: self._set_preset(s))
            b.config(padx=8, pady=4, font=("Helvetica Neue", 9))
            b.pack(side=tk.LEFT, padx=(0, 4))

        # Linha divisória
        tk.Frame(inner, bg=COLORS["divider"], height=1).pack(fill=tk.X, padx=12, pady=(8, 0))

        # ── Seção: Controles ────────────────────────────────
        sec4 = tk.Label(inner, text="CONTROLES",
                        font=("Helvetica Neue", 9, "bold"),
                        fg=COLORS["hint"], bg=COLORS["surface"])
        sec4.pack(anchor="w", padx=16, pady=(12, 6))

        ctrl_row = tk.Frame(inner, bg=COLORS["surface"])
        ctrl_row.pack(fill=tk.X, padx=16, pady=(0, 8))

        start_btn = self._flat_btn(ctrl_row, "▶  Iniciar / Parar",
                                    self._toggle, accent=True)
        start_btn.pack(side=tk.LEFT, padx=(0, 6))

        reset_btn = self._flat_btn(ctrl_row, "↺  Resetar", self._reset)
        reset_btn.pack(side=tk.LEFT)

        # ── Rodapé com atalhos ──────────────────────────────
        tk.Frame(inner, bg=COLORS["divider"], height=1).pack(fill=tk.X, padx=12, pady=(10, 0))

        shortcuts = "Espaço: play/pause · R: reset · F11: fullscreen"
        tk.Label(inner, text=shortcuts,
                 font=("Helvetica Neue", 8), fg=COLORS["hint"],
                 bg=COLORS["surface"], wraplength=260, justify="center"
                 ).pack(padx=16, pady=(8, 12))

    def _toggle_settings(self):
        self._settings_open = not self._settings_open
        self._apply_responsive_layout()

    def _on_settings_change(self):
        self._refresh_display()
        self._apply_responsive_layout()

    def _sync_countdown_vars(self, h: int, m: int, s: int):
        self._cfg_cd_h.set(f"{h:02d}")
        self._cfg_cd_m.set(f"{m:02d}")
        self._cfg_cd_s.set(f"{s:02d}")
        if hasattr(self, "_h_var"):
            self._h_var.set(f"{h:02d}")
            self._m_var.set(f"{m:02d}")
            self._s_var.set(f"{s:02d}")

    def _apply_countdown_from_settings(self):
        if self.mode != "countdown":
            self._set_mode("countdown")
            return
        if self.running:
            return

        raw = [self._cfg_cd_h.get(), self._cfg_cd_m.get(), self._cfg_cd_s.get()]
        vals = []
        for i, token in enumerate(raw):
            token = (token or "0").strip()
            if not token.isdigit():
                token = "0"
            num = int(token)
            limit = MAX_HOURS if i == 0 else 59
            vals.append(max(0, min(limit, num)))

        h, m, s = vals
        secs = h * 3600 + m * 60 + s
        self.total_seconds = secs
        self.remaining_seconds = secs
        self.elapsed_seconds = 0
        self._sync_countdown_vars(h, m, s)

        if secs <= 0:
            self._set_status("Defina um tempo válido", COLORS["amber"])
        else:
            self._set_status(f"Tempo: {h:02d}:{m:02d}:{s:02d}", COLORS["green"])
        self._refresh_display()
        self._update_controls()

    def _position_settings_widgets(self):
        if not self._focus_container.winfo_manager():
            self._app_icon_lbl.place_forget()
            self._settings_btn.place_forget()
            self._settings_panel.place_forget()
            return

        self._focus_container.update_idletasks()
        w = max(self._focus_container.winfo_width(), 1)
        h = max(self._focus_container.winfo_height(), 1)
        margin = max(4, int(min(w, h) * 0.012))
        panel_w = max(220, min(320, int(w * 0.38)))
        panel_h = max(160, min(int(h * 0.96), h - margin * 2))

        self._app_icon_lbl.config(font=("Helvetica Neue", max(10, int(16 * min(w / 900, h / 660)))))
        self._app_icon_lbl.place(x=margin, y=margin, anchor="nw")

        self._settings_btn.place(x=w - margin, y=margin, anchor="ne")
        if self._settings_open:
            self._settings_panel.place(
                x=w - panel_w - margin,
                y=margin + 26,
                width=panel_w,
                height=panel_h,
            )
        else:
            self._settings_panel.place_forget()

    # ── Atalhos ─────────────────────────────────────────────────
    def _bind_shortcuts(self):
        # Espaço e Enter só funcionam quando o foco NÃO está num Entry
        self.root.bind("<space>", self._on_space)
        self.root.bind("<Return>", self._on_enter)
        self.root.bind("<r>", self._on_r_key)
        self.root.bind("<R>", self._on_r_key)
        self.root.bind("<s>", lambda _: self._set_mode("stopwatch"))
        self.root.bind("<S>", lambda _: self._set_mode("stopwatch"))
        self.root.bind("<c>", lambda _: self._set_mode("countdown"))
        self.root.bind("<C>", lambda _: self._set_mode("countdown"))
        self.root.bind("<F11>", lambda _: self._toggle_fullscreen())
        self.root.bind("<Escape>", lambda _: self._exit_fullscreen())
        if IS_MAC:
            self.root.bind("<Command-f>", lambda _: self._toggle_fullscreen())
            self.root.bind("<Command-Return>", lambda _: self._toggle_fullscreen())

    def _on_window_configure(self, event):
        if event.widget is not self.root:
            return
        if self._resize_job is not None:
            self.root.after_cancel(self._resize_job)
        self._resize_job = self.root.after(50, self._apply_responsive_layout)

    def _apply_responsive_layout(self):
        self._resize_job = None
        self._apply_mode_visibility()

        if self._focus_container.winfo_manager():
            self._focus_container.pack_configure(
                padx=max(8, int(self.root.winfo_width() * 0.015)),
                pady=max(8, int(self.root.winfo_height() * 0.02)),
            )
            self._layout_focus_cards()
            self._position_settings_widgets()
            return

        w = max(self.root.winfo_width(), 1)
        h = max(self.root.winfo_height(), 1)

        scale = min(w / BASE_W, h / BASE_H)
        scale = max(0.42, min(1.9, scale))
        mode_boost = 1.0

        digit_size = int(90 * scale * mode_boost)
        digit_size = max(26, min(190, digit_size))
        unit_pad = max(2, min(18, int(10 * scale)))
        digit_pad = max(1, min(6, int(2 * scale)))
        unit_label_size = max(7, min(16, int(10 * scale)))

        self._title_font.configure(size=max(9, min(30, int(15 * scale))))
        self._date_font.configure(size=max(7, min(18, int(11 * scale))))
        self._status_font.configure(size=max(7, min(18, int(11 * scale))))
        self._tab_font.configure(size=max(7, min(16, int(11 * scale))))
        self._sep_font.configure(size=max(16, min(84, int(52 * scale * mode_boost))))
        self._shortcut_font.configure(size=max(7, min(14, int(10 * scale))))

        self._header.pack_configure(
            padx=max(6, int(20 * scale)),
            pady=(max(4, int(16 * scale)), 0),
            ipady=max(4, int(12 * scale)),
        )
        self._tab_frame.pack_configure(pady=(max(6, int(20 * scale)), 0))
        self._display.pack_configure(pady=(max(8, int(28 * scale)), 0))
        self._control_frame.pack_configure(pady=(max(6, int(20 * scale)), 0))
        self._shortcut_lbl.pack_configure(
            pady=(max(4, int(16 * scale)), max(4, int(10 * scale)))
        )

        for tab in self._tabs.values():
            tab.config(
                padx=max(6, int(18 * scale)),
                pady=max(3, int(7 * scale)),
            )

        for unit in (self._unit_h, self._unit_m, self._unit_s):
            unit.resize(digit_size, unit_label_size, digit_pad)
            unit.pack_configure(padx=unit_pad)

        sep_pad_x = max(1, int(4 * scale))
        sep_pad_y = max(8, int(28 * scale * mode_boost))
        self._sep1.pack_configure(padx=sep_pad_x, pady=(0, sep_pad_y))
        self._sep2.pack_configure(padx=sep_pad_x, pady=(0, sep_pad_y))

        start_w = max(92, min(230, int(160 * scale)))
        start_h = max(28, min(62, int(44 * scale)))
        reset_w = max(86, min(210, int(140 * scale)))
        reset_h = max(28, min(62, int(44 * scale)))
        self._btn_start.resize(width=start_w, height=start_h, font_size=int(13 * scale))
        self._btn_reset.resize(width=reset_w, height=reset_h, font_size=int(12 * scale))

        for entry in self._input_entries:
            entry.config(font=("Courier", max(8, int(16 * scale)), "bold"))
        for lbl in self._input_suffix_labels:
            lbl.config(font=("Helvetica Neue", max(7, int(12 * scale))))
        if self._apply_btn is not None:
            self._apply_btn.resize(
                width=max(62, int(90 * scale)),
                height=max(26, int(38 * scale)),
                font_size=int(11 * scale),
            )
        for btn in self._preset_buttons:
            btn.resize(
                width=max(52, int(72 * scale)),
                height=max(24, int(32 * scale)),
                font_size=int(10 * scale),
            )

    def _on_space(self, event):
        """Espaço: iniciar/parar, MAS não se estiver digitando num Entry."""
        if isinstance(event.widget, tk.Entry):
            return  # deixa o comportamento normal do Entry
        self._toggle()
        return "break"

    def _on_enter(self, event):
        """Enter: aplica o tempo digitado."""
        if self.mode == "countdown" and not self.running:
            self._apply_countdown_from_settings()
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
        self.root.after(80, self._apply_responsive_layout)

    def _exit_fullscreen(self):
        if self._is_fullscreen:
            self._is_fullscreen = False
            try:
                self.root.attributes("-fullscreen", False)
            except tk.TclError:
                self.root.attributes("-zoomed", False)
            self._fs_btn.config(text="⤢")
            self.root.after(80, self._apply_responsive_layout)

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
        self._apply_mode_visibility()
        self._build_input_panel()
        self._apply_responsive_layout()

        if mode == "countdown":
            self._apply_countdown_from_settings()
        else:
            self._set_status("Cronômetro", COLORS["accent"])
            self._refresh_display()
            self._update_controls()

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
        if self.running and self.mode == "countdown":
            return
        if self.mode != "countdown":
            self._set_mode("countdown")
        self.total_seconds = seconds
        self.remaining_seconds = seconds
        self.elapsed_seconds = 0
        h, m, s = _secs_to_hms(seconds)
        self._sync_countdown_vars(h, m, s)
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
            self._sync_countdown_vars(0, 0, 0)

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
        self._focus_left.set(f"{h % 100:02d}")
        corner = f"{s:02d}" if self._cfg_show_corner_seconds.get() else ""
        self._focus_right.set(f"{m:02d}", corner=corner)

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
