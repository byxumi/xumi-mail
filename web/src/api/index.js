import { useGlobalState } from '../store'
import { h } from 'vue'
import axios from 'axios'

import i18n from '../i18n'
import { getFingerprint } from '../utils/fingerprint'
import { safeBearerHeader, safeHeaderValue } from '../utils/headers'
import { sanitizeHtml } from '../utils/sanitize-html'
import { APP_CONFIG } from '../config'
import { createUserAccessTokenInterceptor } from './user-access-token-interceptor'
import { ErrorCode } from './error-codes'

const API_BASE = APP_CONFIG.API_BASE || "";
const {
    loading, auth, jwt, settings, openSettings,
    userOpenSettings, userSettings, announcement,
    showAuth, adminAuth, showAdminAuth, userJwt
} = useGlobalState();

/**
 * 路径归一化：上游前端端点 -> 本仓库（xumi-mail）后端路由
 * 本仓库后端从上游移植，路径以 /api/** 为前缀（我们的 /api/settings 是公开设置，
 * 地址私有设置是 /api/address/settings），这里做最小适配。
 */
const normalizePath = (path, method = 'GET') => {
    // 地址私有设置：上游 getSettings 调 /api/settings 期望 {address, auto_reply, send_balance}
    if (path === '/api/settings') return '/api/address/settings';
    // 邮件详情（上游 /api/mails/:id 的 GET 走 /api/mail/:id，两者一致无需改）
    // 已读状态：上游 PATCH /api/mails/:id/read -> 本仓库 PATCH /api/mail/:id
    const readMatch = path.match(/^\/api\/mails\/(\d+)\/read$/);
    if (readMatch && method === 'PATCH') return `/api/mail/${readMatch[1]}`;
    // 删除邮件：上游 DELETE /api/mails/:id -> 本仓库 DELETE /api/mail/:id
    const delMatch = path.match(/^\/api\/mails\/(\d+)$/);
    if (delMatch && method === 'DELETE') return `/api/mail/${delMatch[1]}`;
    // 删除发送邮件：上游 DELETE /api/sendbox/:id -> 本仓库 DELETE /api/sendbox?id=
    const sendDelMatch = path.match(/^\/api\/sendbox\/(\d+)$/);
    if (sendDelMatch && method === 'DELETE') return `/api/sendbox?id=${sendDelMatch[1]}`;
    // 删除地址（上游 /api/delete_address -> 本仓库 DELETE /api/address）
    if (path === '/api/delete_address') return '/api/address';
    // 管理兑换码列表/创建：上游 /admin/redeem_codes\[...\] (GET/POST) -> /api/admin/redeem
    if (path.startsWith('/api/admin/redeem_codes')) {
        const rest = path.slice('/api/admin/redeem_codes'.length);
        // POST /batch -> /api/admin/redeem；GET ?redeem_type=... -> /api/admin/redeem?redeem_type=...
        if (rest === '/batch') return '/api/admin/redeem';
        const listMatch = rest.match(/^\?(.*)$/);
        if (listMatch) return `/api/admin/redeem?${listMatch[1]}`;
        const idMatch = rest.match(/^\/(\d+)$/);
        if (idMatch) return `/api/admin/redeem?id=${idMatch[1]}`;
        const exportMatch = rest.match(/^\/export\?(.*)$/);
        if (exportMatch) return `/api/admin/redeem/export?${exportMatch[1]}`;
        return '/api/admin/redeem';
    }
    // 管理用户角色/worker 配置：现已提供真实路由，直通
    // (用户角色 /api/admin/user_roles、worker 配置 /api/admin/worker/configs)
    // 管理-发送箱/清理类（我们将它们映射到对应简单端点，页面侧会降级提示）
    if (/^\/api\/admin\/sendbox\?/.test(path)) return path;
    if (/^\/api\/admin\/clear_inbox\/[^/]+$/.test(path)) return path;
    if (/^\/api\/admin\/clear_sent_items\/[^/]+$/.test(path)) return path;
    return path;
};

