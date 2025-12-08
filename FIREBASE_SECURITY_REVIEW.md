# Firebase Security Review

## Current Security Posture

### ⚠️ Critical Finding: No Firestore Security Rules Found

**Status**: No `firestore.rules` file exists in the codebase.

**Risk Level**: **HIGH**

**Impact**: 
- All Firestore collections may be accessible without proper authentication
- Client-side code can directly read/write to Firestore
- No validation of data structure or user permissions
- Potential for data manipulation or unauthorized access

## Current Implementation

### Authentication
- **Method**: Cookie-based user identification (no Firebase Auth)
- **User IDs**: Hardcoded user list (`will`, `d/o`, `rosen`, `charlie`, `pat`)
- **No Authentication**: Users are identified by cookies only, no server-side validation

### Data Access Patterns
Based on code analysis:

1. **Client-Side Access**: 
   - `lib/firebase-service.ts` - Direct Firestore access from client
   - `app/games-page.tsx` - Client component accessing Firestore
   - No apparent server-side validation

2. **API Routes**:
   - Some API routes validate data server-side
   - But client can still access Firestore directly

## Recommended Firestore Security Rules

### Basic Rules (Start Here)

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    
    // Helper function to check if user is authenticated (via cookie)
    function isAuthenticated() {
      return request.auth != null || 
             request.headers.get('x-user-id') != null;
    }
    
    // Helper function to get user ID from request
    function getUserId() {
      return request.auth != null ? request.auth.uid : 
             request.headers.get('x-user-id');
    }
    
    // Helper function to check if user is in friend group
    function isFriendGroupMember() {
      let userId = getUserId();
      return userId in ['will', 'd/o', 'rosen', 'charlie', 'pat'];
    }
    
    // Bets collection
    match /bets/{betId} {
      // Allow read if user is a participant or friend group member
      allow read: if isFriendGroupMember() && 
                     (resource.data.participants.hasAny([getUserId()]) ||
                      getUserId() in resource.data.participants);
      
      // Allow create if user is authenticated and in friend group
      allow create: if isFriendGroupMember() && 
                       getUserId() == request.resource.data.placedBy &&
                       getUserId() in request.resource.data.participants;
      
      // Allow update if user is the bet placer or participant
      allow update: if isFriendGroupMember() && 
                       (getUserId() == resource.data.placedBy ||
                        getUserId() in resource.data.participants);
      
      // Allow delete if user is the bet placer
      allow delete: if isFriendGroupMember() && 
                       getUserId() == resource.data.placedBy;
    }
    
    // Games collection (read-only for all authenticated users)
    match /games/{gameId} {
      allow read: if isFriendGroupMember();
      allow write: if false; // Games are managed server-side only
    }
    
    // Final games collection (read-only)
    match /final_games/{gameId} {
      allow read: if isFriendGroupMember();
      allow write: if false; // Managed server-side only
    }
    
    // Player props collection (read-only)
    match /player_props/{propId} {
      allow read: if isFriendGroupMember();
      allow write: if false; // Managed server-side only
    }
    
    // Game ID mappings (read-only)
    match /game_id_mappings/{mappingId} {
      allow read: if isFriendGroupMember();
      allow write: if false; // Managed server-side only
    }
    
    // Pre-game odds (read-only)
    match /pre_game_odds/{oddsId} {
      allow read: if isFriendGroupMember();
      allow write: if false; // Managed server-side only
    }
    
    // Weekends collection (read-only)
    match /weekends/{weekendId} {
      allow read: if isFriendGroupMember();
      allow write: if false; // Managed server-side only
    }
    
    // Settlements collection
    match /settlements/{settlementId} {
      // Users can read their own settlements
      allow read: if isFriendGroupMember() && 
                     resource.data.userId == getUserId();
      
      // Settlements are created server-side only
      allow write: if false;
    }
    
    // Users collection (if exists)
    match /users/{userId} {
      allow read: if isFriendGroupMember();
      allow write: if false; // Managed server-side only
    }
    
    // Deny all other access
    match /{document=**} {
      allow read, write: if false;
    }
  }
}
```

## Security Recommendations

### 1. Implement Firebase Authentication (Recommended)

**Current**: Cookie-based identification
**Recommended**: Firebase Auth with custom claims

**Benefits**:
- Server-side user validation
- Better security rules
- Audit trail
- Token-based authentication

**Implementation**:
```typescript
// Use Firebase Auth instead of cookies
import { getAuth, signInAnonymously } from 'firebase/auth';

