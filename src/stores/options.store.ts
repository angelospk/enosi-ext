import { defineStore } from "pinia";
import { useTheme } from "../composables/useTheme";
import { useBrowserSyncStorage, useBrowserLocalStorage } from "../composables/useBrowserStorage";

export const useOptionsStore = defineStore("options", () => {
  const { isDark, toggleDark } = useTheme();

  const { data: profile } = useBrowserSyncStorage<{
    name: string;
    age: number;
  }>("profile", {
    name: "Mario",
    age: 24,
  });

  const { data: others } = useBrowserLocalStorage<{
    awesome: boolean;
    counter: number;
  }>("legacyOptions", {
    awesome: true,
    counter: 0,
  });

  // Dedicated storage for applicationId
  const { data: applicationId, promise: applicationIdPromise } = useBrowserLocalStorage<string>(
    "opekepeApplicationId",
    "ID_NOT_SET",
  );

  return {
    isDark,
    toggleDark,
    profile,
    others,
    applicationId,
    applicationIdPromise
  };
});
