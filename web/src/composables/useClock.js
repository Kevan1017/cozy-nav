/**
 * 时钟 + 时段问候 + 农历
 * 每秒更新时间，按时段切换问候语和 emoji，支持农历日期显示
 */
import { ref, onMounted, onUnmounted, computed } from 'vue';

/** 农历数据表：1900-2100 */
const LUNAR_INFO = [
  0x04bd8, 0x04ae0, 0x0a570, 0x054d5, 0x0d260, 0x0d950, 0x16554, 0x056a0, 0x09ad0, 0x055d2,
  0x04ae0, 0x0a5b6, 0x0a4d0, 0x0d250, 0x1d255, 0x0b540, 0x0d6a0, 0x0ada2, 0x095b0, 0x14977,
  0x04970, 0x0a4b0, 0x0b4b5, 0x06a50, 0x06d40, 0x1ab54, 0x02b60, 0x09570, 0x052f2, 0x04970,
  0x06566, 0x0d4a0, 0x0ea50, 0x06e95, 0x05ad0, 0x02b60, 0x186e3, 0x092e0, 0x1c8d7, 0x0c950,
  0x0d4a0, 0x1d8a6, 0x0b550, 0x056a0, 0x1a5b4, 0x025d0, 0x092d0, 0x0d2b2, 0x0a950, 0x0b557,
  0x06ca0, 0x0b550, 0x15355, 0x04da0, 0x0a5b0, 0x14573, 0x052b0, 0x0a9a8, 0x0e950, 0x06aa0,
  0x0aea6, 0x0ab50, 0x04b60, 0x0aae4, 0x0a570, 0x05260, 0x0f263, 0x0d950, 0x05b57, 0x056a0,
  0x096d0, 0x04dd5, 0x04ad0, 0x0a4d0, 0x0d4d4, 0x0d250, 0x0d558, 0x0b540, 0x0b6a0, 0x195a6,
  0x095b0, 0x049b0, 0x0a974, 0x0a4b0, 0x0b27a, 0x06a50, 0x06d40, 0x0af46, 0x0ab60, 0x09570,
  0x04af5, 0x04970, 0x064b0, 0x074a3, 0x0ea50, 0x06b58, 0x055c0, 0x0ab60, 0x096d5, 0x092e0,
  0x0c960, 0x0d954, 0x0d4a0, 0x0da50, 0x07552, 0x056a0, 0x0abb7, 0x025d0, 0x092d0, 0x0cab5,
  0x0a950, 0x0b4a0, 0x0baa4, 0x0ad50, 0x055d9, 0x04ba0, 0x0a5b0, 0x15176, 0x052b0, 0x0a930,
  0x07954, 0x06aa0, 0x0ad50, 0x05b52, 0x04b60, 0x0a6e6, 0x0a4e0, 0x0d260, 0x0ea65, 0x0d530,
  0x05aa0, 0x076a3, 0x096d0, 0x04afb, 0x04ad0, 0x0a4d0, 0x1d0b6, 0x0d250, 0x0d520, 0x0dd45,
  0x0b5a0, 0x056d0, 0x055b2, 0x049b0, 0x0a577, 0x0a4b0, 0x0aa50, 0x1b255, 0x06d20, 0x0ada0,
  0x14b63, 0x09370, 0x049f8, 0x04970, 0x064b0, 0x168a6, 0x0ea50, 0x06b20, 0x1a6c4, 0x0aae0,
  0x0a2e0, 0x0d2e3, 0x0c960, 0x0d557, 0x0d4a0, 0x0da50, 0x05d55, 0x056a0, 0x0a6d0, 0x055d4,
  0x052d0, 0x0a9b8, 0x0a950, 0x0b4a0, 0x0b6a6, 0x0ad50, 0x055a0, 0x0aba4, 0x0a5b0, 0x052b0,
  0x0b273, 0x06930, 0x07337, 0x06aa0, 0x0ad50, 0x14b55, 0x04b60, 0x0a570, 0x054e4, 0x0d160,
  0x0e968, 0x0d520, 0x0daa0, 0x16aa6, 0x056d0, 0x04ae0, 0x0a9d4, 0x0a2d0, 0x0d150, 0x0f252,
  0x0d520,
];

/** 农历月份名 */
const LUNAR_MONTHS = ['正', '二', '三', '四', '五', '六', '七', '八', '九', '十', '冬', '腊'];

/** 农历日期名（初一用"初"） */
const LUNAR_DAYS = [
  '初一', '初二', '初三', '初四', '初五', '初六', '初七', '初八', '初九', '初十',
  '十一', '十二', '十三', '十四', '十五', '十六', '十七', '十八', '十九', '二十',
  '廿一', '廿二', '廿三', '廿四', '廿五', '廿六', '廿七', '廿八', '廿九', '三十',
];

