"use client";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Line, OrbitControls } from "@react-three/drei";
import { useEffect, useMemo, useRef } from "react";
import { Vector3, MOUSE, TOUCH } from "three";
import type { OrbitControls as OrbitControlsType } from "three-stdlib";
import { CATEGORIES, type GraphEntity, type Relationship } from "@/lib/types";
import { useKnowledge } from "@/lib/store";
import { useExplorer } from "@/lib/explorer-store";

function CameraDirector({
  nodes,
  controls,
}: {
  nodes: GraphEntity[];
  controls: React.RefObject<OrbitControlsType | null>;
}) {
  const command = useExplorer((s) => s.command);
  const reset = useKnowledge((s) => s.cameraReset);
  const reduced = useKnowledge((s) => s.accessibility.reducedMotion);
  const { camera } = useThree();
  const destination = useRef<Vector3 | null>(null),
    target = useRef(new Vector3());
  useEffect(() => {
    const control = controls.current;
    if (!control) return;
    const kind = command.kind;
    target.current.copy(control.target);
    const offset = camera.position.clone().sub(control.target);
    if (kind === "zoom-in" || kind === "zoom-out") {
      destination.current = control.target
        .clone()
        .add(offset.multiplyScalar(kind === "zoom-in" ? 1 / 1.15 : 1.15));
    } else if (kind.startsWith("pan-")) {
      const direction = new Vector3(
        kind === "pan-left" ? -0.5 : kind === "pan-right" ? 0.5 : 0,
        kind === "pan-up" ? 0.5 : kind === "pan-down" ? -0.5 : 0,
        0,
      ).applyQuaternion(camera.quaternion);
      target.current.add(direction);
      destination.current = camera.position.clone().add(direction);
    } else if (kind === "focus") {
      const node = nodes.find((n) => n.id === useKnowledge.getState().selected);
      if (node) {
        target.current.set(...node.position);
        destination.current = target.current
          .clone()
          .add(offset.normalize().multiplyScalar(7));
      }
    } else {
      target.current.set(0, 0, 0);
      destination.current = new Vector3(0, 0, 16);
    }
  }, [command, reset, nodes, camera, controls]);
  useFrame((_, delta) => {
    if (!destination.current || !controls.current) return;
    const speed = reduced ? 1 : Math.min(delta * 6, 1);
    camera.position.lerp(destination.current, speed);
    controls.current.target.lerp(target.current, speed);
    if (camera.position.distanceTo(destination.current) < 0.015) {
      destination.current = null;
      useExplorer
        .getState()
        .set({
          camera: {
            position: camera.position.toArray() as [number, number, number],
            target: controls.current.target.toArray() as [
              number,
              number,
              number,
            ],
          },
        });
    }
    controls.current.update();
  });
  return null;
}
function ProjectLabels({
  nodes,
  labels,
}: {
  nodes: GraphEntity[];
  labels: React.RefObject<Map<string, HTMLButtonElement>>;
}) {
  const { camera, size } = useThree();
  const point = useMemo(() => new Vector3(), []);
  useFrame(() => {
    for (const node of nodes) {
      const label = labels.current.get(node.id);
      if (!label) continue;
      point
        .set(node.position[0], node.position[1] - 0.4, node.position[2])
        .project(camera);
      label.style.transform = `translate3d(${(point.x * 0.5 + 0.5) * size.width}px,${(-point.y * 0.5 + 0.5) * size.height}px,0) translate(-50%,0)`;
      label.style.visibility =
        point.z > 1 || point.z < -1 ? "hidden" : "visible";
    }
  });
  return null;
}
function Scene({
  nodes,
  edges,
  labels,
}: {
  nodes: GraphEntity[];
  edges: Relationship[];
  labels: React.RefObject<Map<string, HTMLButtonElement>>;
}) {
  const s = useKnowledge();
  const active = useExplorer((v) => v.active);
  const controls = useRef<OrbitControlsType>(null);
  const map = new Map(nodes.map((node) => [node.id, node]));
  const accent = s.theme === "dark" ? "#a0d6c9" : "#29665c";
  return (
    <>
      <ambientLight intensity={1.5} />
      <directionalLight position={[0, 5, 8]} intensity={2} />
      {edges.map((edge) => {
        const a = map.get(edge.source),
          b = map.get(edge.target);
        if (!a || !b) return null;
        return (
          <Line
            key={edge.id}
            points={[a.position, b.position]}
            color={accent}
            opacity={0.5}
            transparent
            lineWidth={1}
            dashed={edge.inferred}
            dashSize={0.12}
            gapSize={0.1}
          />
        );
      })}
      {nodes.map((node) => (
        <mesh
          key={node.id}
          position={node.position}
          onClick={(event) => {
            event.stopPropagation();
            s.select(node.id);
          }}
          onDoubleClick={(event) => {
            event.stopPropagation();
            s.select(node.id);
            useExplorer.getState().request("focus");
          }}
          onPointerOver={(event) => {
            event.stopPropagation();
            s.set({ hovered: node.id });
          }}
          onPointerOut={() => s.set({ hovered: null })}
        >
          {node.type === "institution" ? (
            <octahedronGeometry args={[0.2]} />
          ) : ["company", "job", "news"].includes(node.type) ? (
            <boxGeometry args={[0.25, 0.2, 0.18]} />
          ) : (
            <sphereGeometry
              args={[node.type === "topic" ? 0.42 : 0.14, 16, 16]}
            />
          )}
          <meshStandardMaterial
            color={accent}
            roughness={0.9}
            metalness={0}
            transparent
            opacity={
              s.highlighted.length &&
              !node.evidenceIds.some((id) => s.highlighted.includes(id))
                ? 0.25
                : 1
            }
          />
        </mesh>
      ))}
      <OrbitControls
        ref={controls}
        enabled={active}
        enableZoom={false}
        mouseButtons={{
          LEFT: MOUSE.ROTATE,
          MIDDLE: MOUSE.PAN,
          RIGHT: MOUSE.PAN,
        }}
        touches={{ ONE: TOUCH.ROTATE, TWO: TOUCH.DOLLY_PAN }}
        onStart={() => useExplorer.getState().interact()}
        onEnd={() => {
          const v = useExplorer.getState();
          v.interact();
          if (controls.current)
            v.set({
              camera: {
                position: controls.current.object.position.toArray() as [
                  number,
                  number,
                  number,
                ],
                target: controls.current.target.toArray() as [
                  number,
                  number,
                  number,
                ],
              },
            });
        }}
        enableDamping={!s.accessibility.reducedMotion}
        dampingFactor={0.12}
        minDistance={5}
        maxDistance={40}
        makeDefault
      />
      <CameraDirector nodes={nodes} controls={controls} />
      <ProjectLabels nodes={nodes} labels={labels} />
    </>
  );
}
export default function Universe({
  nodes,
  edges,
  onFailure,
}: {
  nodes: GraphEntity[];
  edges: Relationship[];
  onFailure: () => void;
}) {
  const labels = useRef(new Map<string, HTMLButtonElement>());
  const pinchDistance = useRef(0);
  const s = useKnowledge();
  return (
    <div className="three-universe" onTouchStart={(event) => { if (event.touches.length === 2) pinchDistance.current = Math.hypot(event.touches[0].clientX - event.touches[1].clientX, event.touches[0].clientY - event.touches[1].clientY); }} onTouchMove={(event) => {
      if (!useExplorer.getState().active || event.touches.length !== 2) return;
      const distance = Math.hypot(event.touches[0].clientX - event.touches[1].clientX, event.touches[0].clientY - event.touches[1].clientY);
      if (Math.abs(distance - pinchDistance.current) > 8) { useExplorer.getState().request(distance > pinchDistance.current ? "zoom-in" : "zoom-out"); pinchDistance.current = distance; }
    }} onTouchEnd={() => { pinchDistance.current = 0; }}>
      <Canvas
        camera={{
          position: useExplorer.getState().camera?.position ?? [0, 0, 16],
          fov: 41,
        }}
        dpr={[1, 1.6]}
        gl={{ antialias: true, alpha: true, powerPreference: "low-power" }}
        onCreated={({ gl }) => {
          gl.domElement.addEventListener("webglcontextlost", () => {
            if (gl.domElement.isConnected) onFailure();
          });
        }}
        fallback={
          <div className="graph-fallback">
            <p>3D is unavailable.</p>
            <button className="secondary-button" onClick={onFailure}>
              Use 2D
            </button>
          </div>
        }
      >
        <Scene nodes={nodes} edges={edges} labels={labels} />
      </Canvas>
      <div className="projected-labels">
        {nodes.map((node) => (
          <button
            key={node.id}
            ref={(element) => {
              if (element) labels.current.set(node.id, element);
              else labels.current.delete(node.id);
            }}
            className={`node-label projected-node-label ${s.selected === node.id ? "selected" : ""}`}
            onClick={() => s.select(node.id)}
            onDoubleClick={() => {
              s.select(node.id);
              useExplorer.getState().request("focus");
            }}
            onMouseEnter={() => s.set({ hovered: node.id })}
            onMouseLeave={() => s.set({ hovered: null })}
            tabIndex={-1}
            aria-label={`Explore ${node.title}`}
          >
            <span>{node.label}</span>
            <small>{CATEGORIES[node.type].label}</small>
          </button>
        ))}
      </div>
    </div>
  );
}
