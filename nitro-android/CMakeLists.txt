# C++ build for the in-app MapsGeometry Nitro module (JNI glue only — the
# implementation is Kotlin: android/app/src/main/java/com/margelo/nitro/).
#
# Added via add_subdirectory() from android/CMakeLists.txt. This directory
# must stay a SIBLING of nitrogen/ — the nitrogen-generated include below
# resolves its sources relative to this directory as ../nitrogen/generated/**.

set(CMAKE_CXX_STANDARD 20)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

add_library(MapsGeometry SHARED
            MapsGeometryAdapter.cpp
)

# Nitrogen-generated sources, headers, and prefab links
# (fbjni, ReactAndroid::jsi, react-native-nitro-modules::NitroModules).
include(${CMAKE_CURRENT_SOURCE_DIR}/../nitrogen/generated/android/MapsGeometry+autolinking.cmake)

find_library(LOG_LIB log)

target_link_libraries(
        MapsGeometry
        ${LOG_LIB}
        android
)
