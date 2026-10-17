# Changelog

All notable changes to `@constellationdev/mcp` will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Changed

- `api.getCallGraph` inline help, per-method type summary (`constellation://types/api/getCallGraph`),
  and Code Mode guide examples now use the canonical `direction: 'incoming' | 'outgoing' | 'both'`
  enum exclusively. Deprecated values `'callers'` and `'callees'` continue to work end-to-end
  for one release (the Core executor logs a deprecation warning when they are seen).
  Response field keys `callers` and `callees` are unchanged.

### Fixed

- `api.getCapabilities()` no longer reports `isIndexed: true` (with every feature enabled) for a
  registered but never-indexed branch. A successful architecture overview with 0 files now returns
  `isIndexed: false` and the `constellation index` guidance, matching Core's definition.
- `api.getCapabilities()` now returns `lastIndexedAt` for indexed projects. It was read from the
  overview payload, where Core never sets it, instead of the response metadata.

### Deprecated

- `api.getCallGraph` direction values `'callers'` and `'callees'`. Migrate to `'incoming'`
  and `'outgoing'`; the aliases will be removed in a future release.
