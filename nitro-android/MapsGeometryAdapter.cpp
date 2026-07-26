// JNI entry point for the in-app MapsGeometry Nitro module.
// Runs when MapsGeometryOnLoad.initializeNative() calls
// System.loadLibrary("MapsGeometry") — registers the JNI natives and
// the "MapsGeometry" HybridObject constructor with Nitro.
#include "MapsGeometryOnLoad.hpp"
#include <fbjni/fbjni.h>
#include <jni.h>

JNIEXPORT jint JNICALL JNI_OnLoad(JavaVM* vm, void*) {
  return facebook::jni::initialize(
      vm, []() { margelo::nitro::mapsgeometry::registerAllNatives(); });
}
