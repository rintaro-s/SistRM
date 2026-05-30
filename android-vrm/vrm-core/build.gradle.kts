plugins {
    id("com.android.library")
    kotlin("android")
}

android {
    namespace = "com.sisterm.vrm.core"
    compileSdk = 34

    defaultConfig {
        minSdk = 24
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    kotlinOptions {
        jvmTarget = "17"
    }
}

dependencies {
    implementation(project(":vrm-loader"))
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-android:1.7.3")
}
