"use client";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Line, OrbitControls } from "@react-three/drei";
import { useEffect, useMemo, useRef } from "react";
import { Vector3 } from "three";
import type { OrbitControls as OrbitControlsType } from "three-stdlib";
import { CATEGORIES, type GraphEntity, type Relationship } from "@/lib/types";
import { useKnowledge } from "@/lib/store";

function CameraDirector({
  nodes,
  controls,
}: {
  nodes: GraphEntity[];
  controls: React.RefObject<OrbitControlsType | null>;
}) {
  const selected = useKnowledge((s) => s.selected ?? s.focus);
  const reset = useKnowledge((s) => s.cameraReset);
  const reduced = useKnowledge((s) => s.accessibility.reducedMotion);
  const { camera } = useThree();
  const destination = useRef<Vector3 | null>(null),
    target = useRef(new Vector3());
  useEffect(() => {
    const node = nodes.find((n) => n.id === selected);
    target.current.set(...(node?.position ?? [0, 0, 0]));
    destination.current = node
      ? new Vector3(node.position[0] * 0.6, node.position[1] * 0.6, 10.5)
      : new Vector3(0, 0, 16);
  }, [selected, reset, nodes]);
  useFrame((_, delta) => {
    if (!destination.current || !controls.current) return;
    const speed = reduced ? 1 : Math.min(delta * 6, 1);
    camera.position.lerp(destination.current, speed);
    controls.current.target.lerp(target.current, speed);
    if (camera.position.distanceTo(destination.current) < 0.015)
      destination.current = null;
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
  const s = useKnowledge();
  return (
    <div className="three-universe">
      <Canvas
        camera={{ position: [0, 0, 16], fov: 41 }}
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
