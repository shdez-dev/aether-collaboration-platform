# Store Improvements - February 2026

## Overview

This document describes the improvements made to the Zustand stores to add persistence, use the centralized API service, and improve error handling.

## Changes Made

### 1. Added Persist Middleware to All Stores

All major stores now use Zustand's `persist` middleware to save state to localStorage:

#### Stores Updated:

- ✅ `authStore` (already had persist)
- ✅ `workspaceStore` (already had persist)
- ✅ `boardStore` - **NEW**
- ✅ `cardStore` - **NEW**
- ✅ `documentStore` - **NEW**

#### Implementation Pattern:

```typescript
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

export const useExampleStore = create<ExampleState>()(
  persist(
    (set, get) => ({
      // State and actions here
    }),
    {
      name: 'aether-example-storage',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        // Only persist these fields
        data: state.data,
        currentItem: state.currentItem,
      }),
    }
  )
);
```

#### Benefits:

- Data persists across page refreshes
- Better user experience (no data loss)
- Automatic rehydration on app load
- Selective persistence (sensitive data can be excluded)

---

### 2. Replaced Raw `fetch` with `apiService`

All stores now use the centralized `apiService` instead of raw `fetch` calls.

#### Before:

```typescript
const response = await fetch(`${API_URL}/api/boards/${boardId}`, {
  method: 'GET',
  headers: {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  },
});
const data = await response.json();
```

#### After:

```typescript
const response = await apiService.get<{ board: Board }>(
  `/api/boards/${boardId}`,
  true // useAuth = true
);
```

#### Benefits:

- Automatic token refresh when expired
- Consistent error handling
- Less boilerplate code
- Socket ID header automatically added
- Centralized request/response logic

---

### 3. Clear All LocalStorage on Logout

The `authStore.logout()` function now clears all persisted stores:

```typescript
logout: async () => {
  // 1. Disconnect socket
  if (socketService) {
    socketService.disconnect();
  }

  // 2. Notify server (optional)
  if (accessToken) {
    try {
      await apiService.post('/api/auth/logout', {}, true);
    } catch (error) {
      console.warn('[AuthStore] Error notifying logout:', error);
    }
  }

  // 3. Clear ALL stores from localStorage
  localStorage.removeItem('aether-auth-storage');
  localStorage.removeItem('aether-workspace-storage');
  localStorage.removeItem('aether-board-storage');
  localStorage.removeItem('aether-card-storage');
  localStorage.removeItem('aether-document-storage');

  // 4. Clear state
  clearAuth();
};
```

#### Benefits:

- Complete cleanup on logout
- No stale data from previous sessions
- Better security
- Prevents data leakage between users

---

### 4. Added Global Error Boundary

Created `ErrorBoundary` component to catch React errors:

**File:** `apps/web/src/components/ErrorBoundary.tsx`

#### Features:

- Catches unhandled React errors
- Shows user-friendly error page
- Displays error details in development mode
- Provides "Retry" and "Go Home" buttons
- Professional design with Lucide icons

#### Usage:

```typescript
<ErrorBoundary>
  <YourApp />
</ErrorBoundary>
```

#### Benefits:

- Prevents white screen of death
- Better user experience
- Helpful debugging in development
- Graceful error recovery

---

### 5. Added Hydration Boundary

Created `HydrationBoundary` component to handle store rehydration:

**File:** `apps/web/src/components/HydrationBoundary.tsx`

#### Features:

- Waits for authStore to hydrate before rendering
- Shows loading spinner during hydration
- Prevents hydration mismatches
- Smooth loading experience

#### Usage:

```typescript
<HydrationBoundary>
  <YourApp />
</HydrationBoundary>
```

#### Benefits:

- No flash of unauthenticated content
- Prevents hydration errors
- Better perceived performance
- Cleaner user experience

---

## Implementation Details

### Store Persistence Keys

| Store     | LocalStorage Key           |
| --------- | -------------------------- |
| Auth      | `aether-auth-storage`      |
| Workspace | `aether-workspace-storage` |
| Board     | `aether-board-storage`     |
| Card      | `aether-card-storage`      |
| Document  | `aether-document-storage`  |

### Persisted Fields by Store

#### authStore

- `user`
- `accessToken`
- `refreshToken`
- `isAuthenticated`

#### workspaceStore

- `workspaces`
- `currentWorkspace`

#### boardStore

- `boards`
- `currentBoard`
- `lists`

#### cardStore

- `cards`
- `currentWorkspaceId`

#### documentStore

- `documents`
- `currentDocument`

