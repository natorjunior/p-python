# Fase 11 — Dupla Decisão com If

## Objetivo
Resolver dois eventos aleatórios usando `if/else` e chegar à bandeira.

## Comandos
- `move_right(n)`
- `move_left(n)`
- `interact()`
- `jump()`
- `if is_crystal_ahead():`
- `else:`

## Mecânica
- Dois eventos aparecem na rota (checkpoint 1 e checkpoint 2).
- Em cada execução, cada checkpoint pode virar cristal ou obstáculo.
- Para cada checkpoint:
  - Se for cristal, use `interact()`.
  - Se for obstáculo, use `jump()`.
- Só é possível avançar para o fim após resolver os dois checkpoints.

## Dica
Teste o mesmo código várias vezes: o padrão dos eventos alterna a cada execução e seu `if/else` precisa funcionar em ambos os cenários.
