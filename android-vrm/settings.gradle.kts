pluginManagement {
    repositories {
        google()
        mavenCentral()
        gradlePluginPortal()
    }
}

dependencyResolutionManagement {
    repositoriesMode.set(RepositoriesMode.FAIL_ON_PROJECT_REPOS)
    repositories {
        google()
        mavenCentral()
    }
}

rootProject.name = "android-vrm"
include(":vrm-loader")
include(":vrm-core")
include(":vrm-springbone")
include(":vrm-constraint")
include(":vrm-lookat")
include(":vrm-material")
include(":vrm-network")
include(":vrm-sample")
