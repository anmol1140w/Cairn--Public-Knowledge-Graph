"use client";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import {
  Color,
  Object3D,
  Vector3,
  MOUSE,
  TOUCH,
  type InstancedMesh,
  type Mesh,
  type LineSegments,
  type PerspectiveCamera,
} from "three";
import type { OrbitControls as OrbitControlsType } from "three-stdlib";
import { CATEGORIES, type GraphEntity, type Relationship } from "@/lib/types";
import { useKnowledge } from "@/lib/store";
import { useExplorer } from "@/lib/explorer-store";
import {
  graphBounds,
  labelPriority,
  nodeRadius,
  placeLabels,
} from "@/lib/graph-layout";
type Props = { nodes: GraphEntity[]; edges: Relationship[] };
function configureRotation(control: OrbitControlsType, enabled: boolean) {
  control.autoRotate = enabled;
  control.autoRotateSpeed = 0.8;
}

function CameraDirector({
  nodes,
  controls,
}: {
  nodes: GraphEntity[];
  controls: React.RefObject<OrbitControlsType | null>;
}) {
  const command = useExplorer((s) => s.command),
    reset = useKnowledge((s) => s.cameraReset);
  const { camera, size, gl } = useThree();
  const previous = useRef({
    nodes: [] as GraphEntity[],
    width: 0,
    height: 0,
    reset: -1,
    sequence: -1,
  });
  const baseDistance = useRef(16);
  const animation = useRef<{
    from: Vector3;
    to: Vector3;
    fromTarget: Vector3;
    toTarget: Vector3;
    elapsed: number;
  } | null>(null);
  useEffect(() => {
    const control = controls.current;
    if (!control) return;
    const v = useExplorer.getState(),
      bounds = graphBounds(nodes);
    const autoFit =
      previous.current.nodes !== nodes ||
      previous.current.width !== size.width ||
      previous.current.height !== size.height ||
      previous.current.reset !== reset;
    const resizeOnly =
      previous.current.nodes === nodes &&
      previous.current.reset === reset &&
      (previous.current.width !== size.width ||
        previous.current.height !== size.height);
    const commandChanged = previous.current.sequence !== command.sequence;
    previous.current = {
      nodes,
      width: size.width,
      height: size.height,
      reset,
      sequence: command.sequence,
    };
    const target = control.target.clone(),
      offset = camera.position.clone().sub(target);
    let destination: Vector3;
    if (autoFit || ["fit", "reset"].includes(command.kind)) {
      const half = ((camera as PerspectiveCamera).fov * Math.PI) / 360;
      const angle = Math.min(
        half,
        Math.atan((Math.tan(half) * size.width) / Math.max(1, size.height)),
      );
      baseDistance.current = ((bounds.radius + 0.4) / Math.sin(angle)) * 1.25;
      if (
        !resizeOnly ||
        (commandChanged && ["fit", "reset"].includes(command.kind))
      )
        target.set(...bounds.center);
      const direction =
        command.kind === "reset" && commandChanged
          ? new Vector3(0, 0, 1)
          : offset.normalize();
      destination = target
        .clone()
        .add(direction.multiplyScalar(baseDistance.current / v.zoom));
    } else if (command.kind.startsWith("pan-")) {
      const delta = new Vector3(
        command.kind === "pan-left"
          ? -0.5
          : command.kind === "pan-right"
            ? 0.5
            : 0,
        command.kind === "pan-up"
          ? 0.5
          : command.kind === "pan-down"
            ? -0.5
            : 0,
        0,
      ).applyQuaternion(camera.quaternion);
      target.add(delta);
      destination = camera.position.clone().add(delta);
    } else if (command.kind === "focus") {
      const node = nodes.find((n) => n.id === useKnowledge.getState().selected);
      if (node) target.set(...node.position);
      destination = target
        .clone()
        .add(
          offset
            .normalize()
            .multiplyScalar(Math.max(4, baseDistance.current / 2)),
        );
      v.set({ zoom: 2 });
    } else
      destination = target
        .clone()
        .add(offset.normalize().multiplyScalar(baseDistance.current / v.zoom));
    animation.current = {
      from: camera.position.clone(),
      to: destination,
      fromTarget: control.target.clone(),
      toTarget: target,
      elapsed: 0,
    };
  }, [nodes, command, reset, size.width, size.height, camera, controls]);
  useFrame((_, delta) => {
    const control = controls.current;
    if (!control) return;
    const v = useExplorer.getState(),
      s = useKnowledge.getState();
    const reduced =
      s.accessibility.reducedMotion ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    configureRotation(
      control,
      v.autoRotate &&
        !reduced &&
        !v.hovering &&
        !v.dragging &&
        !s.hovered &&
        !s.selected &&
        Date.now() - v.lastInteraction > 4000 &&
        !animation.current,
    );
    const container = gl.domElement.closest(
      ".three-universe",
    ) as HTMLElement | null;
    if (container)
      container.dataset.rotation = control.autoRotate ? "running" : "paused";
    const a = animation.current;
    if (a) {
      a.elapsed += delta;
      const t = reduced ? 1 : Math.min(1, a.elapsed / 0.6),
        ease = t * t * (3 - 2 * t);
      camera.position.lerpVectors(a.from, a.to, ease);
      control.target.lerpVectors(a.fromTarget, a.toTarget, ease);
      if (t === 1) {
        animation.current = null;
        v.set({
          camera: {
            position: camera.position.toArray() as [number, number, number],
            target: control.target.toArray() as [number, number, number],
          },
        });
      }
    }
    if (a || !control.enabled) control.update();
    if (container)
      container.dataset.cameraTarget = control.target
        .toArray()
        .map((n) => n.toFixed(3))
        .join(",");
  });
  return null;
}

