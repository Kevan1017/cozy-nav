/**
 * 路由配置
 * 前台 + 后台 + 鉴权守卫
 * 登录统一通过 TopBar 弹窗，不再有 /login 路由
 */
import { createRouter, createWebHistory } from 'vue-router';
import { useAuthStore } from '../stores/auth.js';

const routes = [
  {
    path: '/',
    name: 'Home',
    component: () => import('../views/front/Home.vue'),
  },
  {
    path: '/admin',
    component: () => import('../views/admin/Layout.vue'),
    meta: { requiresAuth: true },
    children: [
      {
        path: '',
        name: 'Dashboard',
        component: () => import('../views/admin/Dashboard.vue'),
      },
      {
        path: 'categories',
        name: 'CategoryManage',
        component: () => import('../views/admin/CategoryManage.vue'),
      },
      {
        path: 'links',
        name: 'LinkManage',
        component: () => import('../views/admin/LinkManage.vue'),
      },
      {
        path: 'engines',
        name: 'EngineManage',
        component: () => import('../views/admin/EngineManage.vue'),
      },
      {
        path: 'data',
        name: 'DataManage',
        component: () => import('../views/admin/DataManage.vue'),
      },
      {
        path: 'timeline',
        name: 'TimeMachine',
        component: () => import('../views/admin/TimeMachine.vue'),
      },
      {
        path: 'health',
        name: 'HealthMonitor',
        component: () => import('../views/admin/HealthMonitor.vue'),
      },
      {
        path: 'notify',
        name: 'NotifyCenter',
        component: () => import('../views/admin/NotifyCenter.vue'),
      },
      {
        path: 'logs',
        name: 'OperationLog',
        component: () => import('../views/admin/OperationLog.vue'),
      },
      {
        path: 'appearance',
        name: 'AppearanceManage',
        component: () => import('../views/admin/AppearanceManage.vue'),
      },
      {
        path: 'settings',
        name: 'Settings',
        component: () => import('../views/admin/Settings.vue'),
      },
    ],
  },
  {
    path: '/:pathMatch(.*)*',
    name: 'NotFound',
    component: () => import('../views/NotFound.vue'),
  },
];

const router = createRouter({
  history: createWebHistory(),
  routes,
});

/**
 * 解析 JWT payload 并判断是否过期（仅用于前端守卫，不做签名校验）
 * 过期 / 无法解析时视为已失效，返回 true
 */
function isTokenExpired(token) {
  try {
    const [, payloadB64] = token.split('.');
    const normalized = payloadB64.replace(/-/g, '+').replace(/_/g, '/');
    const payload = JSON.parse(decodeURIComponent(escape(atob(normalized))));
    // 无 exp 字段视为永久有效（兼容老 token）；exp 为秒级时间戳
    if (!payload.exp) return false;
    return Date.now() >= payload.exp * 1000;
  } catch {
    // 无法解析的 token 直接视为过期
    return true;
  }
}

// 鉴权守卫：未登录或 token 过期访问后台时返回首页 + 弹出登录框
router.beforeEach((to) => {
  const token = localStorage.getItem('token');
  const requiresAuth = to.matched.some((r) => r.meta.requiresAuth);

  if (requiresAuth) {
    // token 缺失或已过期 → 清掉本地登录态并弹登录框
    if (!token || isTokenExpired(token)) {
      localStorage.removeItem('token');
      localStorage.removeItem('username');
      const authStore = useAuthStore();
      authStore.token = '';
      authStore.username = '';
      authStore.openLoginModal();
      return { name: 'Home' };
    }
  }
});

export default router;
