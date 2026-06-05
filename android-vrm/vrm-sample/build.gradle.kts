plugins {
    alias(libs.plugins.android.application)
}

android {
    namespace = "com.sisterm.vrm.sample"
    compileSdk = 36

    defaultConfig {
        applicationId = "com.sisterm.vrm.sample"
        minSdk = 24
        targetSdk = 36
        versionCode = 1
        versionName = "1.0"
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
}

dependencies {
    implementation(project(":vrm-core"))
    implementation(project(":vrm-loader"))
    implementation(project(":vrm-springbone"))
    implementation(project(":vrm-constraint"))
    implementation(project(":vrm-lookat"))
    implementation(project(":vrm-material"))
    implementation(project(":vrm-filament"))
    implementation(project(":vrm-network"))
    implementation(libs.androidx.appcompat)
    implementation(libs.androidx.core.ktx)
}
