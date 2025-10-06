---
description: "TuneTrees UI development guidelines and component patterns"
applyTo: "frontend/**/*.{tsx,ts,jsx,js,css,scss}"
---

# TuneTrees UI Development Instructions

## ⚠️ CRITICAL: Legacy App Reference

The **Next.js/FastAPI version** (located in `legacy/` folder) contains screenshots and proven UI patterns that MUST be referenced for all new SolidJS PWA features:

- **Tab Navigation**: Practice | Repertoire | Catalog | Analysis
- **Table Views**: Dense information display with columns (Id, Title, Goal, Type, Structure, Scheduled, Practiced, Stability)
- **Sidebars**: References and Notes panels with expand/collapse
- **Action Buttons**: Add To Review, Filter, Add Tune, Delete Tunes, Columns selector
- **Settings Modal**: Scheduling Options, Spaced Repetition parameters, Account management
- **Tune Editor**: Core Tune Data, User/Repertoire Specific, FSRS Fields sections

**When implementing ANY UI feature**: Check legacy app screenshots first for established patterns, then adapt to SolidJS while maintaining functionality and information density.

## Design Philosophy

TuneTrees follows a **table-centric, productivity-focused design** prioritizing practical functionality for daily use. The interface is optimized for quickly browsing and managing large sets of tunes with information-dense, scannable layouts.

### Core Design Principles ⚠️ CRITICAL - "Make or Break"

1. **Table-Centric UI**: Primary data views MUST use tables (TanStack Solid Table), not card-based layouts

   - Dense, scannable information display
   - Quick browsing of large tune collections
   - Sortable columns, filterable data
   - Exception: Detail views (individual tune pages) may use spacious card layouts

2. **Desktop & Mobile Equally Important**: Same functionality on both platforms with different ergonomics

   - NOT desktop-first, NOT mobile-first
   - Tables adapt responsively (horizontal scroll on mobile if needed)
   - Navigation: Tabs on desktop, collapsible sidebar on mobile
   - Touch targets: 44px minimum on mobile

3. **Functionality Over Aesthetics**: Practical daily use trumps trendy design

   - Information density matters more than spacious layouts
   - Customization options for user preferences
   - Efficient workflows over visual polish
   - Spacious layouts NOT a goal in themselves

4. **User-Controlled Theme**: Light/Dark/System modes as user preference

   - NOT system-forced, NOT hardcoded
   - Settings page must include theme selector
   - Tailwind dark mode classes support all three modes

5. **Legacy App Fidelity**: Match proven patterns from the Next.js/FastAPI version
   - Reference screenshots in design decisions
   - Port business logic, not framework patterns
   - Maintain familiar user workflows
   - Tab navigation: Practice | Repertoire | Catalog | Analysis

### Design Characteristics (Secondary)

- **Minimalist aesthetic**: Clean, uncluttered interfaces (where appropriate)
- **Functional hierarchy**: UI elements sized by frequency of use
- **Subtle visual cues**: Borders, shadows, and color used meaningfully
- **Developer-tool inspiration**: Similar to VS Code's professional appearance
- **Daily-use optimization**: Interface designed for repeated, efficient interactions

## Component Patterns

### Navigation Patterns

#### Desktop Navigation: Horizontal Tabs

```tsx
// Main app navigation tabs (desktop)
<nav className="hidden lg:flex border-b border-gray-200 dark:border-gray-700">
  <A
    href="/practice"
    class="px-4 py-2 border-b-2 border-transparent hover:border-blue-500"
  >
    Practice
  </A>
  <A
    href="/repertoire"
    class="px-4 py-2 border-b-2 border-transparent hover:border-blue-500"
  >
    Repertoire
  </A>
  <A
    href="/catalog"
    class="px-4 py-2 border-b-2 border-transparent hover:border-blue-500"
  >
    Catalog
  </A>
  <A
    href="/analysis"
    class="px-4 py-2 border-b-2 border-transparent hover:border-blue-500"
  >
    Analysis
  </A>
</nav>
```

#### Mobile Navigation: Collapsible Sidebar

```tsx
// Mobile sidebar menu (hamburger icon)
import { createSignal } from "solid-js";

const [sidebarOpen, setSidebarOpen] = createSignal(false);

<div class="lg:hidden">
  <Button
    variant="ghost"
    size="icon"
    onClick={() => setSidebarOpen(!sidebarOpen())}
  >
    <Menu class="h-6 w-6" />
    <span class="sr-only">Toggle menu</span>
  </Button>

  <Show when={sidebarOpen()}>
    <aside class="fixed inset-y-0 left-0 z-50 w-64 bg-white dark:bg-gray-900 shadow-lg">
      <nav class="flex flex-col p-4 space-y-2">
        <A href="/practice" onClick={() => setSidebarOpen(false)}>
          Practice
        </A>
        <A href="/repertoire" onClick={() => setSidebarOpen(false)}>
          Repertoire
        </A>
        <A href="/catalog" onClick={() => setSidebarOpen(false)}>
          Catalog
        </A>
        <A href="/analysis" onClick={() => setSidebarOpen(false)}>
          Analysis
        </A>
      </nav>
    </aside>
    {/* Overlay */}
    <div
      class="fixed inset-0 bg-black/50 z-40"
      onClick={() => setSidebarOpen(false)}
    />
  </Show>
</div>;
```

