# TuneTrees UI Style Guide

_Last updated: July 2025_

## Overview

This style guide is derived from analyzing the actual TuneTrees codebase to document existing UI patterns, conventions, and design decisions. Use this as a reference for creating consistent UI components.

## General Style Philosophy

TuneTrees follows a **minimalist, productivity-focused design** inspired by developer tools like VS Code. The interface prioritizes function over decoration, with clean lines, subtle borders, and restrained use of color. This approach reflects the app's purpose as a daily-use practice tool where users need quick, efficient access to their musical repertoire.

### Design Characteristics
- **Minimalist aesthetic**: Clean, uncluttered interfaces with plenty of white space
- **Functional hierarchy**: UI elements are sized and positioned based on frequency of use
- **Subtle visual cues**: Borders, shadows, and color are used sparingly but meaningfully
- **Developer-tool inspiration**: Similar to VS Code's clean, professional appearance
- **Daily-use optimization**: Interface designed for repeated, efficient daily interactions

### Interaction Philosophy
- **Keyboard-first**: Many actions support keyboard shortcuts and focus management
- **Minimal clicks**: Common workflows are streamlined to reduce interaction overhead
- **Progressive disclosure**: Advanced options are hidden until needed
- **Contextual actions**: Buttons and controls appear when relevant to the current task
- **Consistent gestures**: Similar actions work the same way across different parts of the app

## General Principles

- **Clarity:** UI actions are explicit and labeled. Avoid ambiguous icons or actions.
- **Feedback:** All user actions (save, delete, error, loading) provide immediate, visible feedback.
- **Consistency:** Reuse patterns for dialogs, buttons, icons, and forms across the app.
- **Accessibility:** All interactive elements are keyboard accessible and have clear focus states.
- **Terminology:** Use consistent naming as defined in the terminology guides (see References section).

---

## 1. Buttons & Action Patterns

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

### Examples from Codebase
```tsx
// SaveChangesOrNotDialog pattern
<div className="mt-4 flex justify-end space-x-2">
  <Button variant="ghost" onClick={onCancel}>
    Cancel
    <XCircle className="h-4 w-4" />
  </Button>
  <Button variant="ghost" onClick={onDiscard}>
    Discard
    <TrashIcon className="h-4 w-4" />
  </Button>
  <Button variant="ghost" onClick={onSave} autoFocus>
    Save
    <Save className="h-4 w-4" />
  </Button>
</div>

// Auth buttons
<Button variant="outline">Sign in</Button>
<Button variant="outline">New user</Button>
```

---

## 2. Iconography: Icon Usage (Lucide React)

### Common Icons
- **Save**: `Save` icon
- **Cancel/Close**: `XCircle`, `X`
- **Delete**: `TrashIcon`
- **Add**: `PlusIcon` (often blue: `text-blue-500`)
- **Edit**: `PencilIcon`, `PenOffIcon`
- **Toggle/Check**: `SquareCheckBigIcon` (green), `SquareIcon`
- **Dropdown**: `ChevronDownIcon`, `ChevronDown`
- **External link**: `ExternalLink`
- **Upload**: `Upload`
- **Theme toggle**: `Sun`, `Moon`
- **Show/Hide**: `EyeIcon`, `EyeOffIcon`

### Icon Positioning
- **Icons come AFTER text** in most cases: `Save <Save className="h-4 w-4" />`
- **Icon-only buttons**: Use `size="icon"` and `sr-only` text for accessibility
- **Standard size**: `h-4 w-4` or `h-5 w-5`

### Icon Colors
- **Add buttons**: Blue icons (`text-blue-500`)
- **Success/Active**: Green (`text-green-500`)
- **Default**: Inherit current color

---

## 3. Dialogs & Modals

### Structure (Radix/ShadCN)
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

### Save Changes Pattern
- **Unsaved changes dialog**: Uses `SaveChangesOrNotDialog` component
- **Three options**: Save, Discard, Cancel
- **Auto-focus**: Save button gets focus by default
- **Escape key**: Handled to trigger save-or-discard check

