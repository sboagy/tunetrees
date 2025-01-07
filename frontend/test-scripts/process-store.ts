import type { ChildProcess } from "node:child_process";

let fastapiProcess: ChildProcess | null = null;

export function setFastapiProcess(process: ChildProcess) {
  fastapiProcess = process;
}

export function getFastapiProcess(): ChildProcess | null {
  return fastapiProcess;
}
