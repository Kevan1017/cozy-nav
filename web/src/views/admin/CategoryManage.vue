<script setup>
/**
 * 分类管理页（Naive UI 版本）
 * - PC 端：n-data-table（组件内部分格对齐，永不跑偏）
 * - 移动端：n-list 列表 + n-card 装饰
 * - 弹窗：n-modal + n-form（自带层级、ESC、遮罩）
 * - Emoji 选择面板：n-popover（自带定位、点击外部自动关闭）
 * - 表单校验、删除确认均走 Naive 的组件 API
 * - 回收站 已拆分为独立子组件：CategoryTrashTable（恢复/彻底删除/批量操作）
 */
import { ref, onMounted, h, computed, nextTick, watch } from 'vue';
import { useDataStore } from '../../stores/data.js';
import { useResponsive } from '../../composables/useResponsive.js';
import { usePagination } from '../../composables/usePagination.js';
import { useBatchOps } from '../../composables/useBatchOps.js';
import { BG_COLORS, pickRandom, resolveColor, displayHex } from '../../composables/useColor.js';
import { renderEmoji } from '../../composables/useRenderCell.js';
import { vaultApi } from '../../api/vault.js';
import { categoryApi } from '../../api/category.js';
import {
  NPageHeader,
  NButton,
  NDataTable,
  NCard,
  NModal,
  NForm,
  NFormItem,
  NInput,
  NInputNumber,
  NPopover,
  NTag,
  NSpace,
  NEmpty,
  NCheckbox,
  useDialog,
  useMessage,
} from 'naive-ui';
import CategoryTrashTable from '../../components/admin/categorymanage/CategoryTrashTable.vue';

const dataStore = useDataStore();
const { isMobileView } = useResponsive();
const dialog = useDialog();
const message = useMessage();

/* ---------- 常量：Emoji 与 tokens.css 对齐 ---------- */

