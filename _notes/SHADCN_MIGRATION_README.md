# shadcn-solid + Kobalte Migration Guide

This guide documents patterns and best practices for migrating components to shadcn-solid + Kobalte.

## Table of Contents

1. [Overview](#overview)
2. [Installation](#installation)
3. [Component Patterns](#component-patterns)
4. [Migration Examples](#migration-examples)
5. [Common Pitfalls](#common-pitfalls)
6. [Testing Patterns](#testing-patterns)

## Overview

**shadcn-solid** is a collection of reusable components built with:
- **Kobalte**: Unstyled, accessible UI primitives for SolidJS
- **Tailwind CSS**: Utility-first CSS framework
- **class-variance-authority (CVA)**: Type-safe variant styles

### Key Principles

1. **Copy, Don't Install**: Components are copied into your project, not installed as dependencies
2. **Customizable**: You own the code and can modify it freely
3. **Accessible**: Built on Kobalte's ARIA-compliant primitives
4. **Type-Safe**: Full TypeScript support

## Installation

### Add a Component

```bash
npx shadcn-solid@latest add select
npx shadcn-solid@latest add checkbox
npx shadcn-solid@latest add alert-dialog
```

This copies the component into `src/components/ui/`.

### Configuration

Your `components.json`:

```json
{
  "$schema": "https://shadcn-solid.com/schema.json",
  "tailwind": {
    "config": "tailwind.config.cjs",
    "css": {
      "path": "src/App.css",
      "variable": true
    },
    "color": "slate",
    "prefix": ""
  },
  "alias": {
    "component": "src/components",
    "cn": "@/lib/utils"
  }
}
```

## Component Patterns

### Select Component

**Before (Custom Implementation)**:

```tsx
// Custom dropdown with manual state management
const [isOpen, setIsOpen] = createSignal(false);

<div ref={dropdownRef}>
  <button onClick={() => setIsOpen(!isOpen())}>
    {displayText()}
  </button>
  <Show when={isOpen()}>
    <div class="dropdown-menu">
      {/* Options */}
    </div>
  </Show>
</div>
```

**After (shadcn-solid Select)**:

```tsx
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

<Select value={value()} onChange={setValue}>
  <SelectTrigger>
    <SelectValue placeholder="Select an option" />
  </SelectTrigger>
  <SelectContent>
    <For each={options()}>
      {(option) => (
        <SelectItem value={option.value}>
          {option.label}
        </SelectItem>
      )}
    </For>
  </SelectContent>
</Select>
```

**Benefits**:
- Built-in keyboard navigation
- Proper focus management
- ARIA attributes handled automatically
- Consistent styling

### Checkbox Component

**Before (Native Checkbox)**:

```tsx
<label>
  <input
    type="checkbox"
    checked={checked()}
    onChange={(e) => setChecked(e.target.checked)}
  />
  <span>Label</span>
</label>
```

**After (shadcn-solid Checkbox)**:

```tsx
import { Checkbox } from "@/components/ui/checkbox";

<Checkbox checked={checked()} onChange={setChecked}>
  Label
</Checkbox>
```

**Benefits**:
- Customizable appearance
- Better styling control
- Consistent with other shadcn-solid components

### Dialog/AlertDialog Component

**Before (Custom Modal)**:

```tsx
<Show when={isOpen()}>
  <div class="backdrop" onClick={onCancel} />
  <div class="dialog">
    <h2>{title}</h2>
    <p>{message}</p>
    <button onClick={onCancel}>Cancel</button>
    <button onClick={onConfirm}>Confirm</button>
  </div>
</Show>
```

**After (shadcn-solid AlertDialog)**:

```tsx
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";

<AlertDialog open={isOpen()}>
  <AlertDialogContent>
    <AlertDialogHeader>
      <AlertDialogTitle>{title}</AlertDialogTitle>
      <AlertDialogDescription>{message}</AlertDialogDescription>
    </AlertDialogHeader>
    <AlertDialogFooter>
      <Button variant="outline" onClick={onCancel}>
        Cancel
      </Button>
      <Button variant="destructive" onClick={onConfirm}>
        Confirm
      </Button>
    </AlertDialogFooter>
  </AlertDialogContent>
</AlertDialog>
```

**Benefits**:
- Proper focus trap
- Escape key handling
- Scroll locking
- Portal rendering

## Migration Examples

### Example 1: CompactFilterDropdown → Select

**Original Component** (`CompactFilterDropdown.tsx`):

```tsx
export const CompactFilterDropdown: Component<CompactFilterDropdownProps> = (props) => {
  const [isOpen, setIsOpen] = createSignal(false);
  
  return (
    <div class="relative">
      <button onClick={() => setIsOpen(!isOpen())}>
        {displayText()}
      </button>
      <Show when={isOpen()}>
        <div class="dropdown-menu">
          <For each={props.options}>
            {(option) => (
              <label>
                <input
                  type="checkbox"
                  checked={props.selectedValues.includes(option)}
                  onChange={() => toggleValue(option)}
                />
                {option}
              </label>
            )}
          </For>
        </div>
      </Show>
    </div>
  );
};
```

**Migrated Version** (using shadcn-solid Select):

```tsx
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";

export const CompactFilterDropdown: Component<CompactFilterDropdownProps> = (props) => {
  return (
    <Select
      multiple
      value={props.selectedValues}
      onChange={props.onChange}
      placeholder={props.placeholder || props.label}
    >
      <SelectTrigger class="min-w-[140px]">
        <SelectValue>
          {() => {
            const count = props.selectedValues.length;
            if (count === 0) return props.placeholder || props.label;
            return `${props.label} (${count} selected)`;
          }}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        <For each={props.options}>
          {(option) => (
            <SelectItem value={option}>
              <div class="flex items-center gap-2">
                <Checkbox checked={props.selectedValues.includes(option)} />
                <span>{option}</span>
              </div>
            </SelectItem>
          )}
        </For>
      </SelectContent>
    </Select>
  );
};
```

### Example 2: ConfirmDialog → AlertDialog

**Original Component** (`ConfirmDialog.tsx`):

```tsx
export const ConfirmDialog: Component<ConfirmDialogProps> = (props) => {
  return (
    <Show when={props.isOpen}>
      <div class="backdrop" onClick={props.onCancel} />
      <div class="dialog">
        <h2>{props.title}</h2>
        <p>{props.message}</p>
        <button onClick={props.onCancel}>
          {props.cancelText || "Cancel"}
        </button>
        <button onClick={props.onConfirm}>
          {props.confirmText || "Confirm"}
        </button>
      </div>
    </Show>
  );
};
```

**Migrated Version**:

```tsx
import { AlertDialog, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";

export const ConfirmDialog: Component<ConfirmDialogProps> = (props) => {
  return (
    <AlertDialog open={props.isOpen} onOpenChange={(open) => !open && props.onCancel()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{props.title}</AlertDialogTitle>
          <AlertDialogDescription>{props.message}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <Button variant="outline" onClick={props.onCancel}>
            {props.cancelText || "Cancel"}
          </Button>
          <Button
            variant={props.variant === "primary" ? "default" : "destructive"}
            onClick={props.onConfirm}
          >
            {props.confirmText || "Confirm"}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};
```

## Common Pitfalls

### 1. Don't Mix React and SolidJS Patterns

❌ **Wrong**:
```tsx
const [value, setValue] = useState(""); // React pattern
useEffect(() => { ... }); // React pattern
```

✅ **Correct**:
```tsx
const [value, setValue] = createSignal(""); // SolidJS pattern
createEffect(() => { ... }); // SolidJS pattern
```

### 2. Remember to Call Signals

❌ **Wrong**:
```tsx
<div>{value}</div> // Missing function call
```

✅ **Correct**:
```tsx
<div>{value()}</div> // Correct signal call
```

### 3. Use Proper Event Handlers

❌ **Wrong**:
```tsx
<button onClick={handleClick()}> // Immediately invokes
```

✅ **Correct**:
```tsx
<button onClick={handleClick}> // Passes function reference
// or
<button onClick={() => handleClick()}> // Arrow function
```

### 4. Don't Forget Cleanup

❌ **Wrong**:
```tsx
onMount(() => {
  document.addEventListener("click", handler);
  // No cleanup!
});
```

✅ **Correct**:
```tsx
onMount(() => {
  document.addEventListener("click", handler);
});

onCleanup(() => {
  document.removeEventListener("click", handler);
});
```

## Testing Patterns

### Unit Test Example

```tsx
import { render, screen } from "@solidjs/testing-library";
import { describe, expect, it } from "vitest";
import { CompactFilterDropdown } from "./CompactFilterDropdown";

describe("CompactFilterDropdown", () => {
  it("renders with label", () => {
    render(() => (
      <CompactFilterDropdown
        label="Type"
        options={["Reel", "Jig"]}
        selectedValues={[]}
        onChange={() => {}}
      />
    ));
    
    expect(screen.getByText("Type")).toBeInTheDocument();
  });

  it("shows selected count", async () => {
    const { rerender } = render(() => (
      <CompactFilterDropdown
        label="Type"
        options={["Reel", "Jig"]}
        selectedValues={["Reel"]}
        onChange={() => {}}
      />
    ));
    
    expect(screen.getByText("Type (1 selected)")).toBeInTheDocument();
  });
});
```

### E2E Test Example

```tsx
import { expect, test } from "@playwright/test";

test("user can filter by type", async ({ page }) => {
  await page.goto("/catalog");
  
  // Open filter dropdown
  await page.getByRole("button", { name: "Type" }).click();
  
  // Select "Reel"
  await page.getByRole("option", { name: "Reel" }).click();
  
  // Verify filter applied
  await expect(page.getByText("Type (1 selected)")).toBeVisible();
  
  // Verify results filtered
  const rows = page.locator("[data-testid='tune-row']");
  await expect(rows.first()).toContainText("Reel");
});
```

## Resources

- [shadcn-solid Documentation](https://shadcn-solid.com/)
- [Kobalte Documentation](https://kobalte.dev/)
- [SolidJS Documentation](https://www.solidjs.com/)
- [UI Development Instructions](.github/instructions/ui-development.instructions.md)
- [TuneTrees Copilot Instructions](.github/copilot-instructions.md)

## Support

For questions or issues:
1. Check existing components in `src/components/ui/`
2. Review Kobalte examples at [kobalte.dev](https://kobalte.dev/)
3. Consult shadcn-solid docs at [shadcn-solid.com](https://shadcn-solid.com/)