function ProjectLabels({
  nodes,
  edges,
  labels,
}: Props & { labels: React.RefObject<Map<string, HTMLButtonElement>> }) {
  const { camera, size } = useThree();
  const point = useMemo(() => new Vector3(), []);
  useFrame(() => {
    const s = useKnowledge.getState(),
      v = useExplorer.getState();
    const neighbors = new Set(
      edges
        .filter((e) => e.source === s.selected || e.target === s.selected)
        .flatMap((e) => [e.source, e.target]),
    );
    const candidates = [];
    for (const node of labelPriority(nodes, edges, s.selected, s.hovered)) {
      const label = labels.current.get(node.id);
      if (!label) continue;
      label.style.visibility = "hidden";
      point.set(...node.position).project(camera);
      if (point.z < -1 || point.z > 1) continue;
      candidates.push({
        id: node.id,
        x: (point.x * 0.5 + 0.5) * size.width,
        y: (-point.y * 0.5 + 0.5) * size.height,
        width: label.offsetWidth,
        height: label.offsetHeight,
        required:
          node.id === s.selected ||
          node.id === s.hovered ||
          neighbors.has(node.id),
      });
    }
    for (const label of placeLabels(
      candidates,
      size.width,
      size.height,
      Math.ceil(12 * Math.max(1, v.zoom)),
    )) {
      const element = labels.current.get(label.id)!;
      element.style.visibility = "visible";
      element.style.transform = `translate3d(${label.left}px,${label.top}px,0)`;
    }
  });
  return null;
}
function Edges({ nodes, edges, accent }: Props & { accent: string }) {
  const dashed = useRef<LineSegments>(null);
  const [solidPoints, inferredPoints] = useMemo(() => {
    const map = new Map(nodes.map((n) => [n.id, n])),
      solid: number[] = [],
      inferred: number[] = [];
    for (const edge of edges) {
      const a = map.get(edge.source),
        b = map.get(edge.target);
      if (a && b)
        (edge.inferred ? inferred : solid).push(...a.position, ...b.position);
    }
    return [new Float32Array(solid), new Float32Array(inferred)];
  }, [nodes, edges]);
  useLayoutEffect(() => {
    dashed.current?.computeLineDistances();
  }, [inferredPoints]);
  return (
    <>
      <lineSegments>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            args={[solidPoints, 3]}
          />
        </bufferGeometry>
        <lineBasicMaterial color={accent} transparent opacity={0.4} />
      </lineSegments>
      <lineSegments ref={dashed}>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            args={[inferredPoints, 3]}
          />
        </bufferGeometry>
        <lineDashedMaterial
          color={accent}
          transparent
          opacity={0.4}
          dashSize={0.14}
          gapSize={0.12}
        />
      </lineSegments>
    </>
  );
}
function Node({ node, accent }: { node: GraphEntity; accent: string }) {
  const mesh = useRef<Mesh>(null),
    elapsed = useRef(0);
  const s = useKnowledge();
  const origin = useMemo(
    () =>
      new Vector3(
        ...((node.metadata?.__entry as [number, number, number] | undefined) ??
          node.position),
      ),
    [node],
  );
  const destination = useMemo(() => new Vector3(...node.position), [node]);
  useFrame((_, delta) => {
    if (!mesh.current || elapsed.current >= 1) return;
    elapsed.current =
      s.accessibility.reducedMotion ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
        ? 1
        : Math.min(1, elapsed.current + delta / 0.2);
    mesh.current.position.lerpVectors(origin, destination, elapsed.current);
    mesh.current.scale.setScalar(nodeRadius(node) * elapsed.current);
  });
  return (
    <mesh
      ref={mesh}
      position={node.position}
      scale={0.01}
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
        <octahedronGeometry args={[1]} />
      ) : ["company", "job", "news"].includes(node.type) ? (
        <boxGeometry args={[1.5, 1.2, 1]} />
      ) : (
        <sphereGeometry args={[1, 16, 12]} />
      )}
      <meshStandardMaterial
        color={accent}
        roughness={0.9}
        transparent
        opacity={
          s.highlighted.length &&
          !node.evidenceIds.some((id) => s.highlighted.includes(id))
            ? 0.25
            : 1
        }
      />
    </mesh>
  );
}
function InstancedNodes({
  nodes,
  accent,
}: {
  nodes: GraphEntity[];
  accent: string;
}) {
  const mesh = useRef<InstancedMesh>(null),
    elapsed = useRef(0),
    dummy = useMemo(() => new Object3D(), []);
  const seen = useRef(new Set<string>()),
    newIds = useRef(new Set<string>());
  const s = useKnowledge();
  useLayoutEffect(() => {
    elapsed.current = 0;
    if (!mesh.current) return;
    newIds.current = new Set(
      nodes.filter((node) => !seen.current.has(node.id)).map((node) => node.id),
    );
    seen.current = new Set(nodes.map((node) => node.id));
    nodes.forEach((node, index) => {
      dummy.position.set(...node.position);
      dummy.scale.setScalar(
        newIds.current.has(node.id) ? 0.001 : nodeRadius(node),
      );
      dummy.updateMatrix();
      mesh.current!.setMatrixAt(index, dummy.matrix);
      mesh.current!.setColorAt(
        index,
        new Color(accent).multiplyScalar(
          s.highlighted.length &&
            !node.evidenceIds.some((id) => s.highlighted.includes(id))
            ? 0.5
            : 1,
        ),
      );
    });
    mesh.current.instanceMatrix.needsUpdate = true;
    if (mesh.current.instanceColor)
      mesh.current.instanceColor.needsUpdate = true;
  }, [nodes, accent, dummy, s.highlighted]);
  useFrame((_, delta) => {
    if (!mesh.current || elapsed.current >= 1) return;
    elapsed.current =
      s.accessibility.reducedMotion ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
        ? 1
        : Math.min(1, elapsed.current + delta / 0.2);
    nodes.forEach((node, index) => {
      const start = !newIds.current.has(node.id)
        ? node.position
        : ((node.metadata?.__entry as [number, number, number] | undefined) ??
          node.position);
      dummy.position
        .set(...start)
        .lerp(new Vector3(...node.position), elapsed.current);
      dummy.scale.setScalar(
        nodeRadius(node) * (newIds.current.has(node.id) ? elapsed.current : 1),
      );
      dummy.updateMatrix();
      mesh.current!.setMatrixAt(index, dummy.matrix);
    });
    mesh.current.instanceMatrix.needsUpdate = true;
  });
  return (
    <instancedMesh
      ref={mesh}
      args={[undefined, undefined, nodes.length]}
      onClick={(event) => {
        event.stopPropagation();
        if (event.instanceId !== undefined)
          s.select(nodes[event.instanceId].id);
      }}
      onDoubleClick={(event) => {
        if (event.instanceId !== undefined) {
          s.select(nodes[event.instanceId].id);
          useExplorer.getState().request("focus");
        }
      }}
      onPointerOver={(event) => {
        event.stopPropagation();
        if (event.instanceId !== undefined)
          s.set({ hovered: nodes[event.instanceId].id });
      }}
      onPointerOut={() => s.set({ hovered: null })}
    >
      <sphereGeometry args={[1, 12, 8]} />
      <meshStandardMaterial roughness={0.9} />
    </instancedMesh>
  );
}
function Scene({
  nodes,
  edges,
  labelNodes,
  labels,
}: Props & {
  labelNodes: GraphEntity[];
  labels: React.RefObject<Map<string, HTMLButtonElement>>;
}) {
  const s = useKnowledge(),
    active = useExplorer((v) => v.active),
    controls = useRef<OrbitControlsType>(null);
  const accent = s.theme === "dark" ? "#a0d6c9" : "#29665c";
  return (
    <>
      <ambientLight intensity={1.5} />
      <directionalLight position={[0, 5, 8]} intensity={2} />
      <Edges nodes={nodes} edges={edges} accent={accent} />
      {nodes.length > 300 ? (
        <InstancedNodes nodes={nodes} accent={accent} />
      ) : (
        nodes.map((node) => <Node key={node.id} node={node} accent={accent} />)
      )}
      <OrbitControls
        ref={controls}
        enabled={active}
        enableZoom={false}
        enableDamping={!s.accessibility.reducedMotion}
        dampingFactor={0.12}
        minDistance={2}
        maxDistance={1000}
        mouseButtons={{
          LEFT: MOUSE.ROTATE,
          MIDDLE: MOUSE.PAN,
          RIGHT: MOUSE.PAN,
        }}
        touches={{ ONE: TOUCH.ROTATE, TWO: TOUCH.DOLLY_PAN }}
        onStart={() => {
          const v = useExplorer.getState();
          v.set({ dragging: true });
          v.interact();
        }}
        onEnd={() => {
          const v = useExplorer.getState();
          v.set({ dragging: false });
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
        makeDefault
      />
      <CameraDirector nodes={nodes} controls={controls} />
      <ProjectLabels nodes={labelNodes} edges={edges} labels={labels} />
    </>
  );
}
export default function Universe({
  nodes,
  edges,
  onFailure,
}: Props & { onFailure: () => void }) {
  const labels = useRef(new Map<string, HTMLButtonElement>()),
    pinchDistance = useRef(0);
  const s = useKnowledge(),
    zoom = useExplorer((v) => v.zoom);
  const neighbors = edges.filter(
    (e) => e.source === s.selected || e.target === s.selected,
  ).length;
  const labelNodes = labelPriority(nodes, edges, s.selected, s.hovered).slice(
    0,
    Math.ceil(12 * Math.max(1, zoom)) + neighbors + 2,
  );
  return (
    <div
      className="three-universe"
      data-renderer={nodes.length > 300 ? "instanced" : "individual"}
      onTouchStart={(event) => {
        if (event.touches.length === 2)
          pinchDistance.current = Math.hypot(
            event.touches[0].clientX - event.touches[1].clientX,
            event.touches[0].clientY - event.touches[1].clientY,
          );
      }}
      onTouchMove={(event) => {
        if (!useExplorer.getState().active || event.touches.length !== 2)
          return;
        const distance = Math.hypot(
          event.touches[0].clientX - event.touches[1].clientX,
          event.touches[0].clientY - event.touches[1].clientY,
        );
        if (Math.abs(distance - pinchDistance.current) > 8) {
          useExplorer
            .getState()
            .request(distance > pinchDistance.current ? "zoom-in" : "zoom-out");
          pinchDistance.current = distance;
        }
      }}
      onTouchEnd={() => {
        pinchDistance.current = 0;
      }}
    >
      <Canvas
        camera={{
          position: useExplorer.getState().camera?.position ?? [0, 0, 16],
          fov: 41,
          far: 2000,
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
        <Scene
          nodes={nodes}
          edges={edges}
          labelNodes={labelNodes}
          labels={labels}
        />
      </Canvas>
      <div className="projected-labels">
        {labelNodes.map((node) => (
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
