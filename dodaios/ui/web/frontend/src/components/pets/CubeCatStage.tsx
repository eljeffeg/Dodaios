/**
 * The cube cat on My Pets. The activity at the top of the page picks the clip.
 */
import { Suspense, useLayoutEffect, useRef } from "react";
import { Canvas, useThree } from "@react-three/fiber";
import { CubeCatModel } from "@/components/society/companion/CubeCatModel";
import { cubeClipForState } from "@/components/society/companion/cubeCat";
import type { PetState } from "@/lib/petStates";
import { useCanvasAwake } from "@/hooks/useCanvasAwake";
import { useWebglSurface } from "@/hooks/useWebglSurface";
import { useWebglSupported } from "@/lib/graphDimension";

/** A three-quarter view. The aim is the middle of the cat, not its feet. */
const CAMERA = { position: [1.05, 0.55, 1.9] as [number, number, number], fov: 30 };
const CAT_HEIGHT_M = 0.7;

function AimAtCat() {
  const camera = useThree((state) => state.camera);
  useLayoutEffect(() => {
    // The cube body sits above the feet, so the aim is higher than half the height.
    camera.lookAt(0, CAT_HEIGHT_M * 0.62, 0);
  }, [camera]);
  return null;
}

/** The cube cat, playing the clip for the activity shown above it. */
export function CubeCatPreview({ reduced, state }: { reduced: boolean; state: PetState }) {
  const host = useRef<HTMLDivElement>(null);
  const { generation } = useWebglSurface(host);
  const awake = useCanvasAwake(host);
  const supported = useWebglSupported();
  const clip = cubeClipForState(state);
  return (
    <div
      ref={host}
      data-testid="cube-cat-preview"
      data-clip={clip}
      className="h-full w-full overflow-hidden rounded-lg"
    >
      {supported && awake && (
        <Canvas
          key={generation}
          frameloop={reduced ? "demand" : "always"}
          dpr={[1, 2]}
          camera={{ position: CAMERA.position, fov: CAMERA.fov, near: 0.05, far: 20 }}
          gl={{ alpha: true, antialias: true }}
        >
          <AimAtCat />
          <ambientLight intensity={0.75} />
          <directionalLight position={[2.2, 3.4, 2]} intensity={1.6} />
          <Suspense fallback={null}>
            <CubeCatModel clip={clip} reduced={reduced} paused={!awake} heightM={CAT_HEIGHT_M} />
          </Suspense>
        </Canvas>
      )}
    </div>
  );
}
