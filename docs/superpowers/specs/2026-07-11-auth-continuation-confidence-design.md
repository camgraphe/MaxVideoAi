# Auth continuation confidence design

## Goal

Make the signup/signin handoff feel continuous by confirming that the visitor's selected top-up amount or generation context is preserved.

## Current friction

The login page is visually clear but generic. A visitor arriving from a $25 Billing selection sees the same copy as someone opening login directly, with no confirmation that the amount is still saved. The same uncertainty exists after choosing an engine or tool in the workspace.

## Design

- Keep the existing login card, tabs, fields, Google entry, legal controls, routes, and redirects unchanged.
- Derive a small continuation summary from the already sanitized `next` target.
- Show the summary below the page description and above the auth tabs.
- Use the existing border, background, radius, spacing, and typography tokens.
- Use a check icon from the existing Lucide icon library to signal preserved state.
- Localize the summary in English, French, and Spanish.
- For Billing, show the selected USD amount when it is valid.
- For video/image/audio/tool workflows, confirm that the setup is saved and that the user will return to it.
- For Library, confirm the return destination.
- Do not show a generic summary for the default `/generate` target or while resetting a password.

## Safety

- The summary does not control navigation.
- It accepts only internal paths and reads only allowlisted route families.
- Checkout amount formatting is display-only; Billing remains the owner of validating the actual top-up intent.

## Acceptance criteria

- `/login?next=/billing?amount=2500&currency=USD` confirms that $25 is saved.
- `/login?next=/app?engine=seedance-2-0` confirms that generation setup is saved.
- Image, Audio, Library, and tool targets receive accurate localized summaries.
- Direct/default login remains visually unchanged apart from existing content.
- Reset mode does not show the continuation summary.
- Auth and redirect behavior remains unchanged.
