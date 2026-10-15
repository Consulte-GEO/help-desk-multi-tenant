/** Pinned candidate inputs; this is not a database qualification receipt. */
export const EMAIL_MONITOR_BASELINE_SHA256='019eca369064e0d69e238966eb89668c0ce0b21e67b02fa0eaee6a9ee88ca12a';
export const EMAIL_MONITOR_CONTRACT_SHA256='3ef2776cb17ed40c6bb81ac30b659ccd7cddb34cd6e2381577aa520e0d79127f';
export const EMAIL_MONITOR_COMPONENTS=[
  {
    "file": "hdn_email_monitor_telemetry.sql",
    "sha256": "4d74b26e4ec5afff4b4f629f448aa425ad955869f752d9857dc62adcf2badf8d"
  },
  {
    "file": "hdn_email_monitor_queries.sql",
    "sha256": "ff529122f9eb2e0db7f4345dc44e87b5d4f4aafe14294b8537601bcfe9615143"
  }
] as const;