---

## 4. Forms & Validation

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
</Form>
```

### Input Components
- **Text inputs**: `Input` component (ShadCN)
- **Text areas**: `AutoResizingTextarea` for expandable content
- **Passwords**: `PasswordInput` with show/hide toggle
- **Selects**: `GenreSelector`, ShadCN Select components
- **Toggles**: `Switch`, `Checkbox` components

---

## 5. Tables & Lists

### Table Structure
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

---

## 6. Dropdowns & Menus

### Dropdown Menu Pattern
```tsx
<DropdownMenu>
  <DropdownMenuTrigger asChild>
    <Button variant="outline">
      {currentSelection}
      <ChevronDownIcon className="w-4 h-4" />
    </Button>
  </DropdownMenuTrigger>
  <DropdownMenuContent align="end">
    <DropdownMenuItem onClick={handler}>Option</DropdownMenuItem>
    <DropdownMenuSeparator />
  </DropdownMenuContent>
</DropdownMenu>
```

---

## 7. Toasts & Notifications

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

### Toast Patterns
- **Error toasts**: Include "Error" title
- **Simple structure**: Title and description
- **Long timeout**: `TOAST_REMOVE_DELAY = 1000000` (very long-lived)
- **Limited count**: `TOAST_LIMIT = 1`

---

## 8. Theming & Colors

### CSS Custom Properties
```css
:root {
  --background: 0 0% 100%;
  --foreground: 222.2 84% 4.9%;
  --primary: 222.2 47.4% 11.2%;
  --destructive: 0 84.2% 60.2%;
  /* ... */
}
```

### Dark Mode
- **Toggle component**: `ModeToggle` with sun/moon icons
- **Theme options**: Light, Dark, System
- **CSS classes**: `dark:` variants for dark mode styles

### Color Usage
- **Primary**: Default buttons, links
- **Gray backgrounds**: `bg-gray-200 dark:bg-gray-800` for headers
- **Success/Active**: Green (`text-green-500`)
- **Actions**: Blue (`text-blue-500`)
- **Destructive**: Red for delete actions

---

## 9. Loading & Empty States

### Loading Patterns
```tsx
if (isLoading) {
  return <div>Loading...</div>;
}

// Suspense fallback
<Suspense fallback={<div>Loading...</div>}>
```

### Empty State Handling
- **No playlists**: Auto-open creation dialog
- **Friendly messages**: "No tunes yet. Add one!"
- **Call-to-action**: Include add/create buttons

---

## 10. Authentication UI

### Auth Button Patterns
```tsx
// Social login
<button className="bg-pink-400 text-white p-1 rounded-md m-1 text-lg">
  Sign In With Google
</button>
<button className="bg-black text-white p-1 rounded-md m-1 text-lg">
  Sign In With GitHub
</button>

