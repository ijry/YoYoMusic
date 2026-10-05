import type { ReactNode } from "react";
import { Icon, type IconProps } from "../../shared/icons";
import type { VisualizationMode } from "../../shared/types";

export interface VisualizationModeMeta {
  id: VisualizationMode;
  label: string;
  hint: string;
  icon: (props?: IconProps) => ReactNode;
}

/*
 * The visualiser mode catalogue. Order is intentional: the three "classic"
 * analyses first, then the three showpieces.
 */
export const visualizationModes: VisualizationModeMeta[] = [
  { id: "spectrum", label: "频谱柱", hint: "镜像频谱条与峰值保持", icon: Icon.vizSpectrum },
  { id: "waveform", label: "示波波形", hint: "发光示波曲线", icon: Icon.vizWaveform },
  { id: "radial", label: "环形律动", hint: "环形放射律动", icon: Icon.vizRadial },
  { id: "aurora", label: "音浪绸带", hint: "流动音浪绸带", icon: Icon.vizAurora },
  { id: "particles", label: "粒子星尘", hint: "节拍粒子星尘", icon: Icon.vizParticles },
  { id: "waterfall", label: "镜像瀑布", hint: "滚动频谱瀑布", icon: Icon.vizWaterfall },
];

export function findVisualizationMode(mode: VisualizationMode): VisualizationModeMeta {
  return visualizationModes.find((entry) => entry.id === mode) ?? visualizationModes[0];
}
