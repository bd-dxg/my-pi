#!/usr/bin/env node
/**
 * todo-list skill 核心脚本
 * 读写 ~/.todo/todo.json，提供增删改查、父子层级、进度汇总、软删除回收站、循环任务。
 * 纯 Node 实现，无第三方依赖。所有输出 UTF-8，供 AI 解析/report 给用户。
 */
'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');

const DATA_DIR = path.join(os.homedir(), '.todo');
const DATA_FILE = path.join(DATA_DIR, 'todo.json');

// ---------- 基础 IO（原子写，防损坏） ----------
function load() {
  if (!fs.existsSync(DATA_FILE)) return { next_id: 1, items: [] };
  try {
    return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  } catch (e) {
    console.error('[todo] 数据文件损坏：' + e.message);
    process.exit(1);
  }
}

function save(data) {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  const tmp = DATA_FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2), 'utf8');
  fs.renameSync(tmp, DATA_FILE); // 原子替换
}

function fail(msg) {
  console.error('[todo] ' + msg);
  process.exit(2);
}

// ---------- 工具 ----------
function now() {
  return new Date().toISOString();
}

function pad(n) {
  return String(n).padStart(2, '0');
}

// 生成简单的唯一组ID
function generateGroupId() {
  return 'rec_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 6);
}

// 中文星期 → 数字（1=周一, 7=周日）
const WEEKDAY_MAP = {
  '周一': 1, '星期二': 2, '周三': 3, '周四': 4, '周五': 5, '周六': 6, '周日': 7,
  '星期一': 1, '星期二': 2, '星期三': 3, '星期四': 4, '星期五': 5, '星期六': 6, '星期日': 7,
  '一': 1, '二': 2, '三': 3, '四': 4, '五': 5, '六': 6, '日': 7,
};
const WEEKDAY_REVERSE = ['', '周一', '周二', '周三', '周四', '周五', '周六', '周日'];

// 分配并预检字段
function makeItem(data, title, parentId, priority, due, recurrence, recurGroupId) {
  const id = data.next_id;
  data.next_id += 1;
  const item = {
    id,
    title,
    done: false,
    parent_id: parentId,          // null 表示顶层
    created_at: now(),
    deleted: false,               // true 表示在回收站
    priority: priority || null,   // '高'|'中'|'低'|null
    due_date: due || null,        // 'YYYY-MM-DD'|null
    recurrence: recurrence || null, // { type: 'daily'|'weekly'|'monthly', day?:number, date?:number } | null
    recurrence_group_id: recurGroupId || null, // 同一循环任务的不同实例共享此 id
  };
  return item;
}

function find(data, id) {
  return data.items.find((i) => i.id === id);
}

function childrenOf(data, parentId) {
  return data.items.filter((i) => i.parent_id === parentId);
}

// 计算某条的层级序号字符串，如 "4.1.3"
function getHierarchicalNum(data, item) {
  const parts = [];
  let cur = item;
  while (cur) {
    if (cur.parent_id === null) {
      parts.unshift(String(cur.id));
      break;
    }
    const parent = find(data, cur.parent_id);
    if (!parent || parent.deleted) {
      parts.unshift(String(cur.id));
      break;
    }
    const sibs = childrenOf(data, cur.parent_id)
      .filter((x) => !x.deleted)
      .sort((a, b) => a.id - b.id);
    const idx = sibs.findIndex((x) => x.id === cur.id);
    if (idx === -1) {
      parts.unshift(String(cur.id));
      break;
    }
    parts.unshift(String(idx + 1));
    cur = parent;
  }
  return parts.join('.');
}

// 解析输入序号：支持纯数字 id 或层级序号（如 "4.1" "4.1.3"）
function resolveId(data, rawId, includeDeleted) {
  const parts = rawId.split('.').map(Number);
  if (/^\d+$/.test(rawId)) {
    const found = find(data, Number(rawId));
    if (found) return found;
  }
  if (parts.every((p) => !isNaN(p) && Number.isInteger(p) && p > 0)) {
    let current = find(data, parts[0]);
    if (!current) return null;
    for (let i = 1; i < parts.length; i++) {
      const kids = childrenOf(data, current.id)
        .filter((k) => includeDeleted || !k.deleted)
        .sort((a, b) => a.id - b.id);
      const childIdx = parts[i] - 1;
      if (childIdx < 0 || childIdx >= kids.length) return null;
      current = kids[childIdx];
    }
    return current;
  }
  return null;
}

