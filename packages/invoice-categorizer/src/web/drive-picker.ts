/// <reference types="google.picker" />
/// <reference types="gapi" />

export interface Folder {
  id: string;
  name: string;
}
export interface PickerSession {
  accessToken: string;
  apiKey: string;
  appId: string;
}
let loading: Promise<void> | undefined;
function loadPicker(): Promise<void> {
  if (!loading)
    loading = new Promise<void>((resolve, reject) => {
      const load = () =>
        gapi.load("picker", {
          callback: resolve,
          onerror: () =>
            reject(
              new Error("Google folder picker could not load. Try again."),
            ),
          timeout: 15000,
          ontimeout: () =>
            reject(new Error("Google folder picker timed out. Try again.")),
        });
      if (typeof gapi !== "undefined") {
        load();
        return;
      }
      const script = document.createElement("script");
      script.src = "https://apis.google.com/js/api.js";
      script.async = true;
      const timer = setTimeout(() => {
        script.remove();
        reject(new Error("Google folder picker timed out. Try again."));
      }, 15000);
      script.onload = () => {
        clearTimeout(timer);
        load();
      };
      script.onerror = () => {
        clearTimeout(timer);
        script.remove();
        reject(
          new Error(
            "Google folder picker could not load. Check your connection and try again.",
          ),
        );
      };
      document.head.appendChild(script);
    }).catch((error: unknown) => {
      loading = undefined;
      throw error;
    });
  return loading;
}
export async function pickFolder(
  session: PickerSession,
): Promise<Folder | null> {
  await loadPicker();
  return new Promise((resolve) => {
    const folders = () =>
      new google.picker.DocsView(google.picker.ViewId.FOLDERS)
        .setIncludeFolders(true)
        .setSelectFolderEnabled(true);
    const mine = folders().setOwnedByMe(true);
    mine.setLabel("My folders");
    const shared = folders().setOwnedByMe(false);
    shared.setLabel("Shared with me");
    const drives = folders().setEnableDrives(true);
    drives.setLabel("Shared drives");
    const picker = new google.picker.PickerBuilder()
      .setTitle("Choose invoice folder")
      .setOrigin(window.location.origin)
      .setAppId(session.appId)
      .setDeveloperKey(session.apiKey)
      .setOAuthToken(session.accessToken)
      .enableFeature(google.picker.Feature.SUPPORT_DRIVES)
      .addView(mine)
      .addView(shared)
      .addView(drives)
      .setCallback((data) => {
        if (data.action === google.picker.Action.CANCEL) {
          picker.dispose();
          resolve(null);
        }
        if (data.action === google.picker.Action.PICKED) {
          const folder = data.docs?.[0];
          picker.dispose();
          resolve(
            folder
              ? { id: folder.id, name: folder.name ?? "Selected folder" }
              : null,
          );
        }
      })
      .build();
    picker.setVisible(true);
  });
}