#### Content Sidebars (References, Notes)

```tsx
// Collapsible sidebar panels (both desktop & mobile)
<aside class="border-l border-gray-200 dark:border-gray-700 w-64">
  <div class="p-4">
    <div class="flex items-center justify-between mb-2">
      <h3 class="font-semibold">References</h3>
      <Button variant="ghost" size="icon" onClick={toggleReferences}>
        {referencesExpanded() ? <MinusIcon /> : <PlusIcon />}
      </Button>
    </div>
    <Show when={referencesExpanded()}>{/* References content */}</Show>
  </div>
</aside>
```

### Button Variants (ShadCN)

- **`default`**: Primary actions (Save, Submit) - solid primary color
- **`outline`**: Secondary actions (Cancel, Sign In) - border with transparent background
- **`ghost`**: Subtle actions, toggles, icon buttons - transparent with hover state
- **`destructive`**: Delete/remove actions - red background
- **`link`**: Text-only links

### Button Order & Positioning

- **Dialog actions**: Right-aligned with primary action on the right
- **Cancel/Close buttons**: Always on the left of primary actions
- **Icon buttons**: Often use `variant="ghost"` with size="icon"

### Dialog Structure Pattern

```tsx
<Dialog open={true} modal={true}>
  <DialogPortal>
    <DialogOverlay className="bg-black/50 fixed inset-0" />
    <DialogContent className="fixed z-50 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
      <DialogHeader>
        <DialogTitle>Title</DialogTitle>
        <DialogClose asChild>
          <Button variant="ghost">
            <XIcon className="w-5 h-5" />
          </Button>
        </DialogClose>
      </DialogHeader>
      {/* Content */}
      <DialogFooter>
        <Button variant="ghost" onClick={handleSubmit}>
          Update
        </Button>
      </DialogFooter>
    </DialogContent>
  </DialogPortal>
</Dialog>
```

## Iconography (Lucide React)

### Common Icons & Usage

- **Save**: `Save` icon - `<Save className="h-4 w-4" />`
- **Cancel/Close**: `XCircle`, `X`
- **Delete**: `TrashIcon`
- **Add**: `PlusIcon` (often blue: `text-blue-500`)
- **Edit**: `PencilIcon`, `PenOffIcon`
- **Toggle/Check**: `SquareCheckBigIcon` (green), `SquareIcon`
- **Dropdown**: `ChevronDownIcon`, `ChevronDown`

### Icon Positioning Rules

- **Icons come AFTER text** in most cases: `Save <Save className="h-4 w-4" />`
- **Icon-only buttons**: Use `size="icon"` and `sr-only` text for accessibility
- **Standard size**: `h-4 w-4` or `h-5 w-5`

## Forms & Validation

### Form Structure (React Hook Form + Zod)

```tsx
const formSchema = z.object({
  // field definitions with validation
});

<Form {...form}>
  <form onSubmit={form.handleSubmit(onSubmit)}>
    <FormField
      control={form.control}
      name="fieldName"
      render={({ field }) => (
        <FormItem className="tune-form-item-style2">
          <FormLabel className="tune-form-label-style">
            <em>Label:</em>
          </FormLabel>
          <FormControl className="tune-form-control-style">
            <Input {...field} value={field.value || ""} />
          </FormControl>
          <FormDescription>Help text</FormDescription>
        </FormItem>
      )}
    />
  </form>
</Form>;
```

## Mobile-First Responsive Design

### Platform Balance: Desktop & Mobile Equally Important

- **Desktop**: Primary platform for daily practice sessions with full table functionality
- **Mobile**: Equal power, adapted ergonomics for on-the-go access
- **Design approach**: Responsive design with appropriate adaptations per platform
- **NOT**: Desktop-first OR Mobile-first - both platforms receive equal priority

### Desktop Optimizations

- **Navigation**: Horizontal tabs (Practice | Repertoire | Catalog | Analysis)
- **Tables**: Full-width with all columns visible
- **Sidebars**: Always visible (References, Notes)
- **Keyboard shortcuts**: Full support for power users

### Mobile Optimizations

- **Navigation**: Collapsible sidebar menu (hamburger icon)
- **Tables**: Horizontal scroll to preserve information density
- **Touch targets**: 44px × 44px minimum
- **Sidebars**: Collapsible panels with expand/collapse

