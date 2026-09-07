import { StyleSheet, View } from "react-native";
import { type CropCode } from "../domain/crops";
import { theme } from "./theme";

export function CropArtwork(props: {
  readonly cropCode: CropCode;
  readonly compact?: boolean;
}) {
  const size = props.compact ? 54 : 82;
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[
        styles.frame,
        { width: size, height: size, borderRadius: props.compact ? 18 : 26 },
        backgroundFor(props.cropCode)
      ]}
    >
      <CropShape cropCode={props.cropCode} compact={props.compact === true} />
    </View>
  );
}

function CropShape(props: { readonly cropCode: CropCode; readonly compact: boolean }) {
  switch (props.cropCode) {
    case "cotton":
      return <Cotton compact={props.compact} />;
    case "corn":
      return <Corn compact={props.compact} />;
    case "wheat":
      return <Wheat compact={props.compact} />;
    case "hazelnut":
      return <Hazelnut compact={props.compact} />;
    case "tobacco":
      return <Tobacco compact={props.compact} />;
    case "vegetable":
      return <Vegetable compact={props.compact} />;
    case "other":
      return <OtherCrop compact={props.compact} />;
  }
}

function Cotton({ compact }: { readonly compact: boolean }) {
  const scale = compact ? 0.72 : 1;
  return (
    <View style={styles.shapeArea}>
      <View style={[styles.stem, { height: 34 * scale, bottom: 9 * scale }]} />
      <View style={[styles.leaf, { width: 24 * scale, height: 12 * scale, bottom: 20 * scale, left: 13 * scale, transform: [{ rotate: "-24deg" }] }]} />
      <View style={[styles.cottonBall, { width: 28 * scale, height: 28 * scale, top: 15 * scale, left: 24 * scale }]} />
      <View style={[styles.cottonBall, { width: 24 * scale, height: 24 * scale, top: 23 * scale, left: 10 * scale }]} />
      <View style={[styles.cottonBall, { width: 24 * scale, height: 24 * scale, top: 23 * scale, right: 10 * scale }]} />
    </View>
  );
}

function Corn({ compact }: { readonly compact: boolean }) {
  const scale = compact ? 0.72 : 1;
  return (
    <View style={styles.shapeArea}>
      <View style={[styles.cornLeaf, { width: 18 * scale, height: 49 * scale, left: 17 * scale, bottom: 10 * scale, transform: [{ rotate: "-30deg" }] }]} />
      <View style={[styles.cornLeaf, { width: 18 * scale, height: 49 * scale, right: 17 * scale, bottom: 10 * scale, transform: [{ rotate: "30deg" }] }]} />
      <View style={[styles.cob, { width: 27 * scale, height: 48 * scale, top: 16 * scale }]}>
        <View style={styles.kernelLine} />
        <View style={[styles.kernelLine, { left: "62%" }]} />
        <View style={[styles.kernelAcross, { top: "37%" }]} />
        <View style={[styles.kernelAcross, { top: "61%" }]} />
      </View>
    </View>
  );
}

function Wheat({ compact }: { readonly compact: boolean }) {
  const scale = compact ? 0.72 : 1;
  const stems = [-18, 0, 18];
  return (
    <View style={styles.shapeArea}>
      {stems.map((offset) => (
        <View key={offset} style={[styles.wheatStemWrap, { marginLeft: offset * scale }]}>
          <View style={[styles.wheatStem, { height: 48 * scale }]} />
          <View style={[styles.wheatGrain, { top: 12 * scale, left: 2 * scale, transform: [{ rotate: "34deg" }] }]} />
          <View style={[styles.wheatGrain, { top: 20 * scale, right: 2 * scale, transform: [{ rotate: "-34deg" }] }]} />
          <View style={[styles.wheatGrain, { top: 28 * scale, left: 2 * scale, transform: [{ rotate: "34deg" }] }]} />
        </View>
      ))}
    </View>
  );
}

function Hazelnut({ compact }: { readonly compact: boolean }) {
  const scale = compact ? 0.72 : 1;
  return (
    <View style={styles.shapeArea}>
      <View style={[styles.hazelLeaf, { width: 39 * scale, height: 22 * scale, top: 15 * scale, right: 8 * scale, transform: [{ rotate: "-24deg" }] }]} />
      <View style={[styles.hazelNut, { width: 40 * scale, height: 43 * scale, top: 28 * scale }]} />
      <View style={[styles.hazelCap, { width: 31 * scale, height: 10 * scale, top: 27 * scale }]} />
    </View>
  );
}

