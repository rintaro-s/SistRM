pluginManagement {
    repositories {
        google {
            content {
                includeGroupByRegex("com\\.android.*")
                includeGroupByRegex("com\\.google.*")
                includeGroupByRegex("androidx.*")
            }
        }
        mavenCentral()
        gradlePluginPortal()
    }
}
plugins {
    id("org.gradle.toolchains.foojay-resolver-convention") version "1.0.0"
}
dependencyResolutionManagement {
    repositoriesMode.set(RepositoriesMode.FAIL_ON_PROJECT_REPOS)
    repositories {
        google()
        mavenCentral()
    }
}

rootProject.name = "VRM"
include(":app")

// SisterRM VRM library modules (included from parent project)
val libDir = file("../../android-vrm")
include(":vrm-loader")
project(":vrm-loader").projectDir = file("$libDir/vrm-loader")
include(":vrm-core")
project(":vrm-core").projectDir = file("$libDir/vrm-core")
include(":vrm-network")
project(":vrm-network").projectDir = file("$libDir/vrm-network")
include(":vrm-springbone")
project(":vrm-springbone").projectDir = file("$libDir/vrm-springbone")
include(":vrm-constraint")
project(":vrm-constraint").projectDir = file("$libDir/vrm-constraint")
include(":vrm-lookat")
project(":vrm-lookat").projectDir = file("$libDir/vrm-lookat")
include(":vrm-material")
project(":vrm-material").projectDir = file("$libDir/vrm-material")
include(":vrm-filament")
project(":vrm-filament").projectDir = file("$libDir/vrm-filament")
