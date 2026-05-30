plugins {
    id("com.android.application")
    kotlin("android")
}

android {
    namespace = "com.sisterm.vrm.sample"
    compileSdk = 34

    defaultConfig {
        applicationId = "com.sisterm.vrm.sample"
        minSdk = 24
        targetSdk = 34
        versionCode = 1
        versionName = "1.0"
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
    implementation(project(":vrm-core"))
    implementation(project(":vrm-loader"))
    implementation(project(":vrm-springbone"))
    implementation(project(":vrm-constraint"))
    implementation(project(":vrm-network"))
    implementation("androidx.appcompat:appcompat:1.6.1")
}
