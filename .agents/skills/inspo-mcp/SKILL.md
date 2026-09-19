---
name: inspo-mcp
description: >-
  Curated archive of real website designs, UI components, color palettes, design systems,
  and page flows served over MCP. Use this skill when designing UI/UX, researching layout inspiration,
  selecting typography pairings, picking color schemes, or building modern interfaces.
---

# Inspo MCP - UI/UX Design & Inspiration

`inspo-mcp` is a curated design archive and MCP server for AI coding agents to search, discover, and implement real-world UI/UX patterns, design systems, color schemes, and component architectures.

## Features & Capabilities

1. **Design System & Palette Discovery**:
   - Extract and adapt color palettes, typography scales, spacing tokens, and border radii from curated modern websites.
   - Access harmonious dark/light mode themes and glassmorphism styling.

2. **Component & Layout Architecture**:
   - Explore layout patterns: dashboards, landing hero sections, spatial interfaces, metric grids, data tables, telemetry monitors, and modals.
   - Reference real component patterns for buttons, badges, chips, progress rings, status bars, and cards.

3. **Page Flows & Micro-Interactions**:
   - High-fidelity interactions, hover states, transitions, micro-animations, and responsive layout structures.

## MCP Configuration

The server is configured in `.agents/mcp_config.json`, `~/.cursor/mcp.json`, and VS Code:

- **Endpoint**: `https://inspomcp.dev/api/mcp`
- **CLI / Stdio Command**: `npx -y inspo-mcp --stdio`

## Usage Workflow for UI/UX Tasks

When creating or refining UI components:
1. **Identify the Core Theme**: Determine if the UI needs high-density data visualization, spatial digital-twin layout, sleek glassmorphic dark mode, or clean technical typography.
2. **Apply Design Tokens**:
   - **Colors**: Use CSS custom properties (`--bg`, `--panel`, `--line`, `--text`, `--cyan`, `--amber`, `--emerald`).
   - **Typography**: Pair technical monospace fonts (`JetBrains Mono`, `Fira Code`) for numbers/coordinates with clean sans-serif (`Plus Jakarta Sans`, `Inter`) for headers and body copy.
   - **Spacing & Alignment**: Use consistent 8px/12px/16px grid systems.
3. **Elevate Aesthetics**:
   - Add subtle glows, gradient borders (`color-mix` or linear gradients), backdrop blur (`backdrop-filter: blur(8px)`), and smooth cubic-bezier transitions.
   - Ensure high contrast and accessibility for all text and badges against dark surfaces.
