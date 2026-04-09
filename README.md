# Provio

Provio is an AI-assisted operations system for modern food pantries. It replaces notebook and spreadsheet workflows with a volunteer-friendly web app for intake, inventory tracking, transfers, checkpoints, and year-end rollover.

## Current Scope

- Google sign-in with Firebase Auth
- Inventory creation, editing, restocking, and vendor tracking
- Smart Intake for voice, text, and invoice parsing
- Dedicated invoice history tab for approved uploads
- Program transfers between pantry and grocery
- Low-stock alerts
- Checkpoints and active baseline tracking
- End-of-year rollover with carry-forward summary
- Invoice-linked audit trail inside Smart Intake
- Sample inventory seeding for demos

## Stack

- React 19
- Vite
- Firebase Auth + Firestore
- Firebase Hosting + Storage rules config
- Gemini API via `@google/genai`
- TypeScript

## Local Setup

Prerequisites:

- Node.js 20+
- npm

Install and run:

```bash
npm install
npm run dev
```

The dev server runs on:

```text
http://localhost:3000
```

## Environment Variables

Create `.env.local` in the project root:

```bash
VITE_GEMINI_API_KEY=your_gemini_key_here
```

`firebase-applet-config.json` is used for the Firebase client config in this project.

The repo also includes:

- `firestore.rules`
- `storage.rules`
- `firebase.json`

## Scripts

```bash
npm run dev
npm run build
npm run preview
npm run lint
```

## Product Status

Completed:

- Inventory edit and restock workflows
- Invoice workflow in Smart Intake
- Voice intake with transcript review and edit-before-save
- Invoice history tab for approved uploads
- Low-stock alerts
- End-of-year rollover
- Vendor tracking
- Formal checkpoint baseline behavior
- Invoice-linked audit flows
- Local fallback parsing when Gemini is temporarily unavailable
- Sample inventory loader for demo use

## Main App Areas

- `Dashboard`: category totals, restock notices, recent activity
- `Inventory`: create, edit, search, vendor tagging, stock updates, sample data load
- `Smart Intake`: voice capture, text parsing, invoice parsing, invoice audit trail
- `Invoices`: approved invoice history and audit detail
- `Transfers`: move stock between pantry and grocery
- `Checkpoints`: save baselines, compare against active baseline, run rollover
