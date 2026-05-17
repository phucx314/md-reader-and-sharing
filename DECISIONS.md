# Decisions

## 2026-05-17: Use file-based project memory
Decision:
- Use AGENTS.md, CLAUDE.md, PROJECT_STATE.md, TODO.md, and DECISIONS.md as shared context between Codex and Claude Code.

Reason:
- Codex and Claude Code cannot share sessions directly.
- Markdown files are durable, git-trackable, and readable by all agents.