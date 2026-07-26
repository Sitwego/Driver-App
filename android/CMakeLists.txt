# Top-level native build for :app.
#
# Because this file exists, the React Native gradle plugin does NOT install
# its default-app-setup/CMakeLists.txt — so part 1 below must replicate it
# exactly to keep libappmodules.so (New Architecture autolinking) building.
#
# NOTE: do not place .cpp files in this directory — ReactNative-application.cmake
# globs *.cpp here and would replace RN's default OnLoad.cpp with them.

cmake_minimum_required(VERSION 3.22.1)

# --- 1. Standard React Native app setup (libappmodules.so) ---------------
# Mirrors react-native/ReactAndroid/cmake-utils/default-app-setup/CMakeLists.txt.
# REACT_ANDROID_DIR is passed by the react-native gradle plugin.
project(appmodules)
include(${REACT_ANDROID_DIR}/cmake-utils/ReactNative-application.cmake)

# --- 2. In-app Nitro modules (libMapsGeometry.so) -------------------------
# Separate subdirectory scope so the nitrogen-generated add_definitions /
# include_directories don't leak into the appmodules target.
add_subdirectory(../nitro-android nitro_android_build)
