---
name: writing-specs
description: Use when writing or changing an OpenSpec spec. Says what belongs in a requirement, how to write a scenario a test can assert, and how to change an existing requirement without losing detail. The schema says the file layout and the parser's format.
---

# Writing specs

A spec is a behavior contract, not an implementation plan. It says what the
system does as seen from outside. The design says how.

## What belongs in a spec

- Observable behavior that users or downstream systems rely on.
- Inputs, outputs and error conditions.
- External constraints: security, privacy, reliability, compatibility.
- Scenarios a test can check.

## What does not

- Internal class, function or module names.
- Library or framework choices.
- Step-by-step implementation.
- Execution plans. Those belong in the design and the tasks.

The test: if the implementation could change without changing what anyone
outside can observe, it does not belong in the spec.

## Requirements

- Write normative text with SHALL or MUST. Avoid should and may; they leave the requirement untestable.
- One requirement states one behavior. Split a requirement that needs "and" to describe.
- Every requirement has at least one scenario.

## Scenarios

A scenario is a potential test. Its WHEN names a concrete condition. Its THEN
names an outcome a test can assert: a value, a message, a state, a status
code. "THEN the system handles it correctly" asserts nothing.

```markdown
#### Scenario: Known user opens the app
- **WHEN** a user named Ada, who has signed in before, opens the app
- **THEN** the app shows "Hello, Ada"
```

Cover the failure path as well as the success path when the requirement has
one: the missing input, the denied request, the timeout.

## Changing an existing requirement

Archive replaces the whole requirement with what the delta holds. So:

- **MODIFIED** carries the entire requirement, from its `### Requirement:` heading through every scenario, with the edits made. Partial content loses the rest at archive.
- **ADDED** is for a new requirement, including a new concern on an existing capability that leaves its other requirements alone. Prefer ADDED over MODIFIED when you are adding, not changing.
- **REMOVED** names the requirement, the reason, and the migration for anyone who relied on it.
- **RENAMED** changes only the name. Use MODIFIED if the behavior changes too.

Keep the heading text of a MODIFIED or REMOVED requirement identical to the
existing one, so archive can find it.

## Example: a new capability

A new capability opens with its Purpose and has only ADDED requirements.
There is nothing yet to modify or remove.

```markdown
## Purpose

Lets users take their data out of the product in a portable format.

## ADDED Requirements

### Requirement: User can export data
The system SHALL let a signed-in user download all their data as one CSV file.

#### Scenario: Successful export
- **WHEN** a signed-in user chooses Export
- **THEN** the browser downloads a CSV file that holds every record the user owns

#### Scenario: Export while signed out
- **WHEN** a request to export arrives without a session
- **THEN** the system responds 401 and sends no data
```

## Example: a delta on an existing capability

A delta has no Purpose. It changes, adds or removes requirements the main
spec already holds.

```markdown
## MODIFIED Requirements

### Requirement: User can export data
The system SHALL let a signed-in user download all their data as one CSV or
JSON file, as they choose.

#### Scenario: Successful export
- **WHEN** a signed-in user chooses Export and picks a format
- **THEN** the browser downloads one file in that format that holds every record the user owns

## REMOVED Requirements

### Requirement: Legacy export endpoint
**Reason**: Replaced by the format-aware export.
**Migration**: Call `/api/v2/export?format=csv` instead of `/api/v1/export`.
```
