/**
 * The live shader pet in My Pets. The page already cycles the pet state;
 * this draws that state and lets the change flow into the next one.
 */
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { Canvas } from "@react-three/fiber";
import { ShaderPetModel } from "@/components/society/companion/ShaderPetModel";
import { useCanvasAwake } from "@/hooks/useCanvasAwake";
import { useWebglSurface } from "@/hooks/useWebglSurface";
import type { PetState } from "@/lib/petStates";
import { useWebglSupported } from "@/lib/graphDimension";

export function ShaderPetMark({ className }: { className?: string }) {
  return (
    <span
      data-testid="shader-pet-mark"
      aria-hidden
      className={cn(
        "block rounded-full bg-[radial-gradient(circle_at_35%_30%,#d7fbff,#3d7cff_42%,#12081f_74%)]",
        className ?? "h-16 w-16",
      )}
    />
  );
}

export function ShaderPetPreview({ url, state, reduced }: {
  url: string;
  state: PetState;
  reduced: boolean;
}) {
  const host = useRef<HTMLDivElement>(null);
  const { generation } = useWebglSurface(host);
  const awake = useCanvasAwake(host);
  const supported = useWebglSupported();
  const [source, setSource] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let live = true;
    setSource(null);
    setFailed(false);
    void fetch(url)
      .then((response) => (response.ok ? response.text() : Promise.reject(new Error("missing"))))
      .then((text) => { if (live) setSource(text); })
      .catch(() => { if (live) setFailed(true); });
    return () => { live = false; };
  }, [url]);

  return (
    <div ref={host} data-testid="shader-pet-preview" className="h-full w-full overflow-hidden rounded-lg bg-[#07060f]">
      {failed ? null : supported && awake && source && (
        <Canvas
          key={generation}
          frameloop={reduced ? "demand" : "always"}
          dpr={[1, 1.5]}
          camera={{ position: [0, 0, 2.2], fov: 30, near: 0.05, far: 10 }}
          gl={{ alpha: false, antialias: true }}
        >
          <color attach="background" args={["#07060f"]} />
          <ShaderPetModel source={source} state={state} reduced={reduced} paused={!awake} heightM={1} />
        </Canvas>
      )}
    </div>
  );
}
