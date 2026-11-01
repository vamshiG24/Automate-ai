
import {  createSlice } from "@reduxjs/toolkit";


;

const authSlice = createSlice({
  name: "auth",

  initialState: {
    user: null,
    loading: true,
    error: null,
  },

  reducers: {
    setUser: (state, action) => {
      state.user = action.payload;
      state.loading = false;
      state.error = null;
    },

    clearUser: (state) => {
      state.user = null;
      state.loading = false;
      state.error = null;
    },
  },
});

export const { setUser, clearUser } = authSlice.actions;
export default authSlice.reducer;