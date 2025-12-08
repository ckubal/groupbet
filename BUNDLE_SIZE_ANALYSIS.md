# Bundle Size Analysis & Optimization Opportunities

## Current State

### Large Client Components
1. **`app/games-page.tsx`** (1567 lines)
   - Imports: Firebase service, multiple components, date-fns, betting odds
   - All loaded on initial page load
   - No code splitting

2. **`lib/firebase-service.ts`** (1121 lines)
   - Entire Firebase service loaded client-side
   - Multiple service exports (betService, gameCacheService, etc.)
   - No tree-shaking optimization visible

3. **`lib/odds-api.ts`** (1258+ lines)
   - Large API service class
   - Loaded even when not needed

### Heavy Dependencies
- **Firebase SDK** (`firebase` package) - ~500KB+ minified
- **date-fns** - Full library imported (could use tree-shaking)
- **lucide-react** - All icons potentially loaded
- **@tanstack/react-query** - Query library

## Optimization Opportunities

### 1. Lazy Load Firebase SDK

**Current**: Firebase loaded synchronously in `lib/firebase.ts`

**Optimization**:
```typescript
// lib/firebase-lazy.ts
export async function getFirebase() {
  const { initializeApp, getApps } = await import('firebase/app');
  const { getFirestore } = await import('firebase/firestore');
  // ... lazy load Firebase modules
}
```

**Impact**: Reduces initial bundle by ~500KB

### 2. Code Split Large Components

**Current**: `games-page.tsx` loads all components synchronously

**Optimization**:
```typescript
// Lazy load modals and popups
const BetPopup = dynamic(() => import('@/components/BetPopup'), { ssr: false });
const EditBetModal = dynamic(() => import('@/components/EditBetModal'), { ssr: false });
const ParlayBuilder = dynamic(() => import('@/components/ParlayBuilder'), { ssr: false });
```

**Impact**: Reduces initial bundle by ~50-100KB

### 3. Tree-Shake date-fns

**Current**: 
```typescript
import { format } from 'date-fns';
```

**Optimization**:
```typescript
import format from 'date-fns/format';
```

**Impact**: Reduces bundle by ~20-30KB (only imports used function)

### 4. Lazy Load Icons

**Current**: All lucide-react icons potentially loaded

**Optimization**:
```typescript
// Instead of importing all icons
import { Clock, ChevronDown } from 'lucide-react';

// Use dynamic imports for less-used icons
const ClockIcon = dynamic(() => import('lucide-react').then(m => ({ default: m.Clock })));
```

**Impact**: Reduces bundle by ~10-20KB

### 5. Split Firebase Services

**Current**: Entire `firebase-service.ts` loaded

**Optimization**:
```typescript
// Split into separate files
// lib/services/bet-service.ts
// lib/services/game-cache-service.ts
// lib/services/settlement-service.ts

// Then import only what's needed
import { betService } from '@/lib/services/bet-service';
```

**Impact**: Better tree-shaking, reduces unused code

### 6. Dynamic Import for API Services

**Current**: `odds-api.ts` and `espn-api.ts` loaded client-side

**Optimization**:
```typescript
// Only load when needed (e.g., when fetching games)
const { oddsApi } = await import('@/lib/odds-api');
```

**Impact**: Reduces initial bundle by ~100-200KB

### 7. Split games-page.tsx

**Current**: 1567 lines in single file

**Optimization**:
- Extract bet summary section → `components/BetSummary.tsx`
- Extract settlement section → `components/SettlementPanel.tsx`
- Extract bet cards grid → `components/BetCardsGrid.tsx`
- Extract time slot sections → `components/TimeSlotSection.tsx`

**Impact**: Better code splitting, easier to optimize individual sections

### 8. Use Next.js Image Optimization

**Current**: No image optimization visible

**Optimization**:
```typescript
import Image from 'next/image';
// Use Next.js Image component for logo and assets
```

**Impact**: Reduces image bundle size

### 9. Remove Unused Dependencies

**Check for**:
- Unused React Query features
- Unused date-fns functions
- Unused Firebase features

**Impact**: Varies, but could save 50-100KB

### 10. Implement Route-Based Code Splitting

**Current**: All routes likely bundled together

**Optimization**:
- Ensure proper route boundaries
- Use dynamic imports for route-specific code
- Lazy load API routes that aren't frequently used

**Impact**: Better initial load performance

## Recommended Implementation Order

### Phase 1: Quick Wins (High Impact, Low Effort)
1. **Tree-shake date-fns** - Change import style
2. **Lazy load modals** - Use dynamic imports for BetPopup, EditBetModal
3. **Split Firebase services** - Break into smaller modules

### Phase 2: Medium Effort (High Impact)
4. **Lazy load Firebase SDK** - Dynamic import Firebase modules
5. **Split games-page.tsx** - Extract components
6. **Dynamic import API services** - Load only when needed

### Phase 3: Advanced (Medium Impact)
7. **Optimize icon loading** - Lazy load lucide-react icons
8. **Remove unused dependencies** - Audit and remove
9. **Route-based splitting** - Optimize route boundaries

## Bundle Size Targets

### Current (Estimated)
- Initial JS bundle: ~800KB-1.2MB (uncompressed)
- After gzip: ~250-400KB

### Target (After Optimizations)
- Initial JS bundle: ~400-600KB (uncompressed)
- After gzip: ~150-250KB
- **Reduction: ~40-50%**

## Measurement

### Tools to Use
1. **@next/bundle-analyzer** - Analyze bundle composition
   ```bash
   npm install --save-dev @next/bundle-analyzer
   ```

2. **Next.js Build Output** - Check bundle sizes in build output
   ```bash
   npm run build
   ```

3. **Lighthouse** - Measure real-world performance
   - First Contentful Paint (FCP)
   - Largest Contentful Paint (LCP)
   - Time to Interactive (TTI)

### Metrics to Track
- Initial bundle size (first load)
- Route-specific bundle sizes
- Time to Interactive (TTI)
- First Contentful Paint (FCP)
- Largest Contentful Paint (LCP)

## Implementation Checklist

- [ ] Install @next/bundle-analyzer
- [ ] Run initial bundle analysis
- [ ] Tree-shake date-fns imports
- [ ] Lazy load modals (BetPopup, EditBetModal, ParlayBuilder)
- [ ] Split Firebase services into separate files
- [ ] Implement lazy loading for Firebase SDK
- [ ] Split games-page.tsx into smaller components
- [ ] Dynamic import API services
- [ ] Optimize icon loading
- [ ] Remove unused dependencies
- [ ] Run final bundle analysis
- [ ] Measure performance improvements

## Notes

- Next.js 15 has automatic code splitting, but we can optimize further
- Firebase SDK is the largest dependency - prioritize lazy loading
- games-page.tsx is the main client component - focus optimization here
- Consider using React.lazy() for component-level code splitting
- Monitor bundle size in CI/CD to prevent regressions

