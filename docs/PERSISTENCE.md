# Project persistence

FrameFlow project files use the `.frameflow.json` extension. The desktop backend owns file reads and writes; the React application sends only a requested path and serialized project content.

## Save behavior

1. The project domain validates the document.
2. The frontend serializes the document.
3. The backend creates the parent directory when needed.
4. The backend writes a temporary sibling file.
5. The temporary file replaces the destination project file.

An export failure or project file error must not modify the open project state in memory.

## Open behavior

1. The backend reads the requested file as text.
2. The frontend parses and validates the document version.
3. Unsupported or invalid documents produce a visible error in a later UI step.
