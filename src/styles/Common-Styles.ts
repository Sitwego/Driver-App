import { Dimensions, StyleProp, StyleSheet } from "react-native";
import { borderRadius, space } from "~/constants/styles-token";

export const s = StyleSheet.create({
  aspCt910: {
    aspectRatio: 9 / 10,
  },
  border0: { borderWidth: 0 },
  border1: { borderWidth: 1 },
  borderTop1: { borderTopWidth: 1 },
  borderRight1: { borderRightWidth: 1 },
  borderBottom1: { borderBottomWidth: 1 },
  borderLeft1: { borderLeftWidth: 1 },
  hidden: { display: "none" },
  overFlowHiden: { overflow: "hidden" },
  dimmed: { opacity: 0.5 },

  // text decoration
  underline: { textDecorationLine: "underline" },
  //fontVariant
  fontVarian: { fontVariant: ["tabular-nums"] },
  // font sizes
  f9: { fontSize: 9 },
  f10: { fontSize: 10 },
  f11: { fontSize: 11 },
  f12: { fontSize: 12 },
  f13: { fontSize: 13 },
  f14: { fontSize: 14 },
  f15: { fontSize: 15 },
  f16: { fontSize: 16 },
  f17: { fontSize: 17 },
  f18: { fontSize: 18 },
  f20: { fontSize: 20 },
  f24: { fontSize: 24 },

  // line heights
  ["lh13-1"]: { lineHeight: 13 },
  ["lh13-1.3"]: { lineHeight: 16.9 }, // 1.3 of 13px
  ["lh14-1"]: { lineHeight: 14 },
  ["lh14-1.3"]: { lineHeight: 18.2 }, // 1.3 of 14px
  ["lh15-1"]: { lineHeight: 15 },
  ["lh15-1.3"]: { lineHeight: 19.5 }, // 1.3 of 15px
  ["lh16-1"]: { lineHeight: 16 },
  ["lh16-1.3"]: { lineHeight: 20.8 }, // 1.3 of 16px
  ["lh17-1"]: { lineHeight: 17 },
  ["lh17-1.3"]: { lineHeight: 22.1 }, // 1.3 of 17px
  ["lh18-1"]: { lineHeight: 18 },
  ["lh18-1.3"]: { lineHeight: 23.4 }, // 1.3 of 18px

  // margins
  mr2: { marginRight: 2 },
  mr3: { marginRight: 3 },
  mr4: { marginRight: 4 },
  mr5: { marginRight: 5 },
  mr10: { marginRight: 10 },
  mr20: { marginRight: 20 },
  ml2: { marginLeft: 2 },
  ml3: { marginLeft: 3 },
  ml4: { marginLeft: 4 },
  ml5: { marginLeft: 5 },
  ml10: { marginLeft: 10 },
  ml20: { marginLeft: 20 },
  mt2: { marginTop: 2 },
  mt5: { marginTop: 5 },
  mt8: { marginTop: 8 },
  mt10: { marginTop: 10 },
  mt20: { marginTop: 20 },
  mt24: { marginTop: 24 },
  mt26: { marginTop: 26 },
  mt28: { marginTop: 28 },
  mb2: { marginBottom: 2 },
  mb5: { marginBottom: 5 },
  mb10: { marginBottom: 10 },
  mb20: { marginBottom: 20 },
  mb24: { marginBottom: 24 },
  mb32: { marginBottom: 32 },
  mb40: { marginBottom: 40 },

  //bottoms
  b0: { bottom: 0 },
  b2: { bottom: 2 },
  b3: { bottom: 3 },
  b4: { bottom: 4 },
  b6: { bottom: 6 },
  b8: { bottom: 8 },
  b10: { bottom: 10 },
  b12: { bottom: 12 },
  b16: { bottom: 16 },
  b20: { bottom: 20 },
  b24: { bottom: 24 },

  // paddings
  p2: { padding: 2 },
  p4: { padding: 4 },
  p5: { padding: 5 },
  p8: { padding: 8 },
  p10: { padding: 10 },
  p16: { padding: 16 },
  p20: { padding: 20 },
  p40: { padding: 40 },
  pr2: { paddingRight: 2 },
  pr5: { paddingRight: 5 },
  pr10: { paddingRight: 10 },
  pr20: { paddingRight: 20 },
  pl2: { paddingLeft: 2 },
  pl5: { paddingLeft: 5 },
  pl10: { paddingLeft: 10 },
  pl20: { paddingLeft: 20 },
  pt2: { paddingTop: 2 },
  pt5: { paddingTop: 5 },
  pt10: { paddingTop: 10 },
  pt20: { paddingTop: 20 },
  pb2: { paddingBottom: 2 },
  pb5: { paddingBottom: 5 },
  pb10: { paddingBottom: 10 },
  pb20: { paddingBottom: 20 },
  pb30: { paddingBottom: 30 },
  pb40: { paddingBottom: 40 },
  px2: { paddingHorizontal: 2 },
  px4: { paddingHorizontal: 4 },
  px5: { paddingHorizontal: 5 },
  px6: { paddingHorizontal: 6 },
  px8: { paddingHorizontal: 8 },
  px10: { paddingHorizontal: 10 },
  px12: { paddingHorizontal: 12 },
  px14: { paddingHorizontal: 14 },
  px16: { paddingHorizontal: 16 },
  px20: { paddingHorizontal: 20 },
  px24: { paddingHorizontal: 24 },
  px32: { paddingHorizontal: 32 },
  px40: { paddingHorizontal: 40 },

  py2: { paddingVertical: 2 },
  py4: { paddingVertical: 4 },
  py5: { paddingVertical: 5 },
  py6: { paddingVertical: 6 },
  py8: { paddingVertical: 8 },
  py10: { paddingVertical: 10 },
  py12: { paddingVertical: 12 },
  py14: { paddingVertical: 14 },
  py16: { paddingVertical: 16 },
  py20: { paddingVertical: 20 },
  py24: { paddingVertical: 24 },
  py32: { paddingVertical: 32 },
  py40: { paddingVertical: 40 },

  gap2: { gap: space.xsm },
  gap3: { gap: 3 },
  gap4: { gap: space.xs },
  gap5: { gap: 5 },
  gap6: { gap: 6 },
  gap8: { gap: space.sm },
  gap12: { gap: space.md },
  gap14: { gap: 14 },
  gap16: { gap: space.lg },
  gap20: { gap: space.xl },
  gap24: { gap: space.xl2 },
  gap28: { gap: space.xl3 },
  gap32: { gap: space.xl4 },
  gap40: { gap: space.xl5 },
  // flex
  flexRow: { flexDirection: "row" },
  flexCol: { flexDirection: "column" },
  flex1: { flex: 1 },
  flexBox: { flex: 1, display: "flex" },
  flexGrow1: { flexGrow: 1 },
  alignCenter: { alignItems: "center" },
  centerItem: { justifyContent: "center", alignItems: "center" },
  alignBaseline: { alignItems: "baseline" },
  justifyCenter: { justifyContent: "center" },
  justifyBetween: { justifyContent: "space-between" },
  justifyFlexEnd: { justifyContent: "flex-end" },
  alignSelfStretch: {
    alignSelf: "stretch",
  },
  alignSelf: { alignSelf: "center" },
  align_start: {
    alignItems: "flex-start",
  },
  align_end: {
    alignItems: "flex-end",
  },
  align_baseline: {
    alignItems: "baseline",
  },
  align_stretch: {
    alignItems: "stretch",
  },
  self_auto: {
    alignSelf: "auto",
  },
  self_start: {
    alignSelf: "flex-start",
  },
  self_end: {
    alignSelf: "flex-end",
  },
  self_center: {
    alignSelf: "center",
  },
  self_stretch: {
    alignSelf: "stretch",
  },
  self_baseline: {
    alignSelf: "baseline",
  },
  flexDirectionRow: { flexDirection: "row", gap: 4, alignItems: "center" },
  absoluteFill: {
    ...StyleSheet.absoluteFillObject,
  },
  // position
  absolute: { position: "absolute" },
  relative: { position: "relative" },
  /*
   * Theme-independent bg colors
   */
  bg_transparent: {
    backgroundColor: "transparent",
  },

  // dimensions
  w100pct: { width: "100%" },
  h100pct: { height: "100%" },
  window: {
    width: Dimensions.get("window").width,
    height: Dimensions.get("window").height,
  },

  inset_0: {
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },

  z1: { zIndex: 1 },
  z2: { zIndex: 2 },
  z5: { zIndex: 5 },
  z10: { zIndex: 10 },
  z999: { zIndex: 999 },

  // text align
  textLeft: { textAlign: "left" },
  textCenter: { textAlign: "center" },
  textRight: { textAlign: "right" },

  /*** Border
   */
  border_0: {
    borderWidth: 0,
  },
  border: {
    borderWidth: StyleSheet.hairlineWidth,
  },
  border_t: {
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  border_b: {
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  border_l: {
    borderLeftWidth: StyleSheet.hairlineWidth,
  },
  border_r: {
    borderRightWidth: StyleSheet.hairlineWidth,
  },

  borderRadius_0: {
    borderRadius: 0,
  },
  borderRadius_xsm: {
    borderRadius: borderRadius.xsm,
  },
  borderRadius_xs: {
    borderRadius: borderRadius.xs,
  },
  borderRadius_sm: {
    borderRadius: borderRadius.sm,
  },
  borderRadius_md: {
    borderRadius: borderRadius.md,
  },
  borderRadius_lg: {
    borderRadius: borderRadius.lg,
  },
  borderRadius_full: {
    borderRadius: borderRadius.full,
  },

  /*
   * Shadow
   */
  shadow_sm: {
    shadowRadius: 8,
    shadowOpacity: 0.1,
    elevation: 8,
  },
  shadow_md: {
    shadowRadius: 16,
    shadowOpacity: 0.1,
    elevation: 16,
  },
  shadow_lg: {
    shadowRadius: 32,
    shadowOpacity: 0.1,
    elevation: 24,
  },
  imgCountView: {
    position: "absolute",
    right: 4,
    paddingHorizontal: 5,
    height: 20,
    borderRadius: 4,
  },
  centeredImg: {
    width: null,
    height: null,
    flex: 1,
  },
  input: {
    borderRadius: borderRadius.sm,
    borderWidth: 1,
    height: 56.3,
  },
});

export function addStyle<T>(
  base: StyleProp<T>,
  addedStyle: StyleProp<T>,
): StyleProp<T> {
  if (Array.isArray(base)) {
    return base.concat([addedStyle]);
  }
  return [base, addedStyle];
}
