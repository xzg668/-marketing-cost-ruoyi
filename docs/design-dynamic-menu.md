# 菜单/权限彻底动态化 · 设计文档

**版本**：v1.0
**日期**：2026-04-24
**状态**：待评审 / 待执行

---

## 1. 背景

当前系统存在"**菜单显示**"与"**接口权限**"双源问题，导致：

1. **菜单显示来自两处**：
   - 前端硬编码 `src/menu.js` 的 6 组业务菜单（数据接入 / 基础数据 / 价格源管理 / 成本核算 / 数据分析 / 结账）——所有账号看到的**一模一样**。
   - 后端 `/api/v1/auth/routers` 返回（由 `sys_role_menu` 决定）——当前只给 `bu_director / admin` 返回"系统管理"组，`bu_staff` 没有。
   - `Sidebar.vue` 把两者合并显示，但业务菜单部分**与角色无关**。

2. **后端 `sys_menu` 里配的那套结构跟前端命名对不上**（`cost-trial/base-data/rate/price` vs `ingest/base/price/cost/analysis/settlement`），且 `component` 字段指向不存在的 Vue 文件路径，导致 `toRoute` 过滤光动态路由，历史上 fallback 机制一直在救场。

3. **接口权限精确匹配失败**：`sys_menu.perms` 仅 38 条精确字符串，后端 controller `@PreAuthorize` 要求的 perm 有许多对不上号，`bu_director / bu_staff` 点菜单会 403（`admin` 因为是 `*:*:*` 通配符无此问题）。

## 2. 目标

- **单一事实源**：`sys_menu` 表成为菜单的**唯一事实源**，前端菜单完全由 `/auth/routers` 驱动。
- **与 RuoYi 标准架构对齐**：菜单结构、角色绑定、接口权限全部标准化，未来加菜单 = 一条 SQL。
- **UI 零扰动迁移**：整个迁移过程中，`admin / panxh / hfy` 三个账号看到的侧边栏**跟当前完全一致**，切换瞬间无感。
- **`admin / bu_director / bu_staff` 三个角色的菜单/权限明确落地**：
  - `admin`：全部菜单 + `*:*:*` 通配 perm
  - `bu_director`（panxh）：全部业务菜单 + 系统管理/用户管理 + `*:*:*` 通配 perm（符合"业务总监=全操作"的角色定义）
  - `bu_staff`（hfy）：全部业务菜单（不含系统管理）+ 逐条精确 perm

## 3. 方案选型

### 3.1 已淘汰的方案

| 方案 | 淘汰原因 |
|---|---|
| 保持现状 + 逐个补 perm | 业务菜单仍前端硬编码，未来加菜单要改前后端两处，漂移继续 |
| 前端加角色白名单 | 引入第三份配置，maintenance 成本更高 |
| 让后端 controller 改 `@PreAuthorize` 用 role 判断 | 打破 RuoYi perm 体系，偏离标准架构 |

### 3.2 选定方案：彻底动态化

**核心操作**：把前端 `src/menu.js` 的 6 组业务菜单按原结构**镜像**到后端 `sys_menu` 表，与前端 Vue 组件对齐；然后废除前端硬编码菜单，`Sidebar.vue` 切换到纯 `permissionStore.routes` 驱动。

### 3.3 保护策略（UI 零扰动）

**关键**：整个迁移期间 `Sidebar.vue` **保持现状不动**（"menu.js + 补系统管理"的逻辑），这样无论后端怎么改 `sys_menu`，UI 显示**一直不变**。只有在所有后端数据就绪、三账号 `/auth/routers` 验证通过后，才切换 `Sidebar.vue` 到动态驱动——切换前后 UI 字字一致，用户无感。

## 4. 架构设计

### 4.1 数据流（切换后）

