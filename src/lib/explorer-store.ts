"use client";
import { create } from "zustand";
export type CameraSnapshot = {
  position: [number, number, number];
  target: [number, number, number];
};
type Command =
  | "zoom-in"
  | "zoom-out"
  | "fit"
  | "reset"
  | "pan-left"
  | "pan-right"
  | "pan-up"
  | "pan-down"
  | "focus";
interface ExplorerState {
  active: boolean;
  fullscreen: boolean;
  preset: "compact" | "large" | "full";
  autoRotate: boolean;
  zoom: number;
  pan: [number, number];
  camera: CameraSnapshot | null;
  command: { kind: Command; sequence: number };
  lastInteraction: number;
  set: (patch: Partial<ExplorerState>) => void;
  request: (kind: Command) => void;
  interact: () => void;
}
export const useExplorer = create<ExplorerState>((set) => ({
  active: false,
  fullscreen: false,
  preset: "large",
  autoRotate: true,
  zoom: 1,
  pan: [0, 0],
  camera: null,
  command: { kind: "fit", sequence: 0 },
  lastInteraction: 0,
  set: (patch) => set(patch),
  interact: () => set({ lastInteraction: Date.now() }),
  request: (kind) =>
    set((s) => ({
      command: { kind, sequence: s.command.sequence + 1 },
      lastInteraction: Date.now(),
      zoom:
        kind === "zoom-in"
          ? Math.min(5, s.zoom * 1.15)
          : kind === "zoom-out"
            ? Math.max(0.25, s.zoom / 1.15)
            : ["fit", "reset"].includes(kind)
              ? 1
              : s.zoom,
      pan: ["fit", "reset"].includes(kind)
        ? [0, 0]
        : kind === "pan-left"
          ? [s.pan[0] - 32, s.pan[1]]
          : kind === "pan-right"
            ? [s.pan[0] + 32, s.pan[1]]
            : kind === "pan-up"
              ? [s.pan[0], s.pan[1] - 32]
              : kind === "pan-down"
                ? [s.pan[0], s.pan[1] + 32]
                : s.pan,
    })),
}));
