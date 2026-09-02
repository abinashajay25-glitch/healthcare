# SovereignRx

A patient-controlled healthcare dashboard for managing consent, prescription verification, and audit visibility in one secure workflow.

## Overview

This project demonstrates a privacy-first healthcare experience where patients decide which providers can access their records, review access requests, verify prescription integrity, and inspect the audit trail of every action.

Key features include:

- patient-owned health vault and consent controls
- granular field-level access permissions
- prescription verification with QR payload validation
- audit trail for access and approval activity
- role-based demo flow for patient, doctor, and pharmacy views

## Tech Stack

- React + TypeScript
- Vite
- Tailwind CSS
- tRPC
- Express + TypeScript server
- Drizzle ORM
- Vitest
- pnpm

## Getting Started

### Prerequisites

- Node.js 20+
- pnpm

### Install dependencies

```bash
pnpm install
```

### Run the app in development mode

```bash
pnpm run dev
```

### Build for production

```bash
pnpm run build
```

### Run tests

```bash
pnpm test
```

## Project Structure

```text
client/          Frontend application
server/          Backend and API logic
drizzle/         Database schema and migrations
shared/          Shared types and utilities
patches/         pnpm patch files
```

## Notes

This project is a demo application intended for showcasing secure health-data consent flows and governance patterns. It is not a production medical system.

## License

MIT
