# Agent Instructions

## Before Starting
- Read PROJECT_STATE.md, TODO.md, and DECISIONS.md before making changes.
- Inspect current git status before editing files.
- Do not overwrite unrelated user changes.

## Coding Rules
- Prefer TypeScript strict mode.
- Avoid `any` unless absolutely necessary.
- Keep functions small and readable.
- Do not introduce large dependencies without explaining why.
- Do not run destructive commands unless explicitly asked.

## Project Memory Rules
After meaningful changes:
- Update PROJECT_STATE.md with what changed.
- Update TODO.md when tasks are completed or new tasks are found.
- Update DECISIONS.md for architectural choices.
- Keep notes concise.

## Multi-Agent Rules
- Do not edit files that another agent is actively editing.
- If unsure, ask the user before modifying shared core files.
- Prefer small, reviewable diffs.