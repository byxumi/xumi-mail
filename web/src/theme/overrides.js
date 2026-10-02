/**
 * Xumi Mail - Naive UI theme overrides
 * "Night Signal Station" design system.
 * Dark-first; light mode mirrors the same family so both feel owned.
 */
const SANS = `'Space Grotesk', 'PingFang SC', 'HarmonyOS Sans SC', 'Microsoft YaHei', system-ui, -apple-system, sans-serif`
const MONO = `'JetBrains Mono', ui-monospace, 'SF Mono', Menlo, Consolas, monospace`

const baseOverrides = {
  common: {
    fontFamily: SANS,
    fontFamilyMono: MONO,
    fontWeightStrong: '600',
    cubicBezierEaseInOut: 'cubic-bezier(0.4, 0, 0.2, 1)',
    cubicBezierEaseOut: 'cubic-bezier(0.2, 0.7, 0.3, 1)',
    cubicBezierEaseIn: 'cubic-bezier(0.4, 0, 1, 1)',
    borderRadius: '6px',
    borderRadiusSmall: '4px',
    borderRadiusMedium: '6px',
    borderRadiusLarge: '10px',
  },
  Button: {
    fontWeight: '500',
    borderRadiusMedium: '6px',
    textColorHover: 'rgba(255, 255, 255, 0.92)',
    textColorPressed: 'rgba(255, 255, 255, 0.8)',
  },
  Input: {
    borderRadius: '6px',
    border: '1px solid rgba(128, 128, 128, 0.28)',
    borderHover: '1px solid rgba(128, 128, 128, 0.45)',
    borderFocus: '1px solid rgba(128, 128, 128, 0.45)',
  },
  Card: {
    borderRadius: '12px',
  },
  Tabs: {
    tabFontWeight: '500',
  },
  Tag: {
    borderRadius: '4px',
    fontWeight: '500',
  },
  Pagination: {
    itemBorderRadius: '4px',
  },
}

/** Dark mode - the primary face of the product */
export const darkOverrides = {
  ...baseOverrides,
  common: {
    ...baseOverrides.common,
    primaryColor: '#00e08a',
    primaryColorHover: '#28f0a1',
    primaryColorPressed: '#00c47a',
    primaryColorSuppl: '#00e08a',
    successColor: '#00e08a',
    infoColor: '#7dd3c0',
    warningColor: '#f6c453',
    errorColor: '#ff7a90',
    bodyColor: '#0b0f0d',
    cardColor: '#121816',
    modalColor: '#141a17',
    popoverColor: '#161d19',
    tableColor: '#121816',
    tableColorStriped: '#151c18',
    tableHeaderColor: '#161d19',
    actionColor: '#10150f',
    textColorBase: '#e6f1eb',
    textColor1: '#e6f1eb',
    textColor2: '#c6d4cb',
    textColor3: '#78887f',
    textColorDisabled: '#3e4a43',
    placeholderColor: '#55635c',
    placeholderColorDisabled: '#3a453f',
    borderColor: 'rgba(165, 192, 177, 0.16)',
    dividerColor: 'rgba(165, 192, 177, 0.14)',
    hoverColor: 'rgba(0, 224, 138, 0.08)',
    pressedColor: 'rgba(0, 224, 138, 0.14)',
    popoverColor: '#161d19',
    borderRadius: '6px',
    fontSize: '14px',
  },
  Button: {
    ...baseOverrides.Button,
    colorPrimary: '#00b87c',
    colorHoverPrimary: '#00d68f',
    colorPressedPrimary: '#00a06c',
    textColorPrimary: '#04120c',
  },
  Input: {
    ...baseOverrides.Input,
    color: '#10150f',
    colorFocus: '#10150f',
    colorHover: '#10150f',
    textColor: '#e6f1eb',
  },
  InternalSelection: {
    color: '#10150f',
  },
  Card: {
    ...baseOverrides.Card,
    color: '#121816',
    borderColor: 'rgba(165, 192, 177, 0.14)',
  },
  Tabs: {
    ...baseOverrides.Tabs,
    barColor: '#00e08a',
    tabTextColorActive: '#e6f1eb',
    tabTextColor: '#78887f',
    tabTextColorHover: '#c6d4cb',
    tabBorderColor: 'rgba(165, 192, 177, 0.14)',
    tabColor: 'rgba(165, 192, 177, 0.05)',
    tabColorActive: '#121816',
  },
  Divider: {
    color: 'rgba(165, 192, 177, 0.14)',
  },
  List: {
    color: '#0b0f0d',
  },
  Tag: {
    ...baseOverrides.Tag,
    colorInfo: 'rgba(0, 224, 138, 0.10)',
    textColorInfo: '#7dd3c0',
    borderInfo: 'rgba(0, 224, 138, 0.28)',
  },
  Menu: {
    itemTextColor: '#78887f',
    itemTextColorHover: '#e6f1eb',
    itemTextColorActive: '#00e08a',
    itemTextColorActiveHover: '#00e08a',
    itemColorActive: 'rgba(0, 224, 138, 0.12)',
    itemColorActiveHover: 'rgba(0, 224, 138, 0.12)',
  },
  Drawer: {
    color: '#10150f',
  },
  Popover: {
    color: '#161d19',
  },
  Dialog: {
    color: '#141a17',
  },
  Notification: {
    color: '#141a17',
  },
  Message: {
    color: '#141a17',
  },
  DataTable: {
    thColor: '#161d19',
    thTextColor: '#c6d4cb',
    tdColor: '#121816',
    tdColorHover: 'rgba(0, 224, 138, 0.05)',
    tdColorStriped: '#151c18',
    borderColor: 'rgba(165, 192, 177, 0.12)',
  },
  DatePicker: {
    panelColor: '#161d19',
  },
  NColorPicker: {
    panelColor: '#161d19',
  },
  Scrollbar: {
    color: 'rgba(165, 192, 177, 0.3)',
  },
  Switch: {
    railColorActive: '#00e08a',
    railColorActiveHover: '#28f0a1',
    buttonColor: '#04120c',
  },
  Slider: {
    fillColor: '#00e08a',
    fillColorHover: '#28f0a1',
    railColor: 'rgba(165, 192, 177, 0.2)',
  },
  Checkbox: {
    checkMarkColor: '#04120c',
    colorChecked: '#00e08a',
    colorCheckedHover: '#28f0a1',
  },
  Radio: {
    colorChecked: '#00e08a',
    colorCheckedHover: '#28f0a1',
  },
  Progress: {
    railColor: 'rgba(165, 192, 177, 0.18)',
  },
  Avatar: {
    borderRadius: '8px',
  },
  PageHeader: {
    titleTextColor: '#e6f1eb',
    subtitleTextColor: '#78887f',
  },
  Empty: {
    iconColor: '#3e4a43',
    extraTextColor: '#78887f',
  },
}