// 计算某条「是否完成」：有直接子项则由子项推算，叶子用手动 done
function effectiveDone(data, item) {
  const kids = childrenOf(data, item.id).filter((k) => !k.deleted);
  if (kids.length > 0) {
    return kids.every((k) => effectiveDone(data, k));
  }
  return item.done;
}

// 某条的活跃子项数 / 已完成数（含多级）
function progress(data, item) {
  let total = 0, doneCount = 0;
  const visit = (p) => {
    for (const k of childrenOf(data, p).filter((x) => !x.deleted)) {
      total += 1;
      if (effectiveDone(data, k)) doneCount += 1;
      visit(k.id);
    }
  };
  visit(item.id);
  return { total, doneCount };
}

function prioIcon(p) {
  return { '高': '🔴高', '中': '🟡中', '低': '🟢低' }[p] || '';
}

function dueStr(d) {
  if (!d) return '';
  // 逾期提醒
  const today = new Date().toISOString().slice(0, 10);
  return d < today ? `(逾期 ${d})` : `(截止 ${d})`;
}

function recurrenceStr(r) {
  if (!r) return '';
  if (r.type === 'daily') return '🔁每日';
  if (r.type === 'weekly') return `🔁每周${WEEKDAY_REVERSE[r.day] || '?'}`;
  if (r.type === 'monthly') return `🔁每月${r.date}号`;
  return '🔁';
}

// ---------- 循环任务相关 ----------

// 解析 --every 参数为数字（周几→1-7，日期→1-31）
function parseEvery(everyStr, repeatType) {
  if (!everyStr) return null;
  if (repeatType === 'weekly') {
    // 尝试中文星期
    if (WEEKDAY_MAP[everyStr]) return WEEKDAY_MAP[everyStr];
    // 尝试数字 1-7
    const n = Number(everyStr);
    if (n >= 1 && n <= 7) return n;
    return null;
  }
  if (repeatType === 'monthly') {
    const n = Number(everyStr);
    if (n >= 1 && n <= 31) return n;
    return null;
  }
  return null;
}

