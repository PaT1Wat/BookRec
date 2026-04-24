import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User, Session } from "@supabase/supabase-js";

interface Profile {
  display_name: string | null;
  avatar_url: string | null;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  isAdmin: boolean;
  loading: boolean;
  needsGenreOnboarding: boolean;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  profile: null,
  isAdmin: false,
  loading: true,
  needsGenreOnboarding: false,
  signOut: async () => {},
  refreshProfile: async () => {},
});

function getAuthDisplayName(authUser: User) {
  return (
    authUser.user_metadata?.display_name ||
    authUser.user_metadata?.full_name ||
    authUser.user_metadata?.name ||
    authUser.email?.split("@")[0] ||
    "ผู้ใช้"
  );
}

function getAuthAvatarUrl(authUser: User) {
  return (
    authUser.user_metadata?.avatar_url ||
    authUser.user_metadata?.picture ||
    null
  );
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [needsGenreOnboarding, setNeedsGenreOnboarding] = useState(false);

  const ensureUserRows = useCallback(async (authUser: User) => {
    const displayName = getAuthDisplayName(authUser);
    const avatarUrl = getAuthAvatarUrl(authUser);
    const email = authUser.email || "";
    const now = new Date().toISOString();

    const { error: userError } = await supabase.from("user").upsert(
      {
        id: authUser.id,
        email,
        userName: displayName,
        display_name: displayName,
        role: "user",
        created_at: now,
        updated_at: now,
      },
      { onConflict: "id" }
    );

    if (userError) {
      console.error("ensure public.user error:", userError);
    }

    const { error: profileError } = await supabase.from("profiles").upsert(
      {
        userID: authUser.id,
        display_name: displayName,
        avatar_url: avatarUrl,
      },
      { onConflict: "userID" }
    );

    if (profileError) {
      console.error("ensure profiles error:", profileError);
    }
  }, []);

  const fetchUserData = useCallback(
    async (authUser: User) => {
      await ensureUserRows(authUser);

      const [profileRes, userRes, genreRes] = await Promise.all([
        supabase
          .from("profiles")
          .select("display_name, avatar_url")
          .eq("userID", authUser.id)
          .single(),

        supabase.from("user").select("role").eq("id", authUser.id).single(),

        supabase
          .from("user_genres")
          .select("type_id")
          .eq("user_id", authUser.id),
      ]);

      // 🔥 debug ตรงนี้
      console.log("user_genres:", genreRes.data, genreRes.error);

      const hasGenres =
        !genreRes.error &&
        Array.isArray(genreRes.data) &&
        genreRes.data.length > 0;

      setNeedsGenreOnboarding(!hasGenres);

      if (profileRes.data) {
        setProfile(profileRes.data);
      } else {
        setProfile({
          display_name: getAuthDisplayName(authUser),
          avatar_url: getAuthAvatarUrl(authUser),
        });
      }

      setIsAdmin(userRes.data?.role === "admin");
      
    },
    [ensureUserRows]
  );

  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, currentSession) => {
      setSession(currentSession);
      setUser(currentSession?.user ?? null);

      if (currentSession?.user) {
        setTimeout(() => {
          fetchUserData(currentSession.user);
        }, 0);
      } else {
        setProfile(null);
        setIsAdmin(false);
        setNeedsGenreOnboarding(false);
      }

      setLoading(false);
    });

    supabase.auth.getSession().then(({ data: { session: currentSession } }) => {
      setSession(currentSession);
      setUser(currentSession?.user ?? null);

      if (currentSession?.user) {
        fetchUserData(currentSession.user);
      } else {
        setProfile(null);
        setIsAdmin(false);
        setNeedsGenreOnboarding(false);
      }

      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, [fetchUserData]);

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setProfile(null);
    setIsAdmin(false);
    setNeedsGenreOnboarding(false);
  };

  const refreshProfile = useCallback(async () => {
    if (user) {
      await fetchUserData(user);
    }
  }, [user, fetchUserData]);

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        profile,
        isAdmin,
        loading,
        needsGenreOnboarding,
        signOut,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);