## Inspiration

Provio was inspired by a real operational problem at the VT Food Pantry. The pantry runs two programs, an open-hours pantry and a grocery-style setup, and inventory was being tracked in a physical notebook before being re-entered manually into Excel. That process is repetitive, slow, and easy to get wrong, especially when the people doing the work are volunteers rather than trained technical staff.

We wanted to build something that did more than digitize a spreadsheet. The goal was to create a system that fits how a pantry actually works: intake, restocking, transfers, invoice tracking, checkpoints, and rollover, all in one place, and all simple enough for a non-technical volunteer to use.

## What it does

Provio is an AI-assisted pantry operations system built for modern food pantry workflows. It lets staff create and manage inventory with item name, vendor, weight, units, category, pricing, and pantry or grocery assignment. It also supports quick stock updates for existing items so volunteers do not have to re-enter the same item repeatedly.

Beyond basic inventory, Provio supports vendor invoice tracking, invoice parsing, transfers between pantry and grocery, low-stock alerts, checkpoints that define new inventory baselines, and year-end rollover that calculates totals and carries remaining stock forward. It also includes voice and text intake flows, recent activity history, and invoice-linked audit records.

## How we built it

We built Provio with React, TypeScript, and Vite on the frontend, styled with Tailwind CSS. Firebase Authentication handles sign-in, and Firestore stores items, transactions, invoices, checkpoints, and alerts. We used Gemini to parse text and invoice content into structured inventory records, and the browser Web Speech API for voice capture before sending transcripts into the same intake flow.

The architecture is frontend-first. The React app handles pantry workflows and UI, Firebase Authentication controls access, Firestore stores operational data, and Gemini powers AI-assisted intake. A key product decision was to make all intake paths converge into the same review-before-save pattern so volunteers can confirm what the AI produced before anything reaches the database.

## Challenges we ran into

One major challenge was making the app operationally correct instead of building a generic CRUD demo. The pantry prompt required real workflows like transfers, invoice tracking, periodic checkpoints, and rollover, and those all needed to connect coherently rather than exist as isolated screens.

Another challenge was usability. Because the intended users are non-technical volunteers, even technically correct flows could still fail if the language or layout felt too complicated. That forced us to simplify labels, add more guided structure, and rethink editing flows so the app stayed understandable without training.

We also ran into reliability issues with AI-assisted parsing. Gemini improved intake significantly, but external model calls can fail or produce inconsistent responses. We handled that by adding retries, fallback parsing behavior, and explicit review steps rather than trusting raw output directly.

## Accomplishments that we're proud of

We are proud that Provio goes beyond a basic inventory tracker and actually supports the pantry’s real operating model. It handles both pantry programs, supports invoice-driven intake, tracks vendor-linked records, logs transfers, creates checkpoints as baselines, and supports year-end carry-forward.

We are also proud of the product usability improvements we made during development. Inventory updates became easier through lookup-and-edit flows, stock changes became clearer with separate add and remove actions, and Smart Intake was organized so invoice scan comes first, followed by voice and then text. Those changes made the app feel more realistic for volunteer use.

## What we learned

We learned that the hardest part of building operational software is not just storing data, but modeling real workflow correctly. Pantry inventory is not only a list of items and quantities. It is a system of intake, transfers, corrections, baselines, and rollover, all of which need to be understandable over time.

We also learned that AI works best as assistance, not authority. The most effective pattern in the app was always parse, review, then save. That reduced friction for volunteers without removing human oversight. Finally, we learned that traceability matters: once invoices, checkpoints, and rollover are part of the system, users need to understand how inventory changed, not just what the final numbers are.

## What's next for Provio

The next step is real pilot testing with pantry staff and volunteers so we can measure usability, time saved, and improvements in audit and reconciliation workflows. We would also strengthen production security, expand reporting, improve invoice file retention, and refine the mobile and tablet experience for day-to-day pantry use.

Longer term, Provio could expand beyond the VT Food Pantry into a configurable pantry operations platform for other organizations with similar workflows. The underlying model already supports intake, transfers, baselines, and rollover, so the product could grow into a reusable system for food pantries that need something more practical than notebooks and spreadsheets.
