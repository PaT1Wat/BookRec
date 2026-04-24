import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import GenreOnboardingModal from "@/components/GenreOnboardingModal";

export default function GenreOnboardingGate() {
  const { user, loading, needsGenreOnboarding, refreshProfile } = useAuth();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setOpen(!loading && !!user && needsGenreOnboarding);
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
    />
  );
}