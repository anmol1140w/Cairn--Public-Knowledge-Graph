"use client";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Line, OrbitControls, Stars } from "@react-three/drei";
import { useEffect, useMemo, useRef } from "react";
import { Color, Vector3, type Mesh, type ShaderMaterial } from "three";
import type { OrbitControls as OrbitControlsType } from "three-stdlib";
import { CATEGORIES, type GraphEntity, type Relationship } from "@/lib/types";
import { useKnowledge } from "@/lib/store";

const vertexShader = `varying vec3 vNormal; varying vec3 vPosition; void main(){vNormal=normalize(normalMatrix*normal); vPosition=position; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`;
const fragmentShader = `uniform vec3 color; uniform float time; varying vec3 vNormal; varying vec3 vPosition; void main(){float rim=pow(1.-abs(dot(normalize(vNormal),vec3(0.,0.,1.))),2.8); float lat=abs(sin(vPosition.y*34.)); float lon=abs(sin(atan(vPosition.x,vPosition.z)*15.+time*.04)); float grid=step(.975,lat)*.11+step(.989,lon)*.09; float light=max(0.,dot(normalize(vNormal),normalize(vec3(-.5,.7,1.)))); gl_FragColor=vec4(color*(.06+light*.1+rim*1.3+grid),1.);}`;

function TopicSphere({ reduced }: { reduced: boolean }) {
  const material = useRef<ShaderMaterial>(null);
  const uniforms = useMemo(
    () => ({
      color: { value: new Color(CATEGORIES.topic.color) },
      time: { value: 0 },
    }),
    [],
  );
  useFrame(({ clock }) => {
    if (material.current && !reduced)
      material.current.uniforms.time.value = clock.elapsedTime;
  });
  return (
    <group>
      <mesh>
        <sphereGeometry args={[0.56, 48, 48]} />
        <shaderMaterial
          ref={material}
          uniforms={uniforms}
          vertexShader={vertexShader}
          fragmentShader={fragmentShader}
        />
      </mesh>
      <mesh rotation={[1.2, 0.2, 0.3]}>
        <torusGeometry args={[0.77, 0.006, 6, 100]} />
        <meshBasicMaterial color="#91b0fb" transparent opacity={0.48} />
      </mesh>
      <mesh rotation={[0.4, 0.4, -0.3]}>
        <torusGeometry args={[0.9, 0.004, 6, 100]} />
        <meshBasicMaterial color="#6689e6" transparent opacity={0.24} />
      </mesh>
      <mesh>
        <sphereGeometry args={[0.63, 24, 24]} />
        <meshBasicMaterial
          color="#749cff"
          transparent
          opacity={0.035}
          depthWrite={false}
        />
      </mesh>
    </group>
  );
}

