# Frequently Asked Questions

## General

### What is TuneTrees?
TuneTrees is a practice management application for musicians that uses spaced repetition to help you efficiently maintain and grow your tune repertoire.

### Is TuneTrees free?
Yes, TuneTrees is free and open source.

### What instruments does it support?
TuneTrees works for any instrument. The default catalog focuses on Irish traditional music, but you can add any tunes you want.

### Do I need an internet connection?
No! TuneTrees works fully offline. Your data syncs automatically when you're back online.

---

## Account & Data

### How do I create an account?
Visit [tunetrees.com](https://tunetrees.com) and click Sign Up. You can use email/password or sign in with Google or GitHub.

### Where is my data stored?
Your data is stored locally on your device AND synced to the cloud:
- **Local:** SQLite database in your browser (works offline)
- **Cloud:** Supabase PostgreSQL database (backup & multi-device sync)

### Can I export my data?
Not yet, but this feature is planned. Your data is yours!

### How do I delete my account?
Contact us via GitHub issues. We'll remove your data from our servers.

---

## Practice & Scheduling

### How does spaced repetition work?
TuneTrees uses the FSRS algorithm to schedule reviews:
1. When you learn a new tune, it's reviewed frequently
2. Each successful review increases the interval
3. Forgotten tunes get shorter intervals
4. Over time, you review less but remember more

### What do the ratings mean?
| Rating | When to use |
|--------|-------------|
| **Again** | Forgot the tune completely |
| **Hard** | Struggled but got through it |
| **Good** | Normal recall with some effort |
| **Easy** | Perfect recall, no hesitation |

### How many tunes should I practice daily?
TuneTrees automatically calculates your daily queue. A typical session is 10-20 tunes, but you can adjust in settings.

### Why did a tune I know well appear for review?
The algorithm is conservative to prevent forgetting. If you rate it "Easy," the interval will increase significantly.

---

## Offline & Sync

### How does offline mode work?
When you go offline:
1. All your data is available locally
2. You can practice and rate tunes normally
3. Changes are queued for sync
4. When online again, everything syncs automatically

### What if I edit on two devices while offline?
TuneTrees uses "last write wins" conflict resolution. The most recent change takes precedence. For practice records, both are kept.

### How do I force a sync?
Pull down to refresh on mobile, or click the sync icon in the header.

---

## Installation

### How do I install on iPhone/iPad?
1. Open Safari and go to [tunetrees.com](https://tunetrees.com)
2. Tap the Share button (square with arrow)
3. Scroll down and tap "Add to Home Screen"
4. Tap "Add"

### How do I install on Android?
1. Open Chrome and go to [tunetrees.com](https://tunetrees.com)
2. Tap the menu (⋮)
3. Tap "Install app" or "Add to Home Screen"
4. Tap "Install"

### How do I install on desktop?
1. Open Chrome or Edge and go to [tunetrees.com](https://tunetrees.com)
2. Look for the install icon in the address bar
3. Click "Install"

### The app isn't updating. What do I do?
1. Close the app completely
2. Reopen it - updates apply on restart
3. If still stuck, clear the app's cache in your browser settings

---

## Troubleshooting

### The app is loading slowly
- Check your internet connection
- Try clearing browser cache
- Make sure you're using a modern browser (Chrome, Safari, Firefox, Edge)

### My practice session didn't save
- Check the sync indicator in the header
- If offline, changes save locally and sync later
- If you see an error, try refreshing the page

### I can't sign in
- Check your email/password
- Try resetting your password
- Make sure cookies are enabled
- Try a different browser

### Tunes are missing from my practice queue
- Verify the correct repertoire is selected
- Check if there are tunes due today in the Repertoire view
- Refresh the page to regenerate the queue

---

## Contact & Support

### How do I report a bug?
Open an issue on [GitHub](https://github.com/sboagy/tunetrees/issues) with:
- What you expected to happen
- What actually happened
- Steps to reproduce
- Browser and device info

### How do I request a feature?
Open an issue on [GitHub](https://github.com/sboagy/tunetrees/issues) with the "enhancement" label.

### How can I contribute?
See the [Development Setup Guide](../development/setup.md) to get started!