**Note:** Transient state like `isLoading`, `error`, `activeUsers` is NOT persisted.

---

## Migration Notes

### For Developers

1. **No breaking changes** - All existing code continues to work
2. **Automatic migration** - Users will see improved persistence immediately
3. **Token refresh** - Handled automatically by `apiService`
4. **Error handling** - Caught by `ErrorBoundary`

### For Users

1. **Better persistence** - Data won't disappear on refresh
2. **Longer sessions** - Automatic token refresh (up to 7 days)
3. **Better errors** - Friendly error pages instead of crashes
4. **Faster loads** - Data rehydrates from cache

---

## Testing Checklist

- [x] Auth persists across refresh
- [x] Workspaces persist across refresh
- [x] Boards persist across refresh
- [x] Cards persist across refresh
- [x] Documents persist across refresh
- [x] Token refresh works automatically
- [x] Logout clears all data
- [x] Error boundary catches errors
- [x] Hydration boundary shows loading
- [x] TypeScript compiles without errors

---

## Future Improvements

### Recommended Next Steps:

1. **Add versioning to persisted data**
   - Handle schema migrations gracefully
   - Clear incompatible cached data

2. **Add selective invalidation**
   - Invalidate stale data after X hours
   - Refresh data in background

3. **Add compression**
   - Compress large objects before storing
   - Save localStorage space

4. **Add encryption**
   - Encrypt sensitive data in localStorage
   - Use Web Crypto API

5. **Add analytics**
   - Track hydration time
   - Monitor error rates
   - Measure token refresh success

6. **Add optimistic updates**
   - Update UI immediately
   - Rollback on server error
   - Better perceived performance

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────┐
│                   Root Layout                        │
│  ┌───────────────────────────────────────────────┐  │
│  │            Error Boundary                      │  │
│  │  ┌─────────────────────────────────────────┐  │  │
│  │  │      Hydration Boundary                  │  │  │
│  │  │  ┌───────────────────────────────────┐  │  │  │
│  │  │  │        Application                 │  │  │  │
│  │  │  │  ┌─────────────────────────────┐  │  │  │  │
│  │  │  │  │  Zustand Stores (Persisted) │  │  │  │  │
│  │  │  │  │  ├─ authStore                │  │  │  │  │
│  │  │  │  │  ├─ workspaceStore           │  │  │  │  │
│  │  │  │  │  ├─ boardStore               │  │  │  │  │
│  │  │  │  │  ├─ cardStore                │  │  │  │  │
│  │  │  │  │  └─ documentStore            │  │  │  │  │
│  │  │  │  └─────────────────────────────┘  │  │  │  │
│  │  │  │            ↕                       │  │  │  │
│  │  │  │  ┌─────────────────────────────┐  │  │  │  │
│  │  │  │  │      apiService              │  │  │  │  │
│  │  │  │  │  (Token Refresh Interceptor) │  │  │  │  │
│  │  │  │  └─────────────────────────────┘  │  │  │  │
│  │  │  └───────────────────────────────────┘  │  │  │
│  │  └─────────────────────────────────────────┘  │  │
│  └───────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────┘
              ↕
    ┌───────────────────┐
    │  localStorage     │
    │  ├─ auth          │
    │  ├─ workspace     │
    │  ├─ board         │
    │  ├─ card          │
    │  └─ document      │
    └───────────────────┘
```

---

## Files Modified

### Stores

- `apps/web/src/stores/boardStore.ts` - Added persist + apiService
- `apps/web/src/stores/cardStore.ts` - Added persist
- `apps/web/src/stores/documentStore.ts` - Added persist + apiService
- `apps/web/src/stores/authStore.ts` - Enhanced logout to clear all stores

### Components

- `apps/web/src/components/ErrorBoundary.tsx` - **NEW**
- `apps/web/src/components/HydrationBoundary.tsx` - **NEW**
- `apps/web/src/app/layout.tsx` - Added ErrorBoundary + HydrationBoundary

### Documentation

- `docs/STORE_IMPROVEMENTS.md` - **THIS FILE**

---

## Summary

These improvements significantly enhance the stability, performance, and user experience of the AETHER platform:

✅ **Data Persistence** - Users won't lose their work on refresh  
✅ **Token Refresh** - Sessions last longer with automatic renewal  
✅ **Error Handling** - Graceful error pages instead of crashes  
✅ **Loading States** - Smooth hydration with loading indicators  
✅ **Code Quality** - DRY principle with centralized apiService  
✅ **Security** - Complete cleanup on logout

The platform is now more robust and production-ready.