```
┌───────────┐      ┌────────────────┐      ┌─────────────────┐
│ sys_menu  │      │ sys_role_menu  │      │  sys_user_role  │
│  (菜单源) │──┐   │  (角色↔菜单)    │──┐   │  (用户↔角色)     │
└───────────┘  │   └────────────────┘  │   └─────────────────┘
               └─────┬──────────────────┘
                     ↓
         GET /api/v1/auth/routers (按当前用户角色过滤)
                     ↓
               RouterVO 树 (JSON)
                     ↓
         permission.js: toRoute() → Vue Router addRoute()
                     ↓
         permissionStore.routes → Sidebar.vue 渲染
                     ↓
                用户看到的菜单
```

### 4.2 `sys_menu` 表字段约定

| 字段 | 用途 | 约定 |
|---|---|---|
| `menu_id` | 主键（自增） | 新菜单一律落在 **1000+** 段，与旧菜单 200/300/400/500 隔离，便于回滚 |
| `menu_name` | 显示名 | 跟前端 `menu.js` 的 `title` 字段一致 |
| `parent_id` | 父菜单 | 顶级 = 0 |
| `path` | 路由路径 | 顶级用绝对路径去掉 `/`（如 `ingest`），子菜单用相对路径（如 `oa-form`），Vue Router 自动拼接 |
| `component` | 前端组件 | 遵循"约定优先"：写 `ingest/oa-form/index` 前端自动找 `src/views/ingest/oa-form/index.vue` 或 `src/pages/ingest/oa-form/index.vue`；对于跨目录的历史组件，在 `permission.js` 的 `componentAliasMap` 中添加映射 |
| `menu_type` | 类型 | `M`=目录、`C`=菜单、`F`=按钮 |
| `perms` | 权限标识 | 目录/菜单类型暂可为 `null`；按钮类型精确字符串（跟 `@PreAuthorize` 对齐） |
| `visible` | 显隐 | `0`=显示、`1`=隐藏（用于纯权限载体菜单） |
| `icon` | 图标 | 可用 `element-plus icon name`，前端 `SidebarItem.vue` 按名查找 |
| `order_num` | 排序 | 跟前端 `menu.js` 中的出现顺序一致 |

### 4.3 菜单结构规划（镜像 `src/menu.js`）

共 **39 条菜单记录**（6 顶级目录 + 2 子目录 + 31 叶子）：

<details>
<summary>完整菜单树清单（点开查看）</summary>

```
1000 数据接入 (M, /ingest)
  1001 OA报价单 (C, /ingest/oa-form, component: ingest/oa-form/index)
  1002 U9 BOM明细 (C, /base/u9Bom, component: ingest/u9Bom/index)
  1003 电子图库BOM明细 (C, /base/eleDraw, component: ingest/eleDraw/index)
  1004 BOM明细录入 (C, /base/addbom, component: ingest/addbom/index)

1100 基础数据 (M, /base)
  1101 BOM 层级树查看 (C, /base/bomTree, alias→pages:BomTreeViewerPage)
  1102 BOM明细过滤规则 (C, /base/bomfilter, alias→pages:BomFilterRulePage)
  1103 BOM数据 (C, /base/material, alias→pages:BomManagePage)
  1104 物料价格类型对照表 (C, /base/map, component: base/map/index)
  1105 部门经费率对照表 (C, /base/fixed, component: base/fixed/index)
  1150 辅料管理 (M, /base/aux)
    1151 辅料价格表 (C, /base/aux/subject, component: base/aux/subject/index)
    1152 辅料上浮比率表 (C, /base/aux/item, component: base/aux/item/index)
  1106 物料表 (C, /base/materweight, component: base/materweight/index)
  1107 工资表 (C, /base/salary, component: base/salary/index)
  1108 质量损失率对照表 (C, /base/quantityLoss, component: base/quantityLoss/index)
  1109 制造费用率对照表 (C, /base/manufactureRate, component: base/manufactureRate/index)
  1110 三项费用费率对照表 (C, /base/threeExpenseRate, component: base/threeExpenseRate/index)
  1111 产品属性对照表 (C, /base/productProperty, component: base/productProperty/index)
  1112 其他费用率对照表 (C, /base/other, component: base/other/index)

1200 价格源管理 (M, /price)
  1250 联动价 (M, /price/linked)
    1251 联动价格表 (C, /price/linked/result, component: price/linked/result/index)
    1252 联动价计算 (C, /price/linked/oa-result, component: price/linked/oa-result/index)
    1253 影响因素表 (C, /price/linked/finance-base, alias→pages:PriceLinkedFinanceBasePage)
    1254 价格变量配置 (C, /price/linked/variables, alias→pages:PriceVariableAdminPage)
  1201 区间价 (C, /price/range, component: price/range/index)
  1202 结算价 (C, /price/settle, component: price/settle/index)
  1203 固定价 (C, /price/fixed, component: price/fixed/index)
  1204 委外结算价表 (C, /price/outsource_settle, component: price/outsource_settle/index)
  1205 委外固定价表 (C, /price/outsource_fixed, component: price/outsource_fixed/index)

1300 成本核算 (M, /cost)
  1301 实时成本计算 (C, /cost/run, alias→pages:CostRunPage)
  1302 已核算成本明细 (C, /cost/run/completed, alias→pages:CostRunPage)

1400 数据分析 (M, /analysis)
  1401 成本分析 (C, /analysis/cost, component: analysis/cost/index)
  1402 报表 (C, /analysis/report, component: analysis/report/index)

1500 结账 (M, /settlement)
  1501 月度调价 (C, /settlement/monthly-adjustment, component: settlement/monthly-adjustment/index)
```

