# Component Usage Examples

This file demonstrates how to use the newly migrated shadcn-solid + Kobalte components.

## Checkbox

```tsx
import { Checkbox, CheckboxControl, CheckboxIndicator, CheckboxLabel } from "@/components/ui/checkbox";
import { createSignal } from "solid-js";

function MyComponent() {
  const [checked, setChecked] = createSignal(false);

  return (
    <Checkbox checked={checked()} onChange={setChecked}>
      <CheckboxControl>
        <CheckboxIndicator />
      </CheckboxControl>
      <CheckboxLabel>Accept terms and conditions</CheckboxLabel>
    </Checkbox>
  );
}
```

## AlertDialog

```tsx
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { createSignal } from "solid-js";

function MyComponent() {
  const [open, setOpen] = createSignal(false);

  return (
    <>
      <Button onClick={() => setOpen(true)}>Delete</Button>

      <AlertDialog open={open()} onOpenChange={setOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete your data.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={() => {
              // Perform delete action
              setOpen(false);
            }}>
              Delete
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
```

## ConfirmDialog (Simplified API)

```tsx
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { createSignal } from "solid-js";

function MyComponent() {
  const [showDialog, setShowDialog] = createSignal(false);

  return (
    <>
      <button onClick={() => setShowDialog(true)}>Delete Tunes</button>

      <ConfirmDialog
        isOpen={showDialog()}
        title="Delete Tunes?"
        message="Are you sure you want to delete 3 tunes? This action cannot be undone."
        confirmText="Delete"
        variant="danger"
        onConfirm={() => {
          // Perform delete action
          setShowDialog(false);
        }}
        onCancel={() => setShowDialog(false)}
      />
    </>
  );
}
```

## Select

```tsx
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { createSignal } from "solid-js";
import { For } from "solid-js";

function MyComponent() {
  const [value, setValue] = createSignal("");
  const options = ["Apple", "Banana", "Cherry", "Date"];

  return (
    <Select value={value()} onChange={setValue} placeholder="Select a fruit">
      <SelectTrigger>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <For each={options}>
          {(option) => <SelectItem value={option}>{option}</SelectItem>}
        </For>
      </SelectContent>
    </Select>
  );
}
```

## CompactFilterDropdown (Multi-Select)

```tsx
import { CompactFilterDropdown } from "@/components/catalog/CompactFilterDropdown";
import { createSignal } from "solid-js";

function MyComponent() {
  const [selectedTypes, setSelectedTypes] = createSignal<string[]>([]);
  const types = ["Reel", "Jig", "Hornpipe", "Polka", "Waltz"];

  return (
    <CompactFilterDropdown
      label="Type"
      options={types}
      selectedValues={selectedTypes()}
      onChange={setSelectedTypes}
      placeholder="All Types"
    />
  );
}
```

## Accessibility Features

All components include:

- **Keyboard Navigation**: Full support for Tab, Enter, Escape, Arrow keys
- **ARIA Attributes**: Proper roles, labels, and states
- **Focus Management**: Automatic focus handling in dialogs
- **Screen Reader Support**: Announcements and descriptions
- **Touch Targets**: Minimum 44x44px on mobile

## Dark Mode

All components automatically support dark mode through Tailwind CSS `dark:` variants.

## Testing

### Unit Tests

```tsx
import { render, screen } from "@solidjs/testing-library";
import { describe, expect, it } from "vitest";
import { Checkbox, CheckboxControl, CheckboxIndicator, CheckboxLabel } from "@/components/ui/checkbox";

describe("Checkbox", () => {
  it("renders with label", () => {
    render(() => (
      <Checkbox>
        <CheckboxControl><CheckboxIndicator /></CheckboxControl>
        <CheckboxLabel>Accept terms</CheckboxLabel>
      </Checkbox>
    ));

    expect(screen.getByText("Accept terms")).toBeDefined();
  });
});
```

### E2E Tests

```tsx
import { test, expect } from "@playwright/test";

test("user can check checkbox", async ({ page }) => {
  await page.goto("/form");
  
  // Click checkbox by label
  await page.getByText("Accept terms").click();
  
  // Verify checked state
  const checkbox = page.locator("input[type='checkbox']");
  await expect(checkbox).toBeChecked();
});
```

## Best Practices

1. **Always use signals for state**: `createSignal()` not `useState()`
2. **Call signals as functions**: `value()` not `value`
3. **Use proper event handlers**: `onClick={handler}` not `onClick={handler()}`
4. **Clean up effects**: Use `onCleanup()` in `createEffect()`
5. **Prefer Kobalte primitives**: Use shadcn-solid components over custom implementations
6. **Test accessibility**: Always test keyboard navigation and screen readers

## Migration Checklist

When migrating a component:

- [ ] Replace custom implementation with shadcn-solid component
- [ ] Update imports
- [ ] Maintain existing API/props
- [ ] Test keyboard navigation
- [ ] Test dark mode
- [ ] Add unit tests
- [ ] Update documentation
- [ ] Run typecheck, lint, and tests
- [ ] Visual review