// 根据循环类型和基准日期，计算下一个周期的截止日期
function nextDueDate(recurrence, currentDue) {
  if (!recurrence || !currentDue) return null;
  const [y, m, d] = currentDue.split('-').map(Number);
  const date = new Date(y, m - 1, d);

  if (recurrence.type === 'daily') {
    date.setDate(date.getDate() + 1);
  } else if (recurrence.type === 'weekly') {
    date.setDate(date.getDate() + 7);
  } else if (recurrence.type === 'monthly') {
    // 下个月同一天，若该月没有则跳到该月最后一天
    const targetDay = recurrence.date || d;
    let nextMonth = m; // 1-based
    let nextYear = y;
    if (m === 12) { nextYear = y + 1; nextMonth = 1; }
    else { nextMonth = m + 1; }
    // 该月最后一天
    const lastDay = new Date(nextYear, nextMonth, 0).getDate();
    const day = Math.min(targetDay, lastDay);
    return `${nextYear}-${pad(nextMonth)}-${pad(day)}`;
  }
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

// 根据循环类型和指定值，从今天开始算第一个截止日期
function initialDueDate(recurrence) {
  if (!recurrence) return null;
  const today = new Date();
  const todayStr = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`;

  if (recurrence.type === 'daily') return todayStr;

  if (recurrence.type === 'weekly') {
    const targetDay = recurrence.day;
    const currentDay = today.getDay() === 0 ? 7 : today.getDay(); // 1=周一...7=周日
    let diff = targetDay - currentDay;
    if (diff < 0) diff += 7;
    const next = new Date(today);
    next.setDate(next.getDate() + diff);
    return `${next.getFullYear()}-${pad(next.getMonth() + 1)}-${pad(next.getDate())}`;
  }

  if (recurrence.type === 'monthly') {
    const targetDate = recurrence.date;
    const thisYear = today.getFullYear();
    const thisMonth = today.getMonth() + 1; // 1-based
    const lastDayThisMonth = new Date(thisYear, thisMonth, 0).getDate();
    if (targetDate >= today.getDate() && targetDate <= lastDayThisMonth) {
      // 本月还没过这个日期
      return `${thisYear}-${pad(thisMonth)}-${pad(targetDate)}`;
    }
    // 下个月
    let nextMonth = thisMonth + 1;
    let nextYear = thisYear;
    if (nextMonth > 12) { nextMonth = 1; nextYear++; }
    const lastDayNextMonth = new Date(nextYear, nextMonth, 0).getDate();
    const day = Math.min(targetDate, lastDayNextMonth);
    return `${nextYear}-${pad(nextMonth)}-${pad(day)}`;
  }

  return todayStr;
}

// 为循环任务生成下一周期的副本
function makeRecurrenceCopy(data, item) {
  if (!item.recurrence) return null;
  const nextDue = nextDueDate(item.recurrence, item.due_date);
  const newItem = makeItem(
    data,
    item.title,
    item.parent_id,
    item.priority,
    nextDue,
    item.recurrence,
    item.recurrence_group_id
  );
  return newItem;
}

// 判断某条是否应隐藏（循环任务已完成且同组有更新的活跃实例）
function isRecurrenceInstanceHidden(data, item) {
  if (!item.recurrence_group_id || !item.done) return false;
  // 同组中是否存在 id 更大且未 done 的活跃实例
  return data.items.some((x) =>
    x.recurrence_group_id === item.recurrence_group_id &&
    x.id > item.id &&
    !x.deleted &&
    !x.done
  );
}

// ---------- 打印 ----------
// 打印单条（含其子树），顶层与子级共用
function printItem(data, it, depth, out, prefix) {
  // 已完成的条目不展示（父级所有子项完成时整棵子树隐藏）
  if (effectiveDone(data, it)) return;
  const indent = '  '.repeat(depth);
  const kids = childrenOf(data, it.id)
    .filter((k) => !k.deleted)
    .sort((a, b) => a.id - b.id);
  const displayNum = prefix || String(it.id);
  const recurLabel = recurrenceStr(it.recurrence);
  const recurPrefix = recurLabel ? recurLabel + ' ' : '';

  if (kids.length > 0) {
    const { total, doneCount } = progress(data, it);
    const mark = doneCount === total ? '✔' : '·';
    const line = `${indent}${mark} ${displayNum}. ${recurPrefix}${it.title}（子任务 ${doneCount}/${total}）${prioIcon(it.priority)} ${dueStr(it.due_date)}`.trimEnd();
    out.push(line);
    kids.forEach((k, i) => printItem(data, k, depth + 1, out, `${displayNum}.${i + 1}`));
  } else {
    const mark = effectiveDone(data, it) ? '✔' : '☐';
    const line = `${indent}${mark} ${displayNum}. ${recurPrefix}${it.title}${prioIcon(it.priority)} ${dueStr(it.due_date)}`.trimEnd();
    out.push(line);
  }
}

function sortItems(items, field) {
  const order = { '高': 0, '中': 1, '低': 2, null: 3 };
  return [...items].sort((a, b) => {
    if (field === 'priority') return (order[a.priority] ?? 3) - (order[b.priority] ?? 3);
    if (field === 'due') return (a.due_date || '9999') < (b.due_date || '9999') ? -1 : 1;
    return a.id - b.id; // 默认创建序
  });
}

// ---------- 命令 ----------
function cmdAdd(argv) {
  const data = load();
  const title = argv.title;
  const parentId = argv.parent ? Number(argv.parent) : null;
  if (!title) fail('缺少标题，用法：todo.js add --title "标题" [--parent 父id] [--priority 高中低] [--due YYYY-MM-DD] [--repeat daily|weekly|monthly] [--every 周几|几号]');
  if (parentId !== null) {
    const p = find(data, parentId);
    if (!p) fail(`父任务 #${parentId} 不存在`);
    if (p.deleted) fail(`父任务 #${parentId} 在回收站中，不可添加子任务`);
  }

  // 解析循环参数
  let recurrence = null;
  let recurGroupId = null;
  if (argv.repeat && argv.repeat !== 'off') {
    if (!['daily', 'weekly', 'monthly'].includes(argv.repeat)) {
      fail('--repeat 参数必须为 daily / weekly / monthly / off');
    }
    const everyVal = parseEvery(argv.every, argv.repeat);
    if (argv.repeat === 'weekly') {
      if (!everyVal) fail('--repeat weekly 需要 --every 指定周几（如 周一/周二/.../周日）');
      recurrence = { type: 'weekly', day: everyVal };
    } else if (argv.repeat === 'monthly') {
      if (!everyVal) fail('--repeat monthly 需要 --every 指定日期（1-31）');
      recurrence = { type: 'monthly', date: everyVal };
    } else {
      recurrence = { type: 'daily' };
    }
    recurGroupId = generateGroupId();
    // 没指定 due_date 时自动计算第一个周期的截止日期
    if (!argv.due) {
      argv.due = initialDueDate(recurrence);
    }
  }

  const item = makeItem(data, title, parentId, argv.priority, argv.due, recurrence, recurGroupId);
  data.items.push(item);
  save(data);
  console.log(`✅ 已添加 ${getHierarchicalNum(data, item)}：${item.title}` + (parentId !== null ? `（挂在 ${getHierarchicalNum(data, find(data, parentId))} 下）` : '') + (recurrence ? ` ${recurrenceStr(recurrence)}` : ''));
  // 回显父级进度
  if (parentId !== null) {
    const parent = find(data, parentId);
    const parentNum = getHierarchicalNum(data, parent);
    const { total, doneCount } = progress(data, parent);
    console.log(`   父任务 ${parentNum} 进度：${doneCount}/${total}`);
  }
}

