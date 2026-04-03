import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { RootState } from './index';

export type AuthProvider = 'anonymous' | 'google' | 'email' | null;
export type UserRole = 'user' | 'moderator' | 'admin';

export interface UserState {
  uid: string | null;
  email: string | null;
  displayName: string | null;
  isAnonymous: boolean;
  authProvider: AuthProvider;
  role: UserRole;
  totalScore: number;
  completedCount: number;
  tag: string | null;
  firestoreLoaded: boolean;
  loading: boolean;
}

const initialState: UserState = {
  uid: null,
  email: null,
  displayName: null,
  isAnonymous: true,
  authProvider: null,
  role: 'user',
  totalScore: 0,
  completedCount: 0,
  tag: null,
  firestoreLoaded: false,
  loading: true,
};

const userSlice = createSlice({
  name: 'user',
  initialState,
  reducers: {
    setAuthUser(
      state,
      action: PayloadAction<{
        uid: string;
        email: string | null;
        displayName: string | null;
        isAnonymous: boolean;
        authProvider: AuthProvider;
      }>,
    ) {
      state.uid = action.payload.uid;
      state.email = action.payload.email;
      state.displayName = action.payload.displayName;
      state.isAnonymous = action.payload.isAnonymous;
      state.authProvider = action.payload.authProvider;
      state.loading = false;
    },
    setFirestoreData(
      state,
      action: PayloadAction<{
        role: UserRole;
        totalScore: number;
        completedCount: number;
        tag: string | null;
      }>,
    ) {
      state.role = action.payload.role;
      state.totalScore = action.payload.totalScore;
      state.completedCount = action.payload.completedCount;
      state.tag = action.payload.tag;
      state.firestoreLoaded = true;
    },
    resetUser() {
      return { ...initialState, loading: false };
    },
  },
});

export const selectUser = (state: RootState) => state.user
export const { setAuthUser, setFirestoreData, resetUser } = userSlice.actions;
export default userSlice.reducer;
