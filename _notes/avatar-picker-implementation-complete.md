# Avatar Picker Implementation

**Date:** January 3, 2025  
**Status:** ✅ Complete  
**Branch:** `feat/pwa1`

## Overview

Successfully implemented a complete avatar picker system for TuneTrees, allowing users to:

1. Select from 10 predefined avatar images
2. Upload custom avatar images (.png, .jpg, .webp)
3. Delete custom uploaded avatars
4. Preview current avatar selection

## Components Created

### 1. AvatarPicker Component

**File:** `src/components/user-settings/AvatarPicker.tsx`

**Features:**

- Grid display of 10 predefined avatars from `/public/avatars`
- Custom file upload with validation (image type, max 2MB)
- Upload to Supabase Storage (`avatars/{userId}/{timestamp}.{ext}`)
- Visual indication of currently selected avatar
- Delete custom avatars (predefined ones cannot be deleted)
- Real-time preview updates
- Toast notifications for success/error feedback

**Key Functions:**

- `saveAvatarUrl(url)` - Saves avatar URL to PostgreSQL database
- `selectPredefinedAvatar(filename)` - Handles predefined avatar selection
- `handleFileUpload(event)` - Processes custom avatar uploads
- `deleteCustomAvatar()` - Removes custom avatars from storage

### 2. Card UI Component

**File:** `src/components/ui/card.tsx`

Reusable card component with sub-components:

- `Card` - Main container
- `CardHeader` - Header section
- `CardTitle` - Title text
- `CardDescription` - Description text
- `CardContent` - Content area
- `CardFooter` - Footer section

### 3. Avatar Settings Page

**File:** `src/routes/user-settings/avatar.tsx`

Simple page wrapper that uses the AvatarPicker component with appropriate card layout.

## Database Changes

### Migration: 20250103000001_create_avatars_bucket.sql

Created Supabase Storage bucket with RLS policies:

- **Bucket:** `avatars` (public)
- **Upload Policy:** Users can upload to their own folder (`{userId}/`)
- **Update Policy:** Users can update their own avatars
- **Delete Policy:** Users can delete their own avatars
- **Read Policy:** Public read access for all avatars

### Schema Updates (Already Complete)

**PostgreSQL:** `drizzle/schema-postgres.ts`

```typescript
avatarUrl: text("avatar_url"), // User avatar image URL
```

**SQLite:** `drizzle/schema-sqlite.ts`

```typescript
avatarUrl: text("avatar_url"), // User avatar image URL
```

## Routing Updates

### App.tsx

Added avatar route to user settings:

```typescript
const AvatarPage = lazy(() => import("./routes/user-settings/avatar"));

<Route path="/user-settings" component={UserSettingsLayout}>
  <Route path="/avatar" component={AvatarPage} />
  {/* ... other routes */}
</Route>;
```

### User Settings Layout

Added "Avatar" to sidebar navigation (first item):

```typescript
const sidebarNavItems: SidebarNavItem[] = [
  { title: "Avatar", href: "/user-settings/avatar" },
  { title: "Scheduling Options", href: "/user-settings/scheduling-options" },
  { title: "Spaced Repetition", href: "/user-settings/spaced-repetition" },
  { title: "Account", href: "/user-settings/account" },
];
```

## File Structure

```
src/
├── components/
│   ├── ui/
│   │   └── card.tsx                          # NEW: Reusable card component
│   └── user-settings/
│       └── AvatarPicker.tsx                  # NEW: Avatar selection component
└── routes/
    └── user-settings/
        ├── index.tsx                         # UPDATED: Added avatar nav item
        └── avatar.tsx                        # NEW: Avatar settings page

public/
└── avatars/                                  # 10 predefined avatars
    ├── accordion.png
    ├── balalaika.png
    ├── banjo.png
    ├── flute.png
    ├── guitarist.png
    ├── harmonica.png
    ├── harp.png
    ├── pianist.png
    ├── singer.png
    └── violin.png

supabase/
└── migrations/
    └── 20250103000001_create_avatars_bucket.sql  # NEW: Storage bucket + RLS
```

