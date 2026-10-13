// Read defaults through the real launcher, including platform-specific flags.
// Neither constructor launches Chrome. Subtract flags present without defaults
// so environment headless flags, profile/port arguments and the start URL remain
// owned by the launcher rather than duplicated in our explicit flag list.
module.exports = function lighthouseChromeDefaults(Launcher) {
  const options = { userDataDir: false };
  const withoutDefaults = new Set(new Launcher({ ...options, ignoreDefaultFlags: true }).flags);
  return new Launcher(options).flags.filter(flag => !withoutDefaults.has(flag));
};