function cmdList(argv) {
  const data = load();
  // 过滤掉已完成的、被隐藏的循环旧副本
  const active = data.items.filter((i) => !i.deleted && !isRecurrenceInstanceHidden(data, i));
  if (active.length === 0) {
    console.log('📭 暂无待办，用 ta#加一个任务 开始吧。');
    return;
  }
  // 顶层排序
  const tops = active.filter((i) => i.parent_id === null);
  const sorted = sortItems(tops, argv.sort);
  const out = [];
  for (const t of sorted) printItem(data, t, 0, out, String(t.id));
  // 统计
  const totalDone = active.filter((i) => effectiveDone(data, i)).length;
  const totalActive = active.length;
  if (out.length === 0) {
    console.log('🎉 全部完成！');
  } else {
    console.log(out.join('\n'));
  }
  console.log(`\n📊 共 ${totalActive} 条，已完成 ${totalDone} 条（${totalActive ? Math.round((totalDone / totalActive) * 100) : 0}%）`);
}

function cmdShow(argv) {
  const data = load();
  const rawId = argv._[0];
  const it = resolveId(data, rawId, true);
  if (!it) fail(`${rawId} 不存在`);
  const num = getHierarchicalNum(data, it);
  console.log(`${it.deleted ? '🗑' : (effectiveDone(data, it) ? '✔' : '☐')} ${num}（#${it.id}） ${it.title}`);
  console.log(`   优先级：${it.priority || '无'}`);
  console.log(`   截止：${it.due_date || '无'}`);
  console.log(`   创建：${it.created_at.slice(0, 10)}`);
  if (it.recurrence) {
    console.log(`   循环：${recurrenceStr(it.recurrence)}`);
  }
  if (it.parent_id) console.log(`   父级：#${it.parent_id}`);
  const { total, doneCount } = progress(data, it);
  if (total > 0) console.log(`   子任务：${doneCount}/${total} 已完成`);
  const kids = childrenOf(data, it.id).filter((k) => !k.deleted);
  if (kids.length > 0) {
    console.log('   子任务列表：');
    const prefix = getHierarchicalNum(data, it);
    kids.forEach((k, i) => {
      const childPrefix = `${prefix}.${i + 1}`;
      console.log(`     ${effectiveDone(data, k) ? '✔' : '☐'} ${childPrefix}. ${k.title}`);
    });
  }
}

function cmdBatchDone(argv) {
  const data = load();
  const ids = argv._;
  if (ids.length === 0) {
    fail('缺少序号，用法：todo.js batch-done 4.1 4.2 4.3 ...');
  }
  const seen = new Set();
  let doneCount = 0;
  for (const rawId of ids) {
    const it = resolveId(data, rawId);
    if (!it) { console.log(`  ✖ ${rawId} 不存在，跳过`); continue; }
    if (seen.has(it.id)) continue;
    seen.add(it.id);
    const num = getHierarchicalNum(data, it);
    if (childrenOf(data, it.id).filter((x) => !x.deleted).length > 0) {
      console.log(`  ✖ ${num} 有子任务，请完成其子任务，跳过`);
      continue;
    }
    if (it.deleted) { console.log(`  ✖ ${num} 在回收站中，跳过`); continue; }
    it.done = true;

    // 循环任务：生成下一周期副本
    if (it.recurrence) {
      const copy = makeRecurrenceCopy(data, it);
      if (copy) {
        data.items.push(copy);
        const copyNum = getHierarchicalNum(data, copy);
        console.log(`  🔁 ${num} 已生成下一周期副本 ${copyNum}（截止 ${copy.due_date}）`);
      }
    }

    doneCount++;
  }
  save(data);
  console.log(`✔ 已批量完成 ${doneCount}/${seen.size} 条。`);
}

