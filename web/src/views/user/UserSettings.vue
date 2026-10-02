<script setup>
import { ref } from 'vue'
import { useScopedI18n } from '@/i18n/app'

import { useGlobalState } from '../../store'

const { userJwt, userSettings } = useGlobalState()

const showLogout = ref(false)

const { t } = useScopedI18n('views.user.UserSettings')


const logout = async () => {
    userJwt.value = '';
    location.reload()
}
</script>

<template>
    <div class="center" v-if="userSettings.user_email">
        <n-card :bordered="false" embedded>
            <n-alert :show-icon="false" :bordered="false">
                <span>
                    {{ t('passordTip') }}
                </span>
            </n-alert>
            <n-button @click="showLogout = true" secondary block strong>
                {{ t('logout') }}
            </n-button>
        </n-card>
        <n-modal v-model:show="showLogout" preset="dialog" :title="t('logout')">
            <p>{{ t('logoutConfirm') }}</p>
            <template #action>
                <n-button :loading="loading" @click="logout" size="small" tertiary type="warning">
                    {{ t('logout') }}
                </n-button>
            </template>
        </n-modal>
    </div>
</template>

<style scoped>
.center {
    display: flex;
    justify-content: center;
}


.n-card {
    max-width: 800px;
    text-align: left;
}

.n-button {
    margin-top: 10px;
    margin-bottom: 10px;
}
</style>