const EMOJI_LIST = [
  /* ---------- 表情 / 手势 ---------- */
  { e: '😀', n: '大笑' }, { e: '😄', n: '开心' }, { e: '😆', n: '咧嘴笑' }, { e: '😊', n: '微笑' },
  { e: '🥰', n: '喜爱' }, { e: '😍', n: '花痴' }, { e: '🤩', n: '星星眼' }, { e: '🤔', n: '思考' },
  { e: '😎', n: '墨镜' }, { e: '🤓', n: '书呆子' }, { e: '😴', n: '睡觉' }, { e: '🤗', n: '拥抱' },
  { e: '🤭', n: '捂嘴笑' }, { e: '🤫', n: '噤声' }, { e: '😇', n: '天使' }, { e: '🥳', n: '庆祝' },
  { e: '👋', n: '挥手' }, { e: '👍', n: '点赞' }, { e: '👏', n: '鼓掌' }, { e: '🙌', n: '欢呼' },
  { e: '🤝', n: '握手' }, { e: '💪', n: '加油' }, { e: '✌️', n: '胜利' }, { e: '🤞', n: '好运' },
  /* ---------- 动物 ---------- */
  { e: '🐱', n: '猫' }, { e: '🐶', n: '狗' }, { e: '🐼', n: '熊猫' }, { e: '🐸', n: '青蛙' },
  { e: '🐰', n: '兔子' }, { e: '🦊', n: '狐狸' }, { e: '🐻', n: '熊' }, { e: '🐨', n: '考拉' },
  { e: '🐯', n: '老虎' }, { e: '🦁', n: '狮子' }, { e: '🐮', n: '奶牛' }, { e: '🐷', n: '猪' },
  { e: '🐵', n: '猴子' }, { e: '🐔', n: '鸡' }, { e: '🐧', n: '企鹅' }, { e: '🐦', n: '鸟' },
  { e: '🦆', n: '鸭子' }, { e: '🦅', n: '鹰' }, { e: '🦉', n: '猫头鹰' }, { e: '🐺', n: '狼' },
  { e: '🐴', n: '马' }, { e: '🦄', n: '独角兽' }, { e: '🐝', n: '蜜蜂' }, { e: '🐛', n: '毛虫' },
  { e: '🦋', n: '蝴蝶' }, { e: '🐌', n: '蜗牛' }, { e: '🐞', n: '瓢虫' }, { e: '🦕', n: '恐龙' },
  { e: '🦖', n: '霸王龙' }, { e: '🐢', n: '乌龟' }, { e: '🐍', n: '蛇' }, { e: '🐙', n: '章鱼' },
  { e: '🦑', n: '鱿鱼' }, { e: '🐠', n: '热带鱼' }, { e: '🐟', n: '鱼' }, { e: '🐬', n: '海豚' },
  { e: '🐳', n: '鲸鱼' }, { e: '🦈', n: '鲨鱼' }, { e: '🦭', n: '海豹' }, { e: '🐊', n: '鳄鱼' },
  /* ---------- 植物 / 自然 ---------- */
  { e: '🌱', n: '幼苗' }, { e: '🌿', n: '绿植' }, { e: '🍀', n: '四叶草' }, { e: '🌵', n: '仙人掌' },
  { e: '🌲', n: '松树' }, { e: '🌳', n: '大树' }, { e: '🌴', n: '棕榈树' }, { e: '🍁', n: '枫叶' },
  { e: '🍂', n: '落叶' }, { e: '🌸', n: '樱花' }, { e: '🌺', n: '芙蓉' }, { e: '🌻', n: '向日葵' },
  { e: '🌹', n: '玫瑰' }, { e: '🥀', n: '枯花' }, { e: '🌷', n: '郁金香' }, { e: '🪴', n: '盆栽' },
  { e: '☀️', n: '太阳' }, { e: '🌞', n: '太阳脸' }, { e: '🌙', n: '月亮' }, { e: '⭐', n: '星星' },
  { e: '🌟', n: '闪耀星' }, { e: '✨', n: '闪光' }, { e: '☁️', n: '白云' }, { e: '🌈', n: '彩虹' },
  { e: '🌤️', n: '晴间多云' }, { e: '⛅', n: '多云' }, { e: '🌧️', n: '下雨' }, { e: '⛈️', n: '雷雨' },
  { e: '🌩️', n: '雷电' }, { e: '❄️', n: '雪花' }, { e: '☃️', n: '雪人' }, { e: '🌪️', n: '龙卷风' },
  { e: '🌊', n: '海浪' }, { e: '💧', n: '水滴' }, { e: '🔥', n: '火焰' }, { e: '⚡', n: '闪电' },
  { e: '💨', n: '疾风' }, { e: '☂️', n: '雨伞' }, { e: '🌋', n: '火山' }, { e: '🏔️', n: '雪山' },
  { e: '⛰️', n: '山' }, { e: '🗻', n: '富士山' }, { e: '🏝️', n: '海岛' }, { e: '🏜️', n: '沙漠' },
  { e: '🌍', n: '地球' }, { e: '🌎', n: '地球美洲' }, { e: '🌏', n: '地球亚洲' }, { e: '🌌', n: '星空' },
  { e: '🌠', n: '流星' }, { e: '🌅', n: '日出' }, { e: '🌄', n: '山间日出' }, { e: '🪐', n: '土星' },
  { e: '☄️', n: '彗星' }, { e: '🔭', n: '望远镜' }, { e: '🛰️', n: '卫星' },
  /* ---------- 食物 / 饮品 ---------- */
  { e: '🍎', n: '苹果' }, { e: '🍐', n: '梨' }, { e: '🍊', n: '橙子' }, { e: '🍋', n: '柠檬' },
  { e: '🍌', n: '香蕉' }, { e: '🍉', n: '西瓜' }, { e: '🍇', n: '葡萄' }, { e: '🍓', n: '草莓' },
  { e: '🍒', n: '樱桃' }, { e: '🍑', n: '桃子' }, { e: '🥭', n: '芒果' }, { e: '🍍', n: '菠萝' },
  { e: '🥥', n: '椰子' }, { e: '🥝', n: '猕猴桃' }, { e: '🍅', n: '番茄' }, { e: '🥑', n: '牛油果' },
  { e: '🥦', n: '西兰花' }, { e: '🥬', n: '青菜' }, { e: '🥒', n: '黄瓜' }, { e: '🌽', n: '玉米' },
  { e: '🥕', n: '胡萝卜' }, { e: '🥔', n: '土豆' }, { e: '🍠', n: '红薯' }, { e: '🧄', n: '大蒜' },
  { e: '🧅', n: '洋葱' }, { e: '🍞', n: '面包' }, { e: '🥖', n: '法棍' }, { e: '🥨', n: '椒盐饼' },
  { e: '🧀', n: '奶酪' }, { e: '🥚', n: '鸡蛋' }, { e: '🍳', n: '煎蛋' }, { e: '🥞', n: '松饼' },
  { e: '🥓', n: '培根' }, { e: '🥩', n: '牛排' }, { e: '🍗', n: '鸡腿' }, { e: '🍖', n: '排骨' },
  { e: '🌭', n: '热狗' }, { e: '🍔', n: '汉堡' }, { e: '🍟', n: '薯条' }, { e: '🍕', n: '披萨' },
  { e: '🥪', n: '三明治' }, { e: '🌮', n: '塔可' }, { e: '🌯', n: '卷饼' }, { e: '🥗', n: '沙拉' },
  { e: '🍿', n: '爆米花' }, { e: '🥫', n: '罐头' }, { e: '🍝', n: '意面' }, { e: '🍜', n: '拉面' },
  { e: '🍲', n: '火锅' }, { e: '🍛', n: '咖喱饭' }, { e: '🍣', n: '寿司' }, { e: '🍱', n: '便当' },
  { e: '🥟', n: '饺子' }, { e: '🍤', n: '炸虾' }, { e: '🍙', n: '饭团' }, { e: '🍚', n: '米饭' },
  { e: '🍧', n: '刨冰' }, { e: '🍨', n: '冰淇淋' }, { e: '🍦', n: '甜筒' }, { e: '🧁', n: '纸杯蛋糕' },
  { e: '🍰', n: '蛋糕' }, { e: '🎂', n: '生日蛋糕' }, { e: '🍮', n: '布丁' }, { e: '🍭', n: '棒棒糖' },
  { e: '🍬', n: '糖果' }, { e: '🍫', n: '巧克力' }, { e: '🍪', n: '曲奇' }, { e: '🍩', n: '甜甜圈' },
  { e: '🍯', n: '蜂蜜' }, { e: '🧃', n: '果汁' }, { e: '🥤', n: '冷饮' }, { e: '🧋', n: '珍珠奶茶' },
  { e: '☕', n: '咖啡' }, { e: '🍵', n: '茶' }, { e: '🍺', n: '啤酒' }, { e: '🍻', n: '干杯' },
  { e: '🥂', n: '碰杯' }, { e: '🍷', n: '红酒' }, { e: '🥃', n: '威士忌' }, { e: '🍹', n: '鸡尾酒' },
  /* ---------- 物品 / 生活 ---------- */
  { e: '🖼️', n: '相框' }, { e: '📷', n: '相机' }, { e: '🎨', n: '调色板' }, { e: '🖌️', n: '画笔' },
  { e: '✏️', n: '铅笔' }, { e: '🖊️', n: '钢笔' }, { e: '📝', n: '便签' }, { e: '📎', n: '回形针' },
  { e: '📚', n: '书籍' }, { e: '📖', n: '打开的书' }, { e: '📒', n: '笔记本' }, { e: '📓', n: '日记本' },
  { e: '📔', n: '皮面笔记本' }, { e: '🗂️', n: '档案夹' }, { e: '📁', n: '文件夹' },
  { e: '📂', n: '打开文件夹' }, { e: '🗃️', n: '卡片盒' }, { e: '📊', n: '图表' }, { e: '📈', n: '上升' },
  { e: '📉', n: '下降' }, { e: '📋', n: '剪贴板' }, { e: '📅', n: '日历' }, { e: '📆', n: '翻页日历' },
  { e: '📌', n: '图钉' }, { e: '🔔', n: '铃铛' }, { e: '💬', n: '气泡' }, { e: '💭', n: '思考' },
  { e: '💡', n: '灯泡' }, { e: '🔦', n: '手电筒' }, { e: '🔑', n: '钥匙' }, { e: '🗝️', n: '旧钥匙' },
  { e: '🔒', n: '上锁' }, { e: '🔓', n: '开锁' }, { e: '🔐', n: '密码锁' }, { e: '🔏', n: '保密' },
  { e: '🛡️', n: '盾牌' }, { e: '⚔️', n: '交叉剑' }, { e: '🏹', n: '弓箭' }, { e: '🔮', n: '水晶球' },
  { e: '⚙️', n: '齿轮' }, { e: '🔧', n: '扳手' }, { e: '🔨', n: '锤子' }, { e: '🪛', n: '螺丝刀' },
  { e: '🪚', n: '锯子' }, { e: '🔩', n: '螺丝' }, { e: '🧰', n: '工具箱' }, { e: '🛠️', n: '工具' },
  { e: '🧲', n: '磁铁' }, { e: '🔬', n: '显微镜' }, { e: '🧪', n: '试管' }, { e: '🧫', n: '培养皿' },
  { e: '🧬', n: '基因' }, { e: '💉', n: '注射器' }, { e: '💊', n: '药丸' }, { e: '🩺', n: '听诊器' },
  { e: '📦', n: '包裹' }, { e: '📫', n: '信箱' }, { e: '📮', n: '投递信箱' }, { e: '🛒', n: '购物车' },
  { e: '🛍️', n: '购物袋' }, { e: '💎', n: '宝石' }, { e: '💰', n: '钱袋' }, { e: '💳', n: '银行卡' },
  { e: '⏰', n: '闹钟' }, { e: '⌛', n: '沙漏' }, { e: '⏳', n: '计时沙漏' }, { e: '🕰️', n: '座钟' },
  { e: '📱', n: '手机' }, { e: '💻', n: '笔记本' }, { e: '🖥️', n: '台式机' }, { e: '⌨️', n: '键盘' },
  { e: '🖱️', n: '鼠标' }, { e: '🖨️', n: '打印机' }, { e: '💽', n: '光盘' }, { e: '💾', n: '软盘' },
  { e: '💿', n: 'CD' }, { e: '📀', n: 'DVD' }, { e: '🎧', n: '耳机' }, { e: '🎤', n: '麦克风' },
  { e: '🎸', n: '吉他' }, { e: '🎹', n: '钢琴' }, { e: '🥁', n: '鼓' }, { e: '🎻', n: '小提琴' },
  { e: '🎺', n: '小号' }, { e: '🎷', n: '萨克斯' }, { e: '🎮', n: '游戏机' }, { e: '🕹️', n: '摇杆' },
  { e: '🎲', n: '骰子' }, { e: '🧩', n: '拼图' }, { e: '♟️', n: '国际象棋' }, { e: '🎯', n: '靶心' },
  { e: '🎳', n: '保龄球' }, { e: '🎬', n: '拍板' }, { e: '🎭', n: '戏剧面具' }, { e: '🎪', n: '马戏团' },
  { e: '🎡', n: '摩天轮' }, { e: '🎢', n: '过山车' }, { e: '🎠', n: '旋转木马' }, { e: '🎆', n: '烟花' },
  { e: '🎇', n: '烟花棒' }, { e: '🎉', n: '庆祝彩带' }, { e: '🎊', n: '彩球' }, { e: '🎁', n: '礼物' },
  { e: '🎈', n: '气球' }, { e: '🎀', n: '蝴蝶结' }, { e: '🧸', n: '泰迪熊' }, { e: '🎓', n: '毕业帽' },
  { e: '🎒', n: '书包' }, { e: '👑', n: '皇冠' }, { e: '🧢', n: '帽子' }, { e: '🥽', n: '护目镜' },
  /* ---------- 旅行 / 交通 ---------- */
  { e: '🚀', n: '火箭' }, { e: '✈️', n: '飞机' }, { e: '🛫', n: '起飞' }, { e: '🛬', n: '降落' },
  { e: '🛸', n: 'UFO' }, { e: '🛩️', n: '小飞机' }, { e: '🚁', n: '直升机' }, { e: '⛵', n: '帆船' },
  { e: '🚢', n: '轮船' }, { e: '🛳️', n: '邮轮' }, { e: '🚤', n: '快艇' }, { e: '🛶', n: '独木舟' },
  { e: '🚂', n: '火车头' }, { e: '🚃', n: '轻轨' }, { e: '🚄', n: '高铁' }, { e: '🚅', n: '子弹头列车' },
  { e: '🚆', n: '火车' }, { e: '🚇', n: '地铁' }, { e: '🚈', n: '单轨电车' }, { e: '🚉', n: '车站' },
  { e: '🚊', n: '电车' }, { e: '🚝', n: '单轨列车' }, { e: '🚞', n: '山间铁路' }, { e: '🚋', n: '有轨电车' },
  { e: '🚌', n: '公交' }, { e: '🚍', n: '迎面公交' }, { e: '🚎', n: '无轨电车' }, { e: '🚐', n: '面包车' },
  { e: '🚑', n: '救护车' }, { e: '🚒', n: '消防车' }, { e: '🚓', n: '警车' }, { e: '🚕', n: '出租车' },
  { e: '🚖', n: '出租车驶来' }, { e: '🚗', n: '汽车' }, { e: '🚘', n: '汽车驶来' }, { e: '🚙', n: '越野车' },
  { e: '🚚', n: '卡车' }, { e: '🚛', n: '货车' }, { e: '🚜', n: '拖拉机' }, { e: '🚲', n: '自行车' },
  { e: '🛵', n: '摩托车' }, { e: '🏍️', n: '赛车摩托' }, { e: '🛴', n: '滑板车' }, { e: '🛺', n: '三轮车' },
  { e: '🏎️', n: '赛车' }, { e: '🚦', n: '红绿灯' }, { e: '🚥', n: '交通灯' },
  { e: '🚧', n: '施工' }, { e: '⛽', n: '加油站' }, { e: '🛑', n: '停止' }, { e: '🚨', n: '警灯' },
  { e: '🅿️', n: '停车' }, { e: '🗺️', n: '地图' }, { e: '🧭', n: '指南针' }, { e: '🧳', n: '行李箱' },
  { e: '⛺', n: '帐篷' }, { e: '🏕️', n: '露营' }, { e: '🏠', n: '房子' }, { e: '🏡', n: '家园' },
  { e: '🏢', n: '办公楼' }, { e: '🏫', n: '学校' }, { e: '🏥', n: '医院' }, { e: '🏦', n: '银行' },
  { e: '🏪', n: '便利店' }, { e: '🏬', n: '商场' }, { e: '🏰', n: '城堡' }, { e: '🏯', n: '日式城堡' },
  { e: '🏛️', n: '古典建筑' }, { e: '🗽', n: '自由女神' }, { e: '🗼', n: '铁塔' }, { e: '🌉', n: '大桥' },
  /* ---------- 运动 / 活动 ---------- */
  { e: '⚽', n: '足球' }, { e: '🏀', n: '篮球' }, { e: '🏈', n: '橄榄球' }, { e: '⚾', n: '棒球' },
  { e: '🎾', n: '网球' }, { e: '🏐', n: '排球' }, { e: '🏉', n: '英式橄榄球' }, { e: '🥏', n: '飞盘' },
  { e: '🎱', n: '台球' }, { e: '🏓', n: '乒乓球' }, { e: '🏸', n: '羽毛球' }, { e: '🏒', n: '冰球' },
  { e: '🏑', n: '曲棍球' }, { e: '🥍', n: '长曲棍球' }, { e: '🏏', n: '板球' }, { e: '⛳', n: '高尔夫' },
  { e: '🏌️', n: '高尔夫球员' }, { e: '⛸️', n: '滑冰' }, { e: '🥌', n: '冰壶' }, { e: '🎿', n: '滑雪' },
  { e: '⛷️', n: '滑雪者' }, { e: '🏂', n: '单板滑雪' }, { e: '🏄', n: '冲浪' }, { e: '🏊', n: '游泳' },
  { e: '🚣', n: '划船' }, { e: '🚴', n: '骑行' }, { e: '🚵', n: '山地骑行' }, { e: '🏇', n: '赛马' },
  { e: '🧗', n: '攀岩' }, { e: '🤸', n: '体操' }, { e: '🏋️', n: '举重' }, { e: '🤼', n: '摔跤' },
  { e: '🤺', n: '击剑' }, { e: '🥇', n: '金牌' }, { e: '🥈', n: '银牌' }, { e: '🥉', n: '铜牌' },
  { e: '🏆', n: '奖杯' }, { e: '🏅', n: '奖牌' }, { e: '🎖️', n: '勋章' }, { e: '🪂', n: '跳伞' },
  /* ---------- 符号 / 其他 ---------- */
  { e: '❤️', n: '红心' }, { e: '🧡', n: '橙心' }, { e: '💛', n: '黄心' }, { e: '💚', n: '绿心' },
  { e: '💙', n: '蓝心' }, { e: '💜', n: '紫心' }, { e: '🖤', n: '黑心' }, { e: '🤍', n: '白心' },
  { e: '💕', n: '双心' }, { e: '💞', n: '旋转的心' }, { e: '💓', n: '心跳' }, { e: '💗', n: '成长的心' },
  { e: '💖', n: '闪闪心' }, { e: '💘', n: '爱心箭' }, { e: '💝', n: '礼物心' }, { e: '💟', n: '心形装饰' },
  { e: '☮️', n: '和平' }, { e: '☯️', n: '太极' }, { e: '♈', n: '白羊座' }, { e: '♉', n: '金牛座' },
  { e: '♊', n: '双子座' }, { e: '♋', n: '巨蟹座' }, { e: '♌', n: '狮子座' }, { e: '♍', n: '处女座' },
  { e: '♎', n: '天秤座' }, { e: '♏', n: '天蝎座' }, { e: '♐', n: '射手座' }, { e: '♑', n: '摩羯座' },
  { e: '♒', n: '水瓶座' }, { e: '♓', n: '双鱼座' }, { e: '🆗', n: 'OK' }, { e: '🆒', n: '酷' },
  { e: '🆕', n: '新' }, { e: '🆙', n: '升级' }, { e: '🆓', n: '免费' }, { e: '🆖', n: 'NG' },
  { e: '🅰️', n: 'A' }, { e: '🅱️', n: 'B' }, { e: '⭕', n: '圆圈' }, { e: '❌', n: '叉号' },
  { e: '✅', n: '勾选' }, { e: '✔️', n: '对勾' }, { e: '🔴', n: '红圆' }, { e: '🟠', n: '橙圆' },
  { e: '🟡', n: '黄圆' }, { e: '🟢', n: '绿圆' }, { e: '🔵', n: '蓝圆' }, { e: '🟣', n: '紫圆' },
  { e: '🟤', n: '棕圆' }, { e: '⚫', n: '黑圆' }, { e: '⚪', n: '白圆' }, { e: '🔺', n: '红三角' },
  { e: '🔻', n: '红倒三角' }, { e: '⬛', n: '黑方块' }, { e: '⬜', n: '白方块' }, { e: '🏳️', n: '白旗' },
  /* ---------- 导航常用 ---------- */
  { e: '🔍', n: '搜索' }, { e: '🔖', n: '书签' }, { e: '💼', n: '公文包' }, { e: '🎵', n: '音符' },
  { e: '🎥', n: '摄像机' }, { e: '📺', n: '电视' }, { e: '📰', n: '报纸' }, { e: '🗞️', n: '新闻' },
  { e: '🤖', n: '机器人' }, { e: '🧠', n: '大脑' }, { e: '👥', n: '群组' }, { e: '📢', n: '广播' },
  { e: '🧘', n: '冥想' }, { e: '⚖️', n: '天平' }, { e: '🍽️', n: '餐具' }, { e: '📡', n: '天线' },
];