// Or implement custom authentication
// with user PINs stored securely
```

### 2. Add Input Validation

**Current**: Limited validation on bet creation

**Recommended**: 
- Validate bet amounts (min/max)
- Validate participant lists
- Validate odds/line values
- Validate game IDs exist

**Implementation**:
```typescript
// Add Zod schema validation
import { z } from 'zod';

const betSchema = z.object({
  gameId: z.string().min(1),
  weekendId: z.string().regex(/^\d{4}-week-\d+$/),
  placedBy: z.enum(['will', 'd/o', 'rosen', 'charlie', 'pat']),
  participants: z.array(z.enum(['will', 'd/o', 'rosen', 'charlie', 'pat'])).min(1),
  totalAmount: z.number().positive().max(10000),
  amountPerPerson: z.number().positive().max(1000),
  // ...
});
```

### 3. Server-Side API Validation

**Current**: Some API routes validate, but client can bypass

**Recommended**:
- All data mutations go through API routes
- Client-side Firestore access should be read-only
- Validate all inputs server-side

### 4. Rate Limiting

**Current**: No rate limiting

**Recommended**:
- Implement rate limiting on bet creation
- Limit API calls per user
- Prevent abuse

### 5. Data Validation Rules

**Recommended Rules**:
- Bet amounts must be positive and within limits
- Participant lists must contain valid user IDs
- Game IDs must exist in games collection
- Weekend IDs must match format `YYYY-week-N`
- Status transitions must be valid (active → won/lost)

## Implementation Plan

### Phase 1: Immediate (Critical)
1. **Create `firestore.rules` file** with basic rules
2. **Deploy rules to Firebase** 
3. **Test rules in Firebase console**
4. **Update client code** to handle permission errors

### Phase 2: Short-term
5. **Add input validation** to all API routes
6. **Implement rate limiting**
7. **Add data validation** in security rules
8. **Audit existing data** for compliance

### Phase 3: Long-term
9. **Implement Firebase Auth** (optional but recommended)
10. **Add audit logging** for security events
11. **Implement monitoring** for suspicious activity
12. **Regular security reviews**

## Testing Security Rules

### Test Cases

1. **Read Access**:
   - User can read their own bets ✓
   - User can read bets they participate in ✓
   - User cannot read other users' private bets ✗

2. **Write Access**:
   - User can create bets with themselves as placer ✓
   - User cannot create bets as another user ✗
   - User can update their own bets ✓
   - User cannot update other users' bets ✗

3. **Data Validation**:
   - Bet amounts must be positive ✓
   - Participants must be valid user IDs ✓
   - Game IDs must exist ✓

### Testing Tools
- Firebase Console Rules Playground
- Firebase Emulator Suite
- Unit tests for security rules

## Current Vulnerabilities

### High Risk
1. **No security rules** - Anyone can read/write to Firestore
2. **No authentication** - Users identified only by cookies
3. **No input validation** - Invalid data can be stored
4. **Client-side writes** - Can bypass API validation

### Medium Risk
5. **No rate limiting** - Potential for abuse
6. **No audit logging** - Cannot track changes
7. **Hardcoded user IDs** - Not scalable

### Low Risk
8. **Cookie-based auth** - Less secure than tokens
9. **No data encryption** - Sensitive data in plaintext

## Action Items

- [ ] Create `firestore.rules` file
- [ ] Deploy rules to Firebase
- [ ] Test rules with Firebase Emulator
- [ ] Update client code to handle permission errors
- [ ] Add input validation to API routes
- [ ] Implement rate limiting
- [ ] Add data validation in rules
- [ ] Document security model
- [ ] Set up monitoring for security events
- [ ] Regular security audits

## Notes

- Current implementation relies on client-side security (not secure)
- Friend group is small and trusted, but still need proper security
- Consider implementing Firebase Auth for better security
- Security rules should be tested thoroughly before deployment
- Monitor Firebase usage for unusual patterns