### Responsive Breakpoints (Tailwind)

```css
/* Responsive but NOT mobile-first in priority */
/* Default: Desktop/Mobile simultaneous design */
sm: 640px   /* Small tablets */
md: 768px   /* Tablets */
lg: 1024px  /* Small laptops - tabs appear here */
xl: 1280px  /* Desktop */
2xl: 1536px /* Large desktop */
```

### Table Responsive Behavior

```tsx
// ✅ CORRECT: Horizontal scroll on small screens
<div className="overflow-x-auto">
  <table className="min-w-full">{/* Full table with all columns */}</table>
</div>

// ❌ WRONG: Converting tables to cards on mobile
// DO NOT DO THIS - breaks information density requirement
```

### Future Vision

- **Progressive Web App (PWA)**: Offline sync capabilities
- **Service Worker**: Background data sync
- **Install prompt**: Add to home screen on mobile
- **Offline-first**: SQLite WASM for local-first data

### Touch Interaction Guidelines

- **Minimum size**: 44px × 44px (11 Tailwind units)
- **Preferred size**: 48px × 48px for primary actions
- **Spacing**: Minimum 8px between interactive elements

## Tables & Lists

### ⚠️ PRIMARY DATA VIEW PATTERN: TanStack Solid Table

All primary data views (tune lists, playlist contents, catalog browsing) MUST use table-based layouts, NOT cards.

```tsx
import {
  createSolidTable,
  getCoreRowModel,
  flexRender,
} from "@tanstack/solid-table";
import { For } from "solid-js";

export function TuneList(props: { data: Tune[] }) {
  const table = createSolidTable({
    get data() {
      return props.data;
    },
    columns: [
      { accessorKey: "id", header: "ID" },
      { accessorKey: "title", header: "Title" },
      { accessorKey: "type", header: "Type" },
      { accessorKey: "mode", header: "Mode" },
      // ... more columns
    ],
    getCoreRowModel: getCoreRowModel(),
    // Add sorting, filtering, pagination as needed
  });

  return (
    <table className="w-full">
      <thead className="bg-gray-200 dark:bg-gray-800 sticky top-0">
        <For each={table.getHeaderGroups()}>
          {(headerGroup) => (
            <tr>
              <For each={headerGroup.headers}>
                {(header) => (
                  <th className="px-4 py-2 text-left">
                    {flexRender(
                      header.column.columnDef.header,
                      header.getContext()
                    )}
                  </th>
                )}
              </For>
            </tr>
          )}
        </For>
      </thead>
      <tbody>
        <For each={table.getRowModel().rows}>
          {(row) => (
            <tr className="hover:bg-gray-100 dark:hover:bg-gray-700">
              <For each={row.getVisibleCells()}>
                {(cell) => (
                  <td className="px-4 py-2">
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                )}
              </For>
            </tr>
          )}
        </For>
      </tbody>
    </table>
  );
}
```

### Table Design Guidelines

- **Sticky headers**: `sticky top-0` for column headers
- **Row hover states**: `hover:bg-gray-100 dark:hover:bg-gray-700`
- **Sortable columns**: Click headers to sort (use TanStack Table sorting)
- **Filterable data**: Search/filter controls above table
- **Action columns**: Icon buttons in rightmost column
- **Dense information**: Multiple data points per row (ID, Title, Type, Mode, Scheduled, Practiced, Stability, etc.)
- **Mobile adaptation**: Horizontal scroll if needed, NOT card conversion

### Legacy Table Reference

From Next.js app screenshots - columns to replicate:

- **Id**: Numeric identifier
- **Title**: Tune name (primary info, clickable)
- **Goal**: Target proficiency level
- **Type**: Jig, Reel, Hornpipe, etc.
- **Structure**: ABC/parts structure
- **Scheduled**: Next review date
- **Practiced**: Last practice date
- **Stability**: FSRS stability metric

### Table Structure (Generic)

```tsx
<Table>
  <TableHeader>
    <TableRow className="bg-gray-200 dark:bg-gray-800 sticky top-[-1px]">
      <TableHead>Column</TableHead>
    </TableRow>
  </TableHeader>
  <TableBody>
    <TableRow>
      <TableCell>Content</TableCell>
    </TableRow>
  </TableBody>
</Table>
```

### List Patterns

- **Scrollable content**: Use `max-h-80 overflow-y-auto`
- **Sticky headers**: `sticky top-[-1px] z-40`
- **Row actions**: Icon buttons in the rightmost column
- **Toggle states**: Checkboxes or toggle icons in leftmost column

## Theming & Colors

### User-Controlled Theme System ⚠️ REQUIRED

TuneTrees MUST support user-selectable theme preference, NOT system-forced.

