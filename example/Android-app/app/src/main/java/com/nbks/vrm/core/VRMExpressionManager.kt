package com.nbks.vrm.core

class VRMExpression(
    val name: String,
    val isBinary: Boolean = false
) {
    var weight: Float = 0.0f
        set(value) { field = if (isBinary) (if (value > 0.5f) 1.0f else 0.0f) else value.coerceIn(0.0f, 1.0f) }
}

class VRMExpressionManager {
    private val _expressions = mutableMapOf<String, VRMExpression>()
    val expressions: Map<String, VRMExpression> get() = _expressions

    fun registerExpression(expression: VRMExpression) {
        _expressions[expression.name] = expression
    }

    fun setValue(name: String, value: Float) {
        _expressions[name]?.weight = value
    }

    fun getValue(name: String): Float = _expressions[name]?.weight ?: 0.0f

    fun resetAll() { _expressions.values.forEach { it.weight = 0.0f } }
}
