import { registerRoot, staticFile } from "remotion";
import { loadFont } from "@remotion/fonts";
import { RemotionRoot } from "./Root";

loadFont({
  family: "Noto Sans SC",
  url: staticFile("fonts/NotoSansSC-Black.ttf"),
  weight: "900",
  format: "truetype",
}).then(() => {
  registerRoot(RemotionRoot);
});