/** 农历生肖 */
const ZODIAC = ['鼠', '牛', '虎', '兔', '龙', '蛇', '马', '羊', '猴', '鸡', '狗', '猪'];

/** 获取农历年闰月，无闰返回 0 */
function leapMonth(y) {
  return LUNAR_INFO[y - 1900] & 0xf;
}

/** 获取农历年闰月天数 */
function leapDays(y) {
  if (leapMonth(y)) {
    return (LUNAR_INFO[y - 1900] & 0x10000) ? 30 : 29;
  }
  return 0;
}

/** 获取农历年总天数 */
function lYearDays(y) {
  let sum = 348;
  for (let i = 0x8000; i > 0x8; i >>= 1) {
    sum += (LUNAR_INFO[y - 1900] & i) ? 1 : 0;
  }
  return sum + leapDays(y);
}

/** 获取农历月天数 */
function lMonthDays(y, m) {
  return (LUNAR_INFO[y - 1900] & (0x10000 >> m)) ? 30 : 29;
}

/** 公历转农历 */
function solarToLunar(date) {
  // 基准：1900-01-31 农历 1900 年正月初一
  const baseDate = new Date(1900, 0, 31);
  let offset = Math.floor((date - baseDate) / 86400000);

  let y = 1900;
  let temp = 0;
  while (y < 2100 && offset > 0) {
    temp = lYearDays(y);
    offset -= temp;
    y++;
  }
  if (offset < 0) {
    offset += temp;
    y--;
  }

  const leap = leapMonth(y);
  let isLeap = false;
  let m = 1;
  let d = 1;

  for (m = 1; m < 13 && offset > 0; m++) {
    if (leap > 0 && m === leap + 1 && !isLeap) {
      --m;
      isLeap = true;
      temp = leapDays(y);
    } else {
      temp = lMonthDays(y, m);
    }
    if (isLeap && m === leap + 1) isLeap = false;
    offset -= temp;
  }

  if (offset === 0 && leap > 0 && m === leap + 1) {
    if (isLeap) {
      isLeap = false;
    } else {
      isLeap = true;
      --m;
    }
  }

  if (offset < 0) {
    offset += temp;
    --m;
  }

  d = offset + 1;
  const zodiac = ZODIAC[(y - 4) % 12];

  return {
    year: y,
    month: m,
    day: d,
    isLeap,
    zodiac,
    monthName: (isLeap ? '闰' : '') + LUNAR_MONTHS[m - 1] + '月',
    dayName: LUNAR_DAYS[d - 1],
  };
}

export function useClock() {
  const now = ref(new Date());

  let timer = null;

  /** 时段问候配置 */
  const greeting = computed(() => {
    const h = now.value.getHours();
    if (h >= 5 && h < 9) return { text: '早上好呀', emoji: '☀️' };
    if (h >= 9 && h < 12) return { text: '上午好呀', emoji: '🌤️' };
    if (h >= 12 && h < 14) return { text: '中午好呀', emoji: '🌞' };
    if (h >= 14 && h < 18) return { text: '下午好呀', emoji: '⛅' };
    if (h >= 18 && h < 22) return { text: '晚上好呀', emoji: '🌙' };
    if (h >= 22 || h < 1) return { text: '夜深了', emoji: '🌌' };
    return { text: '凌晨好呀', emoji: '🌒' };
  });

  /** 时间显示：HH:MM */
  const timeText = computed(() => {
    const d = now.value;
    const h = String(d.getHours()).padStart(2, '0');
    const m = String(d.getMinutes()).padStart(2, '0');
    return `${h}:${m}`;
  });

  /** 农历显示 */
  const lunarText = computed(() => {
    try {
      const lunar = solarToLunar(now.value);
      return `${lunar.monthName}${lunar.dayName}`;
    } catch {
      return '';
    }
  });

  /** 完整日期显示：周五 · 08.07 · 21:30 · 七月十五 */
  const dateText = computed(() => {
    const days = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
    const d = now.value;
    const day = days[d.getDay()];
    const md = `${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
    return `${day} · ${md}`;
  });

  /** 时段：用于自动深色模式判断 */
  const hour = computed(() => now.value.getHours());

  onMounted(() => {
    timer = setInterval(() => { now.value = new Date(); }, 1000);
  });

  onUnmounted(() => {
    if (timer) clearInterval(timer);
  });

  return { now, greeting, timeText, lunarText, dateText, hour };
}
