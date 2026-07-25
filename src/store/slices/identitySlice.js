import { supabase } from '../../lib/supabaseClient';
import { fetchCurrentIdentity } from '../../lib/api';

export const createIdentitySlice = (set) => ({
  identity: null,

  loadIdentity: async () => {
    const identity = await fetchCurrentIdentity();
    set({ identity });
  },

  signOutIdentity: async () => {
    await supabase.auth.signOut();
    set({ identity: null });
  },
});
