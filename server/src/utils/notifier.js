/**
 * 通知中心发送器（渠道与事件解耦）
 *
 * 渠道 channels（"怎么发"）：全局一份
 * - serverchan：Server酱（微信推送）——零依赖，Node 18+ 内置 fetch 直发
 * - email：QQ 邮箱等 SMTP —— 依赖 nodemailer
 *
 * 事件 events（"什么时候发、发什么"）：可扩展列表
 * - patrol：巡检结果
 * - backup：本地备份结果
 * - 未来新增事件：加一个事件默认配置 + 一个渲染器 + 调用一次 sendEvent 即可
 *
 * 配置存 preferences.notification_config（JSON），旧平铺结构自动迁移
 * 发送失败静默（仅记日志），绝不影响业务主流程
 */
import nodemailer from 'nodemailer';
import db from '../db/index.js';

/** Server酱推送接口前缀 */
const SERVERCHAN_BASE = 'https://sctapi.ftqq.com';
/** 发送超时（ms） */
const SEND_TIMEOUT = 10000;

/** 通知配置默认值（channels 渠道 + events 事件，与前端通知中心保持一致） */
export const DEFAULT_NOTIFICATION_CONFIG = {
  // ===== 渠道：发到哪（全局一份） =====
  channels: {
    serverchan: { enabled: false, sendKey: '' },   // 微信推送
    email: {                                        // QQ 邮箱（SMTP）
      enabled: false,
      host: 'smtp.qq.com',   // SMTP 服务器
      port: 465,             // 465=SSL | 587=STARTTLS
      user: '',              // 发件邮箱（如 123456@qq.com）
      pass: '',              // 授权码（非邮箱密码）
      to: '',                // 收件邮箱（多个用英文逗号分隔）
    },
  },
  // ===== 事件：什么时候发、发什么（可扩展） =====
  events: {
    // 巡检结果
    patrol: {
      enabled: true,
      strategy: 'abnormal',    // abnormal=仅异常推送 | always=总是推送
      minIssues: 1,            // 异常数达到多少才推送
      titleTemplate: '🩺 巡检发现 {issues} 条异常',          // 全正常时固定为"全部正常"
      bodyTemplate: '正常 {ok} · 需代理 {blocked} · 打不开 {fail} · 跳过 {skip}\n\n检测时间：{time}',
    },
    // 本地备份结果（成功/失败）
    backup: {
      enabled: false,
      onSuccess: true,         // 备份成功时推送
      onFailure: true,         // 备份失败时推送
      titleTemplate: '🛡️ 数据备份{result}',
      bodyTemplate: '文件：{file}\n大小：{size}\n{reason}时间：{time}',
    },
  },
};

/** 各事件模板占位符说明（供前端通知中心展示） */
export const EVENT_PLACEHOLDERS = {
  patrol: [
    { key: '{total}', desc: '本轮检测总数' },
    { key: '{ok}', desc: '正常数' },
    { key: '{blocked}', desc: '需代理数' },
    { key: '{fail}', desc: '打不开数（含死链）' },
    { key: '{skip}', desc: '跳过数' },
    { key: '{issues}', desc: '异常数（同 fail）' },
    { key: '{time}', desc: '推送时间' },
  ],
  backup: [
    { key: '{result}', desc: '备份结果（成功/失败）' },
    { key: '{file}', desc: '快照文件名' },
    { key: '{size}', desc: '快照大小' },
    { key: '{reason}', desc: '失败原因（成功时为空）' },
    { key: '{time}', desc: '推送时间' },
  ],
};

/**
 * 读取通知配置：preferences 表 JSON 字段 + 默认值兜底
 * 兼容旧结构自动迁移：
 * - 最早平铺：serverChanKey → serverchan 子模块
 * - 上一代：顶层 enabled/strategy/templates + serverchan/email 平铺子模块 → channels + events.patrol
 */