/* ---------- 弹窗 & 表单 ---------- */

const modalShow = ref(false);
const modalMode = ref('create'); // 'create' | 'edit'
const submitting = ref(false);
const formRef = ref(null);
const { pagination, syncItemCount, onPageSizeChange, onPageChange } = usePagination();

watch(
  () => dataStore.categories.length,
  (len) => syncItemCount(len),
  { immediate: true }
);
const form = ref({
  id: null,
  name: '',
  subtitle: '',
  emoji: '🧭',
  bg_color: 'peach',
  sort_order: 0,
});

const rules = {
  name: { required: true, message: '请输入分类名称', trigger: ['input', 'submit'] },
  // 排序权重允许留空（留空 = 后端自动排末尾），仅输入数字时校验 ≥ 0
  sort_order: {
    validator: (_rule, value) => value === null || value === undefined || value === '' || (typeof value === 'number' && value >= 0),
    message: '排序权重需 ≥ 0',
    trigger: ['input', 'submit'],
  },
};

function resetFormFixed() {
  form.value = { id: null, name: '', subtitle: '', emoji: '🧭', bg_color: 'peach', sort_order: null };
}

function openCreate() {
  resetFormFixed();
  modalMode.value = 'create';
  modalShow.value = true;
  nextTick(() => formRef.value?.restoreValidation());
}