function cmdDone(argv) {
  const data = load();
  const rawId = argv._[0];
  const it = resolveId(data, rawId);
  if (!it) fail(`${rawId} 不存在`);
  const num = getHierarchicalNum(data, it);
  if (childrenOf(data, it.id).length > 0) fail(`${num} 有子任务，请完成其子任务（父级状态自动汇总）`);
  it.done = true;

  // 循环任务：完成后生成下一周期副本
  if (it.recurrence) {
    const copy = makeRecurrenceCopy(data, it);
    if (copy) {
      data.items.push(copy);
      const copyNum = getHierarchicalNum(data, copy);
      console.log(`  🔁 已生成下一周期 ${copyNum}（${recurrenceStr(copy.recurrence)}，截止 ${copy.due_date}）`);
    }
  }

  save(data);
  let p = it.parent_id;
  while (p !== null) {
    const pi = find(data, p);
    if (!pi) break;
    if (effectiveDone(data, pi)) {
      const pNum = getHierarchicalNum(data, pi);
      console.log(`   ⬆ 父任务 ${pNum} 已全部完成 ✔`);
    }
    p = pi.parent_id;
  }
  console.log(`✔ ${num} ${it.title} 已完成。`);
}

function cmdUndo(argv) {
  const data = load();
  const rawId = argv._[0];
  const it = resolveId(data, rawId);
  if (!it) fail(`${rawId} 不存在`);
  const num = getHierarchicalNum(data, it);

  // 循环任务：如果同组有更新的副本，拒绝 undo
  if (it.recurrence_group_id) {
    const newerInstance = data.items.find((x) =>
      x.recurrence_group_id === it.recurrence_group_id &&
      x.id > it.id &&
      !x.deleted
    );
    if (newerInstance) {
      fail(`${num} 已有更新的副本 ${getHierarchicalNum(data, newerInstance)}，请操作该副本`);
    }
  }

  if (childrenOf(data, it.id).length > 0) fail(`${num} 有子任务，请在其子任务上操作`);
  it.done = false;
  save(data);
  console.log(`↩ ${num} ${it.title} 已恢复为未完成。`);
}

function cmdEdit(argv) {
  const data = load();
  const rawId = argv._[0];
  const it = resolveId(data, rawId);
  if (!it) fail(`${rawId} 不存在`);
  const num = getHierarchicalNum(data, it);

  // 处理 --repeat 修改/取消
  if (argv.repeat !== undefined) {
    if (argv.repeat === 'off') {
      it.recurrence = null;
      // 保留 group_id 供历史关联
      console.log(`  🔁 ${num} 已取消循环。`);
    } else if (['daily', 'weekly', 'monthly'].includes(argv.repeat)) {
      const everyVal = parseEvery(argv.every, argv.repeat);
      if (argv.repeat === 'weekly') {
        if (!everyVal) fail('--repeat weekly 需要 --every 指定周几');
        it.recurrence = { type: 'weekly', day: everyVal };
      } else if (argv.repeat === 'monthly') {
        if (!everyVal) fail('--repeat monthly 需要 --every 指定日期（1-31）');
        it.recurrence = { type: 'monthly', date: everyVal };
      } else {
        it.recurrence = { type: 'daily' };
      }
      // 确保有 group_id
      if (!it.recurrence_group_id) it.recurrence_group_id = generateGroupId();
      console.log(`  🔁 ${num} 已设为 ${recurrenceStr(it.recurrence)}。`);
    } else {
      fail('--repeat 参数必须为 daily / weekly / monthly / off');
    }
  }

  if (argv.title) {
    it.title = argv.title;
    console.log(`✏️ ${num} 已修改为：${it.title}`);
  }
  save(data);
}

