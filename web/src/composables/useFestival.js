/**
 * 节日检测 composable
 * - 覆盖常见公历 + 农历节日（lunar-javascript 计算农历）
 * - 每个节日带生效窗口期（days: [前N天, 后N天]）
 * 分组 group 决定装饰类型：spring 灯笼 / christmas 雪花 / midautumn 月亮 / halloween 蝙蝠 / generic emoji 飘落
 */
import { computed } from 'vue';
import { Lunar, LunarMonth, Solar } from 'lunar-javascript';

/** 把农历年月日转为公历 Date（不含时间） */
function lunarDateToSolar(year, month, day) {
  const solar = Lunar.fromYmd(year, month, day).getSolar();
  return new Date(solar.getYear(), solar.getMonth() - 1, solar.getDay());
}

/** 感恩节：11 月第 4 个星期四 */
function thanksgivingDate(year) {
  // 11月1日星期几（0=周日）
  const dow = new Date(year, 10, 1).getDay();
  // 第一个星期四的日期（1-7）
  const firstThu = ((4 - dow) + 7) % 7 + 1;
  return new Date(year, 10, firstThu + 21);
}

/**
 * 节日表
 * festivalDate(year, solar, lunar) 返回该节日当年公历 Date（不含时间）
 */
const FESTIVALS = [
  /* ---------- 春节族（灯笼红绸） ---------- */
  {
    key: 'newyeareve', name: '除夕', emoji: '🧧', group: 'spring', days: [0, 0],
    festivalDate(year) {
      // 农历腊月最后一天（腊月天数用 LunarMonth.getDayCount() 获取）
      const dayCount = LunarMonth.fromYm(year, 12).getDayCount();
      return lunarDateToSolar(year, 12, dayCount);
    },
  },
  {
    key: 'spring', name: '春节', emoji: '🏮', group: 'spring', days: [-2, 7],
    festivalDate(year) {
      return lunarDateToSolar(year, 1, 1);
    },
  },
  {
    key: 'lantern', name: '元宵节', emoji: '🏮', group: 'spring', days: [0, 0],
    festivalDate(year) {
      return lunarDateToSolar(year, 1, 15);
    },
  },
  /* ---------- 中秋族（月亮） ---------- */
  {
    key: 'midautumn', name: '中秋节', emoji: '🌕', group: 'midautumn', days: [-2, 2],
    festivalDate(year) {
      return lunarDateToSolar(year, 8, 15);
    },
  },
  /* ---------- 万圣族（蝙蝠南瓜） ---------- */
  {
    key: 'halloween', name: '万圣节', emoji: '🎃', group: 'halloween', days: [-3, 1],
    festivalDate(year) {
      return new Date(year, 9, 31);
    },
  },
  /* ---------- 圣诞族（雪花圣诞树） ---------- */
  {
    key: 'christmas', name: '圣诞节', emoji: '🎄', group: 'christmas', days: [-5, 2],
    festivalDate(year) {
      return new Date(year, 11, 25);
    },
  },
  /* ---------- 农历通用 ---------- */
  {
    key: 'dragonboat', name: '端午节', emoji: '🐲', group: 'generic', days: [-1, 1],
    festivalDate(year) {
      return lunarDateToSolar(year, 5, 5);
    },
  },
  {
    key: 'qixi', name: '七夕', emoji: '💞', group: 'generic', days: [-1, 1],
    festivalDate(year) {
      return lunarDateToSolar(year, 7, 7);
    },
  },
  {
    key: 'chongyang', name: '重阳节', emoji: '🌸', group: 'generic', days: [0, 0],
    festivalDate(year) {
      return lunarDateToSolar(year, 9, 9);
    },
  },
  {
    key: 'laba', name: '腊八节', emoji: '🥣', group: 'generic', days: [0, 0],
    festivalDate(year) {
      return lunarDateToSolar(year, 12, 8);
    },
  },
  /* ---------- 公历通用 ---------- */
  {
    key: 'newyear', name: '元旦', emoji: '🎉', group: 'generic', days: [-1, 2],
    festivalDate(year) { return new Date(year, 0, 1); },
  },
  {
    key: 'valentine', name: '情人节', emoji: '💕', group: 'generic', days: [-1, 1],
    festivalDate(year) { return new Date(year, 1, 14); },
  },
  {
    key: 'womensday', name: '妇女节', emoji: '🌷', group: 'generic', days: [0, 0],
    festivalDate(year) { return new Date(year, 2, 8); },
  },
  {
    key: 'arbor', name: '植树节', emoji: '🌳', group: 'generic', days: [0, 0],
    festivalDate(year) { return new Date(year, 2, 12); },
  },
  {
    key: 'aprilfool', name: '愚人节', emoji: '🤡', group: 'generic', days: [0, 0],
    festivalDate(year) { return new Date(year, 3, 1); },
  },
  {
    key: 'laborday', name: '劳动节', emoji: '🛠️', group: 'generic', days: [-1, 4],
    festivalDate(year) { return new Date(year, 4, 1); },
  },
  {
    key: 'youthday', name: '青年节', emoji: '🌟', group: 'generic', days: [0, 0],
    festivalDate(year) { return new Date(year, 4, 4); },
  },
  {
    key: 'children', name: '儿童节', emoji: '🎈', group: 'generic', days: [0, 1],
    festivalDate(year) { return new Date(year, 5, 1); },
  },
  {
    key: 'partybday', name: '建党节', emoji: '🚩', group: 'generic', days: [0, 0],
    festivalDate(year) { return new Date(year, 6, 1); },
  },
  {
    key: 'armyday', name: '建军节', emoji: '🎖️', group: 'generic', days: [0, 0],
    festivalDate(year) { return new Date(year, 7, 1); },
  },
  {
    key: 'teachersday', name: '教师节', emoji: '🍎', group: 'generic', days: [0, 0],
    festivalDate(year) { return new Date(year, 8, 10); },
  },
  {
    key: 'national', name: '国庆节', emoji: '🇨🇳', group: 'generic', days: [-1, 7],
    festivalDate(year) { return new Date(year, 9, 1); },
  },
  {
    key: 'thanksgiving', name: '感恩节', emoji: '🦃', group: 'generic', days: [-1, 1],
    festivalDate(year) { return thanksgivingDate(year); },
  },
];