function openEdit(cat) {
  form.value = { ...cat };
  modalMode.value = 'edit';
  modalShow.value = true;
  nextTick(() => formRef.value?.restoreValidation());
}

/** Emoji 搜索关键词 */
const emojiKeyword = ref('');

/** 已渲染的 emoji 数量：懒加载，避免一次性渲染 486 个 DOM 导致弹窗打开卡顿 */
const emojiRenderCount = ref(128);
/** 每次滚动追加的 emoji 数量 */
const EMOJI_PAGE = 64;

/** 过滤后的 emoji 列表：按中文名或 emoji 本身匹配（小写不区分） */
const filteredEmojis = computed(() => {
  const kw = emojiKeyword.value.trim().toLowerCase();
  if (!kw) return EMOJI_LIST;
  return EMOJI_LIST.filter((item) => item.n.toLowerCase().includes(kw) || item.e.includes(kw));
});

/** 实际渲染的 emoji（懒加载切片，滚动加载更多） */
const visibleEmojis = computed(() => filteredEmojis.value.slice(0, emojiRenderCount.value));

/** 网格滚动到底部时追加更多 emoji */
function onEmojiScroll(e) {
  const el = e.target;
  if (el.scrollTop + el.clientHeight >= el.scrollHeight - 10) {
    emojiRenderCount.value = Math.min(emojiRenderCount.value + EMOJI_PAGE, filteredEmojis.value.length);
  }
}

