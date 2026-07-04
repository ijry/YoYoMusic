export interface AppErrorPayload {
  code: string;
  message: string;
}

const errorPrefix: Record<string, string> = {
  file_missing: "文件丢失",
  unplayable: "音频文件不可播放",
  metadata_read_failed: "标签读取失败",
  metadata_write_failed: "标签写回失败",
  invalid_skin_package: "皮肤包无效",
  shortcut_conflict: "快捷键冲突",
  storage_failed: "存储失败",
};

export function mapAppError(error: AppErrorPayload) {
  const prefix = errorPrefix[error.code] ?? "应用错误";
  return `${prefix}：${error.message}`;
}