## How to Use

### For Users:

1. Navigate to Settings → Avatar (or `/user-settings/avatar`)
2. **Select Predefined Avatar:**
   - Click any of the 10 instrument-themed avatars
   - Selection is saved immediately
3. **Upload Custom Avatar:**
   - Click "Choose File" button
   - Select an image (max 2MB)
   - Uploads to Supabase Storage
   - Saved immediately after upload
4. **Delete Custom Avatar:**
   - Click the × button on the avatar preview
   - Only available for custom uploads (not predefined ones)

### For Developers:

**Query current avatar:**

```typescript
const user = auth.user();
const result = await db
  .select({ avatarUrl: userProfile.avatarUrl })
  .from(userProfile)
  .where(eq(userProfile.supabaseUserId, user.id));
```

**Display avatar in UI:**

```tsx
<img src={user.avatarUrl || "/avatars/default.png"} alt="Avatar" />
```

## Technical Details

### File Upload Flow:

1. User selects file → Validate type & size
2. Generate unique path: `{userId}/{timestamp}.{ext}`
3. Upload to Supabase Storage bucket `avatars`
4. Get public URL from Supabase
5. Save URL to `user_profile.avatar_url` in PostgreSQL
6. Show success toast

### Security:

- **RLS Policies:** Users can only upload/modify their own avatars
- **File Validation:** Client-side validation for type and size
- **Public Bucket:** Avatars are publicly readable (safe for profile images)
- **Namespace Isolation:** Each user's uploads stored in `avatars/{userId}/`

### Offline Support:

- Predefined avatars work offline (served from `/public`)
- Custom uploads require online connection (Supabase Storage)
- Avatar URL saved in local SQLite for offline viewing
- Upload queue could be added for offline-first uploads (future enhancement)

## Quality Gates

✅ **TypeScript:** Strict mode, no errors  
✅ **Linting:** Biome checks passed  
✅ **Migration:** Applied successfully to local Supabase  
✅ **Routes:** Avatar page accessible at `/user-settings/avatar`  
✅ **Navigation:** Avatar link added to settings sidebar

## Testing Notes

### Manual Testing Checklist:

- [ ] Navigate to `/user-settings/avatar`
- [ ] Select a predefined avatar → saves to DB
- [ ] Upload custom image → uploads to Storage & saves URL
- [ ] Delete custom avatar → removes from Storage
- [ ] Try uploading oversized file (>2MB) → shows error
- [ ] Try uploading non-image file → shows error
- [ ] Verify avatar persists after page reload
- [ ] Test on mobile viewport (grid should be responsive)

### E2E Tests (To Be Created):

```typescript
test("user can select predefined avatar", async ({ page }) => {
  // Navigate to avatar settings
  // Click predefined avatar
  // Verify database updated
});

test("user can upload custom avatar", async ({ page }) => {
  // Navigate to avatar settings
  // Upload test image
  // Verify appears in preview
  // Verify uploaded to Storage
});

test("user can delete custom avatar", async ({ page }) => {
  // Upload custom avatar
  // Click delete button
  // Verify removed from Storage
});
```

## Next Steps

1. **Implement Scheduling Options Form** - Port legacy scheduling preferences
2. **Implement Spaced Repetition Form** - Port FSRS/SM2 settings
3. **Implement Account Settings Form** - Name/email editing
4. **Write E2E Tests** - Comprehensive Playwright tests for all settings

## References

- **Supabase Storage Docs:** https://supabase.com/docs/guides/storage
- **Drizzle ORM Updates:** https://orm.drizzle.team/docs/update
- **SolidJS File Inputs:** https://www.solidjs.com/tutorial/bindings_events
- **RLS Policies:** https://supabase.com/docs/guides/auth/row-level-security

---

**Implementation Time:** ~2 hours  
**Files Changed:** 6 files created, 2 files updated  
**Migration Applied:** ✅ 20250103000001_create_avatars_bucket.sql
