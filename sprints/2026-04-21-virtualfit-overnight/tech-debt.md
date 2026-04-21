# Tech Debt Audit

## Date: 2026-04-21 06:45 PDT

## Summary
**2 items found** in test files.

## Items

### 1. Visual tests skipped on CI
- **File**: `e2e/visual.spec.ts:13,27`
- **Type**: `test.skip()`
- **Reason**: Visual baselines generated on macOS, CI runs Linux with different font rendering
- **Fix**: Generate Linux baselines via Docker or accept platform differences

### 2. No TODO/FIXME/XXX found
All test code is clean with no outstanding work markers.

## Recommendations

1. **Visual baselines**: Consider generating platform-specific baselines or increasing pixel tolerance
2. **Test coverage**: Current coverage is good (47 e2e + 111 unit)
3. **Flaky tests**: No flaky tests detected in this audit

## Audit Command
```bash
grep -r "TODO\|FIXME\|XXX\|\.skip(" tests/ e2e/ | wc -l
# Result: 2
```
