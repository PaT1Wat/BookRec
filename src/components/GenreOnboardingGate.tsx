import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import GenreOnboardingModal from "@/components/GenreOnboardingModal";

export default function GenreOnboardingGate() {
  const { user, loading, needsGenreOnboarding, refreshProfile } = useAuth();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const skipped = localStorage.getItem(`skippedGenreOnboarding:${user?.id}`);
    setOpen(!loading && !!user && needsGenreOnboarding && skipped !== "true");
  }, [loading, user, needsGenreOnboarding]);

  if (!user) return null;

  return (
    <GenreOnboardingModal
      userId={user.id}
      open={open}
      onDone={async () => {
        setOpen(false);
        await refreshProfile();
      }}
      onSkip={() => {
        try {
          localStorage.setItem(`skippedGenreOnboarding:${user.id}`, "true");
        } catch {}
        setOpen(false);
      }}
    />
  );
}