// Standard auth
<Button variant="outline">Sign in</Button>
<Button variant="outline">New user</Button>
<Button variant="outline">Demo user</Button>
<Button variant="ghost" onClick={signOut}>Sign Out</Button>
```

### User Button/Avatar
- **Dropdown menu**: User avatar/name with dropdown
- **Menu items**: Settings, Sign Out, Theme Toggle
- **Responsive**: Different layouts for logged in/out states

---

## 11. Accessibility Patterns

### Screen Reader Support
```tsx
<span className="sr-only">Toggle theme</span>
<EyeIcon className="h-4 w-4" aria-hidden="true" />
```

### Focus Management
- **Dialog focus**: Auto-focus on primary action
- **Keyboard navigation**: Escape key handling
- **Tab order**: Logical focus flow

---

## 12. CSS Organization

### Styling Approach
- **Tailwind CSS**: Primary styling method
- **CSS Modules**: Component-specific styles (`.module.css`)
- **CSS custom properties**: Theme variables
- **ShadCN**: Pre-built accessible components

### Class Naming
- **Utility-first**: Tailwind classes in JSX
- **Custom classes**: Module CSS for complex layouts
- **BEM-like**: Module CSS follows component naming

---

## 13. State Management Patterns

### Context Usage
- **User session**: `useSession()` from NextAuth
- **Theme**: `useTheme()` from next-themes
- **Toast**: `useToast()` for notifications
- **Custom contexts**: Feature-specific state

### Form State
- **React Hook Form**: Primary form library
- **Zod validation**: Schema validation
- **Controlled components**: All form inputs are controlled

---

## 14. Mobile & Responsive Design

### Current State & Vision
- **Primary platform**: Desktop/laptop for daily practice sessions
- **Mobile goal**: Functional smartphone access for quick reference and light editing
- **Future vision**: Progressive Web App (PWA) with offline sync capabilities
- **Design approach**: Mobile-first responsive design with progressive enhancement

### Mobile-First Principles
- **Touch-friendly targets**: Minimum 44px tap targets (following iOS/Android guidelines)
- **Thumb-zone optimization**: Critical actions within easy thumb reach
- **Simplified navigation**: Collapsed/drawer navigation for small screens
- **Reduced cognitive load**: Fewer options visible at once on mobile
- **Gesture support**: Swipe, pull-to-refresh, and other mobile-native interactions

### Responsive Breakpoints (Tailwind)
```css
/* Mobile first approach */
/* Default: Mobile (320px+) */
sm: 640px   /* Small tablets */
md: 768px   /* Tablets */
lg: 1024px  /* Small laptops */
xl: 1280px  /* Desktop */
2xl: 1536px /* Large desktop */
```

### Mobile-Specific Patterns

#### Navigation
```tsx
// Desktop: Full navigation bar
<nav className="hidden md:flex items-center space-x-4">
  <NavItem>Practice</NavItem>
  <NavItem>Repertoire</NavItem>
</nav>

// Mobile: Hamburger menu or bottom navigation
<nav className="md:hidden">
  <MobileMenuButton />
  <MobileDrawer />
</nav>
```

#### Tables & Data Display
- **Desktop**: Full table with all columns
- **Tablet**: Hide less critical columns, use horizontal scroll
- **Mobile**: Card-based layout or accordion-style rows
```tsx
// Responsive table approach
<div className="hidden md:block">
  <Table>{/* Full table */}</Table>
</div>
<div className="md:hidden space-y-2">
  {items.map(item => <MobileCard key={item.id} {...item} />)}
</div>
```

#### Dialogs & Modals
- **Desktop**: Centered modal dialogs
- **Mobile**: Full-screen or bottom sheet modals
```tsx
<DialogContent className="
  fixed inset-x-0 bottom-0 rounded-t-lg
  md:inset-auto md:top-1/2 md:left-1/2 md:-translate-x-1/2 md:-translate-y-1/2
  md:max-w-lg md:rounded-lg
">
```

#### Form Layouts
- **Desktop**: Multi-column forms with side-by-side fields
- **Mobile**: Single-column, stacked layout
```tsx
<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
  <FormField name="title" />
  <FormField name="genre" />
</div>
```

### Touch Interaction Guidelines

#### Button Sizing
- **Minimum size**: 44px × 44px (11 Tailwind units)
- **Preferred size**: 48px × 48px for primary actions
- **Spacing**: Minimum 8px between interactive elements

#### Gesture Patterns
- **Swipe actions**: Delete, archive, mark complete
- **Pull-to-refresh**: Reload data in lists
- **Long press**: Context menus, drag-and-drop initiation
- **Pinch-to-zoom**: For sheet music or detailed content

### Mobile-Optimized Components

#### Mobile Navigation Drawer
```tsx
<Sheet>
  <SheetTrigger asChild>
    <Button variant="ghost" size="icon" className="md:hidden">
      <MenuIcon className="h-6 w-6" />
    </Button>
  </SheetTrigger>
  <SheetContent side="left" className="w-64">
    <nav className="space-y-4">
      {/* Navigation items */}
    </nav>
  </SheetContent>