function GraphNode({
  node,
  dimmed,
  selected,
  reduced,
}: {
  node: GraphEntity;
  dimmed: boolean;
  selected: boolean;
  reduced: boolean;
}) {
  const mesh = useRef<Mesh>(null);
  const select = useKnowledge((s) => s.select);
  const set = useKnowledge((s) => s.set);
  const hovered = useKnowledge((s) => s.hovered === node.id);
  const color = CATEGORIES[node.type].color;
  useFrame((_, delta) => {
    if (mesh.current) {
      const target = selected || hovered ? 1.3 : 1;
      const speed = reduced ? 1 : Math.min(delta * 7, 1);
      mesh.current.scale.lerp(new Vector3(target, target, target), speed);
    }
  });
  const material = (
    <meshStandardMaterial
      color={color}
      emissive={color}
      emissiveIntensity={selected || hovered ? 2 : 0.75}
      transparent
      opacity={dimmed ? 0.17 : 0.9}
      roughness={0.3}
      metalness={0.45}
    />
  );
  return (
    <group position={node.position}>
      <group
        onClick={(event) => {
          event.stopPropagation();
          select(node.id);
        }}
        onPointerOver={(event) => {
          event.stopPropagation();
          set({ hovered: node.id });
        }}
        onPointerOut={() => set({ hovered: null })}
      >
        {node.type === "topic" ? (
          <TopicSphere reduced={reduced} />
        ) : (
          <>
            <mesh
              ref={mesh}
              scale={reduced ? 1 : 0.04}
              rotation={
                node.type === "patent"
                  ? [Math.PI / 2, 0, 0]
                  : node.type === "company"
                    ? [0.15, 0.35, 0]
                    : [0, 0, 0]
              }
            >
              {node.type === "institution" ? (
                <octahedronGeometry args={[0.18]} />
              ) : node.type === "company" ? (
                <boxGeometry args={[0.24, 0.24, 0.24]} />
              ) : node.type === "patent" ? (
                <cylinderGeometry args={[0.18, 0.18, 0.1, 6]} />
              ) : node.type === "news" ? (
                <boxGeometry args={[0.28, 0.18, 0.035]} />
              ) : node.type === "job" ? (
                <boxGeometry args={[0.24, 0.17, 0.08]} />
              ) : (
                <sphereGeometry
                  args={[node.type === "technology" ? 0.16 : 0.115, 20, 20]}
                />
              )}
              {material}
            </mesh>
            {node.type === "person" && (
              <mesh position={[0, -0.15, 0]}>
                <capsuleGeometry args={[0.07, 0.05, 4, 8]} />
                {material}
              </mesh>
            )}
            {node.type === "job" && (
              <mesh position={[0, 0.11, 0]}>
                <torusGeometry args={[0.055, 0.013, 6, 12, Math.PI]} />
                {material}
              </mesh>
            )}
            <mesh>
              <sphereGeometry args={[0.3, 16, 16]} />
              <meshBasicMaterial
                color={color}
                transparent
                opacity={dimmed ? 0.008 : selected || hovered ? 0.1 : 0.035}
                depthWrite={false}
              />
            </mesh>
          </>
        )}
      </group>
    </group>
  );
}

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
  const destination = useRef<Vector3 | null>(null);
  const target = useRef(new Vector3());
  useEffect(() => {
    const node = nodes.find((n) => n.id === selected);
    target.current.set(...(node?.position ?? [0, 0, 0]));
    destination.current = node
      ? new Vector3(node.position[0] * 0.6, node.position[1] * 0.6, 10.5)
      : new Vector3(0, 0, 13.5);
  }, [selected, reset, nodes]);
  useFrame((_, delta) => {
    if (!destination.current || !controls.current) return;
    const speed = reduced ? 1 : Math.min(delta * 2.6, 1);
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
    const counts: Record<string, number> = {};
    const { selected, hovered } = useKnowledge.getState();
    for (const node of nodes) {
      const index = counts[node.type] ?? 0;
      counts[node.type] = index + 1;
      const label = labels.current.get(node.id);
      if (!label) continue;
      point
        .set(
          node.position[0],
          node.position[1] - (node.type === "topic" ? 1.03 : 0.34),
          node.position[2],
        )
        .project(camera);
      label.style.transform = `translate3d(${(point.x * 0.5 + 0.5) * size.width}px,${(-point.y * 0.5 + 0.5) * size.height}px,0) translate(-50%,0)`;
      const representative =
        nodes.length <= 26 ||
        node.type === "topic" ||
        index < (node.type === "paper" ? 3 : 2) ||
        selected === node.id ||
        hovered === node.id;
      label.style.visibility =
        point.z > 1 || point.z < -1 || !representative ? "hidden" : "visible";
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
  const controls = useRef<OrbitControlsType>(null);
  const selected = useKnowledge((s) => s.selected);
  const highlighted = useKnowledge((s) => s.highlighted);
  const reduced = useKnowledge((s) => s.accessibility.reducedMotion);
  const map = useMemo(
    () => new Map(nodes.map((node) => [node.id, node])),
    [nodes],
  );
  return (
    <>
      <color attach="background" args={["#080a11"]} />
      <fog attach="fog" args={["#080a11", 25, 50]} />
      <ambientLight intensity={0.7} />
      <pointLight position={[0, 3, 5]} intensity={24} color="#afc9ff" />
      <Stars
        radius={32}
        depth={20}
        count={160}
        factor={1.1}
        saturation={0}
        fade
        speed={reduced ? 0 : 0.12}
      />
      {edges.map((edge) => {
        const from = map.get(edge.source);
        const to = map.get(edge.target);
        if (!from || !to) return null;
        const active = highlighted.length
          ? edge.evidenceIds.some((id) => highlighted.includes(id))
          : selected && (edge.source === selected || edge.target === selected);
        const midpoint: [number, number, number] = [
          (from.position[0] + to.position[0]) / 2,
          (from.position[1] + to.position[1]) / 2 + 0.18,
          (from.position[2] + to.position[2]) / 2 - 0.45,
        ];
        return (
          <Line
            key={edge.id}
            points={[from.position, midpoint, to.position]}
            color={active ? "#abc4ff" : "#50698d"}
            lineWidth={active ? 1.4 : 0.7}
            transparent
            opacity={active ? 0.8 : highlighted.length ? 0.08 : 0.48}
            dashed={edge.inferred}
            dashSize={0.12}
            gapSize={0.1}
          />
        );
      })}
      {nodes.map((node) => (
        <GraphNode
          key={node.id}
          node={node}
          selected={selected === node.id}
          reduced={reduced}
          dimmed={
            highlighted.length > 0 &&
            !node.evidenceIds.some((id) => highlighted.includes(id))
          }
        />
      ))}
      <OrbitControls
        ref={controls}
        enableDamping={!reduced}
        dampingFactor={0.08}
        minDistance={7}
        maxDistance={28}
        maxPolarAngle={Math.PI * 0.74}
        minPolarAngle={Math.PI * 0.26}
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
        camera={{ position: [0, 0, 13.5], fov: 41 }}
        dpr={[1, 1.6]}
        gl={{ antialias: true, alpha: false, powerPreference: "low-power" }}
        onCreated={({ gl }) => {
          gl.domElement.addEventListener("webglcontextlost", () => {
            if (
              gl.domElement.isConnected &&
              useKnowledge.getState().view === "3d"
            )
              onFailure();
          });
        }}
        fallback={
          <div className="graph-fallback">
            <p>3D is unavailable on this device.</p>
            <button onClick={onFailure}>Explore the 2D graph</button>
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
            className={`node-label projected-node-label ${node.type === "topic" ? "topic-label" : ""} ${s.selected === node.id ? "selected" : ""}`}
            style={{
              opacity:
                s.highlighted.length > 0 &&
                !node.evidenceIds.some((id) => s.highlighted.includes(id))
                  ? 0.18
                  : 1,
            }}
            onClick={() => s.select(node.id)}
            onMouseEnter={() => s.set({ hovered: node.id })}
            onMouseLeave={() => s.set({ hovered: null })}
            tabIndex={-1}
            aria-label={`Explore ${node.title}`}
          >
            <span>{node.label}</span>
            <small style={{ color: CATEGORIES[node.type].color }}>
              {CATEGORIES[node.type].label}
            </small>
          </button>
        ))}
      </div>
    </div>
  );
}
