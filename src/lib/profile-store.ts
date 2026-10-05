"use client";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type { Mode } from "./types";
import { profileSchema, type Profile } from "./profiles";
import { useKnowledge } from "./store";
interface ProfileState {
  profiles: Partial<Record<Mode, Profile>>;
  saveWithInvestigation: boolean;
  apply: (profile: Profile, save: boolean) => void;
  clear: () => void;
  consumeConsent: () => void;
}
export const useProfiles = create<ProfileState>()(
  persist(
    (set) => ({
      profiles: {},
      saveWithInvestigation: false,
      apply: (profile, save) => {
        const parsed = profileSchema.parse(profile);
        set((s) => ({
          profiles: { ...s.profiles, [parsed.mode]: parsed },
          saveWithInvestigation: save,
        }));
        if (parsed.mode === "jobs")
          useKnowledge
            .getState()
            .set({ skills: parsed.skills.map((s) => s.name) });
      },
      clear: () => {
        set({ profiles: {}, saveWithInvestigation: false });
        useKnowledge
          .getState()
          .set({
            skills: [],
            toast: "Your details have been cleared from this tab.",
          });
      },
      consumeConsent: () => set({ saveWithInvestigation: false }),
    }),
    {
      name: "cairn-session-details",
      storage: createJSONStorage(() => sessionStorage),
      partialize: (s) => ({ profiles: s.profiles }),
      onRehydrateStorage: () => (state) => {
        const profile = profileSchema.safeParse(state?.profiles.jobs);
        if (profile.success && profile.data.mode === "jobs")
          useKnowledge
            .getState()
            .set({ skills: profile.data.skills.map((s) => s.name) });
      },
    },
  ),
);