注：RuoYi 返回 `path` 时，顶级为相对（如 `ingest`），子级也是相对（如 `oa-form`）。完整 URL 由 Vue Router 自动拼接成 `/ingest/oa-form`。

注：标注 `alias→pages:XxxPage` 的项，需要在 `permission.js` 的 `componentAliasMap` 中保留/添加对应条目（大部分已在）。

</details>

### 4.4 角色绑定规划

| 角色 | roleId | 菜单绑定 | Perm 通配 |
|---|---|---|---|
| `admin` | 1 | 全部新菜单 + 原"系统管理"(100/101) | `*:*:*`（已有） |
| `bu_director` | 10 | 全部新业务菜单(1000-1599) + 原"系统管理 → 用户管理"(100/101) | **新增 `*:*:*`**（按钮型菜单，menu_id 待分配） |
| `bu_staff` | 11 | 全部新业务菜单(1000-1599)，**不含系统管理** | 逐个精确 perm（阶段 D，本方案先不处理） |
| `oa_collaborator` | 12 | 不变（保留现状） | 不变 |

### 4.5 前端改动

| 文件 | 改动类型 | 说明 |
|---|---|---|
| `src/layout/components/Sidebar.vue` | **改** | `displayRoutes` 改为 `computed(() => permissionStore.routes)`，删除 menu.js 和系统管理补丁逻辑 |
| `src/router/index.js` | **改** | 删除 `routeComponentMap`、`childRoutes` 生成、`import menuGroups`，保留公共路由（`/login`、`/404`、`/collaborate`）和带参数的详情路由（`/cost/run/:oaNo` 等） |
| `src/menu.js` | **删** | 不再使用 |
| `src/layout/utils/menuAdapter.js` | **删** | 不再使用 |
| `src/store/modules/permission.js` | **保持** | 已在前次改动修好（扫 views+pages、aliasMap、`tree.map(n=>toRoute(n))` bug、叶子兜底 Placeholder） |

### 4.6 登录后默认跳转

原逻辑：静态路由 `/` redirect 到 `/cost/run`。

新逻辑：`router.beforeEach` 里，当 `to.path === '/'` 时重定向到 `permissionStore.routes[0]` 的第一个叶子路径（动态计算）。

## 5. 回滚方案

**阶段 A-C 若任一步失败**：
- 后端：`DELETE /api/v1/system/menu/{menuId}` 批量删除 menuId 1000+ 段新建的菜单；`PUT /api/v1/system/role/{id}/menus` 还原角色绑定为快照保存的列表。
- 前端：`git revert` 相应 commit。

