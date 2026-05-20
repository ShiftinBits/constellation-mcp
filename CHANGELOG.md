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

### Deprecated

- `api.getCallGraph` direction values `'callers'` and `'callees'`. Migrate to `'incoming'`
  and `'outgoing'`; the aliases will be removed in a future release.
