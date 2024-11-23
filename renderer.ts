import { App } from "obsidian";
import { GitModal } from "./git-modal";

export function openGitDiffViewer(app: App) {
  new GitModal(app).open();
}