```tsx
// Theme options to implement in settings
type ThemePreference = "light" | "dark" | "system";

// User settings should include:
interface UserSettings {
  theme: ThemePreference; // User's explicit choice
  // ... other settings
}

// Apply theme based on user preference
const applyTheme = (preference: ThemePreference) => {
  if (preference === "system") {
    // Use system preference
    const isDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    document.documentElement.classList.toggle("dark", isDark);
  } else {
    // Use explicit user choice
    document.documentElement.classList.toggle("dark", preference === "dark");
  }
};
```

### Theme Settings UI (Required in Settings Page)

```tsx
<FormField name="theme">
  <FormLabel>Theme Preference</FormLabel>
  <Select value={theme()} onChange={setTheme}>
    <SelectTrigger>
      <SelectValue placeholder="Select theme" />
    </SelectTrigger>
    <SelectContent>
      <SelectItem value="light">Light Mode</SelectItem>
      <SelectItem value="dark">Dark Mode</SelectItem>
      <SelectItem value="system">System Default</SelectItem>
    </SelectContent>
  </Select>
</FormField>
```

### Color Usage

- **Primary**: Default buttons, links
- **Gray backgrounds**: `bg-gray-200 dark:bg-gray-800` for headers
- **Success/Active**: Green (`text-green-500`)
- **Actions**: Blue (`text-blue-500`)
- **Destructive**: Red for delete actions

### Dark Mode Support

- **Toggle component**: `ModeToggle` with sun/moon icons
- **CSS classes**: `dark:` variants for dark mode styles

## Authentication UI

### Auth Button Patterns

```tsx
// Standard auth
<Button variant="outline">Sign in</Button>
<Button variant="outline">New user</Button>
<Button variant="outline">Demo user</Button>
<Button variant="ghost" onClick={signOut}>Sign Out</Button>
```

## Accessibility Requirements

### Screen Reader Support

```tsx
<span className="sr-only">Toggle theme</span>
<EyeIcon className="h-4 w-4" aria-hidden="true" />
```

### Focus Management

- **Dialog focus**: Auto-focus on primary action
- **Keyboard navigation**: Escape key handling
- **Tab order**: Logical focus flow

## Toast Notifications

### Toast Usage

```tsx
const { toast } = useToast();

const handleError = (message: string) => {
  toast({
    title: "Error",
    description: message,
  });
};
```

## References

For complete UI patterns and detailed examples, see the full style guide: `frontend/UI_STYLE_GUIDE2.md`

### Terminology Consistency

- `docs/sr_readme.md` - Spaced Repetition Terminology
- `docs/terminology_guide.md` - General Application Terminology

## ⚠️ Common Mistakes to Avoid

### ❌ WRONG: Card-based layouts for primary data views

```tsx
// DON'T DO THIS for tune lists, catalog browsing, etc.
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
  <For each={tunes()}>
    {(tune) => (
      <div className="p-6 border rounded-lg shadow-sm">
        <h3>{tune.title}</h3>
        <p>{tune.type}</p>
      </div>
    )}
  </For>
</div>
```

### ✅ CORRECT: Table-based layouts with TanStack Solid Table

```tsx
// DO THIS instead
const table = createSolidTable({
  get data() {
    return tunes();
  },
  columns: [
    { accessorKey: "id", header: "ID" },
    { accessorKey: "title", header: "Title" },
    { accessorKey: "type", header: "Type" },
    // ... more columns
  ],
  getCoreRowModel: getCoreRowModel(),
});

<table className="w-full">{/* Table implementation */}</table>;
```

### ❌ WRONG: System-forced dark mode

```tsx
// DON'T hardcode theme choice
const isDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
```

### ✅ CORRECT: User-controlled theme preference

```tsx
// DO let user choose explicitly
const [theme, setTheme] = createSignal<"light" | "dark" | "system">("system");
// Save to user settings, apply based on preference
```

### ❌ WRONG: Mobile-only navigation without desktop equivalent

```tsx
// DON'T ignore desktop power users
<div className="flex flex-col space-y-2">{/* Only sidebar nav */}</div>
```

### ✅ CORRECT: Desktop tabs + Mobile sidebar

```tsx
// DO provide optimized navigation for both
<nav className="hidden lg:flex">
  {/* Desktop horizontal tabs */}
</nav>
<div className="lg:hidden">
  {/* Mobile sidebar menu */}
</div>
```

### ❌ WRONG: Spacious layouts as default

```tsx
// DON'T waste space on list views
<div className="p-8 mb-6 space-y-4">{/* Too much padding/margin */}</div>
```

### ✅ CORRECT: Information-dense when appropriate

```tsx
// DO maximize visible data on list views
<tr className="hover:bg-gray-100">
  <td className="px-4 py-2">{/* Dense but readable */}</td>
</tr>
```
