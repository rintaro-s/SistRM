import { Quaternion, Vector3, Matrix4 } from 'three';

/**
 * SisterRM Standard Coordinate System (SSCS) converter.
 *
 * SSCS: Right-handed, Y-up, -Z forward.
 * Three.js / A-Frame are natively SSCS (identity mapping).
 * This module provides conversion to/from Unity (LH) and VRM 0.0 raw.
 */

export enum CoordinateSystem {
  SSCS = 'SSCS',           // RH, Y-up, -Z forward
  UNITY = 'UNITY',         // LH, Y-up, +Z world forward
  VRM0_RAW = 'VRM0_RAW',   // VRM 0.0 spec error: RH, +Z forward
}

export interface TransformData {
  position: Vector3;
  rotation: Quaternion;
  scale: Vector3;
}

// ==================== Position / Vector ====================

export function convertPosition(
  pos: Vector3,
  from: CoordinateSystem,
  to: CoordinateSystem
): Vector3 {
  if (from === to) return pos.clone();
  const standard = toStandardPosition(pos, from);
  return fromStandardPosition(standard, to);
}

export function convertDirection(
  dir: Vector3,
  from: CoordinateSystem,
  to: CoordinateSystem
): Vector3 {
  if (from === to) return dir.clone();
  const standard = toStandardDirection(dir, from);
  return fromStandardDirection(standard, to);
}

// ==================== Rotation (Quaternion) ====================

export function convertRotation(
  rot: Quaternion,
  from: CoordinateSystem,
  to: CoordinateSystem
): Quaternion {
  if (from === to) return rot.clone();
  const standard = toStandardRotation(rot, from);
  return fromStandardRotation(standard, to);
}

// ==================== Scale ====================

export function convertScale(
  scale: Vector3,
  from: CoordinateSystem,
  to: CoordinateSystem
): Vector3 {
  return scale.clone();
}

// ==================== Full Transform ====================

export function convertTransform(
  position: Vector3,
  rotation: Quaternion,
  scale: Vector3,
  from: CoordinateSystem,
  to: CoordinateSystem
): TransformData {
  if (from === to) {
    return {
      position: position.clone(),
      rotation: rotation.clone(),
      scale: scale.clone(),
    };
  }
  const stdPos = toStandardPosition(position, from);
  const stdRot = toStandardRotation(rotation, from);
  return {
    position: fromStandardPosition(stdPos, to),
    rotation: fromStandardRotation(stdRot, to),
    scale: scale.clone(),
  };
}

// ==================== To Standard (SSCS) ====================

export function toStandardPosition(pos: Vector3, from: CoordinateSystem): Vector3 {
  switch (from) {
    case CoordinateSystem.SSCS:
      return pos.clone();
    case CoordinateSystem.UNITY:
      return new Vector3(-pos.x, pos.y, pos.z);
    case CoordinateSystem.VRM0_RAW:
      return new Vector3(-pos.x, pos.y, -pos.z);
  }
}

export function toStandardDirection(dir: Vector3, from: CoordinateSystem): Vector3 {
  switch (from) {
    case CoordinateSystem.SSCS:
      return dir.clone();
    case CoordinateSystem.UNITY:
      return new Vector3(-dir.x, dir.y, dir.z);
    case CoordinateSystem.VRM0_RAW:
      return new Vector3(-dir.x, dir.y, -dir.z);
  }
}

export function toStandardRotation(rot: Quaternion, from: CoordinateSystem): Quaternion {
  switch (from) {
    case CoordinateSystem.SSCS:
      return rot.clone();
    case CoordinateSystem.UNITY:
      return convertQuaternionLhToRh(rot);
    case CoordinateSystem.VRM0_RAW: {
      const correction = new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), Math.PI);
      return correction.multiply(rot);
    }
  }
}

// ==================== From Standard (SSCS) ====================

export function fromStandardPosition(pos: Vector3, to: CoordinateSystem): Vector3 {
  switch (to) {
    case CoordinateSystem.SSCS:
      return pos.clone();
    case CoordinateSystem.UNITY:
      return new Vector3(-pos.x, pos.y, pos.z);
    case CoordinateSystem.VRM0_RAW:
      return new Vector3(-pos.x, pos.y, -pos.z);
  }
}

export function fromStandardDirection(dir: Vector3, to: CoordinateSystem): Vector3 {
  switch (to) {
    case CoordinateSystem.SSCS:
      return dir.clone();
    case CoordinateSystem.UNITY:
      return new Vector3(-dir.x, dir.y, dir.z);
    case CoordinateSystem.VRM0_RAW:
      return new Vector3(-dir.x, dir.y, -dir.z);
  }
}

