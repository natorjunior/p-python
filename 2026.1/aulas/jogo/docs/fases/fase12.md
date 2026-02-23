# Fase 12 — Circuito Aéreo Avançado

## Objetivo
Resolver um checkpoint aleatório (cristal ou obstáculo), coletar o pterossauro, ativar 6 pontos de ambiente no trecho aéreo e alcançar a bandeira final.

## Comandos
- `move_right(n)`
- `move_left(n)`
- `jump()`
- `interact()`
- `if is_crystal_ahead():`
- `else:`
- `flap()`
- `glide()`

## Mecânica
- No solo existe um checkpoint aleatório: pode aparecer um cristal (coleta) ou obstáculo (desvio).
- Use `if is_crystal_ahead():` para decidir: `interact()` quando for cristal, `jump()` no `else` quando for obstáculo.
- No solo, use `interact()` para montar no pterossauro.
- Em voo, ajuste a altura com `flap()` e `glide()`.
- Nos pontos aéreos, use `interact()` para ativar cada elemento do ambiente.
- A bandeira só é liberada após ativar todos os pontos.

## Dica
Ao chegar em um novo ponto, alinhe altura e coluna antes de usar `interact()`.
