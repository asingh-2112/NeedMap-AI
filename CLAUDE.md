# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Branch: master

This is the root/base branch. It contains only a README and serves as the integration target for all feature branches.

## Project Overview

NeedMap-AI is a volunteer-and-needs matching platform. The broader project consists of:
- A Python/FastAPI backend (see `feature/backend-initial-work` branch for the most complete implementation)
- A React Native/Expo frontend (see `feat-adding-frontend` branch)
- OCR benchmarking tooling for digitizing paper surveys (see `ocr-benchmark` and `ocr-dataset-updates` branches)

## Worktree Layout

The project root (`NeedMap-AI/`) contains `.bare/` (git object store) and `.git` (pointer to `.bare`). All branches are checked out as sibling worktrees:

| Worktree Path | Branch | Contents |
|---|---|---|
| `.bare/` | — | Bare git object store |
| `../master` | master | Base branch (this) |
| `../dev` | dev | Backend skeleton + DB models |
| `../feat-adding-frontend` | feat-adding-frontend | Backend + React Native frontend |
| `../feature-backend-initial-work` | feature/backend-initial-work | Full backend API with JWT auth |
| `../feature-create-database0304` | feature/create-database0304 | Database schema setup |
| `../ocr-benchmark` | ocr-benchmark | Basic OCR engine comparison |
| `../ocr-dataset-updates` | ocr-dataset-updates | Enhanced OCR benchmarking with metrics |

To manage worktrees, run git commands from inside `../.bare/`.
