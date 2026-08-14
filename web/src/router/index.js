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

// 鉴权守卫：未登录访问后台时返回首页 + 弹出登录框
router.beforeEach((to) => {
  const token = localStorage.getItem('token');
  const requiresAuth = to.matched.some((r) => r.meta.requiresAuth);

  if (requiresAuth && !token) {
    const authStore = useAuthStore();
    authStore.openLoginModal();
    return { name: 'Home' };
  }
});

export default router;
