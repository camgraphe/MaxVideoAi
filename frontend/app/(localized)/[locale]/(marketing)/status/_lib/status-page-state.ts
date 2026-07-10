export type ServiceNoticeSetting = {
  enabled: boolean;
  message: string;
};

export type StatusNoticeCopy = {
  activeLabel: string;
  clearLabel: string;
  clearBody: string;
};

export type StatusNoticeState = {
  isActive: boolean;
  label: string;
  message: string;
};

export function buildStatusNoticeState(
  setting: ServiceNoticeSetting,
  copy: StatusNoticeCopy
): StatusNoticeState {
  const message = setting.message.trim();
  if (setting.enabled && message) {
    return { isActive: true, label: copy.activeLabel, message };
  }
  return { isActive: false, label: copy.clearLabel, message: copy.clearBody };
}
