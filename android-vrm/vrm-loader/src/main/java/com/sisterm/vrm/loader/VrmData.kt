package com.sisterm.vrm.loader

/**
 * Top-level container for all parsed VRM data from both VRM 0.0 and VRM 1.0.
 */
 data class VrmData(
    val gltf: GltfRoot,
    val version: VrmVersion,
    val vrm0: Vrm0Extension? = null,
    val vrm1: Vrm1Vrm? = null,
    val springBone1: Vrm1SpringBone? = null,
    val nodeConstraints: List<Vrm1NodeConstraintExtension> = emptyList(),
    val mtoonMaterials: Map<Int, Vrm1MToon> = emptyMap()
) {
    companion object {
        fun fromGltf(gltf: GltfRoot): VrmData {
            val version = VrmExtensionParser.detectVersion(gltf.extensions)
            val vrm0 = VrmExtensionParser.parseVrm0(gltf.extensions)
            val vrm1 = VrmExtensionParser.parseVrm1(gltf.extensions)
            val springBone1 = VrmExtensionParser.parseSpringBone1(gltf.extensions)

            val nodeConstraints = mutableListOf<Vrm1NodeConstraintExtension>()
            gltf.nodes.forEach { node ->
                node.extensions?.let { ext ->
                    VrmExtensionParser.parseNodeConstraint1(ext)?.let { nc ->
                        nodeConstraints.add(nc)
                    }
                }
            }

            val mtoonMaterials = mutableMapOf<Int, Vrm1MToon>()
            gltf.materials.forEachIndexed { index, material ->
                material.extensions?.let { ext ->
                    VrmExtensionParser.parseMToon1(ext)?.let { mtoon ->
                        mtoonMaterials[index] = mtoon
                    }
                }
            }

            return VrmData(
                gltf = gltf,
                version = version,
                vrm0 = vrm0,
                vrm1 = vrm1,
                springBone1 = springBone1,
                nodeConstraints = nodeConstraints,
                mtoonMaterials = mtoonMaterials
            )
        }
    }
}
