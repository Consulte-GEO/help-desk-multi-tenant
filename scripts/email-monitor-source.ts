/** Pinned candidate inputs; this is not a database qualification receipt. */
export const EMAIL_MONITOR_BASELINE_SHA256='019eca369064e0d69e238966eb89668c0ce0b21e67b02fa0eaee6a9ee88ca12a';
export const EMAIL_MONITOR_CONTRACT_SHA256='3ef2776cb17ed40c6bb81ac30b659ccd7cddb34cd6e2381577aa520e0d79127f';
export const EMAIL_MONITOR_COMPONENTS=[
  {
    "file": "hdn_email_monitor_telemetry.sql",
    "sha256": "a4336f508d461dad678f573899b966ee6b003cbc4bd407b0c2c884fd941c3d6f"
  },
  {
    "file": "hdn_email_monitor_queries.sql",
    "sha256": "e640ffc54a2c51ef7d99a5750a63e853fca086a4299ac8e34adfb52f78b1fc1f"
  }
] as const;