**每阶段开始前**：
- Snapshot：读 `/api/v1/system/menu` 和每个角色的 `/menus` 保存到 `docs/rollback-snapshot-<阶段>.json`。

## 6. 风险评估

| 风险 | 可能性 | 缓解 |
|---|---|---|
| 后端批量写入中途失败，菜单树半完整 | 低 | 独立 menuId 段；失败即回滚（删 1000+ 段） |
| 切换 `Sidebar.vue` 后 UI 变化 | 低 | 阶段 A 完成后用三账号验证 `/auth/routers` 结构跟 menu.js 完全一致；不一致不切换 |
| 部分 component 路径前端找不到对应文件 | 中 | `permission.js` 叶子加载失败会用 `PlaceholderPage` 兜底 + 控制台 warn；补 `componentAliasMap` 即可 |
| 业务代码里硬编码的 URL 跳转失效 | 低 | 保留静态 staticRoutes 里的详情路由（带参数那些） |
| 未考虑的隐藏菜单点不通 | 低 | 阶段 D 的 perm 对齐单独处理；短期 bu_director 通配兜底 |

## 7. 验收标准

**迁移完成后**，下列全部通过才算完成：

- [ ] `admin / panxh / hfy` 三账号登录，侧边栏**字字一致**（截图对比，跟迁移前一样）
- [ ] `admin / panxh` 点所有菜单无 403
- [ ] `hfy` 点菜单大部分不 403（少数需阶段 D 补 perm，允许）
- [ ] 前端已删 `menu.js` 和 `menuAdapter.js`，`Sidebar.vue` 无 `menuGroups` 引用
- [ ] `permissionStore.routes.length > 0` 且跟 menu.js 结构一致
- [ ] 业务代码里 `router.push('/ingest/oa-form/123')` 这类硬编码跳转仍正常
- [ ] 刷新页面后菜单不闪烁、不丢失
- [ ] `git log` 上所有 commit 可以清晰回滚到任一前置状态

## 8. 未来加菜单 SOP

**加一个菜单的步骤**（迁移完成后）：

1. 前端：在 `src/views/<group>/<page>/index.vue` 写组件（如果走约定路径）
2. 后端：
   ```sql
   INSERT INTO sys_menu (menu_name, parent_id, path, component, menu_type, perms, visible, status, icon, order_num)
   VALUES ('新菜单名', <parent_id>, '<path>', '<group>/<page>/index', 'C', '<perm>', '0', '0', 'icon', <order>);
   INSERT INTO sys_role_menu (role_id, menu_id) VALUES (<role_id>, <新插入的 menu_id>);
   ```
3. 用户重新登录即可看到新菜单。

**这就是"基础打牢"的回报**——新需求只改后端数据，前端零修改。

---

## 附录 A：配套任务文档

见 [`tasks-dynamic-menu.md`](./tasks-dynamic-menu.md)。按阶段 A→B→C→D 顺序执行，每个任务有明确的**前置条件、执行步骤、测试步骤、完成标准、回滚步骤**。

## 附录 B：前端 `componentAliasMap` 当前条目

位于 `src/store/modules/permission.js`。迁移后主要保留指向 `src/pages/` 的条目，因为这些组件在 `src/pages/` 下而非 `src/views/`：

- `pages:OaFormListPage`、`pages:CostRunPage`、`pages:CostRunResultPage`、`pages:CostRunDetailPage`
- `pages:BomManagePage`、`pages:BomFilterRulePage`、`pages:BomTreeViewerPage`、`pages:BomManualImportPage`、`pages:U9BomPage`
- `pages:PriceLinkedFinanceBasePage`、`pages:PriceVariableAdminPage`、`pages:PriceLinkedResultPage`、`pages:PriceLinkedOaResultPage`
- 其他 views 下已存在的路径无需别名
