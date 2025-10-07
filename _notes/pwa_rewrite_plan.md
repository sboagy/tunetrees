I'm planning a comprehensive rewrite of the TuneTrees app, pivoting from a Python/React/Next.js stack to a purely **serverless PWA** built with **SolidJS and TypeScript**.

### **I. Core Technology Stack**

1.  **Frontend:** **SolidJS** with TypeScript.
2.  **Backend/Auth:** **Supabase** (PostgreSQL) for all auth and cloud data.
3.  **Local Database:** **SQLite WASM** for browser-side persistence and **Drizzle ORM** for type-safe relational querying.
4.  **Scheduling Logic:** **`ts-fsrs`** executed entirely on the client using the local SQLite database.

### **II. Component & Code Migration Instructions**

My strategy is to have you (CoPilot) construct the new app while having access to the legacy code as a model. The goal is maximum code reuse for _logic_ and complete adoption of new framework _adapters_:

- **UI/Design:** Map all existing `shadcn/ui` components (styled with Tailwind) to the **`shadcn-solid`** port.
- **Data Grids:** Translate all existing **`TanStack Table`** and windowing logic (`@tanstack/react-virtual`) to the **`@tanstack/solid-table`** and **`@tanstack/solid-virtual`** adapters.
- **Authentication:** Replace all **`auth.js`** implementation with **Supabase Auth** logic, utilizing SolidJS context for user state management.

### **III. Data Flow & External Library Integration**

1.  **Data Synchronization:** Establish an **offline-first model** where data reads come from the local SQLite cache. The application must use **Supabase Realtime** to efficiently sync data changes (Create/Update/Delete) between the client's SQLite and the remote PostgreSQL.
2.  **External Libraries:** Implement **`abcjs`** (music notation) and **`jodit`** (rich text editor) using clean SolidJS component wrappers that leverage Solid's reactivity primitives (signals) to ensure they only update when necessary, maintaining 60 FPS performance.