/** 搜索关键词变化时重置渲染数量，避免残留过多已渲染项 */
watch(emojiKeyword, () => {
  emojiRenderCount.value = 128;
});

function randomEmoji() { form.value.emoji = pickRandom(EMOJI_LIST).e; }
function randomBg() { form.value.bg_color = pickRandom(BG_COLORS); }

async function saveCategory() {
  try {
    await formRef.value?.validate();
  } catch {
    message.warning('请检查表单填写是否正确');
    return;
  }
  submitting.value = true;
  try {
    const payload = {
      name: (form.value.name || '').trim(),
      subtitle: (form.value.subtitle || '').trim() || null,
      emoji: form.value.emoji || '🧭',
      bg_color: form.value.bg_color,
      sort_order: form.value.sort_order ?? null,
    };
    if (modalMode.value === 'create') {
      await dataStore.createCategory(payload);
      message.success('分类已创建');
    } else {
      await dataStore.updateCategory(form.value.id, payload);
      message.success('分类已更新');
    }
    modalShow.value = false;
  } catch (e) {
    // axios 拦截器已提示
  } finally {
    submitting.value = false;
  }
}

/* ---------- 删除（n-dialog.confirm） ---------- */

function askDelete(cat) {
  dialog.warning({
    title: '确认删除分类',
    content: `将删除分类「${cat.name}」及所有下属书签，操作不可恢复。`,
    positiveText: '确定删除',
    negativeText: '取消',
    positiveButtonProps: { type: 'error' },
    onPositiveClick: async () => {
      try {
        await dataStore.deleteCategory(cat.id);
        message.success('已删除');
      } catch { /* noop */ }
    },
  });
}

/* ---------- 上移/下移（按显示顺序全量重新编号 sort_order） ---------- */

/**
 * 将分类上移/下移一格并全量重排 sort_order
 * 说明：仅互换相邻两条的 sort_order 在值重复时（如导入数据全部为 0）无效，
 * 因此改为按新显示顺序统一重新编号（1..N），保证每个分类的 sort_order 唯一且与显示顺序一致。
 * @param {Object} cat - 目标分类
 * @param {number} delta - -1=上移，1=下移
 */
async function moveCategory(cat, delta) {
  const list = dataStore.categories;
  const idx = list.findIndex((c) => c.id === cat.id);
  const target = idx + delta;
  if (idx < 0 || target < 0 || target >= list.length) return;
  // 交换相邻两条得到新显示顺序
  const arr = [...list];
  [arr[idx], arr[target]] = [arr[target], arr[idx]];
  // 全量重新编号，保证 sort_order 唯一
  const orders = arr.map((c, i) => ({ id: c.id, sort_order: i + 1 }));
  try {
    await categoryApi.sort(orders);
    // 通过 store action 同步本地：新顺序 + 新 sort_order 值，界面即时更新
    dataStore.updateCategoriesOrder(orders);
    message.success(delta < 0 ? '已上移' : '已下移');
  } catch (err) {
    message.error(err.message || '操作失败');
  }
}

/** 上移一格 */
async function moveUp(cat) {
  await moveCategory(cat, -1);
}

/** 下移一格 */
async function moveDown(cat) {
  await moveCategory(cat, 1);
}

/* ---------- 加密/解密 ---------- */
const vaultIsEnabled = ref(false);
const vaultIsSet = ref(false);

