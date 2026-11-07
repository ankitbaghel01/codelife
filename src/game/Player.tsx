import { useEffect, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Vector3 } from "three";
import { PointerLockControls } from "three/examples/jsm/controls/PointerLockControls.js";
import { boomLength, resolve } from "./collision";
import { BOXES, INTERACTABLES, SOLIDS, SPAWN } from "./layout";
import { pose } from "./pose";
import { HERO_LAYER } from "./Hero";

const SPEED = 2.4; // metres per second, a calm walk
const RADIUS = 0.3;
const REACH = 1.3;
const BOOM = 2.2; // third-person camera distance
const WALLS = SOLIDS.filter((s) => s.h > 2); // the camera floats above furniture, so only walls block it

type Props = {
  enabled: boolean; // false while the phone or a menu has the keyboard
  thirdPerson: boolean;
  onLockChange: (locked: boolean) => void;
  onNear: (id: string | null) => void;
  onInteract: (id: string) => void;
};

const forward = new Vector3();
const look = new Vector3();
const right = new Vector3();
const toItem = new Vector3();

export function Player({
  enabled,
  thirdPerson,
  onLockChange,
  onNear,
  onInteract,
}: Props) {
  const { camera, gl, scene } = useThree();
  const controls = useRef<PointerLockControls>();
  const keys = useRef(new Set<string>());
  const near = useRef<string | null>(null);
  const live = useRef({ enabled, onNear, onInteract });
  live.current = { enabled, onNear, onInteract };

  useEffect(() => {
    pose.x = SPAWN.x;
    pose.z = SPAWN.z;
    camera.position.set(SPAWN.x, SPAWN.eye, SPAWN.z);
    const c = new PointerLockControls(camera, gl.domElement);
    // Dev-only hook for automated screenshots (no pointer lock in headless browsers).
    if (import.meta.env.DEV) Object.assign(window, { __codelife: { pose, camera, scene } });
    controls.current = c;
    const lock = () => live.current.enabled && c.lock();
    const onLock = () => onLockChange(true);
    const onUnlock = () => {
      keys.current.clear();
      onLockChange(false);
    };
    c.addEventListener("lock", onLock);
    c.addEventListener("unlock", onUnlock);
    gl.domElement.addEventListener("click", lock);
    return () => {
      gl.domElement.removeEventListener("click", lock);
      c.removeEventListener("lock", onLock);
      c.removeEventListener("unlock", onUnlock);
      c.dispose();
    };
  }, [camera, gl, scene, onLockChange]);

  // Leaving game mode (opening the phone, pausing) hands the mouse back to the page.
  useEffect(() => {
    if (!enabled) controls.current?.unlock();
  }, [enabled]);

  useEffect(() => {
    const typing = (e: KeyboardEvent) =>
      e.target instanceof HTMLInputElement ||
      e.target instanceof HTMLTextAreaElement;
    const down = (e: KeyboardEvent) => {
      if (!live.current.enabled || typing(e) || !controls.current?.isLocked)
        return;
      keys.current.add(e.code);
      if (e.code === "KeyE" && near.current)
        live.current.onInteract(near.current);
    };
    const up = (e: KeyboardEvent) => keys.current.delete(e.code);
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, []);

  useFrame((_, dt) => {
    camera.getWorldDirection(look);
    forward.set(look.x, 0, look.z).normalize();
    pose.yaw = Math.atan2(-forward.x, -forward.z);
    pose.third = thirdPerson;
    if (thirdPerson) camera.layers.enable(HERO_LAYER);
    else camera.layers.disable(HERO_LAYER);
    if (!controls.current?.isLocked || !enabled) pose.moving = false;

    if (controls.current?.isLocked && enabled) {
      const k = keys.current;
      const ahead =
        Number(k.has("KeyW") || k.has("ArrowUp")) -
        Number(k.has("KeyS") || k.has("ArrowDown"));
      const side =
        Number(k.has("KeyD") || k.has("ArrowRight")) -
        Number(k.has("KeyA") || k.has("ArrowLeft"));
      right.crossVectors(forward, camera.up).normalize();
      const step = Math.min(dt, 0.05) * SPEED;
      const len = Math.hypot(ahead, side) || 1;
      const x = pose.x + ((forward.x * ahead + right.x * side) / len) * step;
      const z = pose.z + ((forward.z * ahead + right.z * side) / len) * step;
      [pose.x, pose.z] = resolve(x, z, RADIUS, BOXES);
      pose.moving = ahead !== 0 || side !== 0;
    }

    if (thirdPerson) {
      // Pull the camera in when a wall is behind you, so it never clips into the next room.
      const d = boomLength(pose.x, pose.z, -look.x, -look.z, BOOM, WALLS);
      camera.position.set(
        pose.x - look.x * d,
        SPAWN.eye + 0.25 - look.y * d,
        pose.z - look.z * d,
      );
    } else {
      camera.position.set(pose.x, SPAWN.eye, pose.z);
    }

    // Show the "E" prompt for the closest object you are facing.
    let best: string | null = null;
    let bestD = REACH;
    for (const it of INTERACTABLES) {
      toItem.set(it.x - pose.x, 0, it.z - pose.z);
      const d = toItem.length();
      if (d < bestD && toItem.normalize().dot(forward) > 0.4) {
        best = it.id;
        bestD = d;
      }
    }
    if (best !== near.current) {
      near.current = best;
      live.current.onNear(best);
    }
  });

  return null;
}
