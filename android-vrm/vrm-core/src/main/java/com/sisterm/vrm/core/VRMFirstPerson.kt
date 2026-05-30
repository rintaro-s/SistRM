package com.sisterm.vrm.core

import com.sisterm.vrm.core.math.Vector3

enum class FirstPersonFlag {
    AUTO,
    BOTH,
    FIRST_PERSON_ONLY,
    THIRD_PERSON_ONLY
}

data class FirstPersonMeshAnnotation(
    val nodeIndex: Int,
    val flag: FirstPersonFlag
)

class VRMFirstPerson(
    val meshAnnotations: List<FirstPersonMeshAnnotation> = emptyList(),
    val eyeOffset: Vector3 = Vector3()
)