/** 按真实日期计算当前节日（无节日返回 null） */
function getFestivalByDate(date) {
  const today = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const solar = Solar.fromDate(today);
  const lunar = solar.getLunar();
  const year = today.getFullYear();
  for (const f of FESTIVALS) {
    const target = f.festivalDate(year, solar, lunar);
    if (!target) continue;
    const diff = Math.round((today - target) / 86400000);
    if (diff >= f.days[0] && diff <= f.days[1]) {
      return { key: f.key, name: f.name, emoji: f.emoji, group: f.group };
    }
  }
  return null;
}

/**
 * 计算距离参考日期最近的下一个节日
 * 今年 + 明年都检查，保证跨年后自动顺延
 * @param {Date} date 参考日期（默认今天）
 * @returns {Object|null} { key, name, emoji, diff }，diff 为距节日正日的天数（0=今天）
 */
export function getNextFestival(date = new Date()) {
  const today = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  let best = null;
  for (let yearOffset = 0; yearOffset < 2; yearOffset++) {
    const year = today.getFullYear() + yearOffset;
    for (const f of FESTIVALS) {
      const target = f.festivalDate(year);
      if (!target) continue;
      const diff = Math.round((target - today) / 86400000);
      if (diff < 0) continue; // 已过，跳过
      if (!best || diff < best.diff) {
        best = { key: f.key, name: f.name, emoji: f.emoji, diff };
      }
    }
  }
  return best;
}

/**
 * 使用节日检测
 * @returns {{ festival: import('vue').ComputedRef<Object|null>, FESTIVALS: Array }}
 * festival 字段：key / name / emoji / group（装饰分组）
 */
export function useFestival() {
  const festival = computed(() => getFestivalByDate(new Date()));

  return { festival, FESTIVALS };
}
