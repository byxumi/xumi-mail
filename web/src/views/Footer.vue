<script setup>
import { useScopedI18n } from '@/i18n/app'
import { useGlobalState } from '../store'
import DOMPurify from 'dompurify'
const { openSettings } = useGlobalState()


const { t } = useScopedI18n('views.Footer')

</script>

<template>
    <div>
        <div class="footer-hairline" />
        <div class="footer-body">
            <span class="xumi-mono footer-text">
                {{ t('copyright') }} © 2023-{{ new Date().getFullYear() }}
            </span>
            <span class="xumi-mono footer-sep">/</span>
            <span class="xumi-mono footer-text" v-html="DOMPurify.sanitize(openSettings.copyright)"></span>
        </div>
    </div>
</template>


<style scoped>
.footer-hairline {
    height: 1px;
    margin: 0;
    background: linear-gradient(90deg, transparent, var(--xumi-border), transparent);
}

.footer-body {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 10px;
    padding: 20px;
    text-align: center;
}

.footer-text {
    font-size: 11px;
    letter-spacing: 0.08em;
    color: var(--xumi-muted);
}

.footer-sep {
    font-size: 10px;
    color: var(--xumi-accent);
    opacity: 0.6;
}
</style>