export function getNotificationConfig() {
  const row = db.prepare('SELECT notification_config FROM preferences WHERE id = 1').get();
  let parsed = {};
  if (row?.notification_config) {
    try {
      parsed = JSON.parse(row.notification_config);
    } catch { /* 解析失败回退默认 */ }
  }
  if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
    // 迁移 1：最早的 serverChanKey 平铺 → serverchan 子模块
    if (parsed.serverChanKey !== undefined && parsed.serverchan === undefined) {
      parsed.serverchan = { enabled: !!parsed.serverChanKey, sendKey: parsed.serverChanKey };
      delete parsed.serverChanKey;
    }
    // 迁移 2：上一代平铺结构 → channels/events 嵌套
    if (!parsed.channels && (parsed.serverchan || parsed.email)) {
      parsed.channels = {
        serverchan: parsed.serverchan,
        email: parsed.email,
      };
      delete parsed.serverchan;
      delete parsed.email;
      // 顶层巡检相关字段 → events.patrol
      if (parsed.strategy !== undefined || parsed.minIssues !== undefined ||
          parsed.titleTemplate !== undefined || parsed.bodyTemplate !== undefined || parsed.enabled !== undefined) {
        parsed.events = {
          patrol: {
            enabled: parsed.enabled ?? DEFAULT_NOTIFICATION_CONFIG.events.patrol.enabled,
            strategy: parsed.strategy ?? DEFAULT_NOTIFICATION_CONFIG.events.patrol.strategy,
            minIssues: parsed.minIssues ?? DEFAULT_NOTIFICATION_CONFIG.events.patrol.minIssues,
            titleTemplate: parsed.titleTemplate ?? DEFAULT_NOTIFICATION_CONFIG.events.patrol.titleTemplate,
            bodyTemplate: parsed.bodyTemplate ?? DEFAULT_NOTIFICATION_CONFIG.events.patrol.bodyTemplate,
          },
        };
        delete parsed.enabled;
        delete parsed.strategy;
        delete parsed.minIssues;
        delete parsed.titleTemplate;
        delete parsed.bodyTemplate;
      }
    }
    // 迁移 3：移除 Git 备份模块后，旧 events.gitBackup → events.backup
    if (parsed.events?.gitBackup && !parsed.events.backup) {
      parsed.events.backup = parsed.events.gitBackup;
      delete parsed.events.gitBackup;
    }
    // 深度合并默认值（channels/events 逐层兜底）
    return {
      ...DEFAULT_NOTIFICATION_CONFIG,
      ...parsed,
      channels: {
        serverchan: { ...DEFAULT_NOTIFICATION_CONFIG.channels.serverchan, ...(parsed.channels?.serverchan || {}) },
        email: { ...DEFAULT_NOTIFICATION_CONFIG.channels.email, ...(parsed.channels?.email || {}) },
      },
      events: {
        patrol: { ...DEFAULT_NOTIFICATION_CONFIG.events.patrol, ...(parsed.events?.patrol || {}) },
        backup: { ...DEFAULT_NOTIFICATION_CONFIG.events.backup, ...(parsed.events?.backup || {}) },
      },
    };
  }
  return JSON.parse(JSON.stringify(DEFAULT_NOTIFICATION_CONFIG));
}

/**
 * 发送 Server酱微信推送
 * @param {object} opts
 * @param {string} opts.key - SendKey
 * @param {string} opts.title - 消息标题
 * @param {string} [opts.desp] - 消息正文（支持 Markdown）
 * @returns {Promise<boolean>} 是否发送成功
 */