function cmdPrio(argv) {
  const data = load();
  const rawId = argv._[0];
  const it = resolveId(data, rawId);
  if (!it) fail(`${rawId} 不存在`);
  const val = argv._[1];
  if (!['高', '中', '低', '无'].includes(val)) fail('优先级须为：高 / 中 / 低 / 无');
  it.priority = val === '无' ? null : val;
  save(data);
  const num = getHierarchicalNum(data, it);
  console.log(`🎯 已设置 ${num} 优先级：${it.priority || '无'}`);
}

function cmdDue(argv) {
  const data = load();
  const rawId = argv._[0];
  const it = resolveId(data, rawId);
  if (!it) fail(`${rawId} 不存在`);
  const val = argv._[1];
  if (!val) fail('截止日期须为 YYYY-MM-DD 或 无');
  it.due_date = val === '无' ? null : val;
  save(data);
  const num = getHierarchicalNum(data, it);
  console.log(`📅 已设置 ${num} 截止：${it.due_date || '无'}`);
}

// 删除：级联软删除（标记 deleted）
function collectSubtreeIds(data, id, acc) {
  acc.push(id);
  for (const k of childrenOf(data, id)) collectSubtreeIds(data, k.id, acc);
  return acc;
}

function cmdBatchAdd(argv) {
  const data = load();
  const parentId = argv.parent ? Number(argv.parent) : null;
  const titles = argv.titles || [];
  if (titles.length === 0) {
    fail('缺少标题，用法：todo.js batch-add --title "标题1" --title "标题2" [--parent 父id]');
  }
  const parent = parentId !== null ? find(data, parentId) : null;
  if (parentId !== null) {
    if (!parent) fail(`父任务 ${getHierarchicalNum(data, parent) || '#' + parentId} 不存在`);
    if (parent.deleted) fail(`父任务 ${getHierarchicalNum(data, parent)} 在回收站中`);
  }
  for (const title of titles) {
    const item = makeItem(data, title, parentId, argv.priority, argv.due);
    data.items.push(item);
    console.log(`  ✅ ${getHierarchicalNum(data, item)}：${item.title}` + (parentId !== null ? `（挂在 ${getHierarchicalNum(data, parent)} 下）` : ''));
  }
  save(data);
  if (parentId !== null) {
    const parentNum = getHierarchicalNum(data, parent);
    const { total, doneCount } = progress(data, parent);
    console.log(`  父任务 ${parentNum} 进度：${doneCount}/${total}`);
  }
}

function cmdDel(argv) {
  const data = load();
  const rawId = argv._[0];
  const it = resolveId(data, rawId, true);
  if (!it) fail(`${rawId} 不存在`);
  const num = getHierarchicalNum(data, it);
  if (it.deleted) fail(`${num} 已在回收站`);
  const ids = collectSubtreeIds(data, it.id, []);
  for (const i of ids) {
    const x = find(data, i);
    if (x) { x.deleted = true; x.deleted_at = now(); }
  }
  save(data);
  console.log(`🗑 已移入回收站：${num} 及其 ${ids.length - 1} 个子任务。用 ta#还原${num} 可恢复，或 ta#清空回收站 彻底删除。`);
}

function cmdTrash(argv) {
  const data = load();
  const trash = data.items.filter((i) => i.deleted);
  if (trash.length === 0) {
    console.log('♻ 回收站为空。');
    return;
  }
  const out = [];
  for (const it of trash) {
    const prefix = it.parent_id ? '  ↳ ' : '';
    const num = getHierarchicalNum(data, it);
    out.push(`${prefix}${num}（#${it.id}） ${it.title}（删于 ${it.deleted_at ? it.deleted_at.slice(0, 10) : '?'}）`);
  }
  console.log('♻ 回收站：');
  console.log(out.join('\n'));
  console.log('\n用 ta#还原 <序号> 恢复（如 ta#还原 4.1 或 ta#还原 17），ta#清空回收站 彻底删除。');
}

function cmdRestore(argv) {
  const data = load();
  const rawId = argv._[0];
  const it = resolveId(data, rawId, true);
  if (!it) fail(`${rawId} 不存在`);
  const ids = collectSubtreeIds(data, it.id, []);
  for (const i of ids) {
    const x = find(data, i);
    if (x && x.deleted) x.deleted = false;
  }
  const num = getHierarchicalNum(data, it);
  save(data);
  console.log(`♻ 已还原：${num} 及其子任务。`);
}

function cmdEmptyTrash(argv) {
  const data = load();
  const before = data.items.filter((i) => i.deleted).length;
  data.items = data.items.filter((i) => !i.deleted);
  save(data);
  console.log(`🧹 已清空回收站，彻底删除 ${before} 条。`);
}

