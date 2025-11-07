# shadcn-solid + Kobalte Component Migration Checklist

## Overview

This document tracks the migration of UI components from custom implementations to shadcn-solid + Kobalte primitives. The goal is to ensure consistent UI patterns, better accessibility, and easier maintenance.

## Why Migrate?

- **Accessibility**: Kobalte provides ARIA-compliant primitives
- **Consistency**: shadcn-solid ensures uniform styling and behavior
- **Maintenance**: Less custom code to maintain
- **Type Safety**: Better TypeScript support
- **Dark Mode**: Built-in theme support
- **Keyboard Navigation**: Full keyboard accessibility out of the box

## Migration Priorities

### High Priority (This PR)
- [x] Select/Dropdown component (CompactFilterDropdown)
- [x] Checkbox component
- [x] Dialog/AlertDialog component (ConfirmDialog)

### Medium Priority (Future PRs)
- [ ] Label component
- [ ] Input component (if not already using shadcn-solid)
- [ ] Textarea component
- [ ] RadioGroup component
- [ ] Combobox component (RecallEvalComboBox)
- [ ] Popover component
- [ ] Tooltip component

### Low Priority (Nice to Have)
- [ ] Accordion component
- [ ] Tabs component (if replacing custom implementation)
- [ ] Toast component (currently using solid-sonner)
- [ ] DropdownMenu component
- [ ] ContextMenu component

## Components Already Using Kobalte ✅

- Button (@kobalte/core/button)
- Switch (@kobalte/core/switch)
- Table (custom, but acceptable)

## Migration Process

For each component:

1. **Install shadcn-solid component**
   ```bash
   npx shadcn-solid@latest add [component-name]
   ```

2. **Update component implementation**
   - Replace custom implementation with shadcn-solid version
   - Maintain existing API/props where possible
   - Update imports and references

3. **Test accessibility**
   - Keyboard navigation (Tab, Enter, Escape, Arrow keys)
   - Screen reader compatibility
   - Focus management

4. **Test theming**
   - Verify light mode styling
   - Verify dark mode styling
   - Check Tailwind CSS variables

5. **Add tests**
   - Unit tests for component behavior
   - E2E tests for user interactions
   - Accessibility tests

6. **Update documentation**
   - Component JSDoc comments
   - Usage examples
   - Migration notes

## Testing Checklist

### Accessibility Testing
- [ ] Keyboard navigation works correctly
- [ ] Focus is managed properly
- [ ] ARIA attributes are present
- [ ] Screen reader announces content correctly
- [ ] Touch targets are at least 44x44px (mobile)

### Visual Testing
- [ ] Light mode styling is correct
- [ ] Dark mode styling is correct
- [ ] Hover states work
- [ ] Active/selected states are visible
- [ ] Disabled states are styled correctly
- [ ] Animation/transitions are smooth

### Functional Testing
- [ ] Component props work as expected
- [ ] Event handlers fire correctly
- [ ] State updates properly
- [ ] Edge cases handled (empty, loading, error states)

### Integration Testing
- [ ] Component works in existing pages
- [ ] No regressions in existing functionality
- [ ] Performance is acceptable

## Quality Gates

Before merging:

- [ ] All TypeScript errors resolved (`npm run typecheck`)
- [ ] All lint warnings resolved (`npx biome check`)
- [ ] All tests passing (`npm run test`)
- [ ] E2E tests passing for affected features
- [ ] Visual review completed (screenshots provided)
- [ ] Accessibility review completed
- [ ] Code review completed

## Reference Documentation

- [shadcn-solid Docs](https://shadcn-solid.com/)
- [Kobalte Docs](https://kobalte.dev/)
- [SolidJS Docs](https://www.solidjs.com/)
- [Tailwind CSS Docs](https://tailwindcss.com/)
- [UI Development Instructions](.github/instructions/ui-development.instructions.md)

## Notes

- Prefer shadcn-solid components over custom implementations
- Maintain backward compatibility where possible
- Follow SolidJS patterns (signals, createEffect, createMemo)
- Avoid React patterns (useState, useEffect, etc.)
- Keep changes minimal and focused
