import type { Mode } from "./types";

export function isCurrentRequest(input: {
  token: number;
  currentToken: number;
  mode: Mode;
  currentMode: Mode;
  generation: number;
  currentGeneration: number;
}) {
  return (
    input.token === input.currentToken &&
    input.mode === input.currentMode &&
    input.generation === input.currentGeneration
  );
}