async function handleToggleLock(cat) {
  if (!vaultIsEnabled.value) {
    message.warning('请先在网站设置中开启保险库功能');
    return;
  }
  if (!vaultIsSet.value) {
    message.warning('请先在网站设置中设置保险库密码');
    return;
  }
  const willLock = !cat.is_locked;
  try {
    await dataStore.toggleCategoryLock(cat.id, willLock);
    message.success(willLock ? '已加密' : '已解密');
  } catch (e) {
    message.warning(e.message || '操作失败');
  }
}

/* ---------- 批量删除 ---------- */
const checkedRowKeys = ref([]);
const batchDeleting = ref(false);

function askBatchDelete() {
  if (!checkedRowKeys.value.length) {
    message.warning('请先勾选要删除的分类');
    return;
  }
  const count = checkedRowKeys.value.length;
  dialog.warning({
    title: '确认批量删除',
    content: `将删除选中的 ${count} 个分类及其所有下属书签，操作不可恢复。`,
    positiveText: '确定删除',
    negativeText: '取消',
    positiveButtonProps: { type: 'error' },
    onPositiveClick: async () => {
      batchDeleting.value = true;
      try {
        for (const id of checkedRowKeys.value) {
          await dataStore.deleteCategory(id);
        }
        message.success(`已删除 ${count} 个分类`);
        checkedRowKeys.value = [];
      } catch { /* noop */ }
      finally { batchDeleting.value = false; }
    },
  });
}

/* ---------- 回收站（逻辑已拆分到 CategoryTrashTable） ---------- */
const trashMode = ref(false);

function openTrash() {
  trashMode.value = true;
}
function closeTrash() {
  trashMode.value = false;
}

/* ---------- 表格列（PC 端） ---------- */

/* Emoji 小色块渲染复用 useRenderCell.js 的 renderEmoji */

/** 渲染颜色名圆点 */
function renderColorDot(cat) {
  return h('span', { class: 'color-inline' }, [
    h('span', {
      class: 'dot',
      style: { background: resolveColor(cat.bg_color) },
    }),
    ' ',
    displayHex(cat.bg_color) || '—',
  ]);
}

const tableColumns = computed(() => {
  const cols = [
    { type: 'selection' },
    { title: 'ID', key: 'id', width: 64, align: 'center', sorter: (a, b) => a.id - b.id },
    {
      title: '排序', key: 'sort_order', width: 128, align: 'center',
      sorter: (a, b) => (a.sort_order || 0) - (b.sort_order || 0),
      render: (row) => h('div', { class: 'sort-cell' }, [
        h('span', { class: 'sort-val' }, row.sort_order ?? 0),
        h(NButton, { size: 'tiny', quaternary: true, title: '上移', onClick: () => moveUp(row) }, () => '↑'),
        h(NButton, { size: 'tiny', quaternary: true, title: '下移', onClick: () => moveDown(row) }, () => '↓'),
      ]),
    },
    {
      title: 'Emoji', key: 'emoji', width: 96, align: 'center',
      render: (row) => renderEmoji(row),
    },
    {
      title: '名称', key: 'name', ellipsis: { tooltip: true },
      sorter: (a, b) => String(a.name || '').localeCompare(String(b.name || ''), 'zh-Hans-CN'),
      render: (row) => h('strong', { style: 'color: var(--admin-text); font-weight:600' }, row.name),
    },
    {
      title: '副标题', key: 'subtitle', ellipsis: { tooltip: true },
      render: (row) => h('span', { style: 'color: var(--admin-muted)' }, row.subtitle || '—'),
    },
    {
      title: '背景色', key: 'bg_color', width: 140,
      render: (row) => renderColorDot(row),
    },
    {
      title: '书签数', key: 'linkCount', width: 100, align: 'center',
      render: (row) => h(NTag, { round: true, type: 'info', size: 'small' },
        () => row.links?.length ?? 0
      ),
    },
  ];

  // 保险库开启时才显示加密列和加密按钮
  if (vaultIsEnabled.value) {
    cols.push({
      title: '加密', key: 'is_locked', width: 90, align: 'center',
      render: (row) => h(NTag, {
        round: true, size: 'small',
        type: row.is_locked ? 'warning' : 'default',
      }, () => row.is_locked ? '🔒 已加密' : '—'),
    });
  }

  cols.push({
    title: '操作', key: 'ops', width: vaultIsEnabled.value ? 230 : 170, align: 'right',
    render: (row) => h(NSpace, { size: 6, align: 'center' }, () => {
      const btns = [];
      if (vaultIsEnabled.value) {
        btns.push(h(NButton, {
          size: 'small', quaternary: true,
          type: row.is_locked ? 'warning' : 'info',
          onClick: () => handleToggleLock(row),
        }, () => row.is_locked ? '🔓 解密' : '🔒 加密'));
      }
      btns.push(h(NButton, {
        size: 'small', type: 'primary', quaternary: true,
        onClick: () => openEdit(row),
      }, () => '编辑'));
      btns.push(h(NButton, {
        size: 'small', type: 'error', tertiary: true,
        onClick: () => askDelete(row),
      }, () => '删除'));
      return btns;
    }),
  });

  return cols;
});

/* ---------- 生命周期 ---------- */

onMounted(() => {
  if (!dataStore.categories.length) dataStore.fetchCategories();
  // 查询保险库是否已设置密码
  vaultApi.getStatus().then(res => {
    vaultIsEnabled.value = res.data.isEnabled;
    vaultIsSet.value = res.data.isSet;
  }).catch(() => {});
});
</script>

