plugins {
    id("com.android.library")
}

android {
    namespace = "com.sisterm.vrm.springbone"
    compileSdk = 36

    defaultConfig {
        minSdk = 24
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
}

dependencies {
    implementation(project(":vrm-core"))
    implementation(project(":vrm-loader"))
}