export function fromStandardRotation(rot: Quaternion, to: CoordinateSystem): Quaternion {
  switch (to) {
    case CoordinateSystem.SSCS:
      return rot.clone();
    case CoordinateSystem.UNITY:
      return convertQuaternionLhToRh(rot);
    case CoordinateSystem.VRM0_RAW: {
      const correction = new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), Math.PI);
      return correction.multiply(rot);
    }
  }
}

// ==================== Unity LH ↔ RH Helpers ====================

/**
 * Convert quaternion between Left-Handed and Right-Handed Y-up.
 * Self-inverse operation.
 */
export function convertQuaternionLhToRh(q: Quaternion): Quaternion {
  return new Quaternion(-q.x, -q.y, -q.z, q.w);
}

/**
 * Convert a 4×4 matrix between LH and RH (Y-up).
 * M' = F · M · F where F = diag(-1, 1, 1, 1)
 */
export function convertMatrixLhToRh(m: Matrix4): Matrix4 {
  const e = m.elements;
  const result = new Matrix4();
  const out = result.elements;

  // F * M * F
  out[0] = e[0];   out[1] = -e[1];  out[2] = -e[2];  out[3] = -e[3];
  out[4] = -e[4];  out[5] = e[5];   out[6] = e[6];   out[7] = e[7];
  out[8] = -e[8];  out[9] = e[9];   out[10] = e[10]; out[11] = e[11];
  out[12] = -e[12]; out[13] = e[13]; out[14] = e[14]; out[15] = e[15];

  return result;
}

// ==================== VRM 0.0 Correction ====================

/**
 * Correct VRM 0.0 root transform to SSCS orientation.
 * Applies 180° Y rotation.
 */
export function correctVrm0Orientation(position: Vector3, rotation: Quaternion): TransformData {
  const y180 = new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), Math.PI);
  const correctedPos = position.clone().applyQuaternion(y180);
  const correctedRot = y180.clone().multiply(rotation);
  return { position: correctedPos, rotation: correctedRot, scale: new Vector3(1, 1, 1) };
}

// ==================== Network Protocol Helpers ====================

/**
 * Pack a Three.js transform into SSCS array format for network messages.
 * A-Frame/Three.js is natively SSCS, so this is identity with validation.
 */
export function packToSSCS(
  position: Vector3,
  rotation: Quaternion,
  scale: Vector3
): { pos: [number, number, number]; rot: [number, number, number, number]; scale: [number, number, number] } {
  const sscs = convertTransform(position, rotation, scale, CoordinateSystem.SSCS, CoordinateSystem.SSCS);
  return {
    pos: [sscs.position.x, sscs.position.y, sscs.position.z],
    rot: [sscs.rotation.x, sscs.rotation.y, sscs.rotation.z, sscs.rotation.w],
    scale: [sscs.scale.x, sscs.scale.y, sscs.scale.z],
  };
}

/**
 * Unpack SSCS array format from network messages into Three.js objects.
 */
export function unpackFromSSCS(
  pos: [number, number, number],
  rot: [number, number, number, number],
  scale: [number, number, number]
): TransformData {
  const sscs = convertTransform(
    new Vector3(pos[0], pos[1], pos[2]),
    new Quaternion(rot[0], rot[1], rot[2], rot[3]),
    new Vector3(scale[0], scale[1], scale[2]),
    CoordinateSystem.SSCS,
    CoordinateSystem.SSCS
  );
  return sscs;
}

// ==================== Validation ====================

export function isValidStandardPosition(pos: Vector3): boolean {
  const max = 1_000_000;
  return (
    pos.x >= -max && pos.x <= max &&
    pos.y >= -max && pos.y <= max &&
    pos.z >= -max && pos.z <= max
  );
}

export function isValidStandardRotation(rot: Quaternion): boolean {
  const len = Math.sqrt(rot.x * rot.x + rot.y * rot.y + rot.z * rot.z + rot.w * rot.w);
  return Math.abs(len - 1.0) < 0.01;
}

export function isValidStandardScale(scale: Vector3): boolean {
  const min = 0.001;
  const max = 1000;
  return (
    scale.x >= min && scale.x <= max &&
    scale.y >= min && scale.y <= max &&
    scale.z >= min && scale.z <= max
  );
}
