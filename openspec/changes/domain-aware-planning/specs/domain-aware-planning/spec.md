## Purpose

Help agents plan against relevant project and shared behavior specs using one root OpenSpec project, while preserving established capability paths.

## ADDED Requirements

### Requirement: Read affected behavior before planning

Both Let's Spec flows SHALL instruct agents to identify affected capabilities and read their existing specs before settling the brainstorm or writing spec deltas, using the resolved OpenSpec planning home.

#### Scenario: Backend work depends on shared authentication
- **WHEN** a backend change affects behavior described by backend and shared authentication specs
- **THEN** the planning guidance directs the agent to read both specs before deciding the change's requirements

#### Scenario: Clear scope needs no extra selection step
- **WHEN** the request and existing specs identify the affected area without ambiguity
- **THEN** the guidance permits planning to proceed without a separate domain-selection confirmation

### Requirement: Preserve the existing spec organization

Planning guidance SHALL direct agents to reuse existing capability paths and follow the project's organization for new capabilities, without requiring migration or a new domain registry.

#### Scenario: Existing flat specs
- **WHEN** an existing capability lives at `openspec/specs/user-auth/spec.md`
- **THEN** a delta for that capability remains at `specs/user-auth/spec.md` inside the change
- **THEN** planning does not move it under a project or domain prefix

#### Scenario: Existing grouped specs
- **WHEN** an existing capability lives at `openspec/specs/identity/user-auth/spec.md`
- **THEN** a delta for that capability uses the full `specs/identity/user-auth/spec.md` path inside the change

### Requirement: Keep changes across domains together

Planning guidance SHALL allow one change to carry deltas for every affected capability, including capabilities in different domains, and SHALL distinguish reading a relevant spec from changing its requirements.

#### Scenario: Checkout affects backend and frontend
- **WHEN** one checkout story changes backend API and frontend behavior
- **THEN** one change contains deltas at each affected capability's existing relative path

#### Scenario: Shared behavior is relevant but unchanged
- **WHEN** an agent reads a shared authentication spec for context and its requirements remain unchanged
- **THEN** the guidance does not require a delta for that spec

### Requirement: Verify matching archive destinations

Changes produced by either Let's Spec flow SHALL retain the full capability paths needed for OpenSpec sync/archive to update matching main specs and preserve unrelated specs.

#### Scenario: Archive changes in a flat layout
- **WHEN** a validated change modifies two existing flat capabilities and is archived
- **THEN** each matching main spec contains its updated requirement
- **THEN** an unrelated main spec is byte-for-byte unchanged

#### Scenario: Archive changes in a grouped layout
- **WHEN** a validated change modifies capabilities under different domain prefixes and is archived
- **THEN** each matching main spec is updated at its full original path
- **THEN** capabilities with the same leaf name under different prefixes remain distinct
- **THEN** an unrelated main spec is byte-for-byte unchanged

### Requirement: Explain the shared project layout

The README SHALL explain one root OpenSpec project with shared skills, how domains group specs for applications, services or features, and how a change can affect multiple domains.

#### Scenario: Maintainer organizes a monorepo
- **WHEN** a maintainer reads the domain guidance
- **THEN** it shows a root layout, explains how agents identify relevant specs, and states that domain names do not automatically map to source directories
- **THEN** it explains that existing flat specs continue to work without migration
