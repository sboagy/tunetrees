---
description: "TuneTrees UI development guidelines and component patterns"
applyTo: "frontend/**/*.{tsx,ts,jsx,js,css,scss}"
---

# TuneTrees UI Development Instructions

## Design Philosophy

TuneTrees follows a **minimalist, productivity-focused design** inspired by developer tools like VS Code. The interface prioritizes function over decoration, with clean lines, subtle borders, and restrained use of color.

### Design Characteristics
- **Minimalist aesthetic**: Clean, uncluttered interfaces with plenty of white space
- **Functional hierarchy**: UI elements are sized and positioned based on frequency of use
- **Subtle visual cues**: Borders, shadows, and color are used sparingly but meaningfully
- **Developer-tool inspiration**: Similar to VS Code's clean, professional appearance
- **Daily-use optimization**: Interface designed for repeated, efficient daily interactions

## Component Patterns

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
</Form>
```

## Mobile-First Responsive Design

### Current State & Vision
- **Primary platform**: Desktop/laptop for daily practice sessions
- **Mobile goal**: Functional smartphone access for quick reference and light editing
- **Future vision**: Progressive Web App (PWA) with offline sync capabilities
- **Design approach**: Mobile-first responsive design with progressive enhancement

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

### Touch Interaction Guidelines
- **Minimum size**: 44px × 44px (11 Tailwind units)
- **Preferred size**: 48px × 48px for primary actions
- **Spacing**: Minimum 8px between interactive elements

## Tables & Lists

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

## Theming & Colors

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