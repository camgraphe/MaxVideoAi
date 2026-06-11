# Canvas Floating Toolbar Implementation Plan

## Objective

Make Canvas mode feel like a large graph editor with a compact floating toolbar, while keeping templates and block creation available through menu-driven tools.

## Steps

1. Add shared toolbar UI and styles.
2. Reuse the existing palette drag event so toolbar-created nodes follow the same drop path as the old sidebar.
3. Pass canvas template and user-template actions from `WorkspaceEditorLayout` to `WorkspaceCanvas`.
4. Remove `NodeLibrarySidebar` from Canvas mode and widen the canvas grid.
5. Add `note` to `WorkspaceNodeKind`, drag preview, ad hoc node factory, resizable node list, and node renderer.
6. Update architecture/E2E expectations for the new Canvas-mode entry point.
7. Run focused validation: lint, architecture tests, and editor smoke checks where practical.