export async function sendServerChan({ key, title, desp = '' }) {
  if (!key) return false;
  try {
    const res = await fetch(`${SERVERCHAN_BASE}/${key}.send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, desp }),
      signal: AbortSignal.timeout(SEND_TIMEOUT),
    });
    const data = await res.json().catch(() => null);
    // Server酱成功约定：HTTP 200 且 code === 0
    const ok = res.ok && data?.code === 0;
    console.log(`[${new Date().toISOString()}] [通知] [Server酱] [${ok ? '成功' : '失败'}] ${data?.message || `HTTP ${res.status}`}`);
    return ok;
  } catch (err) {
    console.log(`[${new Date().toISOString()}] [通知] [Server酱] [失败] ${err.message}`);
    return false;
  }
}

/**
 * 发送 QQ 邮箱（SMTP）通知
 * @param {object} cfg - email 渠道配置（host/port/user/pass/to）
 * @returns {Promise<boolean>} 是否发送成功
 */
export async function sendEmail({ config: cfg, title, desp = '' }) {
  if (!cfg.user || !cfg.pass || !cfg.to) return false;
  let transporter;
  try {
    transporter = nodemailer.createTransport({
      host: cfg.host || 'smtp.qq.com',
      port: cfg.port || 465,
      secure: (cfg.port || 465) === 465, // 465 用 SSL，587 用 STARTTLS
      auth: { user: cfg.user, pass: cfg.pass },
      connectionTimeout: SEND_TIMEOUT,
      greetingTimeout: SEND_TIMEOUT,
    });
    await transporter.sendMail({
      from: `"cozy·nav" <${cfg.user}>`,
      to: cfg.to,
      subject: title,
      text: desp,
    });
    console.log(`[${new Date().toISOString()}] [通知] [邮件] [成功] ${cfg.to}`);
    return true;
  } catch (err) {
    console.log(`[${new Date().toISOString()}] [通知] [邮件] [失败] ${err.message}`);
    return false;
  } finally {
    // 释放连接池，避免长时间占用
    try { transporter?.close(); } catch { /* 忽略 */ }
  }
}

/** 是否存在已启用且配置完整的渠道 */
function hasActiveChannel(channels) {
  return (channels.serverchan?.enabled && channels.serverchan?.sendKey)
    || (channels.email?.enabled && channels.email?.user && channels.email?.pass && channels.email?.to);
}

/** 按当前配置，向所有已启用渠道发送同一消息 */
export async function sendAllChannels(channels, title, desp) {
  const results = [];
  if (channels?.serverchan?.enabled && channels.serverchan?.sendKey) {
    results.push(await sendServerChan({ key: channels.serverchan.sendKey, title, desp }));
  }
  if (channels?.email?.enabled && channels.email?.user && channels.email?.pass && channels.email?.to) {
    results.push(await sendEmail({ config: channels.email, title, desp }));
  }
  return results.some(Boolean);
}

/**
 * 通用通知入口：按事件类型读取配置 → 条件判断 → 渲染模板 → 多渠道发送
 * @param {string} eventType - 事件标识（'patrol' | 'backup'）
 * @param {object} data - 事件数据（不同事件字段不同，见各渲染器）
 * @returns {Promise<boolean>} 是否实际发送
 */
export async function sendEvent(eventType, data) {
  const cfg = getNotificationConfig();
  const event = cfg.events?.[eventType];
  if (!event?.enabled) return false;
  if (!hasActiveChannel(cfg.channels)) return false;

  // 渲染器决定是否满足触发条件，返回 null 表示本次不推送
  const renderer = RENDERERS[eventType];
  if (!renderer) return false;
  const rendered = renderer(event, data);
  if (!rendered) return false;

  return sendAllChannels(cfg.channels, rendered.title, rendered.desp);
}

/** 事件渲染器注册表（新增事件在此加一项即可） */
const RENDERERS = {
  /** 巡检结果：按策略（仅异常/总是）+ 异常阈值决定是否推送 */
  patrol: (event, stat) => {
    const issues = stat.fail || 0;
    if (event.strategy !== 'always' && issues < event.minIssues) return null;
    const timeStr = new Date().toLocaleString('zh-CN', { hour12: false });
    // issues 由渲染器单独计算，渲染标题时需并入数据，否则 {issues} 会替换为空
    const map = { ...stat, issues };
    // 全部正常时标题固定，避免"发现 0 条异常"的奇怪文案
    const title = issues > 0
      ? renderTemplate(event.titleTemplate || '🩺 巡检发现 {issues} 条异常', map, timeStr)
      : '🩺 巡检完成（全部正常）';
    const desp = renderTemplate(
      event.bodyTemplate || '正常 {ok} · 需代理 {blocked} · 打不开 {fail} · 跳过 {skip}\n\n检测时间：{time}',
      map,
      timeStr
    );
    return { title, desp };
  },

  /** 备份结果：按成功/失败开关决定是否推送，WebDAV 云端状态附在正文末尾 */
  backup: (event, data) => {
    const ok = !!data.ok;
    if (ok && !event.onSuccess) return null;
    if (!ok && !event.onFailure) return null;
    const timeStr = new Date().toLocaleString('zh-CN', { hour12: false });
    const map = {
      result: ok ? '成功' : '失败',
      file: data.file || '',
      size: data.size || '',
      reason: ok ? '' : (data.reason || ''),
    };
    const title = renderTemplate(event.titleTemplate || '🛡️ 数据备份{result}', map, timeStr);
    let desp = renderTemplate(
      event.bodyTemplate || '文件：{file}\n大小：{size}\n{reason}时间：{time}',
      map,
      timeStr
    );
    // 云端坚果云上传状态（未启用 WebDAV 时不展示）
    if (data.webdav) {
      const w = data.webdav;
      desp += `\n云端坚果云：${w.ok ? `已上传（${w.uploaded ?? 0} 个文件）` : `上传失败（${w.reason || '未知原因'}）`}`;
    }
    return { title, desp };
  },
};

/** 将模板中的 {占位符} 替换为实际值（时间占位符统一处理） */
function renderTemplate(tpl, map, timeStr) {
  return tpl.replace(/\{(total|ok|blocked|fail|skip|issues|result|file|size|reason|time)\}/g, (match, key) => {
    if (key === 'time') return timeStr;
    return map[key] ?? '';
  });
}

/** 巡检结果通知（保持原函数名，供 healthRunner 调用，内部走通用入口） */
export function notifyPatrolResult(stat) {
  return sendEvent('patrol', stat);
}

/** 备份结果通知（供 scheduler/backupController 调用，内部走通用入口） */
export function notifyBackup(result) {
  return sendEvent('backup', result);
}
