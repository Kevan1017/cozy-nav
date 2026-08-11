/**
 * 共享批量检测执行器
 * 手动批量检测（linkController.checkAllLinks）与定时巡检（scheduler）共用，
 * 消除重复代码；统一维护内存态任务进度 + 任务锁，避免并发跑批。
 */
import db from '../db/index.js';
import { checkLinkHealth } from './linkHealth.js';
import { notifyPatrolResult } from './notifier.js';

// 批量检测并发数（避免目标站限流 / 连接数耗尽）
export const BATCH_CONCURRENCY = 4;
// 同一域名两次检测的最小间隔（ms），避免触发目标站风控
const DOMAIN_THROTTLE = 500;
// 巡检历史报告最多保留轮数（超出自动清理最旧的，避免无限增长）
const MAX_PATROL_REPORTS = 100;

/** 内存态批量任务（单用户导航站数据量小，无需引入任务队列库） */
let batchTask = null;

/** 同域名节流时间表：hostname → 下次可检测时间戳 */
const throttleMap = new Map();

/**
 * 将检测结果写回数据库（含连续失败 fail_streak 判死逻辑）
 * @param {number} linkId - 书签 id
 * @param {object} result - checkLinkHealth 的返回值
 * @param {number} [deadStreak=3] - 连续失败多少次判定为死链 down（可配置，默认 3）
 */
export function persistHealth(linkId, result, deadStreak = 3) {
  // 读取当前连续失败次数
  const row = db.prepare('SELECT fail_streak FROM links WHERE id = ?').get(linkId);
  let streak = row?.fail_streak ?? 0;

  // 失败 +1，其他状态归零
  if (result.status === 'fail') {
    streak += 1;
  } else {
    streak = 0;
  }

  // 连续失败达到阈值 → 判死（down 终态，后续巡检默认不再重复请求）
  let status = result.status;
  if (result.status === 'fail' && streak >= deadStreak) {
    status = 'down';
  }

  db.prepare(
    'UPDATE links SET health_status = ?, last_check_at = ?, health_note = ?, fail_streak = ?, tls_expires_at = ? WHERE id = ?'
  ).run(status, new Date().toISOString(), result.note || null, streak, result.tlsExpiresAt || null, linkId);
}

/** 同域名节流：同一域名两次检测间隔至少 DOMAIN_THROTTLE ms */
async function throttleDomain(hostname) {
  const next = throttleMap.get(hostname) || 0;
  const now = Date.now();
  if (now < next) {
    await new Promise((r) => setTimeout(r, next - now));
  }
  throttleMap.set(hostname, Date.now() + DOMAIN_THROTTLE);
}

/** 当前是否有批量任务在跑（手动批量 / 定时巡检共用任务锁） */
export function isBatchRunning() {
  return !!batchTask?.running;
}

/**
 * 启动一批后台检测任务（任务锁互斥，立即返回，后台 setImmediate 跑完）
 * @param {Array<{id:number, url:string}>} links - 待检测书签列表
 * @param {object} [opts]
 * @param {string} [opts.logTag='批量检测'] - 日志标签（批量检测 / 巡检）
 * @param {number} [opts.deadStreak=3] - 判死阈值
 * @param {string} [opts.triggerType='manual'] - 触发方式：scheduled 定时巡检 / manual 手动批量
 * @returns {{started:boolean, total:number}} started=false 表示已有任务在跑
 */
export function startHealthBatch(links, { logTag = '批量检测', deadStreak = 3, triggerType = 'manual' } = {}) {
  if (batchTask?.running) {
    return { started: false, total: 0 };
  }

  const startedAtMs = Date.now();
  batchTask = {
    running: true,
    total: links.length,
    done: 0,
    ok: 0,
    blocked: 0,
    fail: 0,
    skip: 0,
    startedAt: new Date(startedAtMs).toISOString(),
    startedAtMs,
    triggerType,
  };
  // 本轮异常链接快照（非 ok 状态），用于历史报告详情
  const issueLinks = [];

  console.log(`[${new Date().toISOString()}] [书签] [${logTag}] [启动] 共 ${links.length} 条`);

  // 后台执行：小并发分片跑完，不阻塞调用方
  setImmediate(async () => {
    try {
      for (let i = 0; i < links.length; i += BATCH_CONCURRENCY) {
        const chunk = links.slice(i, i + BATCH_CONCURRENCY);
        await Promise.all(chunk.map(async (link) => {
          try {
            // 同域名节流，避免触发目标站风控
            let hostname = link.domain || '';
            try { hostname = hostname || new URL(link.url).hostname; } catch { /* 保留空 */ }
            if (hostname) await throttleDomain(hostname);

            const result = await checkLinkHealth(link.url);
            persistHealth(link.id, result, deadStreak);
            if (batchTask) {
              if (batchTask[result.status] !== undefined) batchTask[result.status]++;
              else batchTask.skip++;
              batchTask.done++;
            }
            // 记录本轮异常链接快照（供历史报告详情展示）
            if (result.status !== 'ok') {
              issueLinks.push({ id: link.id, status: result.status });
            }
          } catch {
            // 单条异常不影响整体，记 fail 继续
            if (batchTask) {
              batchTask.fail++;
              batchTask.done++;
            }
          }
        }));
      }
    } finally {
      if (batchTask) {
        batchTask.running = false;
        // 写入巡检历史报告（统计 + 异常快照），并保留最近 MAX_PATROL_REPORTS 轮
        persistPatrolReport(batchTask, issueLinks);
      }
      console.log(`[${new Date().toISOString()}] [书签] [${logTag}] [完成] ok=${batchTask?.ok ?? 0} blocked=${batchTask?.blocked ?? 0} fail=${batchTask?.fail ?? 0} skip=${batchTask?.skip ?? 0}`);
      // 一轮检测结束后，按通知配置决定是否推送管理员（失败静默，不影响主流程）
      if (batchTask) {
        notifyPatrolResult({ total: batchTask.total, ok: batchTask.ok, blocked: batchTask.blocked, fail: batchTask.fail, skip: batchTask.skip });
      }
    }
  });

  return { started: true, total: links.length };
}

/** 将一轮检测结果写入巡检历史报告表，并清理超出保留轮数的旧报告 */
function persistPatrolReport(task, issueLinks) {
  try {
    db.prepare(
      `INSERT INTO patrol_reports (started_at, finished_at, trigger_type, total, ok, blocked, fail, skip, duration_ms, issue_links)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      task.startedAt,
      new Date().toISOString(),
      task.triggerType,
      task.total,
      task.ok,
      task.blocked,
      task.fail,
      task.skip,
      Date.now() - task.startedAtMs,
      JSON.stringify(issueLinks)
    );
    // 保留最近 MAX_PATROL_REPORTS 轮，超出删除最旧的
    db.prepare(
      `DELETE FROM patrol_reports WHERE id NOT IN (SELECT id FROM patrol_reports ORDER BY id DESC LIMIT ?)`
    ).run(MAX_PATROL_REPORTS);
    console.log(`[${new Date().toISOString()}] [巡检] [报告] [已写入] ok=${task.ok} fail=${task.fail} issue=${issueLinks.length}`);
  } catch (err) {
    // 报告写入失败不影响检测主流程，仅记日志
    console.log(`[${new Date().toISOString()}] [巡检] [报告] [写入失败] ${err.message}`);
  }
}

/** 获取当前批量任务进度（无任务时返回空进度对象） */
export function getHealthBatchProgress() {
  if (!batchTask) {
    return { running: false, total: 0, done: 0, ok: 0, blocked: 0, fail: 0, skip: 0 };
  }
  return batchTask;
}