<template>
  <div class="page">
    <!-- 页头 -->
    <n-page-header
      title="分类管理"
      class="page-header"
    >
      <template #extra>
        <n-space align="center">
          <n-button v-if="trashMode" secondary @click="closeTrash">← 返回列表</n-button>
          <template v-else>
            <n-button
              v-if="!isMobileView && checkedRowKeys.length"
              type="error"
              tertiary
              :loading="batchDeleting"
              @click="askBatchDelete"
            >批量删除 ({{ checkedRowKeys.length }})</n-button>
            <n-button secondary @click="openTrash">🗑 回收站</n-button>
            <n-button type="primary" size="medium" @click="openCreate">
              <template #icon>＋</template>
              新建分类
            </n-button>
          </template>
        </n-space>
      </template>
    </n-page-header>

    <!-- ============ PC：n-data-table ============ -->
    <n-card v-if="!trashMode && !isMobileView" class="table-card" content-style="padding:0" :bordered="false">
      <n-data-table
        :columns="tableColumns"
        :data="dataStore.categories"
        :row-key="(row) => row.id"
        :checked-row-keys="checkedRowKeys"
        @update:checked-row-keys="(keys) => checkedRowKeys = keys"
        @update:page-size="onPageSizeChange"
        @update:page="onPageChange"
        :bordered="false"
        striped
        size="medium"
        :max-height="640"
        :pagination="pagination"
        :remote="false"
      >
        <template #empty>
          <n-empty description="还没有分类，点右上角「新建分类」创建一个～" />
        </template>
      </n-data-table>
    </n-card>

    <!-- ============ 移动端：n-list ============ -->
    <div v-else-if="!trashMode" class="mobile-list">
      <!-- 移动端批量操作栏 -->
      <div v-if="dataStore.categories.length" class="mob-batch-bar">
        <n-checkbox
          :checked="checkedRowKeys.length === dataStore.categories.length && dataStore.categories.length > 0"
          @update:checked="(val) => {
            checkedRowKeys = val ? dataStore.categories.map(c => c.id) : [];
          }"
        >全选</n-checkbox>
        <n-button
          v-if="checkedRowKeys.length"
          size="small"
          type="error"
          tertiary
          :loading="batchDeleting"
          @click="askBatchDelete"
        >删除选中 ({{ checkedRowKeys.length }})</n-button>
      </div>
      <template v-if="dataStore.categories.length">
        <n-card
          v-for="cat in dataStore.categories"
          :key="cat.id"
          hoverable
          class="mob-card"
        >
          <div class="mob-head">
            <span
              class="cat-emoji big"
              :style="{ '--bgc': resolveColor(cat.bg_color) }"
            >{{ cat.emoji }}</span>
            <div class="mob-titles">
              <div class="mob-name">{{ cat.name }}</div>
              <div class="mob-sub">{{ cat.subtitle || '—' }}</div>
            </div>
            <n-tag round type="info" size="small">
              {{ cat.links?.length || 0 }}
            </n-tag>
          </div>
          <div class="mob-meta">
            <span class="color-inline">
              <span class="dot" :style="{ background: resolveColor(cat.bg_color) }" />
              {{ displayHex(cat.bg_color) }}
            </span>
            <span class="mob-sort">排序 {{ cat.sort_order }}</span>
            <n-tag v-if="vaultIsEnabled && cat.is_locked" round size="small" type="warning">🔒</n-tag>
          </div>
          <div class="mob-ops">
            <n-checkbox
              :checked="checkedRowKeys.includes(cat.id)"
              @update:checked="(val) => {
                if (val) {
                  checkedRowKeys = [...checkedRowKeys, cat.id];
                } else {
                  checkedRowKeys = checkedRowKeys.filter(id => id !== cat.id);
                }
              }"
            />
            <n-button
              size="small"
              quaternary
              title="上移"
              @click="moveUp(cat)"
            >↑</n-button>
            <n-button
              size="small"
              quaternary
              title="下移"
              @click="moveDown(cat)"
            >↓</n-button>
            <n-button
              v-if="vaultIsEnabled"
              size="small"
              quaternary
              :type="cat.is_locked ? 'warning' : 'info'"
              @click="handleToggleLock(cat)"
            >{{ cat.is_locked ? '🔓' : '🔒' }}</n-button>
            <n-button size="small" type="primary" quaternary @click="openEdit(cat)">编辑</n-button>
            <n-button size="small" type="error" tertiary @click="askDelete(cat)">删除</n-button>
          </div>
        </n-card>
      </template>
      <n-empty v-else description="还没有分类～" />
    </div>

    <!-- ============ 回收站（子组件） ============ -->
    <CategoryTrashTable v-if="trashMode" @close="closeTrash" />

    <!-- ============ 新建/编辑弹窗 ============ -->
    <n-modal
      v-model:show="modalShow"
      :mask-closable="true"
      preset="card"
      :title="modalMode === 'create' ? '新建分类' : '编辑分类'"
      class="cat-modal"
      style="width: clamp(320px, 92vw, 520px);"
      :segmented="{ content: true, action: true }"
      :bordered="false"
    >
      <n-form
        ref="formRef"
        :model="form"
        :rules="rules"
        label-placement="top"
        size="medium"
        label-align="left"
        require-mark-placement="right-hanging"
      >
        <n-form-item label="名称" path="name">
          <n-input
            v-model:value="form.name"
            placeholder="如：常用直达"
            clearable
          />
        </n-form-item>

        <n-form-item label="副标题（可选）">
          <n-input
            v-model:value="form.subtitle"
            placeholder="如：最常访问的几个"
            clearable
          />
        </n-form-item>

        <n-form-item label="Emoji">
          <div class="inline-field-row">
            <n-popover
              trigger="click"
              placement="bottom-start"
              :show-arrow="false"
              overlay-style="padding: 0"
            >
              <template #trigger>
                <n-button class="emoji-trigger">
                  <span class="cur-emoji">{{ form.emoji }}</span>
                  <span class="trig-text">点击选择 Emoji</span>
                </n-button>
              </template>
              <div class="emoji-popover">
                <n-input
                  v-model:value="emojiKeyword"
                  placeholder="搜索 emoji，如：动物 / 导航"
                  size="small"
                  clearable
                  class="emoji-search"
                />
                <div v-if="visibleEmojis.length" class="emoji-grid" @scroll="onEmojiScroll">
                  <button
                    v-for="item in visibleEmojis"
                    :key="item.e"
                    type="button"
                    class="emoji-cell"
                    :class="{ on: form.emoji === item.e }"
                    :title="item.n"
                    @click="form.emoji = item.e"
                  >{{ item.e }}</button>
                  <!-- 还有更多未加载时显示加载提示，滚动到底部自动追加 -->
                  <div v-if="emojiRenderCount < filteredEmojis.length" class="emoji-loading">
                    <span class="loading-dot"></span>加载中…
                  </div>
                </div>
                <div v-else class="emoji-empty">没有找到匹配的 emoji</div>
              </div>
            </n-popover>
            <n-button size="small" quaternary class="random-btn" @click="randomEmoji">🎲 随机</n-button>
          </div>
        </n-form-item>

        <n-form-item label="背景色">
          <div class="color-field">
            <div class="color-row">
              <button
                v-for="c in BG_COLORS"
                :key="c"
                type="button"
                class="color-dot"
                :class="{ on: form.bg_color === c }"
                :style="{ background: `var(--${c})` }"
                :title="c"
                @click="form.bg_color = c"
              />
            </div>
            <div class="hex-row">
              <span class="color-preview" :style="{ background: resolveColor(form.bg_color) }" />
              <n-input
                :value="displayHex(form.bg_color)"
                placeholder="或输入 HEX 值，如 #FF5500"
                size="small"
                class="hex-input"
                @update:value="form.bg_color = $event"
              />
              <n-button size="small" quaternary @click="randomBg">🎲 随机</n-button>
            </div>
          </div>
        </n-form-item>

        <n-form-item label="排序权重" path="sort_order">
          <n-input-number
            v-model:value="form.sort_order"
            :min="0"
            placeholder="留空自动排末尾"
            style="width: 100%"
          />
        </n-form-item>
      </n-form>

      <template #footer>
        <div class="modal-footer">
          <n-button quaternary @click="modalShow = false">取消</n-button>
          <n-button
            type="primary"
            :loading="submitting"
            @click="saveCategory"
            class="save-btn"
          >
            {{ submitting ? '保存中...' : '保存' }}
          </n-button>
        </div>
      </template>
    </n-modal>
  </div>
