## Inspiration

Provio was built around a specific operational problem at the VT Food Pantry. The pantry runs two programs, an open-hours pantry and a grocery-style setup, and inventory was being tracked in a physical notebook and then re-entered manually into Excel. That workflow is slow, repetitive, and error-prone, especially when the people entering the data are volunteers rather than trained technical staff.

The prompt was clear: build a system that a non-technical volunteer could actually use, while still handling the real operational details the pantry needs. That meant we were not trying to make a generic inventory dashboard. We were trying to replace a fragile notebook-to-spreadsheet process with a workflow-first tool that fits how the pantry actually operates.

## What We Built

We built Provio, an AI-assisted pantry operations system that covers the required workflows from the prompt:

- inventory creation with item name, vendor, weight, units, category, pricing, and pantry or grocery assignment
- quick restocking of existing items without re-entering them from scratch
- vendor invoice tracking with scanned invoice parsing and approved invoice history
- transfers between pantry and grocery programs
- periodic checkpoints that establish a new baseline
- end-of-year rollover that calculates totals and carries inventory forward

We also added supporting workflows that improve day-to-day usability:

- voice intake
- text intake
- low-stock notices
- recent activity logging
- invoice-linked audit trails

The result is a single app that supports intake, tracking, movement, reconciliation, and year-end continuity.

## How We Built It

We used React, TypeScript, and Vite for the frontend, with Tailwind CSS for styling. Firebase Authentication handles sign-in, and Firestore stores items, transactions, invoices, checkpoints, and alerts.

The data model was designed around the pantry prompt rather than a generic product catalog. Items now carry:

- operational identity: name, vendor, category, unit
- allocation state: pantry quantity and grocery quantity
- physical metadata: weight value and weight unit
- pricing metadata: unit price and price basis

This let us support both of the prompt’s pricing cases:

$$
\text{price basis} \in \{\text{per unit}, \text{per weight}\}
$$

For intake, we built a shared review-before-save flow:

$$
\text{voice/text/invoice} \rightarrow \text{parse} \rightarrow \text{review} \rightarrow \text{commit}
$$

Text and invoice parsing use Gemini, while voice capture uses the browser Web Speech API and then feeds the transcript into the same parsing path. Invoice scans can be reviewed, approved, saved, and later inspected through the invoice history and audit views.

We also implemented the operational workflows directly in the app:

- transfers write source and destination program changes
- checkpoints establish a current baseline
- rollover creates a new carry-forward baseline and logs rollover activity
- low-stock alerts are generated automatically based on thresholds

## Challenges We Faced

The first challenge was resisting the temptation to build a CRUD demo instead of the system the pantry actually needed. The prompt includes details that are easy to skip, such as program transfers, invoice tracking, periodic checkpoints, and rollover. Those are exactly the workflows that make the problem real.

The second challenge was UX. The pantry context changes the bar completely. A feature is not done just because it works technically. It has to be understandable by a volunteer who may be using it under time pressure. That forced a lot of design decisions:

- simpler labels
- dropdowns where consistency matters
- focused modal flows for adding inventory
- clear review states before saving AI-parsed records
- consistent navigation and sidebar behavior

The third challenge was AI reliability. Gemini improved the intake experience significantly, but external AI calls can fail or return inconsistent output. We ran into transient issues such as `503 ServiceUnavailable`, so we added retry logic, fallback parsing behavior, and explicit review steps instead of trusting raw model output directly.

Another challenge was traceability. Once invoices, transfers, baselines, and rollover enter the system, the app needs to explain how state changed over time. That is why we added invoice-linked transactions, active baseline tracking, and a separate full activity log page instead of only storing final quantities.

## What We Learned

We learned that the hard part of an operational app is not only storing information. It is modeling the workflow correctly.

For this project, that meant understanding that pantry inventory is not just:

$$
\text{items} + \text{counts}
$$

It is closer to:

$$
\text{inventory state} = \text{baseline} + \text{intake} + \text{transfers} + \text{corrections} + \text{rollover logic}
$$

That shift changed how we approached the entire product. Checkpoints stopped being passive snapshots and became active baselines. Invoice uploads stopped being just file parsing and became auditable intake records. Restocking stopped being “create another item” and became “look up the item you already have and update it quickly.”

We also learned that AI works best when it reduces friction without owning the final decision. The highest-quality pattern was always parse first, review second, save third.

## Why This Fits the Prompt Well

The prompt explicitly required a simple system for a two-program pantry with no barcode scanning and no student checkout tracking. We kept those constraints intact.

Instead of expanding scope into consumer-style features, we focused on the pantry’s real workflows:

- intake
- reassignment between pantry and grocery
- invoice-driven stock updates
- checkpoint resets
- year-end continuity

That is what makes Provio strong relative to the original challenge. It is not trying to be everything. It is trying to be operationally correct and usable by the actual people doing the work.

## Where We Ended Up

Provio ended up as a workflow-first pantry operations platform rather than a basic inventory tracker. It directly addresses the VT Food Pantry’s notebook-and-Excel problem, supports both pantry programs, captures the item data the prompt asked for, and preserves the simplicity needed for non-technical volunteers.

The final product is not just a nicer interface over the same manual process. It changes the process itself:

$$
\text{manual re-entry} \rightarrow \text{structured intake and tracked operations}
$$

That was the real goal of the project, and it is where the build is strongest.
