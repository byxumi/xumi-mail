"use client";

import { useEffect, useState } from "react";
import Header from "@/components/Header";
import { EmptyState, LoadingButton } from "@/components/ui";
import { useToast } from "@/components/Toast";
import { useAddressToken, useSettings } from "@/hooks/useSettings";
import { api, formatTime } from "@/lib/client";

export default function SendPage() {
  const { push } = useToast();
  const { settings } = useSettings();
  const { token } = useAddressToken();

  const [fromName, setFromName] = useState("");
  const [toMail, setToMail] = useState("");
  const [subject, setSubject] = useState("");
  const [content, setContent] = useState("");
  const [sending, setSending] = useState(false);
  const [sentList, setSentList] = useState<any[]>([]);
  const [address, setAddress] = useState("");

  useEffect(() => {
    if (!token) return;
    api
      .addressSettings()
      .then((s) => setAddress(s.address))
      .catch(() => {});
    void loadSent();
  }, [token]);

  const loadSent = async () => {
    try {
      const res = await api.sendbox({ limit: 20, offset: 0 });
      setSentList(res.results);
    } catch {
      // ignore
    }
  };

  const send = async () => {
    if (!toMail.trim() || !subject.trim() || !content.trim()) {
      push("error", "收件人、主题、内容均不能为空");
      return;
    }
    setSending(true);
    try {
      await api.sendMail({
        from_name: fromName || undefined,
        to_mail: toMail.trim(),
        subject: subject.trim(),
        content,
      });
      push("success", "发送成功");
      setToMail("");
      setSubject("");
      setContent("");
      await loadSent();
    } catch (e) {
      push("error", (e as Error).message);
    } finally {
      setSending(false);
    }
  };

  if (!token) {
    return (
      <div className="min-h-screen">
        <Header />
        <div className="mx-auto max-w-xl px-4 py-20 text-center text-slate-500">
          请先创建邮箱地址后再发件。
        </div>
      </div>
    );
  }

  if (settings && !settings.enableSendMail) {
    return (
      <div className="min-h-screen">
        <Header />
        <div className="mx-auto max-w-xl px-4 py-20 text-center text-slate-500">
          管理员未启用发件功能（需要配置 Resend / SMTP / SEND_MAIL）。
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <Header />
      <main className="mx-auto max-w-3xl px-4 py-6">
        <h1 className="text-xl font-bold text-slate-900">发送邮件</h1>
        <p className="mt-0.5 text-sm text-slate-500">
          发件地址：<span className="font-medium text-slate-700">{address}</span>
        </p>

        <div className="mt-5 space-y-4 rounded-2xl border border-slate-200 bg-white p-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm text-slate-600">发件人名称</label>
              <input
                value={fromName}
                onChange={(e) => setFromName(e.target.value)}
                placeholder="可选"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm text-slate-600">收件人 *</label>
              <input
                value={toMail}
                onChange={(e) => setToMail(e.target.value)}
                placeholder="someone@example.com"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-sm text-slate-600">主题 *</label>
            <input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm text-slate-600">内容 *</label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={8}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
          <LoadingButton
            loading={sending}
            onClick={send}
            className="w-full rounded-xl bg-blue-600 py-3 font-medium text-white hover:bg-blue-700"
          >
            发送
          </LoadingButton>
        </div>

        <div className="mt-8">
          <h2 className="mb-3 text-lg font-semibold text-slate-800">已发送</h2>
          {sentList.length === 0 ? (
            <EmptyState title="暂无已发送邮件" />
          ) : (
            <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white">
              {sentList.map((item) => {
                let body: any = {};
                try {
                  body = typeof item.raw === "string" ? JSON.parse(item.raw) : item.raw;
                } catch {
                  body = {};
                }
                return (
                  <li key={item.id} className="flex items-center justify-between px-4 py-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-slate-800">
                        发给 {body.to_mail || item.address}
                      </p>
                      <p className="truncate text-sm text-slate-500">{body.subject}</p>
                    </div>
                    <span className="shrink-0 text-xs text-slate-400">
                      {formatTime(item.created_at)}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </main>
    </div>
  );
}