function Tobacco({ compact }: { readonly compact: boolean }) {
  const scale = compact ? 0.72 : 1;
  return (
    <View style={styles.shapeArea}>
      <View style={[styles.stem, { height: 48 * scale, bottom: 10 * scale }]} />
      <View style={[styles.tobaccoLeaf, { width: 42 * scale, height: 22 * scale, top: 17 * scale, left: 7 * scale, transform: [{ rotate: "-26deg" }] }]} />
      <View style={[styles.tobaccoLeaf, { width: 42 * scale, height: 22 * scale, top: 33 * scale, right: 7 * scale, transform: [{ rotate: "26deg" }] }]} />
    </View>
  );
}

function Vegetable({ compact }: { readonly compact: boolean }) {
  const scale = compact ? 0.72 : 1;
  return (
    <View style={styles.shapeArea}>
      <View style={[styles.tomato, { width: 47 * scale, height: 43 * scale, top: 27 * scale }]} />
      <View style={[styles.tomatoLeaf, { width: 30 * scale, height: 14 * scale, top: 20 * scale, transform: [{ rotate: "10deg" }] }]} />
      <View style={[styles.tomatoLeaf, { width: 26 * scale, height: 12 * scale, top: 20 * scale, transform: [{ rotate: "-35deg" }] }]} />
    </View>
  );
}

function OtherCrop({ compact }: { readonly compact: boolean }) {
  const scale = compact ? 0.72 : 1;
  return (
    <View style={styles.shapeArea}>
      <View style={[styles.fieldLine, { width: 51 * scale, bottom: 20 * scale }]} />
      <View style={[styles.fieldLine, { width: 42 * scale, bottom: 31 * scale }]} />
      <View style={[styles.fieldLine, { width: 31 * scale, bottom: 42 * scale }]} />
      <View style={[styles.sun, { width: 17 * scale, height: 17 * scale, top: 14 * scale, right: 14 * scale }]} />
    </View>
  );
}

function backgroundFor(cropCode: CropCode) {
  switch (cropCode) {
    case "cotton": return styles.cottonBackground;
    case "corn": return styles.cornBackground;
    case "wheat": return styles.wheatBackground;
    case "hazelnut": return styles.hazelnutBackground;
    case "tobacco": return styles.tobaccoBackground;
    case "vegetable": return styles.vegetableBackground;
    case "other": return styles.otherBackground;
  }
}

const styles = StyleSheet.create({
  frame: {
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.65)"
  },
  shapeArea: { width: "100%", height: "100%", alignItems: "center", justifyContent: "center" },
  cottonBackground: { backgroundColor: "#244C36" },
  cornBackground: { backgroundColor: "#4F5D2F" },
  wheatBackground: { backgroundColor: "#63522B" },
  hazelnutBackground: { backgroundColor: "#5B3F2A" },
  tobaccoBackground: { backgroundColor: "#36533B" },
  vegetableBackground: { backgroundColor: "#5A3832" },
  otherBackground: { backgroundColor: "#314A43" },
  stem: { position: "absolute", width: 4, borderRadius: 4, backgroundColor: "#7FAA7D" },
  leaf: { position: "absolute", borderRadius: 999, backgroundColor: "#6E9B70" },
  cottonBall: { position: "absolute", borderRadius: 999, backgroundColor: "#FFFDF7", borderWidth: 1, borderColor: "#E7E1D3" },
  cornLeaf: { position: "absolute", borderRadius: 999, backgroundColor: "#7BA25D" },
  cob: { position: "absolute", borderRadius: 999, backgroundColor: "#F0C95B", overflow: "hidden", alignSelf: "center" },
  kernelLine: { position: "absolute", top: 4, bottom: 4, left: "35%", width: 1, backgroundColor: "rgba(91,73,24,0.25)" },
  kernelAcross: { position: "absolute", left: 3, right: 3, height: 1, backgroundColor: "rgba(91,73,24,0.25)" },
  wheatStemWrap: { position: "absolute", bottom: 12, width: 18, alignItems: "center" },
  wheatStem: { width: 3, borderRadius: 3, backgroundColor: "#D9B85B" },
  wheatGrain: { position: "absolute", width: 14, height: 6, borderRadius: 999, backgroundColor: "#E5C66A" },
  hazelLeaf: { position: "absolute", borderRadius: 999, backgroundColor: "#73955E" },
  hazelNut: { position: "absolute", borderRadius: 999, backgroundColor: "#B8793D" },
  hazelCap: { position: "absolute", borderRadius: 999, backgroundColor: "#76502E" },
  tobaccoLeaf: { position: "absolute", borderRadius: 999, backgroundColor: "#78A26E" },
  tomato: { position: "absolute", borderRadius: 999, backgroundColor: "#D96250" },
  tomatoLeaf: { position: "absolute", borderRadius: 999, backgroundColor: "#7FA268" },
  fieldLine: { position: "absolute", height: 5, borderRadius: 999, backgroundColor: "#80A287" },
  sun: { position: "absolute", borderRadius: 999, backgroundColor: theme.color.warning }
});