/** Light mode - same family, daylit */
export const lightOverrides = {
  ...baseOverrides,
  common: {
    ...baseOverrides.common,
    primaryColor: '#00a876',
    primaryColorHover: '#00c08b',
    primaryColorPressed: '#008e63',
    primaryColorSuppl: '#00a876',
    successColor: '#00a876',
    infoColor: '#2f7a63',
    warningColor: '#c4901e',
    errorColor: '#d6455d',
    bodyColor: '#f5f7f6',
    cardColor: '#ffffff',
    modalColor: '#ffffff',
    popoverColor: '#ffffff',
    tableColor: '#ffffff',
    tableColorStriped: '#f5f8f6',
    tableHeaderColor: '#f0f4f2',
    actionColor: '#f0f4f2',
    textColorBase: '#16211c',
    textColor1: '#16211c',
    textColor2: '#42524a',
    textColor3: '#7a877f',
    textColorDisabled: '#aab5ae',
    placeholderColor: '#9aa69f',
    borderColor: 'rgba(23, 47, 38, 0.13)',
    dividerColor: 'rgba(23, 47, 38, 0.12)',
    hoverColor: 'rgba(0, 168, 118, 0.08)',
    pressedColor: 'rgba(0, 168, 118, 0.14)',
    borderRadius: '6px',
    fontSize: '14px',
  },
  Button: {
    ...baseOverrides.Button,
    colorPrimary: '#00a876',
    colorHoverPrimary: '#00b880',
    colorPressedPrimary: '#008e63',
    textColorPrimary: '#ffffff',
  },
  Input: {
    ...baseOverrides.Input,
    color: '#ffffff',
    colorFocus: '#ffffff',
    colorHover: '#ffffff',
    textColor: '#16211c',
  },
  InternalSelection: {
    color: '#ffffff',
  },
  Card: {
    ...baseOverrides.Card,
    color: '#ffffff',
    borderColor: 'rgba(23, 47, 38, 0.13)',
  },
  Tabs: {
    ...baseOverrides.Tabs,
    barColor: '#00a876',
    tabTextColorActive: '#16211c',
    tabTextColor: '#7a877f',
    tabTextColorHover: '#42524a',
    tabBorderColor: 'rgba(23, 47, 38, 0.13)',
    tabColor: 'rgba(23, 47, 38, 0.05)',
    tabColorActive: '#ffffff',
  },
  Divider: {
    color: 'rgba(23, 47, 38, 0.12)',
  },
  List: {
    color: '#f5f7f6',
  },
  Tag: {
    ...baseOverrides.Tag,
    colorInfo: 'rgba(0, 168, 118, 0.10)',
    textColorInfo: '#2f7a63',
    borderInfo: 'rgba(0, 168, 118, 0.28)',
  },
  Menu: {
    itemTextColor: '#7a877f',
    itemTextColorHover: '#16211c',
    itemTextColorActive: '#00a876',
    itemTextColorActiveHover: '#00a876',
    itemColorActive: 'rgba(0, 168, 118, 0.12)',
    itemColorActiveHover: 'rgba(0, 168, 118, 0.12)',
  },
  Drawer: {
    color: '#ffffff',
  },
  Popover: {
    color: '#ffffff',
  },
  Dialog: {
    color: '#ffffff',
  },
  Notification: {
    color: '#ffffff',
  },
  Message: {
    color: '#ffffff',
  },
  DataTable: {
    thColor: '#f0f4f2',
    thTextColor: '#42524a',
    tdColor: '#ffffff',
    tdColorHover: 'rgba(0, 168, 118, 0.05)',
    tdColorStriped: '#f5f8f6',
    borderColor: 'rgba(23, 47, 38, 0.12)',
  },
  Switch: {
    railColorActive: '#00a876',
    railColorActiveHover: '#00b880',
    buttonColor: '#ffffff',
  },
  Slider: {
    fillColor: '#00a876',
    fillColorHover: '#00b880',
    railColor: 'rgba(23, 47, 38, 0.2)',
  },
  Checkbox: {
    checkMarkColor: '#ffffff',
    colorChecked: '#00a876',
    colorCheckedHover: '#00b880',
  },
  Radio: {
    colorChecked: '#00a876',
    colorCheckedHover: '#00b880',
  },
  Avatar: {
    borderRadius: '8px',
  },
  PageHeader: {
    titleTextColor: '#16211c',
    subtitleTextColor: '#7a877f',
  },
}