const instance = axios.create({
    baseURL: API_BASE,
    timeout: 30000,
    validateStatus: (status) => status >= 200 && status <= 500
});

const responseInterceptors = [createUserAccessTokenInterceptor(instance)];

const interceptResponse = async (path, response) => {
    for (const { matches, handle } of responseInterceptors) {
        if (matches(path, response)) return await handle(response);
    }
    return response;
};

const apiFetch = async (path, options = {}) => {
    const showLoading = options.showLoading !== false;
    if (showLoading) loading.value = true;
    try {
        const method = options.method || 'GET';
        const normalizedPath = normalizePath(path, method);
        // Get browser fingerprint for request tracking
        const fingerprint = await getFingerprint();

        // Skip auth headers whose value is empty / "undefined" / contains
        // control chars (otherwise axios throws "Invalid character in header
        // content" before the request is sent — see issue #1000).
        const headers = {
            'x-lang': i18n.global.locale.value,
            'x-fingerprint': fingerprint,
            'Content-Type': 'application/json',
        };
        const userTokenHeader = safeHeaderValue(options.userJwt || userJwt.value);
        if (userTokenHeader) headers['x-user-token'] = userTokenHeader;
        const userAccessHeader = safeHeaderValue(userSettings.value.access_token);
        if (userAccessHeader) headers['x-user-access-token'] = userAccessHeader;
        const customAuthHeader = safeHeaderValue(auth.value);
        if (customAuthHeader) headers['x-custom-auth'] = customAuthHeader;
        const adminAuthHeader = safeHeaderValue(adminAuth.value);
        if (adminAuthHeader) headers['x-admin-auth'] = adminAuthHeader;
        const authorizationHeader = safeBearerHeader(jwt.value);
        if (authorizationHeader) headers['Authorization'] = authorizationHeader;

        const initialResponse = await instance.request(normalizedPath, {
            method,
            data: options.body || null,
            headers,
        });
        const response = await interceptResponse(path, initialResponse);
        if (ErrorCode.isAdminAuthError(response)) {
            showAdminAuth.value = true;
        }
        if (ErrorCode.isSiteAuthError(response)) {
            showAuth.value = true;
        }
        if (response.status >= 300) {
            throw new Error(`[${response.status}]: ${response.data?.message || response.data}`);
        }
        const data = response.data;
        return data;
    } catch (error) {
        if (error.response) {
            throw new Error(`Code ${error.response.status}: ${error.response.data?.message || error.response.data}`);
        }
        throw error;
    } finally {
        if (showLoading) loading.value = false;
    }
}

