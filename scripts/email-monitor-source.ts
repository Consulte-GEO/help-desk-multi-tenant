/** Pinned candidate inputs; this is not a database qualification receipt. */
export const EMAIL_MONITOR_BASELINE_SHA256='019eca369064e0d69e238966eb89668c0ce0b21e67b02fa0eaee6a9ee88ca12a';
export const EMAIL_MONITOR_CONTRACT_SHA256='23c947256b86acd76f95d9567a592709dd56ab33fa7ebfae61974ac719c8fcf5';
export const EMAIL_MONITOR_COMPONENTS=[
  {
    "file": "hdn_email_monitor_telemetry.sql",
    "sha256": "4d74b26e4ec5afff4b4f629f448aa425ad955869f752d9857dc62adcf2badf8d"
  },
  {
    "file": "hdn_email_monitor_queries.sql",
    "sha256": "2b5564bbb01c0395e1b7ffd8b82beab097822cfa3ac56339f26c4b53dc7ed750"
  }
] as const;
