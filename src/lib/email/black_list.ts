// 黑名单检测
import { addressParser } from "postal-mime";
import { Env } from "@/types";
import { CONSTANTS } from "../constants";

const parseSenderAddresses = (fromHeader: string | null): string[] => {
  try {
    const senderAddresses = addressParser(fromHeader || "", { flatten: true })
      .map((sender) => sender.address || "")
      .filter(Boolean);
    return senderAddresses;
  } catch (error) {
    console.error("Failed to parse sender addresses", error);
    return [];
  }
};

export const isBlocked = async (
  env: Env,
  from: string,
  headers: Headers
): Promise<boolean> => {
  const senders = [from, ...parseSenderAddresses(headers.get("From"))];
  if (
    env.BLACK_LIST &&
    env.BLACK_LIST.split(",").some((word) => senders.some((sender) => sender.includes(word)))
  ) {
    return true;
  }
  if (!env.KV) return false;
  const blockList =
    (await env.KV.get<string[]>(CONSTANTS.EMAIL_KV_BLACK_LIST, "json")) || [];
  if (blockList.some((word) => senders.some((sender) => sender.includes(word)))) {
    return true;
  }
  return false;
};