// ---------- 入口 ----------
function parseArgs(args) {
  const argv = { _: [], titles: [] };
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '--title') { argv.titles.push(args[++i]); }
    else if (a === '--parent') { argv.parent = args[++i]; }
    else if (a === '--priority') { argv.priority = args[++i]; }
    else if (a === '--due') { argv.due = args[++i]; }
    else if (a === '--sort') { argv.sort = args[++i]; }
    else if (a === '--repeat') { argv.repeat = args[++i]; }
    else if (a === '--every') { argv.every = args[++i]; }
    else if (a.startsWith('-')) { /* ignore unknown flag */ }
    else argv._.push(a);
  }
  // 向后兼容：单条 add 命令的 --title 写入 argv.title
  if (argv.titles.length > 0) argv.title = argv.titles[0];
  return argv;
}

const cmd = process.argv[2];
const argv = parseArgs(process.argv.slice(3));

// 首次使用（数据文件尚不存在）且非帮助命令 → 提示将自动创建
if (!fs.existsSync(DATA_FILE) && !['help', '-h', '--help'].includes(cmd)) {
  console.log('✨ 首次使用：将自动创建数据文件 ~/.todo/todo.json。');
}

switch (cmd) {
  case 'add': cmdAdd(argv); break;
  case 'batch-add': cmdBatchAdd(argv); break;
  case 'list': cmdList(argv); break;
  case 'show': cmdShow(argv); break;
  case 'done': cmdDone(argv); break;
  case 'batch-done': cmdBatchDone(argv); break;
  case 'undo': cmdUndo(argv); break;
  case 'edit': cmdEdit(argv); break;
  case 'prio': cmdPrio(argv); break;
  case 'due': cmdDue(argv); break;
  case 'del': cmdDel(argv); break;
  case 'trash': cmdTrash(argv); break;
  case 'restore': cmdRestore(argv); break;
  case 'empty-trash': cmdEmptyTrash(argv); break;
  case 'help': case '-h': case '--help': printHelp(); break;
  default: printHelp(cmd);
}

// 完整帮助（含示例）
function printHelp(unknown) {
  if (unknown) console.log(`[todo] 未知命令：${unknown}`);
  console.log(`todo-list 待办工具 — 数据保存在 ~/.todo/todo.json

用法示例：
  node todo.js help                      查看本帮助
  node todo.js add --title "写周报" --priority 高 --due 2026-03-01
  node todo.js add --parent 1 --title "整理大纲"          在 #1 下建子任务
  node todo.js batch-add --parent 1 --title "任务A" --title "任务B" --title "任务C"
                                                                       一次批量创建多个子任务（推荐）
  node todo.js list [--sort priority|due|id]
  node todo.js show 1                     查看 #1 及其子任务
  node todo.js done 4.1                   完成子任务（支持层级序号）
  node todo.js batch-done 4.1 4.2 4.3     批量完成（推荐）
  node todo.js undo 4.1                   取消完成 #4.1
  node todo.js edit 1 --title "新标题"
  node todo.js prio 2 中                   设置 #2 优先级
  node todo.js due 2 2026-03-01           设置 #2 截止日期
  node todo.js del 2                      软删除 #2 入回收站
  node todo.js trash                      查看回收站
  node todo.js restore 2                  从回收站还原 #2
  node todo.js empty-trash                彻底清空回收站

循环任务（新增）：
  node todo.js add --title "写日报" --repeat daily                          每日任务
  node todo.js add --title "写周报" --repeat weekly --every 周一              每周一
  node todo.js add --title "还信用卡" --repeat monthly --every 15             每月15号
  node todo.js add --title "晨会" --repeat weekly --every 周一 --due 2026-03-16  指定起始日期
  node todo.js edit 1 --repeat daily                                        改为每日循环
  node todo.js edit 1 --repeat weekly --every 周三                          改为每周三
  node todo.js edit 1 --repeat off                                          取消循环

参数：
  --title "标题"      标题（必填）
  --parent <id>       父任务 id，创建子任务用
  --priority 高|中|低   优先级
  --due YYYY-MM-DD    截止日期
  --repeat daily|weekly|monthly|off  循环类型（配合 --every 使用）
  --every 周几|几号       每周指定 周一~周日，每月指定 1-31`);
  process.exit(unknown ? 1 : 0);
}