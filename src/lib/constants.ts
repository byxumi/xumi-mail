export const VERSION = "v1.0.0";

export const CONSTANTS = {
  // DB settings
  ADDRESS_BLOCK_LIST_KEY: "address_block_list",
  SEND_BLOCK_LIST_KEY: "send_block_list",
  AUTO_CLEANUP_KEY: "auto_cleanup",
  USER_SETTINGS_KEY: "user_settings",
  ADDRESS_CREATION_SETTINGS_KEY: "address_creation_settings",
  VERIFIED_ADDRESS_LIST_KEY: "verified_address_list",
  NO_LIMIT_SEND_ADDRESS_LIST_KEY: "no_limit_send_address_list",
  EMAIL_RULE_SETTINGS_KEY: "email_rule_settings",
  AI_EXTRACT_SETTINGS_KEY: "ai_extract_settings",
  WEBHOOK_KV_SETTINGS_KEY: "temp-mail-webhook-settings",
  WEBHOOK_KV_USER_SETTINGS_KEY: "temp-mail-webhook-user-settings",
  WEBHOOK_KV_ADMIN_MAIL_SETTINGS_KEY: "temp-mail-webhook-admin-mail-settings",
  EMAIL_KV_BLACK_LIST: "temp-mail-email-black-list",
  SEND_MAIL_LIMIT_COUNT_KEY_PREFIX: "send_mail_limit_count:",
  SEND_MAIL_LIMIT_CONFIG_KEY: "send_mail_limit_config",
} as const;