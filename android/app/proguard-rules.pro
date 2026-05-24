# Add project specific ProGuard rules here.
# By default, the flags in this file are appended to flags specified
# in /usr/local/Cellar/android-sdk/24.3.3/tools/proguard/proguard-android.txt
# You can edit the include path and order by changing the proguardFiles
# directive in build.gradle.
#
# For more details, see
#   http://developer.android.com/guide/developing/tools/proguard.html

# react-native-reanimated
-keep class com.swmansion.reanimated.** { *; }
-keep class com.facebook.react.turbomodule.** { *; }

# Suppress R8 warnings about Google Play Services internals (reduces R8 analysis pressure)
-dontwarn com.google.android.gms.internal.**

# Protobuf-lite: keep all generated message classes and their fields.
# R8 obfuscates field names (e.g. id_) which breaks protobuf reflection lookups at runtime.
-keep class * extends com.google.protobuf.GeneratedMessageLite { *; }
-keep class com.google.protobuf.** { *; }
-dontwarn com.google.protobuf.**

# gRPC: keep stub/channel classes used by GrpcNotificationService
-keep class io.grpc.** { *; }
-dontwarn io.grpc.**
-keep class io.grpc.stub.** { *; }

# Keep app-local protobuf generated classes (from notiff.proto / events.proto)
-keep class com.transli.mobilitycaptain.**Grpc { *; }
-keep class com.transli.mobilitycaptain.**Grpc$* { *; }

# Expo modules – preserve runtime type resolution
-keep class kotlin.Metadata { *; }
-keepattributes RuntimeVisibleAnnotations
-keep class expo.modules.kotlin.** { *; }
-keep class expo.modules.image.** { *; }