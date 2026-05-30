package com.sisterm.vrm.core

enum class ExpressionPresetName {
    AA,
    IH,
    OU,
    EE,
    OH,
    BLINK,
    HAPPY,
    ANGRY,
    SAD,
    RELAXED,
    LOOK_UP,
    SURPRISED,
    LOOK_DOWN,
    LOOK_LEFT,
    LOOK_RIGHT,
    BLINK_LEFT,
    BLINK_RIGHT,
    NEUTRAL
}

enum class ExpressionOverrideType {
    NONE,
    BLOCK,
    BLEND
}

class VRMExpression(
    val name: String,
    val isBinary: Boolean = false,
    val overrideBlink: ExpressionOverrideType = ExpressionOverrideType.NONE,
    val overrideLookAt: ExpressionOverrideType = ExpressionOverrideType.NONE,
    val overrideMouth: ExpressionOverrideType = ExpressionOverrideType.NONE
) {
    var weight: Float = 0.0f
        set(value) {
            field = if (isBinary) {
                if (value > 0.5f) 1.0f else 0.0f
            } else {
                value.coerceIn(0.0f, 1.0f)
            }
        }

    val overrideBlinkAmount: Float
        get() = if (overrideBlink == ExpressionOverrideType.BLOCK) 1.0f else 0.0f

    val overrideLookAtAmount: Float
        get() = if (overrideLookAt == ExpressionOverrideType.BLOCK) 1.0f else 0.0f

    val overrideMouthAmount: Float
        get() = if (overrideMouth == ExpressionOverrideType.BLOCK) 1.0f else 0.0f

    var appliedWeight: Float = 0.0f
        private set

    fun clearAppliedWeight() {
        appliedWeight = 0.0f
    }

    fun applyWeight(multiplier: Float = 1.0f) {
        appliedWeight = weight * multiplier
    }
}

class VRMExpressionManager {
    private val _expressions = mutableListOf<VRMExpression>()
    private val _expressionMap = mutableMapOf<String, VRMExpression>()

    val expressions: List<VRMExpression> get() = _expressions.toList()
    val expressionMap: Map<String, VRMExpression> get() = _expressionMap.toMap()

    var blinkExpressionNames: List<String> = listOf("blink", "blinkLeft", "blinkRight")
    var lookAtExpressionNames: List<String> = listOf("lookLeft", "lookRight", "lookUp", "lookDown")
    var mouthExpressionNames: List<String> = listOf("aa", "ee", "ih", "oh", "ou")

    fun registerExpression(expression: VRMExpression) {
        _expressions.add(expression)
        _expressionMap[expression.name] = expression
    }

    fun unregisterExpression(expression: VRMExpression) {
        _expressions.remove(expression)
        _expressionMap.remove(expression.name)
    }

    fun getExpression(name: String): VRMExpression? = _expressionMap[name]

    fun setValue(name: String, value: Float) {
        _expressionMap[name]?.weight = value
    }

    fun getValue(name: String): Float? = _expressionMap[name]?.weight

    fun resetAll() {
        _expressions.forEach { it.weight = 0.0f }
    }

    fun update() {
        val multipliers = calculateWeightMultipliers()

        _expressions.forEach { it.clearAppliedWeight() }

        _expressions.forEach { expression ->
            var multiplier = 1.0f
            val name = expression.name

            if (blinkExpressionNames.contains(name)) {
                multiplier *= multipliers.blink
            }
            if (lookAtExpressionNames.contains(name)) {
                multiplier *= multipliers.lookAt
            }
            if (mouthExpressionNames.contains(name)) {
                multiplier *= multipliers.mouth
            }

            expression.applyWeight(multiplier)
        }
    }

    private fun calculateWeightMultipliers(): WeightMultipliers {
        var blink = 1.0f
        var lookAt = 1.0f
        var mouth = 1.0f

        _expressions.forEach { expression ->
            blink -= expression.overrideBlinkAmount
            lookAt -= expression.overrideLookAtAmount
            mouth -= expression.overrideMouthAmount
        }

        return WeightMultipliers(
            blink = blink.coerceAtLeast(0.0f),
            lookAt = lookAt.coerceAtLeast(0.0f),
            mouth = mouth.coerceAtLeast(0.0f)
        )
    }

    data class WeightMultipliers(
        val blink: Float,
        val lookAt: Float,
        val mouth: Float
    )
}