</template>

<style scoped>
.page-header {
  margin-bottom: 20px;
}
:deep(.n-page-header__title) {
  font-family: 'Fredoka', var(--app-font, sans-serif);
  color: var(--admin-accent);
  font-size: clamp(18px, 4vw, 24px);
  white-space: nowrap;
}
:deep(.n-page-header__sub-title) {
  color: var(--admin-muted);
  font-size: 13px;
  white-space: nowrap;
}

/* 颜色点（inline 圆点 + 名） */
:deep(.color-inline) {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  font-weight: 600;
  color: var(--admin-text-2);
}
:deep(.color-inline .dot) {
  width: 14px;
  height: 14px;
  border-radius: 50%;
  display: inline-block;
  box-shadow: inset 0 0 0 1px rgba(0,0,0,.04);
}

/* ---------- 移动端卡片（其余样式由全局 styles/admin-common.css 提供） ---------- */
/* 分类卡片 meta 行保持右端对齐（与分类页原布局一致，共享表默认左对齐） */
.mob-meta {
  justify-content: space-between;
}

/* ---------- Modal 内 ---------- */
.cat-modal :deep(.n-card-header__main) {
  font-family: 'Fredoka', var(--app-font, sans-serif);
  color: var(--admin-accent);
}

.inline-field-row {
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 10px;
  width: 100%;
}

.random-btn {
  flex-shrink: 0;
}

/* Emoji 触发器按钮 */
.emoji-trigger {
  justify-content: flex-start !important;
  padding: 6px 12px !important;
  gap: 12px !important;
  height: auto !important;
  border-radius: 10px !important;
  flex: 1;
}
.cur-emoji {
  font-size: 20px;
  line-height: 1;
}
.trig-text {
  color: var(--admin-muted);
  font-size: 13px;
}

/* Emoji 面板（Popover 内） */
.emoji-popover {
  padding: 10px;
}
.emoji-search {
  margin-bottom: 8px;
}
.emoji-empty {
  padding: 18px 0;
  text-align: center;
  color: var(--admin-muted);
  font-size: 13px;
}
.emoji-grid {
  display: grid;
  grid-template-columns: repeat(8, 1fr);
  gap: 4px;
  max-height: 240px;
  overflow-y: auto;
}
.emoji-cell {
  width: 100%;
  aspect-ratio: 1 / 1;
  border: 0;
  background: transparent;
  border-radius: 8px;
  font-size: 18px;
  cursor: pointer;
  transition: all .15s;
  overflow: hidden;
}
.emoji-cell:hover { background: var(--admin-peach); transform: scale(1.1); }
.emoji-cell.on {
  background: var(--admin-accent);
  box-shadow: 0 0 0 2px rgba(63, 185, 143, .25);
}
/* 滚动加载提示：横跨整行，闪烁小圆点 + 文案 */
.emoji-loading {
  grid-column: 1 / -1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 10px 0;
  color: var(--admin-muted);
  font-size: 12px;
}
.loading-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--admin-accent);
  animation: emoji-blink 1s ease-in-out infinite;
}
@keyframes emoji-blink {
  0%, 100% { opacity: .2; }
  50% { opacity: 1; }
}

/* 颜色点矩阵 */
.color-row {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  flex: 1;
}
.color-dot {
  width: 30px;
  height: 30px;
  border-radius: 50%;
  border: 3px solid transparent;
  cursor: pointer;
  transition: transform .15s, border-color .15s;
  padding: 0;
  flex-shrink: 0;
}
.color-dot:hover { transform: scale(1.12); }
.color-dot.on {
  border-color: var(--admin-text);
  transform: scale(1.08);
}
/* HEX 输入区 */
.color-field {
  display: flex;
  flex-direction: column;
  gap: 10px;
  width: 100%;
}
.hex-row {
  display: flex;
  align-items: center;
  gap: 8px;
}
.color-preview {
  width: 28px;
  height: 28px;
  border-radius: 8px;
  flex-shrink: 0;
  box-shadow: inset 0 0 0 1px var(--admin-shadow);
}
.hex-input {
  flex: 1;
  max-width: 220px;
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
}
.save-btn {
  background: linear-gradient(135deg, var(--admin-accent), var(--admin-accent-2)) !important;
  border: 0 !important;
  color: var(--admin-on-accent) !important;
}
</style>
