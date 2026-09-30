import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "我的邮箱 | 临时邮箱",
};

export default function MailLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}