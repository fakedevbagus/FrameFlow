# Development

## Prerequisites

- Node.js 24 or later
- Rust stable toolchain
- FFmpeg
- Linux dependencies required by Tauri

## Commands

```bash
npm install
npm run dev
npm run tauri dev
npm run lint
npm run test
npm run build
```

## Verification order

Run the following before committing changes:

```bash
npm run lint
npm run test
npm run build
```

## Project conventions

- Keep feature code isolated by responsibility.
- Add a test when changing domain behavior.
- Do not commit generated build output.
- Update the Notion handoff log when a milestone or blocker changes.
