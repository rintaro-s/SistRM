import { Quaternion, Vector3, Matrix4 } from 'three';
/**
 * SisterRM Standard Coordinate System (SSCS) converter.
 *
 * SSCS: Right-handed, Y-up, -Z forward.
 * Three.js / A-Frame are natively SSCS (identity mapping).
 * This module provides conversion to/from Unity (LH) and VRM 0.0 raw.
 */
export declare enum CoordinateSystem {
    SSCS = "SSCS",// RH, Y-up, -Z forward
    UNITY = "UNITY",// LH, Y-up, +Z world forward
    VRM0_RAW = "VRM0_RAW"
}
export interface TransformData {
    position: Vector3;
    rotation: Quaternion;
    scale: Vector3;
}
export declare function convertPosition(pos: Vector3, from: CoordinateSystem, to: CoordinateSystem): Vector3;
export declare function convertDirection(dir: Vector3, from: CoordinateSystem, to: CoordinateSystem): Vector3;
export declare function convertRotation(rot: Quaternion, from: CoordinateSystem, to: CoordinateSystem): Quaternion;
export declare function convertScale(scale: Vector3, from: CoordinateSystem, to: CoordinateSystem): Vector3;
export declare function convertTransform(position: Vector3, rotation: Quaternion, scale: Vector3, from: CoordinateSystem, to: CoordinateSystem): TransformData;
export declare function toStandardPosition(pos: Vector3, from: CoordinateSystem): Vector3;
export declare function toStandardDirection(dir: Vector3, from: CoordinateSystem): Vector3;
export declare function toStandardRotation(rot: Quaternion, from: CoordinateSystem): Quaternion;
export declare function fromStandardPosition(pos: Vector3, to: CoordinateSystem): Vector3;
export declare function fromStandardDirection(dir: Vector3, to: CoordinateSystem): Vector3;
export declare function fromStandardRotation(rot: Quaternion, to: CoordinateSystem): Quaternion;
/**
 * Convert quaternion between Left-Handed and Right-Handed Y-up.
 * Self-inverse operation.
 */
export declare function convertQuaternionLhToRh(q: Quaternion): Quaternion;
/**
 * Convert a 4×4 matrix between LH and RH (Y-up).
 * M' = F · M · F where F = diag(-1, 1, 1, 1)
 */
export declare function convertMatrixLhToRh(m: Matrix4): Matrix4;
/**
 * Correct VRM 0.0 root transform to SSCS orientation.
 * Applies 180° Y rotation.
 */
export declare function correctVrm0Orientation(position: Vector3, rotation: Quaternion): TransformData;
/**
 * Pack a Three.js transform into SSCS array format for network messages.
 * A-Frame/Three.js is natively SSCS, so this is identity with validation.
 */
export declare function packToSSCS(position: Vector3, rotation: Quaternion, scale: Vector3): {
    pos: [number, number, number];
    rot: [number, number, number, number];
    scale: [number, number, number];
};
/**
 * Unpack SSCS array format from network messages into Three.js objects.
 */
export declare function unpackFromSSCS(pos: [number, number, number], rot: [number, number, number, number], scale: [number, number, number]): TransformData;
export declare function isValidStandardPosition(pos: Vector3): boolean;
export declare function isValidStandardRotation(rot: Quaternion): boolean;
export declare function isValidStandardScale(scale: Vector3): boolean;
