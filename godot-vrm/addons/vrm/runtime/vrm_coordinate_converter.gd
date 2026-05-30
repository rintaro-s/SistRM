class_name VRMCoordinateConverter
extends RefCounted

## SisterRM Standard Coordinate System (SSCS) converter.
## SSCS: Right-handed, Y-up, -Z forward.
## Godot is natively SSCS (identity mapping).
## This module provides conversion to/from Unity (LH) and VRM 0.0 raw.

enum CoordinateSystem {
	SSCS,           ## RH, Y-up, -Z forward
	UNITY,          ## LH, Y-up, +Z world forward
	VRM0_RAW,       ## VRM 0.0 spec error: RH, +Z forward
}

# ==================== Position / Vector ====================

static func convert_position(pos: Vector3, from: CoordinateSystem, to: CoordinateSystem) -> Vector3:
	if from == to:
		return pos
	var standard = to_standard_position(pos, from)
	return from_standard_position(standard, to)

static func convert_direction(dir: Vector3, from: CoordinateSystem, to: CoordinateSystem) -> Vector3:
	if from == to:
		return dir
	var standard = to_standard_direction(dir, from)
	return from_standard_direction(standard, to)

# ==================== Rotation (Quaternion) ====================

static func convert_rotation(rot: Quaternion, from: CoordinateSystem, to: CoordinateSystem) -> Quaternion:
	if from == to:
		return rot
	var standard = to_standard_rotation(rot, from)
	return from_standard_rotation(standard, to)

# ==================== Scale ====================

static func convert_scale(scale: Vector3, from: CoordinateSystem, to: CoordinateSystem) -> Vector3:
	return scale

# ==================== Full Transform ====================

static func convert_transform(position: Vector3, rotation: Quaternion, scale: Vector3, from: CoordinateSystem, to: CoordinateSystem) -> Dictionary:
	if from == to:
		return {"position": position, "rotation": rotation, "scale": scale}
	var std_pos = to_standard_position(position, from)
	var std_rot = to_standard_rotation(rotation, from)
	return {
		"position": from_standard_position(std_pos, to),
		"rotation": from_standard_rotation(std_rot, to),
		"scale": scale,
	}

# ==================== To Standard (SSCS) ====================

static func to_standard_position(pos: Vector3, from: CoordinateSystem) -> Vector3:
	match from:
		CoordinateSystem.SSCS:
			return pos
		CoordinateSystem.UNITY:
			return Vector3(-pos.x, pos.y, pos.z)
		CoordinateSystem.VRM0_RAW:
			return Vector3(-pos.x, pos.y, -pos.z)
	return pos

static func to_standard_direction(dir: Vector3, from: CoordinateSystem) -> Vector3:
	match from:
		CoordinateSystem.SSCS:
			return dir
		CoordinateSystem.UNITY:
			return Vector3(-dir.x, dir.y, dir.z)
		CoordinateSystem.VRM0_RAW:
			return Vector3(-dir.x, dir.y, -dir.z)
	return dir

static func to_standard_rotation(rot: Quaternion, from: CoordinateSystem) -> Quaternion:
	match from:
		CoordinateSystem.SSCS:
			return rot
		CoordinateSystem.UNITY:
			return convert_quaternion_lh_to_rh(rot)
		CoordinateSystem.VRM0_RAW:
			var correction = Quaternion.from_euler(Vector3(0, PI, 0))
			return correction * rot
	return rot

# ==================== From Standard (SSCS) ====================

static func from_standard_position(pos: Vector3, to: CoordinateSystem) -> Vector3:
	match to:
		CoordinateSystem.SSCS:
			return pos
		CoordinateSystem.UNITY:
			return Vector3(-pos.x, pos.y, pos.z)
		CoordinateSystem.VRM0_RAW:
			return Vector3(-pos.x, pos.y, -pos.z)
	return pos

static func from_standard_direction(dir: Vector3, to: CoordinateSystem) -> Vector3:
	match to:
		CoordinateSystem.SSCS:
			return dir
		CoordinateSystem.UNITY:
			return Vector3(-dir.x, dir.y, dir.z)
		CoordinateSystem.VRM0_RAW:
			return Vector3(-dir.x, dir.y, -dir.z)
	return dir

static func from_standard_rotation(rot: Quaternion, to: CoordinateSystem) -> Quaternion:
	match to:
		CoordinateSystem.SSCS:
			return rot
		CoordinateSystem.UNITY:
			return convert_quaternion_lh_to_rh(rot)
		CoordinateSystem.VRM0_RAW:
			var correction = Quaternion.from_euler(Vector3(0, PI, 0))
			return correction * rot
	return rot

# ==================== Unity LH ↔ RH Helpers ====================

## Convert quaternion between Left-Handed and Right-Handed Y-up.
## Self-inverse operation.
static func convert_quaternion_lh_to_rh(q: Quaternion) -> Quaternion:
	return Quaternion(-q.x, -q.y, -q.z, q.w)

## Convert a 4×4 Basis between LH and RH (Y-up).
## M' = F · M · F where F = diag(-1, 1, 1)
static func convert_basis_lh_to_rh(b: Basis) -> Basis:
	var m = b.get_rotation_quaternion()
	return Basis(convert_quaternion_lh_to_rh(m))

# ==================== VRM 0.0 Correction ====================

## Correct VRM 0.0 root transform to SSCS orientation.
## Applies 180° Y rotation.
static func correct_vrm0_orientation(position: Vector3, rotation: Quaternion) -> Dictionary:
	var y180 = Quaternion.from_euler(Vector3(0, PI, 0))
	var corrected_pos = y180 * position
	var corrected_rot = y180 * rotation
	return {"position": corrected_pos, "rotation": corrected_rot}

# ==================== Validation ====================

static func is_valid_standard_position(pos: Vector3) -> bool:
	var max_val = 1000000.0
	return abs(pos.x) <= max_val and abs(pos.y) <= max_val and abs(pos.z) <= max_val

static func is_valid_standard_rotation(rot: Quaternion) -> bool:
	var len = sqrt(rot.x * rot.x + rot.y * rot.y + rot.z * rot.z + rot.w * rot.w)
	return abs(len - 1.0) < 0.01

static func is_valid_standard_scale(scale: Vector3) -> bool:
	var min_val = 0.001
	var max_val = 1000.0
	return scale.x >= min_val and scale.x <= max_val and scale.y >= min_val and scale.y <= max_val and scale.z >= min_val and scale.z <= max_val
