# Everything Claude Code Integration & Project Audit

## Objective
Integrate the complete toolkit from `everything-claude-code` (skills, agents, rules, commands, hooks, scripts) into Antigravity workspace paths (`.agents/`, `.antigravity/`, `.gemini/`, `.claude/`) and global Antigravity configuration (`~/.gemini/config/skills/`), and apply these standards (coding standards, backend/frontend patterns, security review, verification loop) across the codebase.

## Actionable Checklist
- [x] Task 1: Install skills, rules, agents, commands, and hooks from `everything-claude-code` into Antigravity workspace directories (`.agents/`, `.antigravity/`, `.gemini/`, `.claude/`) and global Antigravity config (`~/.gemini/config/skills/`).
- [x] Task 2: Apply coding standards, backend patterns, and frontend patterns to inspect and audit `maral-os`.
- [x] Task 3: Perform security review on authentication, endpoints, inputs, and environment configuration.
- [x] Task 4: Execute verification loop (builds & tests) and clean up temporary clone artifacts.

## Verification Evidence
- Installed `11 skills`, `8 rules`, `15 agents`, `15 commands`, `5 hooks`, and `cross-platform scripts` into `.agents/`, `.antigravity/`, `.gemini/`, and `.claude/`.
- Installed all 11 skills globally into `C:\Users<user>\.gemini\config\skills\` for native Antigravity discovery across all sessions.
- Backend build: `npm --prefix backend run build` succeeded with exit code 0 (`tsc`).
- Frontend build: `npm --prefix frontend run build` succeeded with exit code 0 (`vite build`).
- Fixed `package.json` configuration warning by declaring `"type": "module"` in `frontend/package.json`.
- Removed temporary directory `temp_everything_claude_code`.

## Chosen Route per Task
- Task 1: Direct inline (file copying and folder setup across global and workspace paths)
- Task 2: Direct inline (code inspection against standards)
- Task 3: Direct inline (security audit of JWT, auth middleware, and env checks)
- Task 4: Direct inline (build and test verification)
