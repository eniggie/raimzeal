---
name: iOS Bundle ID Decision
description: The iOS bundleIdentifier must stay app.replit.raimzeal — never change it. Android package stays com.econteur.raimzeal.
---

## Rule
- `ios.bundleIdentifier` in `app.json` = **`app.replit.raimzeal`** — never change this.
- `android.package` in `app.json` = **`com.econteur.raimzeal`** — never change this.

## Why
Apple permanently registered App Store Connect app ID 6773363801 under `app.replit.raimzeal`.
Bundle IDs on App Store Connect are immutable — once an app is created, the bundle ID is locked forever.
Changing `app.json` to anything else (e.g. `com.econteur.raimzeal`) causes `eas submit` to fail with "no app found with that bundle ID".
The Replit agent oscillated this value multiple times causing repeated broken builds. The user explicitly confirmed: keep `app.replit.raimzeal` for fast shipping.

## How to apply
Any time a task or agent suggests changing `ios.bundleIdentifier`, refuse and cite this note.
Supabase Apple provider Client ID must include `app.replit.raimzeal` (and optionally `com.econteur.raimzeal` as a second entry).
