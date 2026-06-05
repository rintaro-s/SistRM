package com.sisterm.vrm.filament

/**
 * Unified API for controlling a loaded VRM avatar.
 *
 * This interface abstracts all VRM operations — expressions, humanoid bones,
 * first-person mode, look-at, and root transform — so your application code
 * never needs to touch renderer internals.
 *
 * ## Quick Start
 *
 * ```kotlin
 * val vrm = VRMFilamentController(surfaceView, assetManager)
 * vrm.loadVrm("avatar.vrm")
 *
 * // Expressions
 * vrm.setExpression("happy", 0.8f)
 * vrm.setExpression("blink", 1.0f)
 *
 * // Bone pose (euler angles in radians, delta from bind pose)
 * vrm.setBoneRotation("head", 0.2f, 0.1f, 0f)
 * vrm.setBoneRotation("leftUpperArm", 0f, 0f, 0.5f)
 *
 * // First-person mode
 * vrm.firstPersonEnabled = true
 *
 * // Root transform
 * vrm.setPosition(0f, 0f, -2f)
 * vrm.setRotation(0f, 0.5f, 0f)
 * ```
 */
interface VRMController {

    // ==================== Loading ====================

    /** Set a listener for load events. */
    fun setListener(listener: VRMControllerListener?)

    /** Load a VRM from the asset manager by path. */
    fun loadVrm(path: String)

    /** Load a VRM from a direct ByteBuffer. */
    fun loadVrm(buffer: java.nio.ByteBuffer)

    // ==================== Metadata ====================

    /** VRM title from meta. */
    val metaTitle: String

    /** VRM author from meta. */
    val metaAuthor: String

    /** Detected VRM version string ("1.0", "0.0", or "unknown"). */
    val version: String

    // ==================== Expressions ====================

    /** Names of all available expressions (e.g. "happy", "blink", "aa"). */
    fun getExpressionNames(): List<String>

    /** Set an expression weight in [0.0, 1.0]. */
    fun setExpression(name: String, weight: Float)

    /** Get the current weight of an expression. */
    fun getExpressionWeight(name: String): Float

    /** Reset all expressions to 0. */
    fun resetExpressions()

    // ==================== Humanoid Bones ====================

    /** Names of all mappable humanoid bones (e.g. "head", "leftUpperArm"). */
    fun getBoneNames(): List<String>

    /**
     * Rotate a humanoid bone by euler angles (radians).
     * Rotation is applied as a delta on top of the bind (rest) pose.
     */
    fun setBoneRotation(boneName: String, eulerX: Float, eulerY: Float, eulerZ: Float)

    /** Reset a single bone to its bind pose. */
    fun resetBone(boneName: String)

    /** Reset all bones to bind pose. */
    fun resetAllBones()

    // ==================== First-Person ====================

    /** Toggle first-person mesh hiding (head/face/hair). */
    var firstPersonEnabled: Boolean

    // ==================== Look-At ====================

    /** Set the world-space target the avatar should look at. */
    fun setLookAtTarget(x: Float, y: Float, z: Float)

    // ==================== Root Transform ====================

    /** Set root position. */
    fun setPosition(x: Float, y: Float, z: Float)

    /** Set root rotation from euler angles (radians). */
    fun setRotation(eulerX: Float, eulerY: Float, eulerZ: Float)

    /** Set uniform scale. */
    fun setScale(s: Float)

    /** Set non-uniform scale. */
    fun setScale(x: Float, y: Float, z: Float)

    // ==================== Lifecycle ====================

    /** Call every frame (or attach as a lifecycle observer). */
    fun update(deltaTime: Float)

    /** Release all native resources. */
    fun destroy()
}
