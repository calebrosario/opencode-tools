import { ResourceLimits, ContainerStatus } from "../types";

export interface ContainerConfig {
  name: string;
  image: string;
  command?: string[];
  entrypoint?: string[];
  workingDir?: string;
  env?: Record<string, string>;
  mounts?: any[];
  volumes?: any[];
  networkMode?: "bridge" | "host" | "none";
  resourceLimits?: ResourceLimits;
  autoRemove?: boolean;
  labels?: Record<string, string>;
  restartPolicy?: "no" | "on-failure" | "always";
  healthCheck?: any;
  logConfig?: any;
}

export type { ContainerStatus } from "../types";
