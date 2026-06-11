# Canvas Floating Toolbar Design

## Goal

Replace the Canvas-mode left sidebar with a floating canvas toolbar so the graph has more working room and block creation happens from contextual menus.

## Product Rules

- Canvas mode owns generation graph tools only.
- Viewer mode keeps Project media, sequences, imports, generated clips, and timeline editing.
- Canvas templates apply only nodes and edges. They must not reset timeline state or project media.
- New blocks are created by dragging from toolbar menus into the canvas.
- The canvas keeps existing file drop and paste support.

## First Pass Scope

- Remove `NodeLibrarySidebar` from Canvas mode layout.
- Add a floating bottom canvas toolbar adapted to the Studio dark theme.
- Toolbar menus:
  - Media: image reference, video reference, audio reference.
  - Text: prompt block, free text note.
  - Generate: video shot block.
  - Templates: canvas templates, user templates, save current canvas.
  - Tools: fit, organize, clean links placeholders for future implementation.
  - Plus: quick add shortcuts.
- Add a real `note` canvas node kind for free text that is visually separate from prompt input blocks.

## Non-Goals

- Do not change Viewer Project media behavior in this pass.
- Do not change backend persistence shape beyond accepting the new `note` node kind in client state.
- Do not implement complex canvas grouping or whiteboard drawing yet.

## Validation

- Canvas mode shows no left template sidebar.
- Viewer mode still shows Project media on the left.
- Dragging a toolbar block creates a node at the drop point.
- Existing file drop and paste into the canvas still work.
- Architecture tests reflect that templates live in the floating canvas toolbar, not the layout sidebar.
