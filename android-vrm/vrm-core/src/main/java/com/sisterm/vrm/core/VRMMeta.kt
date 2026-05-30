package com.sisterm.vrm.core

data class VRMMeta(
    val title: String = "",
    val version: String = "",
    val author: String = "",
    val contact: String = "",
    val reference: String = "",
    val thumbnail: Int? = null,
    val allowedUser: AllowedUser = AllowedUser.ONLY_AUTHOR,
    val violentUsage: UsagePermission = UsagePermission.DISALLOW,
    val sexualUsage: UsagePermission = UsagePermission.DISALLOW,
    val commercialUsage: UsagePermission = UsagePermission.DISALLOW,
    val license: LicenseType = LicenseType.REDISTRIBUTION_PROHIBITED
)

enum class AllowedUser {
    ONLY_AUTHOR,
    EXPLICITLY_LICENSED_PERSON,
    EVERYONE
}

enum class UsagePermission {
    ALLOW,
    DISALLOW
}

enum class LicenseType {
    REDISTRIBUTION_PROHIBITED,
    CC0,
    CC_BY,
    CC_BY_NC,
    CC_BY_SA,
    CC_BY_NC_SA,
    CC_BY_ND,
    CC_BY_NC_ND,
    OTHER
}
