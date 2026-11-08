/**
 * A user shader pet (`jarvis-shader-pet/1`). The fragment file is the
 * author's `main`. This wraps it so the app owns the uniforms, and so a
 * state change draws the old look and the new one and mixes them.
 *
 * The bans mirror `dodaios/ui/pets/shader.py`. The server is the authority
 * on save; this check is what the create dialog can say before the upload.
 */
import { PET_STATES, type PetState } from "@/lib/petStates";
import { readVoiceInputLevel } from "@/lib/voiceInputLevel";
import { voiceOutputLevelRef } from "@/lib/voiceOutputLevel";
/** How long a state change takes to finish mixing, in seconds. */
export const SHADER_BLEND_S = 0.33;

/** The sphere every shader pet shares. The fragment file is the author's. */
export const PET_VERTEX_SHADER = /* glsl */ `
varying vec3 vLocal;
varying vec3 vNormal;
varying vec3 vView;
void main() {
  vec4 world = modelMatrix * vec4(position, 1.0);
  vLocal = position;
  vNormal = normalize(mat3(modelMatrix) * normal);
  vView = cameraPosition - world.xyz;
  gl_Position = projectionMatrix * viewMatrix * world;
}`;

export interface ShaderBlend {
  from: number;
  to: number;
  /** 0 is entirely the previous state, 1 is entirely the next. */
  blend: number;
}

const BANNED_DIRECTIVES = ["#include", "#version", "#extension", "#define", "#pragma"];
const BANNED_WORDS = ["sampler", "uniform", "varying", "attribute", "while", "precision"];
const ANY_FOR = /\bfor\s*\(/g;
const CONST_FOR = /\bfor\s*\(\s*int\s+[A-Za-z_]\w*\s*=\s*\d+\s*;\s*[A-Za-z_]\w*\s*<\s*(\d+)\s*;\s*[A-Za-z_]\w*\s*\+\+\s*\)/g;

export function shaderStateIndex(state: PetState): number {
  const index = PET_STATES.indexOf(state);
  return index < 0 ? 0 : index;
}

/**
 * Loudness for `uLevel`, 0..1. Talking reads the assistant's voice and
 * listening reads the microphone. Every other state is silent, so a stale
 * sample cannot keep the pet moving.
 */
export function shaderVoiceLevel(state: PetState, now = performance.now()): number {
  if (state === "listening") return readVoiceInputLevel(now);
  if (state === "talking") return voiceOutputLevelRef.current ?? 0;
  return 0;
}

/** Advance the mix. A new state restarts it from the one on screen. */
export function stepShaderBlend(current: ShaderBlend, stateIndex: number, dt: number, reduced: boolean): void {
  if (stateIndex !== current.to) {
    current.from = current.to;
    current.to = stateIndex;
    current.blend = reduced ? 1 : 0;
  }
  if (reduced) {
    current.blend = 1;
    return;
  }
  if (current.blend < 1) current.blend = Math.min(1, current.blend + dt / SHADER_BLEND_S);
}

/** The same sentences as the Python loader, for a file that has not been uploaded yet. */
export function shaderSourceError(source: string): string | null {
  if (!source.trim()) return "The shader is empty.";
  if (new TextEncoder().encode(source).length > 16 * 1024) return "The shader is larger than 16 KB.";
  for (const directive of BANNED_DIRECTIVES) {
    if (source.includes(directive)) return `The shader cannot use ${directive}.`;
  }
  for (const word of BANNED_WORDS) {
    // No trailing boundary: "sampler" has to catch "sampler2D".
    if (new RegExp(`\\b${word}`).test(source)) return `The shader cannot use '${word}'.`;
  }
  if (!/\bvoid\s+main\s*\(/.test(source)) return "The shader needs a main function.";
  const loops = source.match(ANY_FOR)?.length ?? 0;
  const bounded = [...source.matchAll(CONST_FOR)];
  if (loops !== bounded.length) {
    return "A for loop must count a fixed number of times, like 'for (int i = 0; i < 8; i++)'.";
  }
  for (const loop of bounded) {
    if (Number(loop[1]) > 32) return "A for loop may run at most 32 times.";
  }
  return null;
}

/**
 * The author's main, called twice per pixel: once for the state being left
 * and once for the state being entered. `uBlend` mixes the two colours.
 */
export function wrapPetFragment(source: string): string {
  const body = source.replace(/\bvoid\s+main\s*\(/, "void petMain(");
  // Three.js adds the precision line. A second one is a compile error.
  return `uniform float uTime;
uniform float uState;
uniform float uStateFrom;
uniform float uBlend;
uniform float uLevel;
varying vec3 vLocal;
varying vec3 vNormal;
varying vec3 vView;
float petState;
#define uState petState
${body}
#undef uState
void main() {
  petState = uStateFrom;
  petMain();
  vec4 petFrom = gl_FragColor;
  petState = uState;
  petMain();
  gl_FragColor = mix(petFrom, gl_FragColor, clamp(uBlend, 0.0, 1.0));
}
`;
}

/**
 * Compile the wrapped fragment. The vertex here is only a stand-in: the
 * real one is PET_VERTEX_SHADER, and three.js fills in its matrices.
 * `null` when it compiles, or when this machine has no WebGL to ask.
 */
const COMPILE_VERTEX = `attribute vec3 position;
varying vec3 vLocal;
varying vec3 vNormal;
varying vec3 vView;
void main() {
  vLocal = position;
  vNormal = position;
  vView = vec3(0.0, 0.0, 1.0);
  gl_Position = vec4(position, 1.0);
}
`;

export function compilePetShader(source: string): string | null {
  const canvas = document.createElement("canvas");
  const gl = canvas.getContext("webgl");
  if (!gl) return null;
  const fragment = gl.createShader(gl.FRAGMENT_SHADER);
  const vertex = gl.createShader(gl.VERTEX_SHADER);
  if (!fragment || !vertex) return null;
  gl.shaderSource(fragment, `precision mediump float;\n${wrapPetFragment(source)}`);
  gl.shaderSource(vertex, COMPILE_VERTEX);
  gl.compileShader(fragment);
  gl.compileShader(vertex);
  const fragmentOk = gl.getShaderParameter(fragment, gl.COMPILE_STATUS);
  const vertexOk = gl.getShaderParameter(vertex, gl.COMPILE_STATUS);
  const log = !fragmentOk
    ? gl.getShaderInfoLog(fragment)
    : !vertexOk
      ? gl.getShaderInfoLog(vertex)
      : null;
  gl.deleteShader(fragment);
  gl.deleteShader(vertex);
  return log && log.trim() ? log.trim() : fragmentOk && vertexOk ? null : "The shader did not compile.";
}
