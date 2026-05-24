# Fonts

The LeadsWave codebase uses `next/font` with **Geist Sans + Geist Mono** loaded from Google Fonts.

This design system substitutes:

| Role | Codebase | This system | Source |
|---|---|---|---|
| Mono (dominant) | Geist Mono | **DM Mono** | Google Fonts CDN |
| Sans | Geist Sans | **Inter** | Google Fonts CDN |
| Editorial serif | Georgia | Georgia | System |

Loaded via `@import` at the top of `colors_and_type.css`:

```css
@import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@300;400;500&family=Inter:wght@400;500;600;700&display=swap');
```

## To use the production Geist fonts instead

1. Drop the Geist `.woff2` / `.ttf` files into this folder.
2. Replace the `@import` line above with `@font-face` declarations.
3. Update the `--font-mono` and `--font-sans` custom properties to point at the Geist family names.

The visual system was specifically requested to use **DM Mono** in the brief, so the substitution is intentional. Geist Mono is a close stylistic neighbor — slightly tighter counters, more humanist `g` — and code laid out for DM Mono should reflow cleanly in Geist Mono.
