<script setup>
import { onMounted, ref } from 'vue'
import { useScopedI18n } from '@/i18n/app'
import { useRouter } from 'vue-router'
import { User, ExchangeAlt } from '@vicons/fa'

import { useGlobalState } from '../../store'
import { api } from '../../api'
import Login from '../common/Login.vue'
import TelegramAddress from './TelegramAddress.vue'
import LocalAddress from './LocalAddress.vue'
import AddressManagement from '../user/AddressManagement.vue'
import { getRouterPathWithLang } from '../../utils'
import AddressSelect from '../../components/AddressSelect.vue'
import AddressCredentialModal from '../../components/AddressCredentialModal.vue'

const router = useRouter()

const {
    jwt, settings, showAddressCredential, userJwt,
    isTelegram, addressPassword
} = useGlobalState()

const { locale, t } = useScopedI18n('views.index.AddressBar')

const showAddressManage = ref(false)

const onUserLogin = async () => {
    await router.push(getRouterPathWithLang("/user", locale.value))
}

onMounted(async () => {
    await api.getSettings();
});
</script>

<template>
    <div>
        <!-- loading skeleton -->
        <n-card :bordered="false" embedded v-if="!settings.fetched">
            <n-skeleton style="height: 50vh" />
        </n-card>

        <div v-else class="xumi-hero">
            <!-- top: kicker + status -->
            <div class="xumi-hero__top">
                <span class="xumi-hero__kicker xumi-mono">{{ t('station') }}</span>
                <span class="xumi-hero__status">
                    <span class="xumi-hero__status-dot"></span>
                    <span class="xumi-mono">{{ t('open') }}</span>
                </span>
            </div>

            <!-- heading: 4 text elements max -->
            <h1 class="xumi-hero__title">{{ t('tagline') }}</h1>
            <p class="xumi-hero__sub">{{ t('sub') }}</p>

            <!-- functional panel -->
            <div class="xumi-hero__panel">
                <div v-if="settings.address">
                    <AddressSelect>
                        <template #actions>
                            <n-button class="address-manage" size="small" tertiary type="primary"
                                @click="showAddressManage = true">
                                <n-icon :component="ExchangeAlt" />
                                {{ t('addressManage') }}
                            </n-button>
                        </template>
                    </AddressSelect>
                </div>
                <div v-else-if="isTelegram">
                    <TelegramAddress />
                </div>
                <div v-else-if="userJwt">
                    <AddressManagement />
                </div>
                <div v-else>
                    <n-alert v-if="jwt" type="warning" :show-icon="false" :bordered="false" closable>
                        <span>{{ t('fetchAddressError') }}</span>
                    </n-alert>
                    <Login />
                    <n-divider />
                    <n-button @click="onUserLogin" type="primary" block secondary strong>
                        <template #icon>
                            <n-icon :component="User" />
                        </template>
                        {{ t('userCenter') }}
                    </n-button>
                </div>
            </div>

            <p class="xumi-hero__foot xumi-mono">{{ t('foot') }}</p>
        </div>

        <AddressCredentialModal v-model:show="showAddressCredential" :address="settings.address" :jwt="jwt"
            :address-password="addressPassword" />
        <n-modal v-model:show="showAddressManage" preset="card" :title="t('addressManage')"
            style="width: 720px;">
            <TelegramAddress v-if="isTelegram" />
            <AddressManagement v-else-if="userJwt" />
            <LocalAddress v-else />
        </n-modal>
    </div>
</template>

<style scoped>
.xumi-hero {
    display: flex;
    flex-direction: column;
    align-items: center;
    width: 100%;
    max-width: 760px;
    margin: 0 auto;
    padding: clamp(28px, 7vh, 72px) 18px 72px;
}

.xumi-hero__top {
    display: flex;
    align-items: center;
    justify-content: space-between;
    width: 100%;
    max-width: 560px;
    margin-bottom: 26px;
}

.xumi-hero__kicker {
    font-size: 11px;
    font-weight: 500;
    letter-spacing: 0.22em;
    color: var(--xumi-accent);
}

.xumi-hero__status {
    display: inline-flex;
    align-items: center;
    gap: 7px;
    padding: 4px 10px;
    border: 1px solid var(--xumi-border);
    border-radius: 999px;
    background: var(--xumi-surface-2);
    font-size: 10px;
    letter-spacing: 0.14em;
    color: var(--xumi-muted);
}

.xumi-hero__status-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: var(--xumi-accent);
    box-shadow: 0 0 8px var(--xumi-accent);
    animation: xumi-blink 2.8s ease-in-out infinite;
}

.xumi-hero__title {
    margin: 0;
    font-size: clamp(26px, 5vw, 40px);
    font-weight: 700;
    letter-spacing: -0.02em;
    line-height: 1.15;
    text-align: center;
    color: var(--xumi-text);
}

.xumi-hero__sub {
    margin: 14px 0 34px;
    max-width: 34em;
    font-size: 15px;
    line-height: 1.7;
    text-align: center;
    color: var(--xumi-muted);
}

.xumi-hero__panel {
    width: 100%;
    max-width: 560px;
    padding: 28px 28px 30px;
    border: 1px solid var(--xumi-border);
    border-radius: 18px;
    background: var(--xumi-surface);
    box-shadow: 0 20px 60px -30px rgba(0, 0, 0, 0.45),
        inset 0 1px 0 rgba(255, 255, 255, 0.03);
}

html:not(.dark) .xumi-hero__panel {
    box-shadow: 0 18px 50px -34px rgba(23, 47, 38, 0.35);
}

.xumi-hero__foot {
    margin: 22px 0 0;
    font-size: 10px;
    letter-spacing: 0.18em;
    text-align: center;
    color: var(--xumi-muted);
    opacity: 0.75;
}

.address-manage {
    flex: 0 0 auto;
    white-space: nowrap;
}

@keyframes xumi-blink {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.35; }
}

@media (prefers-reduced-motion: reduce) {
    .xumi-hero__status-dot {
        animation: none;
    }
}
</style>