</Sheet>
```

#### Mobile-First Cards
```tsx
<Card className="p-4 space-y-3">
  <div className="flex justify-between items-start">
    <h3 className="font-medium">{title}</h3>
    <Button variant="ghost" size="sm">
      <MoreVertical className="h-4 w-4" />
    </Button>
  </div>
  <div className="text-sm text-muted-foreground">
    {/* Condensed information */}
  </div>
  <div className="flex gap-2">
    {/* Action buttons */}
  </div>
</Card>
```

#### Responsive Typography
```css
/* Mobile-first responsive text sizes */
.title {
  @apply text-lg md:text-xl lg:text-2xl;
}
.body {
  @apply text-sm md:text-base;
}
```

### Progressive Web App (PWA) Considerations

#### Offline-First Design
- **Graceful degradation**: Show cached content when offline
- **Sync indicators**: Clear visual feedback for sync status
- **Conflict resolution**: Handle data conflicts when reconnecting
- **Local storage**: Cache critical data for offline access

#### PWA-Ready Components
```tsx
// Offline status indicator
<div className="flex items-center gap-2 text-sm">
  {isOffline ? (
    <>
      <WifiOff className="h-4 w-4" />
      <span>Offline</span>
    </>
  ) : (
    <>
      <Wifi className="h-4 w-4" />
      <span>Online</span>
    </>
  )}
</div>

// Sync status for forms
<div className="flex items-center gap-2">
  {isSyncing ? (
    <Loader2 className="h-4 w-4 animate-spin" />
  ) : syncStatus === 'synced' ? (
    <Check className="h-4 w-4 text-green-500" />
  ) : (
    <Clock className="h-4 w-4 text-orange-500" />
  )}
  <span className="text-sm">{syncStatusText}</span>
</div>
```

### Mobile Testing Strategy
- **Device testing**: Test on actual iOS and Android devices
- **Browser dev tools**: Use responsive design mode for initial testing
- **Touch simulation**: Test tap targets and gesture interactions
- **Performance**: Monitor bundle size and loading times on mobile networks
- **Accessibility**: Test with screen readers and voice control

### Implementation Priority
1. **Phase 1**: Responsive layouts for existing components
2. **Phase 2**: Touch-optimized interactions and mobile navigation
3. **Phase 3**: PWA foundation (service worker, manifest)
4. **Phase 4**: Offline capabilities and data synchronization

### Mobile-Specific Utilities
```tsx
// Viewport detection hook
const useIsMobile = () => {
  const [isMobile, setIsMobile] = useState(false);
  // Implementation...
  return isMobile;
};

// Touch-friendly spacing
const MOBILE_SPACING = {
  tapTarget: 'h-11 w-11', // 44px minimum
  buttonPadding: 'px-4 py-3',
  listSpacing: 'space-y-3',
  cardPadding: 'p-4',
};
```

---

## 15. References

### Technical Documentation
- [ShadCN UI Docs](https://ui.shadcn.com/)
- [Radix UI Docs](https://www.radix-ui.com/docs/primitives/components/dialog)
- [Tailwind CSS Docs](https://tailwindcss.com/docs/installation)

### Terminology & Naming Conventions
- [`docs/sr_readme.md`](docs/sr_readme.md) - Spaced Repetition Terminology (canonical source for spaced repetition terms)
- [`docs/terminology_guide.md`](docs/terminology_guide.md) - General Application Terminology (domain-specific terms for music, practice, and UI)

These terminology guides should be consulted when naming UI components, database fields, API endpoints, and user-facing text to ensure consistency across the application.

---

_This guide is a living document. Please update as new patterns emerge or conventions change._

_This style guide reflects the actual patterns found in the TuneTrees codebase as of July 2025. Use these patterns to maintain consistency when adding new UI components._