const getOpenSettings = async (message, notification) => {
    try {
        const res = await api.fetch("/open_api/settings");
        const domains = Array.isArray(res["domains"]) ? res["domains"] : [];
        const domainLabels = res["domainLabels"] || [];
        if (domains.length < 1) {
            message.error("No domains found, please check your worker settings");
        }
        Object.assign(openSettings.value, {
            ...res,
            title: res["title"] || "",
            prefix: res["prefix"] || "",
            minAddressLen: res["minAddressLen"] || 1,
            maxAddressLen: res["maxAddressLen"] || 30,
            needAuth: res["needAuth"] || false,
            defaultDomains: res["defaultDomains"] || [],
            randomSubdomainDomains: res["randomSubdomainDomains"] || [],
            domains: domains.map((domain, index) => {
                return {
                    label: domainLabels.length > index ? domainLabels[index] : domain,
                    value: domain
                }
            }),
            adminContact: res["adminContact"] || "",
            enableUserCreateEmail: res["enableUserCreateEmail"] || false,
            disableAnonymousUserCreateEmail: res["disableAnonymousUserCreateEmail"] || false,
            disableCustomAddressName: res["disableCustomAddressName"] || false,
            enableUserDeleteEmail: res["enableUserDeleteEmail"] || false,
            enableMailReadStatus: res["enableMailReadStatus"] === true,
            enableAutoReply: res["enableAutoReply"] || false,
            enableIndexAbout: res["enableIndexAbout"] || false,
            copyright: res["copyright"] || openSettings.value.copyright,
            cfTurnstileSiteKey: res["cfTurnstileSiteKey"] || "",
            enableWebhook: res["enableWebhook"] || false,
            isS3Enabled: res["isS3Enabled"] || false,
            showGithubForUser: res["showGithubForUser"] ?? openSettings.value.showGithubForUser,
            enableAddressPassword: res["enableAddressPassword"] || false,
            enableAgentEmailInfo: res["enableAgentEmailInfo"] || false,
            enableRedeemCode: res["enableRedeemCode"] || false,
            redeemCodeUrl: res["redeemCodeUrl"] || "",
            smtpImapProxyConfig: res["smtpImapProxyConfig"] || openSettings.value.smtpImapProxyConfig,
            statusUrl: res["statusUrl"] || "",
            enableGlobalTurnstileCheck: res["enableGlobalTurnstileCheck"] || false,
        });
        if (openSettings.value.needAuth) {
            showAuth.value = true;
        }
        if (openSettings.value.announcement
            && !openSettings.value.fetched
            && (openSettings.value.announcement != announcement.value
                || openSettings.value.alwaysShowAnnouncement)
        ) {
            announcement.value = openSettings.value.announcement;
            notification.info({
                content: () => {
                    return h("div", {
                        innerHTML: sanitizeHtml(announcement.value)
                    });
                }
            });
        }
    } catch (error) {
        message.error(error.message || "error");
    } finally {
        openSettings.value.fetched = true;
    }
}

const getSettings = async () => {
    try {
        if (typeof jwt.value != 'string' || jwt.value.trim() === '' || jwt.value === 'undefined') {
            return "";
        }
        const res = await apiFetch("/api/settings");;
        settings.value = {
            address: res["address"],
            auto_reply: res["auto_reply"],
            send_balance: res["send_balance"],
        };
    } finally {
        settings.value.fetched = true;
    }
}


const getUserOpenSettings = async (message) => {
    try {
        const res = await api.fetch(`/user_api/open_settings`);
        Object.assign(userOpenSettings.value, res);
    } catch (error) {
        message.error(error.message || "fetch settings failed");
    } finally {
        userOpenSettings.value.fetched = true;
    }
}

const getUserSettings = async (message) => {
    try {
        if (!userJwt.value) return;
        const res = await api.fetch("/user_api/settings")
        Object.assign(userSettings.value, res)
        // auto refresh user jwt
        if (userSettings.value.new_user_token) {
            try {
                await api.fetch("/user_api/settings", {
                    userJwt: userSettings.value.new_user_token,
                })
                userJwt.value = userSettings.value.new_user_token;
                console.log("User JWT updated successfully");
            }
            catch (error) {
                console.error("Failed to update user JWT", error);
            }
        }
    } catch (error) {
        message?.error(error.message || "error");
    } finally {
        userSettings.value.fetched = true;
    }
}

const adminShowAddressCredential = async (id) => {
    try {
        const { jwt: addressCredential } = await apiFetch(`/admin/show_password/${id}`);
        return addressCredential;
    } catch (error) {
        throw error;
    }
}

const adminDeleteAddress = async (id) => {
    try {
        await apiFetch(`/admin/delete_address/${id}`, {
            method: 'DELETE'
        });
    } catch (error) {
        throw error;
    }
}

const bindUserAddress = async () => {
    if (!userJwt.value) return;
    try {
        await apiFetch(`/user_api/bind_address`, {
            method: 'POST',
        });
    } catch (error) {
        throw error;
    }
}

export const api = {
    fetch: apiFetch,
    getSettings,
    getOpenSettings,
    getUserOpenSettings,
    getUserSettings,
    adminShowAddressCredential,
    adminDeleteAddress,
    bindUserAddress,
}
