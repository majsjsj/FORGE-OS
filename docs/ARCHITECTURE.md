# Architecture

## Current runtime
A Python package provides a CLI and stdio MCP server. MCP delegates to ordinary Python functions, keeping tools testable and model-independent.

## Trust boundaries
File operations are confined to a configured workspace. Paths are resolved before access; traversal and common secret/dependency directories are blocked. File sizes are capped. No arbitrary shell tool is exposed.

The pytest tool executes repository code. Use disposable containers for untrusted projects. This MVP is not a hardened multi-tenant service.

## Planned layers
- Director: decomposition, routing, budgets, approvals, audit trail.
- Studios: web, Android, games, SaaS, APIs.
- Vision: screenshot parsing, browser capture, image diffs, OCR, iterative correction.
- QA/security: tests, static analysis, dependency review, release gates.
- Model gateway: Claude, other hosted models, and self-hosted FORGE AI.
- Learning: opt-in, evaluation-backed memory of verified fixes.

Core workflows must remain model-agnostic. Claude is an integration, not the core runtime.
